// 콜라보 분석 리포트 생성 엔진 — DNA 생성·리포트 생성·채점 선발·mock.
// 순수 라이브러리(요청·인증·캐시 오케스트레이션은 /api/collab-report가 담당).
// GEMINI_API_KEY 없으면 mock 반환 — 로컬 UI 개발·빌드가 키 없이 돌아간다.
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md
// 플랜: docs/superpowers/plans/2026-07-25-collab-report-dna.md Task 6

import { GoogleGenAI, Type } from "@google/genai";
import { DNA_SYSTEM, REPORT_SYSTEM } from "./collab-report-prompts";
import {
  DNA_POOL,
  LIGHT_METHODS,
  HEAVY_METHODS,
  filterPoolValid,
  distinctTypeCount,
  THIN_MIN_TYPES,
  MIN_MATCH_SCORE,
  DNA_REFRESH_BEFORE,
  DNA_STALE_SLACK_MS,
} from "./dna-pool";
import type { Block, BrandDna, CollabReportData, DnaItem, Maker } from "./types";

const REPORT_MODEL = () => process.env.REPORT_MODEL || "gemini-2.5-flash";
const DNA_MODEL = "gemini-2.5-flash"; // DNA는 flash 고정(스펙)
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

/** DNA를 리포트 입력용 텍스트로 — summary + `value(type) — evidence` 줄들. */
function dnaText(dna: BrandDna): string {
  return [dna.summary, ...dna.items.map((it) => `${it.value}(${it.type}) — ${it.evidence}`)]
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
  },
  required: ["summary", "items"],
};

const REPORT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    oneLiner: { type: Type.STRING, description: "한 줄 결론(60자 내외)" },
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
  required: ["oneLiner", "candidates", "ideas", "steps", "effects"],
};

// ── DNA 생성 ──────────────────────────────────────────────────

/** 키 없는 로컬용 mock DNA — 실제 스키마와 동일 형태(캔버스가든 소재). thin 아님(type 6종). */
function mockDna(m: Maker): BrandDna {
  const { fields } = brandDigest(m);
  const nowIso = new Date().toISOString();
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
    input_fields: fields,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

/** Brand DNA 생성(flash 고정·중립 — 비교 상대 무관 재사용 자산).
 *  prev = 갱신 재생성 시 기존 DNA — created_at을 보존한다(최초 생성 시각). */
export async function generateDna(m: Maker, prev?: BrandDna): Promise<BrandDna> {
  const digest = brandDigest(m);
  const nowIso = new Date().toISOString();
  if (!hasKey()) {
    const mock = mockDna(m);
    return prev ? { ...mock, created_at: prev.created_at } : mock;
  }
  const poolText = Object.entries(DNA_POOL)
    .map(([t, vs]) => `${t}: ${vs.join(", ")}`)
    .join("\n");
  const res = await ai().models.generateContent({
    model: DNA_MODEL,
    contents: `[Pool]\n${poolText}\n\n[소개서]\n${digest.text}`,
    config: {
      systemInstruction: DNA_SYSTEM,
      responseMimeType: "application/json",
      responseSchema: DNA_SCHEMA,
      temperature: 0.2,
    },
  });
  const parsed = JSON.parse(res.text ?? "{}") as { summary?: unknown; items?: DnaItem[] };
  // 화이트리스트 서버 검증(사실 게이트 ②) — Pool 밖 어휘·근거 없음·입력에 없던 source 탈락
  const items = filterPoolValid(parsed.items ?? [], digest.fields);
  return {
    summary: String(parsed.summary ?? "").slice(0, 80),
    items,
    input_fields: digest.fields,
    created_at: prev?.created_at ?? nowIso,
    updated_at: nowIso,
  };
}

// ── 판정 헬퍼 ─────────────────────────────────────────────────

/** thin 가드 — 서로 다른 type 수 미달(raw pick 수 아님: mood만 4개여도 thin). */
export const isThin = (dna: BrandDna) => distinctTypeCount(dna.items) < THIN_MIN_TYPES;

/** stale 판정 — ①DNA 없음 ②Pool 대개정 이전 생성분(DNA_REFRESH_BEFORE)
 *  ③소개서가 DNA보다 새로움(setBrandDna의 update가 brands.updated_at 트리거를 발화시키므로
 *   DNA_STALE_SLACK_MS 허용 오차를 둔다). */
export function isDnaStale(dna: BrandDna | null, brandUpdatedAt?: string): boolean {
  if (!dna) return true;
  const dnaTime = Date.parse(dna.updated_at);
  if (!Number.isFinite(dnaTime)) return true;
  if (dnaTime < Date.parse(DNA_REFRESH_BEFORE)) return true;
  if (brandUpdatedAt) {
    const brandTime = Date.parse(brandUpdatedAt);
    if (Number.isFinite(brandTime) && brandTime > dnaTime + DNA_STALE_SLACK_MS) return true;
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

/** 키 없는 로컬용 mock 리포트 — 캔버스가든×호락호락 도서관 소재, 6조각 전부(⑥ CTA는 UI 고정). */
const MOCK_REPORT: CollabReportData = {
  oneLiner: "천 조각과 그림책이 만나, 손으로 몰입하며 머무는 시간을 함께 만들 수 있어요.",
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
  bDna: BrandDna
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

  const res = await ai().models.generateContent({
    model: REPORT_MODEL(),
    contents,
    config: {
      systemInstruction: REPORT_SYSTEM,
      responseMimeType: "application/json",
      responseSchema: REPORT_SCHEMA,
      temperature: 0.6,
    },
  });
  const p = JSON.parse(res.text ?? "{}") as {
    oneLiner?: unknown;
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

  return {
    report: {
      oneLiner: String(p.oneLiner ?? ""),
      matchPoints,
      ideas,
      steps: (p.steps ?? []).slice(0, 4).map(String),
      effects: (p.effects ?? []).slice(0, 3).map(String),
    },
    candidates,
  };
}
