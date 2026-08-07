// 콜라보 분석 리포트 생성 엔진 — DNA 생성·리포트 생성·채점 선발·mock.
// 순수 라이브러리(요청·인증·캐시 오케스트레이션은 /api/collab-report가 담당).
// GEMINI_API_KEY 없으면 mock 반환 — 로컬 UI 개발·빌드가 키 없이 돌아간다.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md
// 플랜: docs/superpowers/plans/2026-07-25-collab-report-dna.md Task 6

import { createHash } from "node:crypto";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import {
  DNA_SYSTEM,
  REPORT_SYSTEM,
  NOVEL_SEEDS,
  NOVEL_GEN_SYSTEM,
  NOVEL_JUDGE_SYSTEM,
} from "./collab-report-prompts";
import {
  DNA_POOL,
  LIGHT_METHODS,
  HEAVY_METHODS,
  filterPoolValid,
  filterSignatures,
  distinctTypeCount,
  THIN_MIN_TYPES,
  MIN_MATCH_SCORE,
  DNA_REFRESH_BEFORE,
} from "./dna-pool";
import type { Block, BrandDna, CollabReportData, DnaItem, DnaSignature, Maker, NovelIdea } from "./types";
import { kstIso } from "./time";
import { meter, logMeter, type CallMeter } from "./ai-cost";

// 리포트 모델: 대표 블라인드 A/B(07-26)에서 3.6-flash가 2.5-flash·3.1-pro를 모두 이김.
// 리포트 호출에는 샘플링 파라미터를 넘기지 않는다(3.x 계열 temperature 지원 중단 공지 대응).
// ⚠️ 단 **실측(07-27)으로는 3.6-flash가 temperature를 400으로 거부하지 않는다** — 0.4·1.0·1.4 모두 통과했고
//    1.4에서 출력 변동성도 늘었다(반영되는 것으로 보임). 즉 "3.x라 temperature를 못 쓴다"를 전제로
//    다른 단계(enrich 생성 등)의 모델 교체를 포기할 근거는 없다. 넘겨도 죽지 않는다.
export const REPORT_MODEL = () => process.env.REPORT_MODEL || "gemini-3.6-flash";
const DNA_MODEL = "gemini-2.5-flash"; // DNA는 flash 고정(스펙) — 2.5 계열이라 temperature 유지
const ai = () => new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
const hasKey = () => !!process.env.GEMINI_API_KEY;

// ── 소개서 직렬화 ──────────────────────────────────────────────

/** 선택 블록의 텍스트 필드만 추출(사진·링크 제외) — DNA evidence 인용 대상이 되는 원문. */
function blockText(b: Block): string {
  switch (b.type) {
    case "metrics":
      return b.items.map((it) => `${it.label}: ${it.value}`).join("\n");
    case "reviews":
      return b.items.map((it) => `"${it.quote}"${it.source ? ` — ${it.source}` : ""}`).join("\n");
    case "team":
      return b.intro;
    case "press":
      return b.items
        .map((it) => [it.title, it.year, it.desc].filter(Boolean).join(" · "))
        .join("\n");
    case "space":
      return [b.desc, b.features.join(", ")].filter(Boolean).join("\n");
    case "custom":
      return [b.title, b.body].filter(Boolean).join("\n");
  }
}

/** 소개서를 [필드명] 라벨 블록 텍스트로 직렬화.
 *  라벨 = 실제 DB 컬럼명 — DNA_SYSTEM이 이 라벨을 source로 출력하고,
 *  filterPoolValid가 fields(=input_fields)를 화이트리스트로 검증한다.
 *  비어있지 않은 필드만 블록으로 넣는다(없는 라벨을 source로 대면 탈락). */
