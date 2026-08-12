// 콜라보 분석 리포트 생성 엔진 — DNA 생성·리포트 생성·채점 선발·mock.
// 순수 라이브러리(요청·인증·캐시 오케스트레이션은 /api/collab-report가 담당).
// GEMINI_API_KEY 없으면 mock 반환 — 로컬 UI 개발·빌드가 키 없이 돌아간다.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md
// 플랜: docs/superpowers/plans/2026-07-25-collab-report-dna.md Task 6

import { createHash } from "node:crypto";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { DNA_SYSTEM, REPORT_SYSTEM } from "./collab-report-prompts";
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
import type { Block, BrandDna, CollabReportData, DnaItem, DnaSignature, Maker, NovelIdea, ReportIdea } from "./types";
import { kstIso } from "./time";
import { meter, logMeter, type CallMeter } from "./ai-cost";
import { DNA_ITEM_LIMIT } from "./limits";

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
  // 🆕08-10 `slice(DNA_ITEM_LIMIT)` — 화면 상한(30)과 **분리한다**. 안 자르면 화면 상한을 푼 만큼
  //   AI 입력이 조용히 따라 부푼다(리포트 원가의 큰 몫이 입력이다).
  //   ✅도입 시점 실제 최대가 활동 5·콜라보 5라 7로 잘라도 결과가 같다 → 다이제스트 문자열 동일 →
  //     `input_hash` 동일 → **DNA 재생성 0건.** 8건째를 넣는 브랜드부터만 갈린다.
  //   ⚠️여기 순서는 **사장님이 폼에서 정한 순서**다(앞에 둔 것이 곧 대표작) — 정렬하지 말 것.
  push(
    "activities",
    m.activities
      .slice(0, DNA_ITEM_LIMIT)
      .map((a) => [a.title, a.desc].filter(Boolean).join(": "))
      .filter(Boolean)
      .join("\n")
  );
  push(
    "collab_history",
    m.collabHistory
      .slice(0, DNA_ITEM_LIMIT) // 위 activities 주석 참조 — 화면 상한과 분리
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
      description: "이 브랜드만의 것 0~5개(없으면 빈 배열). 정체 서술만이 아니라 개별 프로그램·만드는 것·콜라보에서 한 행위도 후보",
    },
  },
  required: ["summary", "items", "signature"],
};

/** 아이디어 후보 1개 — **ideas·novel_ideas가 같은 모양**을 쓴다(08-08 통합).
 *  두 배열은 생성 씨앗만 다르고 채점 축은 같다. 선발은 서버(`pickIdeas`)가 점수로 한다.
 *  ⚠️점수는 INTEGER — NUMBER로 두면 모델이 23.099999999999998 같은 실수를 흘린다(08-08 실측). */
const SCORE = { type: Type.INTEGER, description: "1~5 정수" };
const IDEA_ITEM_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "20자 이내, 형식어(워크숍·전시·굿즈 제작 등)로 끝나는 완결된 행사 이름" },
    desc: { type: Type.STRING, description: "'~하는 콜라보'로 끝나는 명사구" },
    method: { type: Type.STRING, description: "Collab Method Pool 어휘 하나" },
    gain_a: { type: Type.STRING, description: "A에게 벌어지는 일 한 줄" },
    gain_b: { type: Type.STRING, description: "B에게 벌어지는 일 한 줄" },
    exchange: SCORE,
    specificity: SCORE,
    light: SCORE,
    viral: SCORE,
    mutual: SCORE,
    family: { type: Type.STRING, description: "결과물 계열 한 단어" },
    motif: { type: Type.STRING, description: "핵심 장치 한 단어" },
  },
  required: [
    "title", "desc", "method", "gain_a", "gain_b",
    "exchange", "specificity", "light", "viral", "mutual", "family", "motif",
  ],
};

export const REPORT_SCHEMA = {
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
    ideas: { type: Type.ARRAY, items: IDEA_ITEM_SCHEMA, description: "현실 노선 후보 5개 + 자기 채점" },
    novel_ideas: { type: Type.ARRAY, items: IDEA_ITEM_SCHEMA, description: "기발 노선 후보 4개 + 자기 채점" },
    steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "실행 플랜 최대 4단계" },
    effects: { type: Type.ARRAY, items: { type: Type.STRING }, description: "기대 효과 2~3개" },
  },
  required: ["candidates", "ideas", "novel_ideas", "steps", "effects"],
};

/** 화면에 나가는 아이디어 카드 수(대표 확정 08-08 — 5장에서 축소). 후보 9개 중 이만큼만 살아남는다. */
const IDEA_CARDS = 4;