export function brandDigest(m: Maker): { text: string; fields: string[] } {
  const blocks: { label: string; body: string }[] = [];
  const push = (label: string, body: string | undefined) => {
    const t = (body ?? "").trim();
    if (t) blocks.push({ label, body: t });
  };

  push("one_liner", m.oneLiner);
  push("description", m.description);
  push("story", m.story);
  push("keywords", m.keywords.join(", "));
  push("offers", m.offers.join(", "));
  push("seeks", m.seeks.join(", "));
  push("offers_description", m.offersDescription);
  push("seeks_description", m.seeksDescription);
  push("target_audience", m.targetAudience.join(", "));
  push(
    "activities",
    m.activities
      .map((a) => [a.title, a.desc].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("\n")
  );
  push(
    "collab_history",
    m.collabHistory
      .map((h) => {
        const head = h.types.length > 0 ? `${h.partner} (${h.types.join("·")})` : h.partner;
        return h.desc ? `${head}: ${h.desc}` : head;
      })
      .filter(Boolean)
      .join("\n")
  );
  push("showcases", m.showcases.map(blockText).filter((t) => t.trim()).join("\n"));
  push(
    "enrichment",
    (m.enrichment?.chips ?? []).map((c) => `${c.text}(${c.section})`).join(", ")
  );

  return {
    text: blocks.map((b) => `[${b.label}]\n${b.body}`).join("\n\n"),
    fields: blocks.map((b) => b.label),
  };
}

/** DNA를 리포트 입력용 텍스트로 — summary + ⭐이 브랜드만의 것 + `value(type) — evidence` 줄들.
 *  signature를 Pool 항목보다 **먼저** 놓는다: Pool 어휘는 브랜드끼리 겹치라고 만든 축이라 그것만 보면
 *  희소성 점수(rarity)가 안 나온다. 리포트가 제일 먼저 봐야 하는 재료가 '이 브랜드만의 것'이다. */
function dnaText(dna: BrandDna): string {
  const sig = (dna.signature ?? []).map((s) => `· ${s.text} (근거: "${s.evidence}")`);
  return [
    dna.summary,
    ...(sig.length ? ["[이 브랜드만의 것]", ...sig] : []),
    ...dna.items.map((it) => `${it.value}(${it.type}) — ${it.evidence}`),
  ]
    .filter(Boolean)
    .join("\n");
}

// ── Gemini responseSchema (⚠️ additionalProperties 미지원 — 쓰지 말 것) ──

const DNA_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "브랜드 한 문장 요약(40~80자)" },
    items: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "Pool의 type 키" },
          value: { type: Type.STRING, description: "Pool 어휘만" },
          evidence: { type: Type.STRING, description: "소개서 실제 문구 인용(10~30자)" },
          source: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "근거가 된 입력 [필드명] 라벨들",
          },
        },
        required: ["type", "value", "evidence", "source"],
      },
    },
    signature: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "이 브랜드에만 해당하는 특징 한 조각(15~40자)" },
          evidence: { type: Type.STRING, description: "소개서 실제 문구 인용(10~30자)" },
          source: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "근거가 된 입력 [필드명] 라벨들",
          },
        },
        required: ["text", "evidence", "source"],
      },
      description: "이 브랜드만의 것 0~3개(없으면 빈 배열)",
    },
  },
  required: ["summary", "items", "signature"],
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          text: { type: Type.STRING, description: "접점 한 문장" },
          rarity: { type: Type.NUMBER },
          specificity: { type: Type.NUMBER },
          actionability: { type: Type.NUMBER },
          mutuality: { type: Type.NUMBER },
        },
        required: ["text", "rarity", "specificity", "actionability", "mutuality"],
      },
      description: "접점 후보 6~8개 + 자기 채점(선발은 시스템이)",
    },
    ideas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "15자 내외" },
          desc: { type: Type.STRING, description: "1~2줄" },
          method: { type: Type.STRING, description: "Collab Method Pool 어휘 하나" },
        },
        required: ["title", "desc", "method"],
      },
      description: "추천 아이디어 1~3개",
    },
    steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "실행 플랜 최대 4단계" },
    effects: { type: Type.ARRAY, items: { type: Type.STRING }, description: "기대 효과 2~3개" },
  },
  required: ["candidates", "ideas", "steps", "effects"],
};

// 기발 아이디어(B36) — 생성/심사 2종. 스펙 = 2026-08-06-novel-collab-ideas-design.md
const NOVEL_GEN_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    ideas: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "15자 내외" },
          desc: { type: Type.STRING, description: "'~하는 콜라보'로 끝나는 명사구" },
          method: { type: Type.STRING, description: "Collab Method Pool 어휘 하나" },
          gain_a: { type: Type.STRING, description: "A에게 벌어지는 일 한 줄" },
          gain_b: { type: Type.STRING, description: "B에게 벌어지는 일 한 줄" },
        },
        required: ["title", "desc", "method", "gain_a", "gain_b"],
      },
      description: "기발한 후보 8개",
    },
  },
  required: ["ideas"],
};

const NOVEL_JUDGE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    judged: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "심사한 후보의 title 그대로" },
          verdict: { type: Type.STRING, description: "통과 또는 탈락" },
          reason: { type: Type.STRING },
          exchange: { type: Type.NUMBER },
          unexpected: { type: Type.NUMBER },
          light: { type: Type.NUMBER },
          viral: { type: Type.NUMBER },
          risk: { type: Type.STRING },
          overlap: { type: Type.BOOLEAN },
          overlap_with: { type: Type.STRING },
          overlap_reason: { type: Type.STRING },
          family: { type: Type.STRING, description: "만드는 결과물 계열" },
          motif: { type: Type.STRING, description: "핵심 장치" },
        },
        required: ["title", "verdict", "exchange", "unexpected", "light", "viral", "overlap", "family", "motif"],
      },
    },
  },
  required: ["judged"],
};

/** 기발 후보 심사 결과 — 선발 로직이 쓰는 중간 형태(밖으로 나가지 않는다). */
interface JudgedNovel {
  title: string;
  verdict: string;
  exchange: number; unexpected: number; light: number; viral: number;
  total: number;
  overlap: boolean;
  family: string;
  motif: string;
}

/** 게이트·겹침 통과분에서 최종 2개를 고른다.
 *  ⭐1위는 최고점, 2위는 **계열(family)과 모티프(motif)가 둘 다 1위와 다른 것** 중 최고점.
 *  화면에 나란히 붙는 두 줄이 둘 다 부적이면 "또 부적?"이 되므로 점수 순 채택보다 이 규칙이 먼저다(대표 확정 08-06).
 *  ⚠️단 이 제약은 **기발 2개 내부에만** 건다 — 기존 ideas와 모티프가 겹치는 건 허용이다(행위만 다르면). */
function selectNovel(judged: JudgedNovel[], byTitle: Map<string, NovelIdea>): NovelIdea[] {
  const pool = judged
    .filter((j) => j.verdict !== "탈락" && !j.overlap)
    .sort((x, y) => y.total - x.total);
  const first = pool[0];
  if (!first) return [];
  const norm = (s: string) => s.trim().toLowerCase();
  const second = pool
    .slice(1)
    .find((j) => norm(j.family) !== norm(first.family) && norm(j.motif) !== norm(first.motif));
  return [first, second]
    .filter((j): j is JudgedNovel => !!j)
    .map((j) => byTitle.get(j.title))
    .filter((i): i is NovelIdea => !!i);
}

/** 기발 후보 16개 생성(관점 2 × 8, 콜 2개 병렬) — ⭐**리포트 콜과 동시에 시작한다**(입력이 같아 기다릴 이유가 없다).
 *  ⏱실측(08-07, 캔가×두더지): 리포트 16.4s / 생성 17.6s / 심사 22.1s = 직렬 56s.
 *    생성을 리포트와 병렬로 돌리면 생성 몫은 +1~2s로 줄어든다(느린 쪽 차액만 남음).
 *  실패는 빈 배열 — 이 섹션은 부가 가치이지 리포트의 필수 조각이 아니다. */