/** 리포트 콜이 돌려주는 아이디어 후보 1개(원본 JSON) — 두 배열이 같은 모양이다. */
type RawIdea = {
  title?: unknown; desc?: unknown; method?: unknown; gain_a?: unknown; gain_b?: unknown;
  exchange?: unknown; specificity?: unknown; light?: unknown; viral?: unknown; mutual?: unknown;
  family?: unknown; motif?: unknown;
};

/** 채점까지 붙은 후보 — 화면 필드(ReportIdea) + 선발용 5축 + 겹침 판정용 계열·모티프. */
type ScoredIdea = ReportIdea & {
  exchange: number; specificity: number; light: number; viral: number; mutual: number;
  family: string; motif: string;
};

/** 5축 합(각 1~5점 → 5~25점). 축마다 가중치를 두지 않는다 — 자기 채점이라 정밀한 가중은 의미가 없고,
 *  ⭐순위만 쓰기 때문에 편향이 상당 부분 상쇄된다(절대 점수로 합격선을 긋지 않는 이유). */
const ideaTotal = (i: ScoredIdea) =>
  i.exchange + i.specificity + i.light + i.viral + i.mutual;

/** 후보 풀에서 화면에 나갈 카드를 고른다 — **ideas·novel_ideas를 합친 하나의 풀**에서 점수순(08-08 대표 확정).
 *  ⭐칸막이를 없앤 이유: 5축 공통 잣대로 재도 기발 씨앗이 상위 4장에 2장씩 올라왔다(08-08 실측).
 *    값은 채점이 아니라 **생성 씨앗의 다양성**에 있었으므로, 정원을 주지 않아도 좋은 게 알아서 올라온다.
 *  ⚠️계열·모티프가 **둘 다** 이미 쓰인 후보는 건너뛴다 — 닮은 카드가 나란히 놓이는 걸 막는다.
 *    한쪽만 같은 건 통과다(결과물이 같아도 행위가 다르면 다른 아이디어).
 *  ⚠️제약 때문에 자리를 못 채우면 **제약을 풀어 점수순으로 마저 채운다** — 카드 수가 규칙보다 우선이다
 *    (빈손 리포트가 닮은 카드보다 나쁘다).
 */