async function generateNovelCandidates(
  brandsText: string,
  model: string,
  meters?: CallMeter[]
): Promise<NovelIdea[]> {
  try {
    // ⚡생성도 사고 low(08-07 A/B) — 기본은 15.4~26.5s로 널뛰었는데 low는 8.1~8.3s 고정.
    //   심사 점수(=품질 계량기)가 동급이었다: 기본 상위 33~35점대 / low 33·33·33·32·31.
    //   16개를 뿌리고 심사가 거르는 구조라 생성의 긴 사고가 품질을 안 올리고 있었다.
    //   `NOVEL_GEN_THINKING=1`로 복구. 400 거부 시 옵션 없이 재시도(심사와 동일 패턴).
    const lowThinking = process.env.NOVEL_GEN_THINKING !== "1";
    const gens = await Promise.all(
      NOVEL_SEEDS.map(async (seed) => {
        const t = Date.now();
        const call = (withLevel: boolean) =>
          ai().models.generateContent({
            model,
            contents: brandsText,
            config: {
              systemInstruction: NOVEL_GEN_SYSTEM(seed),
              responseMimeType: "application/json",
              responseSchema: NOVEL_GEN_SCHEMA,
              ...(withLevel && lowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
            },
          });
        let r;
        try {
          r = await call(true);
        } catch (e) {
          const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
          if (!lowThinking || status !== 400) throw e;
          console.warn(`[novel] ${model} 생성 thinkingLevel=low 거부(400) → 옵션 없이 재시도`);
          r = await call(false);
        }
        const m = meter("novel-gen", model, Date.now() - t, r.usageMetadata);
        logMeter(m);
        meters?.push(m);
        return JSON.parse(r.text ?? "{}") as { ideas?: Record<string, unknown>[] };
      })
    );
    const cands: NovelIdea[] = gens
      .flatMap((g) => g.ideas ?? [])
      .map((i) => {
        const method = String(i.method ?? "");
        return {
          title: String(i.title ?? ""),
          desc: String(i.desc ?? ""),
          // Pool 밖 어휘는 빈 문자열로 — 아이디어는 살리고 UI가 태그만 생략한다(기존 ideas와 같은 처리)
          method: DNA_POOL.collabMethod.includes(method) ? method : "",
          gainA: String(i.gain_a ?? ""),
          gainB: String(i.gain_b ?? ""),
        };
      })
      .filter((i) => i.title && i.desc);
    return cands;
  } catch (e) {
    console.error("[novel] 기발 후보 생성 실패", e);
    return [];
  }
}

/** 심사 1콜 → 최종 2개. 겹침 판정에 기존 ideas가 필요해서 **리포트 뒤에만** 올 수 있다.
 *  ⚡사고 low가 기본(08-07) — 심사가 22.1s로 파이프라인 최대 병목이었고 사고 토큰이 리포트의 1.5배였다.
 *    채점·분류는 창작이 아니라 판정이라 DNA 사고 끄기(07-26, 4.7배 빠르고 품질 유지)와 같은 계열.
 *    `NOVEL_JUDGE_THINKING=1`로 복구 가능.
 *  ⚠️3.6-flash는 thinkingBudget:0을 400으로 거부한다(07-26 실측) — 대신 thinkingLevel:'low'.
 *    모델 오버라이드로 다른 세대가 들어와 400이 나면 옵션 없이 1회 재시도(DNA와 동일 패턴). */
async function judgeNovelIdeas(
  brandsText: string,
  baseIdeas: { title: string; desc: string }[],
  cands: NovelIdea[],
  model: string,
  meters?: CallMeter[]
): Promise<NovelIdea[]> {
  if (cands.length === 0) return [];
  try {
    const t2 = Date.now();
    const lowThinking = process.env.NOVEL_JUDGE_THINKING !== "1";
    const call = (withLevel: boolean) =>
      ai().models.generateContent({
        model,
        contents: [
          brandsText,
          "",
          "[기존 아이디어]",
          baseIdeas.map((i, n) => `${n + 1}. ${i.title} — ${i.desc}`).join("\n"),
          "",
          "[심사할 기발 후보]",
          cands.map((i, n) => `${n + 1}. ${i.title} — ${i.desc}`).join("\n"),
        ].join("\n"),
        config: {
          systemInstruction: NOVEL_JUDGE_SYSTEM,
          responseMimeType: "application/json",
          responseSchema: NOVEL_JUDGE_SCHEMA,
          ...(withLevel && lowThinking ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } } : {}),
        },
      });
    let judgeRes;
    try {
      judgeRes = await call(true);
    } catch (e) {
      const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
      if (!lowThinking || status !== 400) throw e;
      console.warn(`[novel] ${model} thinkingLevel=low 거부(400) → 옵션 없이 재시도`);
      judgeRes = await call(false);
    }
    const jm = meter("novel-judge", model, Date.now() - t2, judgeRes.usageMetadata);
    logMeter(jm);
    meters?.push(jm);

    const parsed = JSON.parse(judgeRes.text ?? "{}") as { judged?: Record<string, unknown>[] };
    const judged: JudgedNovel[] = (parsed.judged ?? []).map((j) => {
      const exchange = Number(j.exchange) || 0;
      const unexpected = Number(j.unexpected) || 0;
      const light = Number(j.light) || 0;
      const viral = Number(j.viral) || 0;
      return {
        title: String(j.title ?? ""),
        verdict: String(j.verdict ?? ""),
        exchange, unexpected, light, viral,
        total: exchange + unexpected + light + viral,
        overlap: j.overlap === true,
        family: String(j.family ?? ""),
        motif: String(j.motif ?? ""),
      };
    });

    const byTitle = new Map(cands.map((c) => [c.title, c]));
    return selectNovel(judged, byTitle);
  } catch (e) {
    // 리포트는 살린다 — 기발 섹션만 비운다
    console.error("[novel] 기발 심사 실패", e);
    return [];
  }
}

// ── DNA 생성 ──────────────────────────────────────────────────

/** 키 없는 로컬용 mock DNA — 실제 스키마와 동일 형태(캔버스가든 소재). thin 아님(type 6종). */
function mockDna(m: Maker): BrandDna {
  const { fields } = brandDigest(m);
  const nowIso = kstIso();
  return {
    summary: (m.oneLiner || m.name).slice(0, 80),
    items: [
      { type: "philosophy", value: "지속가능성", evidence: "버려지는 천에 새 이야기를 입히는", source: ["description"] },
      { type: "production", value: "핸드메이드", evidence: "패브릭으로 짓는 친환경 가방", source: ["one_liner"] },
      { type: "experience", value: "클래스", evidence: "소품을 만드는 2시간 클래스", source: ["activities"] },
      { type: "space", value: "공방", evidence: "성수동 작업실 겸 쇼룸", source: ["showcases"] },
      { type: "audienceAsset", value: "수강생 풀", evidence: "워크숍 누적 수강생 640명", source: ["showcases"] },
      { type: "mood", value: "따뜻함", evidence: "느슨하고 길게 협업하고 싶어요", source: ["seeks_description"] },
    ],
    signature: [
      { text: "버려지는 헌 옷 천을 이어 붙여 소품을 만드는 공방", evidence: "버려지는 천에 새 이야기를 입히는", source: ["description"] },
    ],
    input_fields: fields,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/** Brand DNA 생성(flash 고정·중립 — 비교 상대 무관 재사용 자산).
 *  prev = 갱신 재생성 시 기존 DNA — created_at을 보존한다(최초 생성 시각). */
export async function generateDna(m: Maker, prev?: BrandDna, meters?: CallMeter[]): Promise<BrandDna> {
  const digest = brandDigest(m);
  if (!hasKey()) {
    const mock = mockDna(m);
    return prev ? { ...mock, created_at: prev.created_at } : mock;
  }
  const poolText = Object.entries(DNA_POOL)
    .map(([t, vs]) => `${t}: ${vs.join(", ")}`)
    .join("\n");
  const t0 = Date.now();
  // ⚡DNA는 사고를 끈다(기본) — DNA는 창작이 아니라 '소개서에서 Pool 어휘 뽑기'라 사고가 거의 불필요.
  // A/B 실측(07-26): 사고 켬 29.6s/23.7원 → 끔 6.3s/6.3원. **4.7배 빠르고 3.8배 싸다.**
  // 품질 저하 없음 — evidence 원문 일치 33/33 유지, 서로 다른 type 13→11(thin 하한 4 대비 여유).
  // 항목 수가 조금 줄지만 근거 있는 것만 남는 쪽이라 사실게이트 취지에 부합.
  // enrich 검색 단계 thinkingBudget:0과 같은 계열의 판단. `DNA_THINKING=1`로 복구 가능.
  const budget = process.env.DNA_THINKING === "1" ? undefined : (process.env.DNA_THINKING_BUDGET ?? "0");
  const call = (withBudget: boolean) =>
    ai().models.generateContent({
      model: DNA_MODEL,
      contents: `[Pool]\n${poolText}\n\n[소개서]\n${digest.text}`,
      config: {
        systemInstruction: DNA_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: DNA_SCHEMA,
        temperature: 0.2,
        ...(withBudget && budget !== undefined ? { thinkingConfig: { thinkingBudget: Number(budget) } } : {}),
      },
    });
  // ⚠️ thinkingBudget 수용 범위는 모델 세대마다 다르다 — 실측(07-26): 2.5-flash는 0 허용,
  //    3.6-flash는 0을 400으로 거부(대신 thinkingLevel:'low'). DNA_MODEL을 3.x로 바꾸는 순간
  //    DNA가 통째로 죽으므로, 400이면 옵션 없이 1회 재시도한다(enrich 검색단계와 동일 패턴).
  let res;
  try {
    res = await call(true);
  } catch (e) {
    const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
    if (budget === undefined || status !== 400) throw e;
    console.warn(`[collab-report] ${DNA_MODEL} thinkingBudget=${budget} 거부(400) → 옵션 없이 재시도`);
    res = await call(false);
  }
  const dnaMeter = meter(`dna(${m.slug})`, DNA_MODEL, Date.now() - t0, res.usageMetadata);
  logMeter(dnaMeter);
  meters?.push(dnaMeter);
  const parsed = JSON.parse(res.text ?? "{}") as {
    summary?: unknown;
    items?: DnaItem[];
    signature?: DnaSignature[];
  };
  // 화이트리스트 서버 검증(사실 게이트 ②) — Pool 밖 어휘·근거 없음·입력에 없던 source 탈락
  const items = filterPoolValid(parsed.items ?? [], digest.fields);
  // signature는 Pool 밖 자유 서술이라 화이트리스트를 못 쓴다 → 인용문이 소개서에 실제로 있는지 원문 대조
  const signature = filterSignatures(parsed.signature ?? [], digest.fields, digest.text);
  // ⚠️ 시각은 반드시 모델 호출 '이후'에 찍는다. 호출 전에 찍으면 10~20초 과거가 기록돼
  //    직후 DB 쓰기가 발화시키는 brands.updated_at 트리거보다 뒤처진다(구 stale 로직의 무한 재생성 원인).
  const nowIso = kstIso();
  return {
    summary: String(parsed.summary ?? "").slice(0, 80),
    items,
    signature,
    input_fields: digest.fields,
    input_hash: hashText(digest.text),
    created_at: prev?.created_at ?? nowIso,
    updated_at: nowIso,
  };
}

// ── 판정 헬퍼 ─────────────────────────────────────────────────

/** DNA 입력(소개서 다이제스트)의 지문. stale 판정 기준 — 시각이 아니라 '내용이 바뀌었나'로 본다.
 *  공백·줄바꿈은 지문 전에 정규화 — 눈에 안 보이는 수정(뒤 공백, 줄바꿈 수)으로 재생성되지 않게(대표 07-26). */
const hashText = (s: string) =>
  createHash("sha1").update(s.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);
export const digestHash = (m: Maker) => hashText(brandDigest(m).text);

/** thin 가드 — 서로 다른 type 수 미달(raw pick 수 아님: mood만 4개여도 thin). */
export const isThin = (dna: BrandDna) => distinctTypeCount(dna.items) < THIN_MIN_TYPES;

/** stale 판정 — ①DNA 없음 ②Pool 대개정 이전 생성분(DNA_REFRESH_BEFORE) ③소개서 내용이 바뀜.
 *
 *  ③은 **시각 비교가 아니라 내용 지문(input_hash) 비교**다. 시각 비교를 쓰면 안 되는 이유:
 *  setBrandDna의 update가 brands의 updated_at 트리거를 발화시켜 brands.updated_at이 항상
 *  dna.updated_at보다 뒤가 된다 → 모든 DNA가 영구 stale → 매 요청 재생성 → 리포트 캐시도 영구 미스.
 *  (2026-07-26 실측 원인. 허용 오차 상수로 막으려 했으나 DNA 생성이 10~20초라 오차를 넘겼다.)
 *  지문 비교는 클럭 스큐·트리거·대량 마이그레이션(전 행 updated_at 갱신)에도 흔들리지 않는다. */
export function isDnaStale(dna: BrandDna | null, brand?: Maker): boolean {
  if (!dna) return true;
  const dnaTime = Date.parse(dna.updated_at);
  if (!Number.isFinite(dnaTime)) return true;
  if (dnaTime < Date.parse(DNA_REFRESH_BEFORE)) return true;
  if (brand) {
    if (!dna.input_hash) return true;                       // 지문 없는 구버전 → 1회 재생성 후 안정화
    if (dna.input_hash !== digestHash(brand)) return true;   // 소개서 내용이 실제로 바뀜
  }
  return false;
}

// ── 리포트 생성 ────────────────────────────────────────────────

export interface ReportCandidate {
  text: string;
  rarity: number;
  specificity: number;
  actionability: number;
  mutuality: number;
}

/** collabMethod 강도 라벨 — LIGHT=가벼움, HEAVY=무거움, 나머지=중간(작게 시작 추천 근거). */
function methodIntensity(method: string): string {
  if (LIGHT_METHODS.includes(method)) return "가벼움";
  if (HEAVY_METHODS.includes(method)) return "무거움";
  return "중간";
}

// ⚠️ (은퇴 2026-08-01) oneLiner — 리포트 최상단 한줄 요약을 폐지했다(대표 확정).
//    한줄은 결국 ideas[0]의 축약이라, 아이디어의 신선함이 가시면 정보가 0인 중복으로 남았다.
//    실쌍 11개·10라운드 문형 개편 끝의 결론이므로 "더 나은 문형"으로 되살리지 말 것.
//    함께 은퇴: checkOneLiner/resolveOneLiner/ONELINER_MAX(문형 파서 게이트),
//    scripts/test-oneliner-shape.ts, scripts/x-oneliner-ab.ts.
//    리포트의 얼굴은 이제 ③ 추천 콜라보 아이디어다(ReportSheet 첫 섹션).

/** 키 없는 로컬용 mock 리포트 — 캔버스가든×호락호락 도서관 소재, 5조각 전부(⑥ CTA는 UI 고정). */
const MOCK_REPORT: CollabReportData = {
  matchPoints: [
    { text: "조각 워크숍과 느린 책방 무드는 '천천히 손으로 몰입하는 시간'이라는 같은 경험을 서로 다른 재료로 만들고 있어요." },
    { text: "책방을 찾는 아이와 부모에게 천 조각 소품 만들기는 책 읽기 다음의 자연스러운 활동이 돼요." },
    { text: "폐원단으로 만드는 북커버는 책방의 물성과 지속가능성 철학이 겹치는 지점이에요." },
  ],
  ideas: [
    {
      title: "그림책 북커버 워크숍",
      desc: "책방 한켠에서 폐원단으로 나만의 북커버를 만드는 2시간 클래스를 열어요. 완성한 커버에 좋아하는 그림책을 끼워 가요.",
      method: "협동 워크숍",
    },
    {
      title: "밑줄 문장 책갈피",
      desc: "책방이 고른 문장을 자투리 천에 새겨 작은 책갈피 굿즈로 만들어요.",
      method: "굿즈",
    },
  ],
  // 기발 섹션 mock — 계열·모티프가 서로 다른 2개(선발 규칙이 만드는 모양 그대로)
  novelIdeas: [
    {
      title: "반납 못 한 책 부적",
      desc: "오래 반납되지 않은 책 목록을 받아 그 책이 돌아오길 비는 직물 부적을 만들고, 책이 돌아오면 부적을 책방 벽에 거는 콜라보",
      method: "협동 워크숍",
      gainA: "부적 만들기가 책이라는 새 소재를 만나요.",
      gainB: "반납 독촉이 놀이가 되고 벽에 이야깃거리가 쌓여요.",
    },
    {
      title: "책방 동선 직물 지도",
      desc: "손님들이 어느 서가를 먼저 들르는지 한 달간 모아 그 동선을 자투리 천으로 이어 붙이고, 완성된 지도를 책방 입구에 거는 콜라보",
      method: "전시",
      gainA: "직물 조형이 공간을 안내하는 물건이 돼요.",
      gainB: "단골의 취향이 눈에 보이고 처음 온 손님에게 길잡이가 돼요.",
    },
  ],
  steps: [
    "인스타 DM으로 가볍게 인사 나누기",
    "30분 미팅으로 일정과 규모 정하기",
    "주말 하루 북커버 워크숍 파일럿",
    "후기 사진을 서로의 계정에 공유하기",
  ],
  effects: [
    "책을 사러 온 손님이 손으로 만드는 경험까지 하고 돌아가요.",
    "워크숍 결과물이 자연스럽게 두 브랜드의 콘텐츠가 돼요.",
  ],
};

/** 리포트 생성 + 서버 채점 선발.
 *  통과 접점 < 2개 또는 아이디어 0개면 { report: null }(no_match — 억지 리포트보다 정직한 빈손). */
export async function generateReport(
  a: Maker,
  aDna: BrandDna,
  b: Maker,
  bDna: BrandDna,
  modelOverride?: string, // A/B 실험 — 라우트가 화이트리스트 검증 후 전달
  meters?: CallMeter[] // 원가·토큰 실측 누적기(선택)
): Promise<{ report: CollabReportData | null; candidates: ReportCandidate[] }> {
  if (!hasKey()) return { report: MOCK_REPORT, candidates: [] };

  const methodPoolText = DNA_POOL.collabMethod
    .map((mth) => `${mth}(${methodIntensity(mth)})`)
    .join(", ");
  const contents = [
    `[브랜드 A(제안자=우리) — ${a.name}]`,
    brandDigest(a).text,
    "",
    "[A DNA]",
    dnaText(aDna),
    "",
    `[브랜드 B(상대) — ${b.name}]`,
    brandDigest(b).text,
    "",
    "[B DNA]",
    dnaText(bDna),
    "",
    "[Collab Method Pool]",
    methodPoolText,
  ].join("\n");

  const reportModel = modelOverride || REPORT_MODEL();
  // ⭐기발 후보 생성을 리포트와 **동시에** 출발시킨다 — 입력이 같아서 리포트를 기다릴 이유가 없다.
  //   심사(judgeNovelIdeas)만 리포트의 ideas를 기다린다(겹침 판정 재료).
  //   ⏱실측(08-07): 직렬 56s → 이 병렬화 + 심사 사고 low로 ~30s 목표.
  const novelCandsPromise = generateNovelCandidates(contents, reportModel, meters);
  const t0 = Date.now();
  const res = await ai().models.generateContent({
    model: reportModel,
    contents,
    config: {
      systemInstruction: REPORT_SYSTEM,
      responseMimeType: "application/json",
      responseSchema: REPORT_SCHEMA,
    },
  });
  const reportMeter = meter("report", reportModel, Date.now() - t0, res.usageMetadata);
  logMeter(reportMeter);
  meters?.push(reportMeter);
  const p = JSON.parse(res.text ?? "{}") as {
    candidates?: ReportCandidate[];
    ideas?: { title?: unknown; desc?: unknown; method?: unknown }[];
    steps?: unknown[];
    effects?: unknown[];
  };
  const candidates: ReportCandidate[] = (p.candidates ?? []).map((c) => ({
    text: String(c.text ?? ""),
    rarity: Number(c.rarity) || 0,
    specificity: Number(c.specificity) || 0,
    actionability: Number(c.actionability) || 0,
    mutuality: Number(c.mutuality) || 0,
  }));

  // 채점 선발(서버, 레드팀 C2): rarity 2배 가중 합산 → MIN_MATCH_SCORE 미달 탈락
  // → (rarity→specificity→actionability) 사전순 정렬 → 상위 4
  const scored = candidates
    .map((c) => ({ ...c, total: c.rarity * 2 + c.specificity + c.actionability + c.mutuality }))
    .filter((c) => c.total >= MIN_MATCH_SCORE)
    .sort(
      (x, y) =>
        y.rarity - x.rarity || y.specificity - x.specificity || y.actionability - x.actionability
    );
  const matchPoints = scored.slice(0, 4).map((c) => ({ text: c.text }));
  if (matchPoints.length < 2) return { report: null, candidates }; // no_match(스펙 선발 규칙)

  // ideas 후처리 — Pool 밖 method는 빈 문자열로(아이디어는 유지, UI가 태그 생략). 0개면 no_match.
  const ideas = (p.ideas ?? []).slice(0, 3).map((i) => {
    const method = String(i.method ?? "");
    return {
      title: String(i.title ?? ""),
      desc: String(i.desc ?? ""),
      method: DNA_POOL.collabMethod.includes(method) ? method : "",
    };
  });
  if (ideas.length === 0) return { report: null, candidates };

  // ④ 기발한 아이디어(B36) — 후보는 위에서 이미 리포트와 병렬로 만들어지고 있다.
  //    여기서는 심사만 한다(겹침 판정에 위 ideas가 필요해서 이 지점보다 당길 수 없다).
  //    실패해도 빈 배열이라 리포트는 그대로 나간다.
  const novelIdeas = await judgeNovelIdeas(contents, ideas, await novelCandsPromise, reportModel, meters);

  return {
    report: {
      matchPoints,
      ideas,
      novelIdeas,
      steps: (p.steps ?? []).slice(0, 4).map(String),
      effects: (p.effects ?? []).slice(0, 3).map(String),
    },
    candidates,
  };
}