function pickIdeas(pool: ScoredIdea[], n: number): ScoredIdea[] {
  const norm = (s: string) => s.trim().toLowerCase();
  const sorted = [...pool].sort((x, y) => ideaTotal(y) - ideaTotal(x));
  const out: ScoredIdea[] = [];
  const fam = new Set<string>();
  const mot = new Set<string>();
  for (const c of sorted) {
    if (out.length >= n) break;
    if (fam.has(norm(c.family)) && mot.has(norm(c.motif))) continue;
    out.push(c);
    fam.add(norm(c.family));
    mot.add(norm(c.motif));
  }
  for (const c of sorted) {
    if (out.length >= n) break;
    if (!out.includes(c)) out.push(c);
  }
  return out;
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

/** **읽기 전용** 캐시 신선 판정 — `/api/collab-report`의 ⑥ 캐시 3조건과 같은 로직이지만
 *  이쪽은 DNA를 만들지 않는다(stale이면 그냥 false — 유료 콜 0). 라우트는 생성 경로라 먼저
 *  `ensureDna`로 DNA를 채워둔 뒤 판정하지만, 여긴 "지금 있는 그대로"만 본다.
 *
 *  용도(08-09) — 소개서 페이지(`/m/[slug]`)가 [콜라보 분석]을 열기 **전에** 미리 훑어서,
 *  DNA가 안 바뀐 쌍은 로딩 화면 없이 바로 리포트를 보여주기 위함(`ReportSheet`의 `cachedReports`).
 *  /my 아카이브가 이미 하던 것(저장본을 손에 쥐고 열기)과 같은 경험을 소개서 페이지에도 준다.
 *
 *  ⚠️ 라우트(`route.ts`)는 건드리지 않았다 — 거긴 이미 `ensureDna` 이후라 fromDna/toDna가
 *     항상 non-stale임이 보장돼 있어 이 함수를 끼워 넣을 이유가 없고, 유료 생성 경로라
 *     리스크를 더 얹지 않는 편이 안전하다. 판정 로직만 여기 한 곳에 두고 두 쪽이 같은 규칙을
 *     참조하게 하고 싶었지만, route.ts 쪽은 이미 스스로 같은 조건(3줄)을 인라인으로 쓰고
 *     있어 중복은 딱 그 3줄뿐이다 — 갈라질 위험보다 라이브 코드 미변경이 우선이었다. */
export function isReportCacheFresh(
  latest: { createdAt: string } | null,
  fromDna: BrandDna | null,
  toDna: BrandDna | null,
  from: Maker,
  to: Maker,
): boolean {
  if (!latest) return false;
  if (isDnaStale(fromDna, from) || isDnaStale(toDna, to)) return false;
  return (
    Date.parse(latest.createdAt) > Date.parse(fromDna!.updated_at) &&
    Date.parse(latest.createdAt) > Date.parse(toDna!.updated_at)
  );
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
  // 08-08 통합 후 모양 그대로 — **합친 풀에서 고른 4장**(현실 씨앗·기발 씨앗이 섞여 있고 구분 표시가 없다).
  ideas: [
    {
      title: "폐원단으로 북커버를 꿰매는 워크숍",
      desc: "책방 한켠에서 폐원단을 잘라 나만의 북커버를 꿰매고 좋아하는 그림책을 끼워 가는 2시간 클래스 콜라보",
      method: "협동 워크숍",
      gainA: "만든 커버가 손님 책장에 그대로 남아요.",
      gainB: "책을 고른 손님이 한 시간 더 머물게 돼요.",
    },
    {
      title: "돌아오길 비는 반납 부적 전시",
      desc: "오래 반납되지 않은 책 목록을 받아 그 책이 돌아오길 비는 직물 부적을 만들고 책이 돌아오면 책방 벽에 거는 콜라보",
      method: "전시",
      gainA: "부적 만들기가 책이라는 새 소재를 만나요.",
      gainB: "반납 독촉이 놀이가 되고 벽에 이야깃거리가 쌓여요.",
    },
    {
      title: "손님 동선을 천으로 잇는 지도 팝업",
      desc: "손님들이 어느 서가를 먼저 들르는지 한 달간 모아 그 동선을 자투리 천으로 이어 붙여 입구에 거는 콜라보",
      method: "전시",
      gainA: "직물 조형이 공간을 안내하는 물건이 돼요.",
      gainB: "단골의 취향이 눈에 보이고 처음 온 손님에게 길잡이가 돼요.",
    },
    {
      title: "밑줄 문장을 자수로 놓는 굿즈 제작",
      desc: "책방이 고른 문장을 자투리 천에 자수로 새겨 작은 책갈피로 만드는 콜라보",
      method: "굿즈",
      gainA: "짧은 자투리가 문장을 담는 자리가 돼요.",
      gainB: "책을 산 손님에게 건넬 소품이 생겨요.",
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
/** 리포트·기발 생성 콜의 공용 입력 직렬화 — A/B 실측 스크립트가 prod와 **같은 입력 계약**으로
 *  돌 수 있게 export(08-08). 여기 형식을 바꾸면 저장된 리포트 캐시와의 비교 가능성이 깨진다. */
export function buildReportContents(a: Maker, aDna: BrandDna, b: Maker, bDna: BrandDna): string {
  const methodPoolText = DNA_POOL.collabMethod
    .map((mth) => `${mth}(${methodIntensity(mth)})`)
    .join(", ");
  return [
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
}

export async function generateReport(
  a: Maker,
  aDna: BrandDna,
  b: Maker,
  bDna: BrandDna,
  modelOverride?: string, // A/B 실험 — 라우트가 화이트리스트 검증 후 전달
  meters?: CallMeter[] // 원가·토큰 실측 누적기(선택)
): Promise<{ report: CollabReportData | null; candidates: ReportCandidate[] }> {
  if (!hasKey()) return { report: MOCK_REPORT, candidates: [] };

  const contents = buildReportContents(a, aDna, b, bDna);

  const reportModel = modelOverride || REPORT_MODEL();
  // ⭐**콜 1개**(08-08 대표 확정). ~~리포트 + 기발 생성 2 + 심사 = 4콜~~ → 한 콜이 후보 9개를 내고
  //   자기 채점까지 하면 서버가 고른다. ⏱💰실측: 152원·36.4초 → 93원·35.8초(캔가×계단뿌셔).
  //   비용이 절반인 이유 = 소개서 원문을 네 번 보내던 게 한 번이 되고 심사 콜이 통째로 사라져서.
  const t0 = Date.now();
  // ⏱리포트 콜의 사고량 — **파이프라인에서 유일하게 안 낮춘 자리**(기발 생성·심사는 08-07에 low로).
  //   `REPORT_THINKING=low`로만 켠다(기본=모델 기본값). 이 콜은 뒤에 거름망이 없어 품질이 곧 화면이라,
  //   대표 블라인드 A/B 전에는 기본값을 바꾸지 않는다. 400 거부 시 옵션 없이 재시도(기발과 동일 패턴).
  const reportLowThinking = process.env.REPORT_THINKING === "low";
  const callReport = (withLevel: boolean) =>
    ai().models.generateContent({
      model: reportModel,
      contents,
      config: {
        systemInstruction: REPORT_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: REPORT_SCHEMA,
        ...(withLevel && reportLowThinking
          ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
          : {}),
      },
    });
  let res;
  try {
    res = await callReport(true);
  } catch (e) {
    const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
    if (!reportLowThinking || status !== 400) throw e;
    console.warn(`[report] ${reportModel} thinkingLevel=low 거부(400) → 옵션 없이 재시도`);
    res = await callReport(false);
  }
  const reportMeter = meter("report", reportModel, Date.now() - t0, res.usageMetadata);
  logMeter(reportMeter);
  meters?.push(reportMeter);
  const p = JSON.parse(res.text ?? "{}") as {
    candidates?: ReportCandidate[];
    ideas?: RawIdea[];
    novel_ideas?: RawIdea[];
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

  // 후보 풀 — 두 배열을 **합친다**(08-08 대표 확정: 추천·기발 칸막이 폐지).
  // 상한은 요청 수보다 넉넉히: 프롬프트가 5·4를 요청하지만 모델이 더 뱉어도 선발이 감당한다(계약은 파서가 보장).
  const toCand = (i: RawIdea): ScoredIdea => {
    const method = String(i.method ?? "");
    return {
      title: String(i.title ?? ""),
      desc: String(i.desc ?? ""),
      method: DNA_POOL.collabMethod.includes(method) ? method : "", // Pool 밖이면 UI가 태그를 생략
      gainA: String(i.gain_a ?? ""),
      gainB: String(i.gain_b ?? ""),
      exchange: Number(i.exchange) || 0,
      specificity: Number(i.specificity) || 0,
      light: Number(i.light) || 0,
      viral: Number(i.viral) || 0,
      mutual: Number(i.mutual) || 0,
      family: String(i.family ?? ""),
      motif: String(i.motif ?? ""),
    };
  };
  const pool = [...(p.ideas ?? []).slice(0, 7), ...(p.novel_ideas ?? []).slice(0, 6)].map(toCand);
  if (pool.length === 0) return { report: null, candidates };
  const picked = pickIdeas(pool, IDEA_CARDS);
  console.log(
    `[report] 후보 ${pool.length}(현실 ${(p.ideas ?? []).length}/기발 ${(p.novel_ideas ?? []).length}) → ${picked.length}장 ` +
      `점수 ${picked.map(ideaTotal).join(",")}`
  );

  return {
    report: {
      matchPoints,
      // 화면에 나가는 건 6필드뿐 — 채점·계열·모티프는 선발용이라 저장하지 않는다(캐시가 비대해진다).
      ideas: picked.map((i) => ({
        title: i.title,
        desc: i.desc,
        method: i.method,
        gainA: gateJargon(i.gainA, "gainA"),
        gainB: gateJargon(i.gainB, "gainB"),
      })),
      steps: (p.steps ?? []).slice(0, 4).map(String),
      effects: (p.effects ?? []).slice(0, 3).map(String).filter((s) => !gateJargonHit(s, "effects")),
    },
    candidates,
  };
}

// ── 사업 보고서 어휘 서버 게이트(08-08) ─────────────────────────
// 계기: 프롬프트 ⛔금지어가 뚫려 "타깃층"이 화면까지 갔다(08-08 실측). [[prompt-parser-contract]] —
// 프롬프트는 요청이고 **여기가 보장**이다.
// ⚠️적용 범위는 **통째로 지워도 화면이 성립하는 줄만**: gains(빈 값이면 그 불릿을 생략)·effects(2~3개 중
//   하나 빠져도 성립). desc·steps·title은 지우면 카드·플랜이 깨지므로 여기서 안 지운다(프롬프트만 막는다).
// ⚠️단어는 프롬프트 ⛔목록과 같은 9종만 — 어느 콜라보에나 붙는 일반론 어휘라 오검이 없다.
//   ("홍보 효과"만 묶음이고 "홍보" 단독은 안 막는다 — steps의 "인스타 홍보 게시물"류가 정당해서.)
const BIZ_JARGON = /인지도|신규 고객|타깃|각인|확보|유입|홍보 효과|포트폴리오|매출/;
function gateJargonHit(s: string | undefined, label: string): boolean {
  if (!s || !BIZ_JARGON.test(s)) return false;
  console.warn(`[gate] ${label} 금지어 낙마: ${s}`);
  return true;
}
const gateJargon = (s: string | undefined, label: string) => (gateJargonHit(s, label) ? "" : (s ?? ""));
