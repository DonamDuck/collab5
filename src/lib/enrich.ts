// "딸깍 등록" 자동완성 — 업체명으로 웹을 뒤져 등록 폼 초안을 채운다.
// 지금은 MockSearchProvider(키 불필요). 키 발급 후 ClaudeSearchProvider로 교체(이 파일 1곳).
// 원칙(Notion "온보딩 재설계 §② AI 자동완성" / design.md F1):
//  - 말랑한 층(소개·결)=초안 / 검증가능 층(인스타·홈피·주소)=추출+출처 표시(✓검증마크 X)
//  - 하드축(콜라보유형·지역규모)은 AI가 추측하지 않는다 → 사람이 클릭(필터 오염 방지)
//  - graceful degradation: 못 찾으면 missing으로 표시 → "직접 입력이 필요해요" 노티
//
// ⚠️ 서버 전용 모듈. 클라이언트(register/page.tsx)는 `import type`로 타입만 가져간다.
import Anthropic from "@anthropic-ai/sdk";
import { GoogleGenAI, Type } from "@google/genai";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { josa } from "./josa";
import { regionConflict, regionMatches } from "./regionSynonyms";
import { DESC_ANCHOR_COUNT } from "./enrichBlend";

/** 검증가능 신뢰 시그널 필드 — 못 찾으면 missing, 찾으면 sources에 출처 */
export type EnrichField = "instagram" | "homepage" | "address";

/** 검증가능 필드의 출처 (사람이 읽는 라벨 + 링크). ✓검증마크가 아니라 '어디서 왔나' 표시용 */
export interface EnrichSource {
  field: EnrichField | "name" | "description";
  label: string; // 예: "instagram.com/canvasgarden"
  url: string;
}

/** enrich가 제안하는 한 후보(= 폼 초안). 사용자가 검수·수정 후 저장한다. */
export interface EnrichCandidate {
  name: string;
  oneLiner: string;
  region?: string;
  address?: string;
  instagram?: string;
  homepage?: string;
  description: string; // 소개 초안(말랑한 층)
  values: string[]; // 결 칩 distill(말랑한 층)
  sources: EnrichSource[]; // 검증가능 필드 출처
  missing: EnrichField[]; // 못 찾은 필드 → 직접 입력 노티
  hint?: string; // 동명 disambiguation용 구분 단서 (예: "서울 성수 · 패브릭 가방")
}

export interface EnrichResult {
  candidates: EnrichCandidate[];
}

/** 재크롤링 입력 — 후보 + 사용자가 추가한 인스타/홈피로 더 깊이 조사 */
export interface RecrawlInput {
  name: string;
  instagram?: string;
  homepage?: string;
}

/** 소개 초안 생성 입력 — 폼에 입력된 정보 기반. round로 '다시 받기' 시 다른 각도로 변주. */
export interface DraftInput {
  name: string;
  oneLiner?: string;
  values?: string[];
  offers?: string[];
  targetAudience?: string[];
  focusKeywords?: string[]; // 가중 키워드 — 생성 방향을 잡는다(선택한 키워드 = 재료)
  starredKeywords?: string[]; // ⭐ 한 줄 소개에 반드시 반영(캡 3, 배열 순서 = 우선순위)
  verbatimKeywords?: string[]; // '그대로 넣기' — 슬로건·인증·상표. 표현 변형 금지
  researchMemo?: string; // 이미 크롤한 조사메모 재사용(키워드 추출 때 쓴 것) — 재크롤 방지(콜 절감)
  homepageDigest?: string; // 홈페이지 딥리드 발췌 — 서버(fetchHomepageDigest)에서만 생성, 클라이언트 텍스트 금지
  round?: number; // 0=첫 초안, 1+=다시 받기(다른 맥락)
}

/** 키워드 가중 5지선다 생성 입력 — research(백그라운드 크롤 결과)를 재사용 */
export interface OptionsInput {
  name: string;
  research: string; // enrichResearch()가 만든 조사 메모(네이버+제미나이)
  focusKeywords?: string[]; // 유저가 고른 키워드 = 생성 재료(안 고른 건 버림)
  starredKeywords?: string[]; // ⭐ 한 줄 소개에 반드시 반영(캡 3, 순서=우선순위)
  verbatimKeywords?: string[]; // 그대로 넣기 — 유저가 직접 쓴 문구(의역 금지)
  ownerNote?: string; // 사장이 직접 쓴 한두 문장 — 생성의 최우선 중심축
  homepageDigest?: string; // 홈페이지 딥리드 발췌 — 서버(fetchHomepageDigest)에서만 생성, 클라이언트 텍스트 금지
}

/** 자세히 재생성 입력 — 사용자가 고른/수정한 한 줄 소개를 '관통 주제'로 자세히 5개만 다시 만든다.
 *  ⚠️콜 규율: 이 경로는 generateOptions 1콜만 쓴다(재크롤 금지 — researchMemo 재사용). */
export interface RegenDescInput {
  name: string;
  chosenOneLiner: string; // 사용자가 최종 확정한 한 줄 소개 = 5개 자세히의 공통 관통 주제
  researchMemo?: string; // 이전 생성이 쓴 조사메모 재사용(재크롤 방지). 없으면 자료 없이 생성.
  homepageDigest?: string; // 홈페이지 딥리드 발췌(있으면) — 서버에서만 생성
  focusKeywords?: string[]; // 키워드 재료(선택한 키워드)
  values?: string[]; // 브랜드 결 단어
}

/** 크롤이 발견한 활동 흔적 — 창작 아님, 조사 메모에 실제 등장한 것만 */
export interface ActivityHint {
  title: string; // 짧은 활동명 (예: "가방 만들기 워크숍")
  desc: string; // 한두 문장 요약 (해요체)
  source: string; // 출처 유형 라벨 (예: "네이버 블로그 후기")
}
/** 크롤이 발견한 콜라보 흔적 */
export interface CollabHint {
  partner: string; // 파트너/함께한 곳
  desc: string; // 한두 문장 요약 (해요체)
  source: string; // 출처 유형 라벨
}
/** 크롤 근거 기반 추천 블록 — 리빌 카드 "이런 이야기도 담아보세요" 소스 */
export interface BlockHint {
  type: "metrics" | "press" | "space" | "reviews";
  reason: string; // "인스타그램에서 팔로워 1.2만을 봤어요" 형태 근거 한 줄
  desc?: string; // space 공간 소개 밑그림(해요체 한두 문장). metrics·press는 미사용
  items?: { label: string; value?: string; year?: string; desc?: string }[]; // metrics·press 밑그림(press item desc=기사 한 줄 요약)
}
/** 크롤이 발견한 '원하는 파트너·협업' 단서 — 리빌 seeks 카드 소스 */
export interface SeeksHint {
  types: string[]; // 콜라보 유형 최대 3 (제품콜라보·팝업·워크숍·공동굿즈·공동콘텐츠·행사참여·공간대여 중)
  note: string; // 해요체 한두 문장
  reason: string; // "~에서 봤어요" 근거 한 줄
}

/** 크롤 조사메모에서 오프라인 파싱한 선택용 키워드 칩(LLM 없음 — 콜 0).
 *  크롤→키워드 재설계: 유저가 '나를 나타내는 것'을 골라 생성 재료로 삼는다. */
export interface KeywordChip {
  text: string; // 짧은 키워드/구 (선택 단위)
  section: string; // 출처 소제목 (정체·제품·활동·콜라보·고객·숫자·알려짐·공간·신뢰정보)
  factual: boolean; // 사실 게이트 대상(숫자·방송·수상·대표명 등 — 오귀속 시 거짓말이 됨). 기본 OFF·탭 확인
}

/** 5지선다 결과 — 확인된 identity + 한줄소개/브랜드소개 후보 5개씩 + 결 단어 */
export interface EnrichOptions {
  identity: {
    name: string;
    region?: string;
    address?: string;
    instagram?: string; // 확실히 확인된 것만(홈페이지 링크 등)
    homepage?: string;
    hint?: string;
  };
  instagramCandidates: string[]; // 불확실할 때 사장이 고를 인스타 후보(추정 포함)
  oneLiners: string[];
  descriptions: string[];
  values: string[];
  activityHints: ActivityHint[]; // 발견된 활동 흔적 0~3건 (참고용)
  collabHints: CollabHint[]; // 발견된 콜라보 흔적 0~3건 (참고용)
  blockHints: BlockHint[]; // 근거 기반 추천 블록 0~2건 (근거 없으면 빈 배열)
  seeksHint: SeeksHint | null; // 원하는 파트너·협업 단서 (근거 없으면 null)
}

/** 검색 단계 추상화 — mock ↔ Claude/Gemini 교체 지점. */
export interface SearchProvider {
  lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]>;
  /** (선택) 인스타/홈피 기반 재크롤링 — 더 풍부한 단일 후보 */
  recrawl?(input: RecrawlInput): Promise<EnrichCandidate | null>;
  /** (선택) 폼 정보 기반 소개 글 5개 초안 — round로 다른 각도 변주 */
  draft?(input: DraftInput): Promise<string[]>;
  /** (선택) 폼 정보 기반 한 줄 소개 후보 3개 — 초안받기 2스텝용. 각 40자 이내 */
  oneLiners?(input: DraftInput): Promise<string[]>;
  /** (선택) 한 줄 소개 3개 + 브랜드 소개 5개를 한 번에 — 초안받기 이중 크롤 제거(research 1회+생성 1회).
   *  researchMemo = 이번에 쓴 조사메모(자세히 재생성이 재사용해 재크롤을 막는다). */
  draftBoth?(input: DraftInput): Promise<{ oneLiners: string[]; descriptions: string[]; researchMemo?: string }>;
  /** (선택) 고른/수정한 한 줄 소개를 관통 주제로 '자세히 소개' 5개만 재생성(generateOptions 1콜, 재크롤 없음) */
  regenDescriptions?(input: RegenDescInput): Promise<string[]>;
  /** (선택) 브랜드명(+지역·업종)으로 조사 메모만 생성(백그라운드 크롤 — 느린 단계) */
  research?(name: string, region?: string, businessType?: string): Promise<string>;
  /** (선택) 조사 메모 + 키워드 → 한줄소개·브랜드소개 5지선다(빠른 생성 단계) */
  options?(input: OptionsInput): Promise<EnrichOptions>;
}

// collab5 브랜드 보이스 — `~/Desktop/COLLAB_BRAND_SYSTEM.md`(v0.2)를 소개 글 생성용으로 증류.
// 모든 AI 생성 텍스트(소개·구조화 description)는 이 기준을 통과한다.
const BRAND_VOICE = `[collab5 브랜드 보이스 — 이 말투를 반드시 지켜라]
말투:
- ⭐기본은 '해요체'(~해요, ~예요, ~이에요, ~있어요). 단 긴 '브랜드 소개'(descriptions)는 문장 역할에 따라 '~합니다'를 섞는 혼합체 — 세부 규칙은 descriptions 항목을 따른다. 짧은 UI성 문장·한 줄 소개는 해요체 유지.
- 친절하지만 과하지 않게. 감성적이지만 오글거리지 않게. 담백하고 단단하게.
- 마케팅 문구가 아니라 '좋은 브랜드가 스스로를 담담히 소개하는' 느낌. 읽고 "이 브랜드 괜찮네, 같이 해보고 싶다"가 들도록.
- 쉽고 부담 없이. 문장은 짧고 명료하게.
- 관점: 단순 소개가 아니라 '함께 협업하고 싶어지는 첫인상'을 만든다.
금지: 최고의 / 혁신적인 / 압도적 / 완벽한 / 트렌디한 / 퀄리티 / 솔루션 같은 홍보·상투어, 과장, 이모지, 느낌표 남발, "생성/자동" 같은 기계적 표현.
지향: 함께 / 정성 / 담다 / 첫인상 / 꾸준히 / 결이 맞는 — 구체적 사실(무엇을·어떻게·누구에게) 위주로.`;

// ── mock fixture: 알려진 곳은 풍부하게(데모용) ──
const FIXTURES: Record<string, EnrichCandidate[]> = {
  캔버스가든: [
    {
      name: "캔버스가든",
      oneLiner: "패브릭으로 짓는 친환경 가방과 조각 워크숍",
      region: "서울 성수",
      address: "서울 성동구 성수동",
      instagram: "@canvasgarden",
      homepage: "https://www.canvasgarden.shop",
      description:
        "버려지는 천에 새 이야기를 입히는 패브릭 브랜드예요. 작은 가방에서 시작해, 사람을 모으는 조각 워크숍으로 자라고 있어요.",
      values: ["친환경", "손맛", "느린 호흡"],
      sources: [
        { field: "instagram", label: "instagram.com/canvasgarden", url: "https://instagram.com/canvasgarden" },
        { field: "homepage", label: "canvasgarden.shop", url: "https://www.canvasgarden.shop" },
        { field: "address", label: "네이버 지도", url: "https://map.naver.com" },
      ],
      missing: [],
      hint: "서울 성수 · 패브릭 가방/워크숍",
    },
  ],
};

/** 이름만으로 만든 부분 초안 — 못 찾은 필드는 missing으로(직접 입력 폴백) */
function genericCandidate(
  name: string,
  region?: string,
  oneLiner?: string,
  instagram?: string
): EnrichCandidate {
  const sources: EnrichSource[] = [];
  const missing: EnrichField[] = [];
  const handle = instagram?.replace(/^@/, "");
  if (handle) {
    sources.push({
      field: "instagram",
      label: `instagram.com/${handle}`,
      url: `https://instagram.com/${handle}`,
    });
  } else {
    missing.push("instagram");
  }
  missing.push("homepage"); // 일반 검색으론 홈페이지까진 못 찾는 경우가 많음
  if (region) {
    sources.push({ field: "address", label: "네이버 지도", url: "https://map.naver.com" });
  } else {
    missing.push("address");
  }
  return {
    name,
    oneLiner: oneLiner ?? "",
    region,
    address: region,
    instagram,
    homepage: undefined,
    description: `${name}의 이야기를 담은 곳이에요. 소개를 조금만 다듬으면 멋진 카드가 돼요.`,
    values: [],
    sources,
    missing,
    hint: [region, oneLiner].filter(Boolean).join(" · ") || undefined,
  };
}

export class MockSearchProvider implements SearchProvider {
  async lookup(query: string): Promise<EnrichCandidate[]> {
    const q = query.trim();
    if (!q) return [];
    await new Promise((r) => setTimeout(r, 700)); // 검색 지연 체감(데모)

    const fx = FIXTURES[q];
    if (fx) return fx;

    // 동명 disambiguation 데모: "공방"이 들어가면 후보 2곳
    if (q.includes("공방")) {
      return [
        genericCandidate(q, "서울 성수", "도자기와 핸드빌딩 클래스", "@studio_seongsu"),
        genericCandidate(q, "부산 전포", "유리공예 공방"),
      ];
    }

    // 일반: 1곳, 일부 필드는 못 찾음(부분 성공 → 직접 입력 노티 데모)
    return [genericCandidate(q)];
  }

  // 재크롤링 mock — 사용자가 추가한 인스타/홈피로 "더 깊이 찾은" 풍부한 결과 시뮬
  async recrawl(input: RecrawlInput): Promise<EnrichCandidate | null> {
    await new Promise((r) => setTimeout(r, 800));
    const sources: EnrichSource[] = [];
    const missing: EnrichField[] = [];
    const handle = input.instagram?.replace(/^@/, "");
    if (handle) {
      sources.push({
        field: "instagram",
        label: `instagram.com/${handle}`,
        url: `https://instagram.com/${handle}`,
      });
    } else missing.push("instagram");
    if (input.homepage) {
      sources.push({ field: "homepage", label: input.homepage.replace(/^https?:\/\//, ""), url: input.homepage });
    } else missing.push("homepage");
    sources.push({ field: "address", label: "네이버 지도", url: "https://map.naver.com" });

    return {
      name: input.name,
      oneLiner: `${input.name} — 인스타·홈페이지까지 살펴 더 깊이 정리했어요`,
      region: "서울 성수",
      address: "서울 성동구",
      instagram: input.instagram,
      homepage: input.homepage,
      description: `${input.name}의 인스타그램과 홈페이지를 함께 살펴보니, 자기 색을 꾸준히 쌓아온 브랜드예요. 작은 시작에서 출발해 팬을 모으며 성장하고 있어요. (재크롤링으로 보강한 소개 초안 — 확인하고 다듬어 주세요)`,
      values: ["정성", "꾸준함", "개성", "스토리"],
      sources,
      missing,
      hint: undefined,
    };
  }

  // 소개 초안 mock — 5지선다용 여러 각도 반환(다시 받기 시 round로 앞뒤 살짝 바꿔 변주)
  async draft(input: DraftInput): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 700));
    const name = input.name.trim() || "우리 브랜드";
    const vibe = input.values?.slice(0, 3).join(", ");
    const line = vibe ? `${vibe}${josa(vibe, "을", "를")} 담아 ` : "";
    const variants = [
      `${name}${josa(name, "은", "는")} ${input.oneLiner?.trim() || "자기만의 이야기를 담은 곳"}이에요. 작은 시작에서 출발해 한 걸음씩 자기 색을 쌓아왔어요. 유행보다 오래 남을 것을 고민하며, ${line}만드는 사람과 쓰는 사람 사이에 이야기가 오가도록 해요.`,
      `${line}${name}${josa(name, "이", "가")} 지켜온 태도가 있어요. 빠르게 많이 만들기보다 하나를 정성껏 매만지는 방식을 택했어요. 그렇게 쌓인 시간이 브랜드의 결이 되었고, 찾아주시는 분들과의 신뢰로 이어지고 있어요.`,
      `${name}${josa(name, "을", "를")} 찾는 분들은 결이 맞는 경험을 기대해요. 우리는 그 기대에 정직하게 답하는 걸 가장 중요하게 생각해요. 화려한 말보다 실제로 손에 남는 것으로 이야기하려 해요.`,
      `함께 무언가를 만든다면, ${name}${josa(name, "은", "는")} ${vibe || "우리다운 색"}으로 서로의 이야기를 넓혀줄 파트너가 될 거예요. 작은 협업이라도 서로에게 좋은 첫인상으로 남기를 바라요.`,
      `${name}${josa(name, "은", "는")} 손에 남는 것으로 이야기하는 브랜드예요. 오늘도 정성스러운 과정을 지키며, 결이 맞는 분들과의 만남을 기다리고 있어요.`,
    ];
    const r = input.round ?? 0;
    return r === 0 ? variants : [...variants.slice(1), variants[0]];
  }

  // 한 줄 소개 후보 mock — 3개, 각 40자 이내(다시 받기 시 round로 순서 변주)
  async oneLiners(input: DraftInput): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 500));
    const name = input.name.trim() || "우리 브랜드";
    const v = input.values?.[0];
    const variants = [
      v
        ? `${v}${josa(v, "을", "를")} 담은 물건을 손수 만들고 있어요`
        : `일상에 스며드는 물건을 정성껏 만들고 있어요`,
      `오래 쓰일 것을 고민하며 하나씩 지어가고 있어요`,
      `결이 맞는 분들과 워크숍·협업을 이어가고 있어요`,
    ];
    const r = input.round ?? 0;
    return r === 0 ? variants : [...variants.slice(1), variants[0]];
  }

  // 한 줄 소개 + 브랜드 소개 통합 mock — draft2(이중 크롤 제거) 데모용
  async draftBoth(input: DraftInput): Promise<{ oneLiners: string[]; descriptions: string[]; researchMemo?: string }> {
    const [oneLiners, descriptions, researchMemo] = await Promise.all([
      this.oneLiners(input),
      this.draft(input),
      this.research(input.name),
    ]);
    return { oneLiners, descriptions, researchMemo };
  }

  // 자세히 재생성 mock — 고른 한 줄을 관통 주제로 '앵커' N개(서로 다른 렌즈). N=DESC_ANCHOR_COUNT.
  async regenDescriptions(input: RegenDescInput): Promise<string[]> {
    await new Promise((r) => setTimeout(r, 500));
    const ol = input.chosenOneLiner.trim();
    const lensPool = [
      `${ol} 손이 많이 가는 방식을 고집하고 있어요. 빠르게보다 제대로를 택한 시간이 저희의 결이 됐어요.`, // 어떻게
      `작은 불편에서 시작했어요. ${ol} 그 마음을 잊지 않으려 오늘도 처음처럼 정성을 지키고 있어요.`, // 왜
      `일상에서 자주 쓰는 분들을 생각하며 만들어요. ${ol} 손에 오래 남는 쓰임을 가장 먼저 챙기고 있어요.`, // 누구에게
      `${ol} 그중에서도 가장 단단한 것부터 하나씩 갖춰가고 있어요. 겉보다 안이 튼튼하길 바라거든요.`, // 무엇을
      `${ol} 담백하지만 따뜻한 결을 지키려 해요. 요란하지 않아도 오래 곁에 두고 싶은 느낌을 담고 있어요.`, // 분위기
    ];
    return lensPool.slice(0, DESC_ANCHOR_COUNT);
  }

  // 조사 메모 mock
  async research(name: string, region?: string): Promise<string> {
    await new Promise((r) => setTimeout(r, 700));
    return `[mock 조사] ${name}${region ? ` (${region})` : ""} — 소규모 브랜드. 정성스러운 제작, 로컬 기반. (실제 크롤링은 키 설정 시)`;
  }

  // 5지선다 mock
  async options(input: OptionsInput): Promise<EnrichOptions> {
    await new Promise((r) => setTimeout(r, 500));
    const name = input.name.trim() || "우리 브랜드";
    const kw = input.focusKeywords?.length ? ` (${input.focusKeywords.join("·")} 강조)` : "";
    const slug = name.replace(/\s+/g, "").toLowerCase();
    return {
      identity: { name, region: "서울 성수", address: "서울 성동구 성수동", hint: "mock" },
      instagramCandidates: [`@${slug}`, `@${slug}_official`],
      oneLiners: [
        `우리만의 이야기를 정성으로 지어가고 있어요${kw}`,
        `일상에 스며드는 물건을 손수 만들고 있어요`,
        `결이 맞는 사람들과 함께 자라고 있어요`,
        `작지만 단단한 로컬 브랜드를 꾸려가고 있어요`,
        `오래 남을 것을 고민하며 만들고 있어요`,
      ],
      descriptions: (await this.draft({ name, values: input.focusKeywords })).slice(0, 5),
      values: input.focusKeywords?.slice(0, 4) ?? ["정성", "손맛", "로컬"],
      activityHints: [
        { title: "가방 만들기 워크숍", desc: "5주 과정 워크숍 후기가 여러 건 보여요.", source: "네이버 블로그 후기" },
        { title: "온라인 스토어 운영", desc: "자체 제작 소품을 판매하는 스토어가 언급돼요.", source: "웹 검색" },
      ],
      collabHints: [
        { partner: "오월의숲", desc: "함께 팝업을 열었다는 후기가 보여요.", source: "카페글" },
      ],
      blockHints: [
        {
          type: "press",
          reason: "지역 매체에서 소개 기사를 봤어요",
          items: [
            { label: "은평시민신문", year: "2025", desc: "동네 사랑방 같은 작업실로 소개했어요." },
            { label: "트립닷컴", year: "2025", desc: "" },
          ],
        },
        {
          type: "space",
          reason: "블로그에서 공간 사진을 봤어요",
          desc: "다양한 소품과 작업물을 볼 수 있는 아담한 작업실 겸 쇼룸이에요. 소규모 워크숍도 열려요.",
        },
      ],
      seeksHint: null,
    };
  }
}

// ── 실제 Claude provider: web_search(리서치) → structured output(구조화) 2단계 ──

const EnrichSourceSchema = z.object({
  field: z.enum(["instagram", "homepage", "address", "name", "description"]),
  label: z.string().describe("사람이 읽는 출처 라벨 (예: instagram.com/canvasgarden)"),
  url: z.string().describe("출처 URL"),
});

const EnrichCandidateSchema = z.object({
  name: z.string().describe("정규화된 상호명"),
  oneLiner: z.string().describe("한 줄 소개 초안 (없으면 빈 문자열)"),
  region: z.string().optional().describe("지역 (예: 서울 성수)"),
  address: z.string().optional(),
  instagram: z.string().optional().describe("@handle 형식"),
  homepage: z.string().optional(),
  description: z.string().describe("소개 한 문단 초안"),
  values: z.array(z.string()).describe("브랜드 결 칩 2~4개 (예: 친환경, 손맛)"),
  sources: z.array(EnrichSourceSchema).describe("확인된 검증가능 필드의 출처"),
  missing: z
    .array(z.enum(["instagram", "homepage", "address"]))
    .describe("웹에서 확인 못 한 검증가능 필드"),
  hint: z.string().optional().describe("동명 구분용 한 줄 (지역·업종)"),
});

const EnrichResultSchema = z.object({
  candidates: z
    .array(EnrichCandidateSchema)
    .describe("같은 이름의 서로 다른 업체는 각각 별도 후보로"),
});

const ENRICH_SYSTEM = `너는 콜라보 플랫폼 collab5의 등록 도우미야. 조사된 웹 내용을 바탕으로 한국 업체/브랜드의 '등록 폼 초안'을 만든다.

${BRAND_VOICE}

규칙:
- description은 위 브랜드 보이스를 지켜 쓴다. 조사 내용이 넉넉하면 3~5문장으로 풍부하게, 적으면 담백하게. values(브랜드 결 칩 2~4개)도 매력적인 '초안'으로. 사용자가 검수·수정할 전제다.
- instagram·homepage·address는 조사에서 실제로 확인된 것만 채우고, 각각 sources에 출처(label=도메인/서비스명, url)를 남긴다. 확인 안 되면 비우고 missing에 넣는다. 절대 지어내지 마라.
- 콜라보 유형·지역규모 같은 필터 항목은 추측하지 마라(폼에서 사람이 직접 고른다).
- 같은 이름의 서로 다른 업체가 보이면 candidates 배열에 각각 담고, hint(지역·업종 한 줄)로 구분한다.`;

// ── 5지선다(options) 스키마 + system ──
const OptionsResultSchema = z.object({
  identity: z.object({
    name: z.string(),
    region: z.string().optional(),
    address: z.string().optional(),
    instagram: z.string().optional(),
    homepage: z.string().optional(),
    hint: z.string().optional(),
  }),
  instagramCandidates: z
    .array(z.string())
    .describe("인스타 핸들 후보 0~4개(@형식) — 확정 안 됐을 때 사장이 고를 추정치"),
  oneLiners: z.array(z.string()).describe("한 줄 소개 후보 5개 — 서로 다른 앵글"),
  descriptions: z.array(z.string()).describe("브랜드 소개 후보 5개 — 서로 다른 앵글, 각 3~5문장, 어미는 시스템 지침의 '어미 리듬'(기능 기반 혼합체)"),
  values: z.array(z.string()).describe("브랜드 결 단어 2~4개"),
  activityHints: z
    .array(
      z.object({
        title: z.string().describe("짧은 활동명"),
        desc: z.string().describe("한두 문장 요약, 해요체"),
        source: z.string().describe("출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나"),
      })
    )
    .describe("조사 메모에 실제 언급된 활동 흔적 0~3건. 없으면 빈 배열"),
  collabHints: z
    .array(
      z.object({
        partner: z.string().describe("파트너/함께한 곳 이름"),
        desc: z.string().describe("한두 문장 요약, 해요체"),
        source: z.string().describe("출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나"),
      })
    )
    .describe("조사 메모에 실제 언급된 콜라보 흔적 0~3건. 없으면 빈 배열"),
  blockHints: z
    .array(
      z.object({
        type: z.enum(["metrics", "press", "space", "reviews"]),
        reason: z.string().describe('"인스타그램에서 팔로워 1.2만을 봤어요" 형태 근거 한 줄'),
        desc: z
          .string()
          .optional()
          .describe("space 공간 소개 밑그림(해요체 한두 문장). metrics·press·reviews는 생략"),
        items: z
          .array(
            z.object({
              label: z.string(),
              value: z.string().optional(),
              year: z.string().optional(),
              desc: z.string().optional(),
            })
          )
          .optional()
          .describe("metrics·press 밑그림. press item의 desc=그 매체가 브랜드를 소개한 내용 한 줄 요약. space·reviews는 생략"),
      })
    )
    .max(2)
    .default([])
    .describe("조사 근거가 뚜렷할 때만 추천 블록 최대 2개. 없으면 빈 배열"),
  seeksHint: z
    .object({
      types: z.array(z.string()).max(3).describe("콜라보 유형 최대 3개(제품콜라보·팝업·워크숍·공동굿즈·공동콘텐츠·행사참여·공간대여 중)"),
      note: z.string().describe("해요체 한두 문장"),
      reason: z.string().describe("'~에서 봤어요' 근거 한 줄"),
    })
    .nullable()
    .default(null)
    .describe("이 브랜드가 원하는 파트너·협업 근거가 보일 때만. 없으면 null"),
});

const GEMINI_OPTIONS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    identity: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        region: { type: Type.STRING, description: "지역(예: 서울 성수). 없으면 빈 문자열" },
        address: { type: Type.STRING, description: "주소. 없으면 빈 문자열" },
        instagram: { type: Type.STRING, description: "@handle. 없으면 빈 문자열" },
        homepage: { type: Type.STRING, description: "홈페이지 URL. 없으면 빈 문자열" },
        hint: { type: Type.STRING, description: "지역·업종 한 줄. 없으면 빈 문자열" },
      },
      required: ["name"],
    },
    instagramCandidates: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "인스타 핸들 후보 0~4개(@형식). identity.instagram이 확정 안 됐을 때 사장이 고를 수 있게, 도메인·브랜드명 기반 그럴듯한 추정 핸들을 제시. 확정값은 여기 중복하지 말 것.",
    },
    oneLiners: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "한 줄 소개 후보 5개 — 서로 확실히 다른 앵글로",
    },
    descriptions: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "브랜드 소개 후보 5개 — 서로 다른 앵글, 각 3~5문장, 어미는 시스템 지침의 '어미 리듬'(기능 기반 혼합체)",
    },
    values: { type: Type.ARRAY, items: { type: Type.STRING }, description: "브랜드 결 단어 2~4개" },
    activityHints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "짧은 활동명" },
          desc: { type: Type.STRING, description: "한두 문장 요약, 해요체" },
          source: { type: Type.STRING, description: "출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나" },
        },
        required: ["title", "desc", "source"],
      },
      description: "조사 메모에 실제 언급된 활동(워크숍·클래스·팝업·제품라인 등) 흔적 0~3건. 메모에 없으면 빈 배열 — 창작 금지",
    },
    collabHints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          partner: { type: Type.STRING, description: "파트너/함께한 곳 이름" },
          desc: { type: Type.STRING, description: "한두 문장 요약, 해요체" },
          source: { type: Type.STRING, description: "출처 유형: 네이버 블로그 후기/카페글/웹 검색/인스타그램 중 하나" },
        },
        required: ["partner", "desc", "source"],
      },
      description: "조사 메모에 파트너명이 드러난 협업 소식 0~3건. 메모에 없으면 빈 배열 — 창작 금지",
    },
    blockHints: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          type: { type: Type.STRING, description: "metrics|press|space|reviews 중 하나" },
          reason: {
            type: Type.STRING,
            description: '"인스타그램에서 팔로워 1.2만을 봤어요" 형태의 근거 한 줄',
          },
          desc: {
            type: Type.STRING,
            description: "space 공간 소개 밑그림(해요체 한두 문장). metrics·press·reviews는 빈 문자열",
          },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                label: { type: Type.STRING },
                value: { type: Type.STRING, description: "없으면 빈 문자열" },
                year: { type: Type.STRING, description: "없으면 빈 문자열" },
                desc: { type: Type.STRING, description: "press: 그 매체가 브랜드를 소개한 내용 한 줄 요약. 없으면 빈 문자열" },
              },
              required: ["label"],
            },
            description: "metrics·press 밑그림(label·value·year·desc). space·reviews는 빈 배열",
          },
        },
        required: ["type", "reason"],
      },
      description: "조사 근거가 뚜렷할 때만 추천 블록 최대 2개. 근거 없으면 빈 배열 — 창작 금지",
    },
    seeksHint: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        types: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "콜라보 유형 최대 3개(제품콜라보·팝업·워크숍·공동굿즈·공동콘텐츠·행사참여·공간대여 중)",
        },
        note: { type: Type.STRING, description: "해요체 한두 문장" },
        reason: { type: Type.STRING, description: "'~에서 봤어요' 근거 한 줄" },
      },
      required: ["types", "note", "reason"],
      description: "조사에서 이 브랜드가 원하는 파트너·협업 근거가 보일 때만. 없으면 null — 창작 금지",
    },
  },
  required: ["identity", "instagramCandidates", "oneLiners", "descriptions", "values", "activityHints", "collabHints", "blockHints", "seeksHint"],
};

const OPTIONS_SYSTEM = `너는 콜라보 플랫폼 collab5의 브랜드 소개 카피라이터야. 웹 조사 메모를 바탕으로 브랜드가 고를 수 있는 '한 줄 소개'와 '브랜드 소개'를 각각 5개씩 서로 다른 앵글로 만든다.

${BRAND_VOICE}

작성 규칙:
- oneLiners 5개 (각 20~40자):
  · 공식 = [이 브랜드만의 구체 디테일: 무엇을·어떻게] + [누구에게/어떤 가치]. 조사 메모의 구체 명사(재료·방식·활동·지역·제품명)를 자연스럽게 담아라 — 억지로 끼워 넣기보다, 그 명사가 문장의 핵심 의미를 전달하게.
  · ⭐이 브랜드만의 고유한 특징을 담아, 다른 업체에 붙이면 어색하거나 틀린 문장이 되도록 써라. "정성으로 만드는", "특별한 경험을 드리는" 같은 어디에나 붙는 문장 금지.
  · ⭐문장 골격 = 브랜드가 하는 일의 담백한 사실 진술을, 누군가에게 말로 소개하듯. 서술어는 "~을 만들고 있어요 / ~을 운영하고 있어요 / ~을 이어가고 있어요 / ~해오고 있어요"처럼 행위+진행형으로 끝내라. 단답 현재형("~을 열어요/만들어요/이야기해요")은 설명문처럼 딱딱하니 금지 — "수선 워크숍을 열어요"(X) → "수선 워크숍을 열고 있어요"(O), "수선 문화를 이야기해요"(X) → "수선 문화를 만들어 가고 있어요"(O). 감성 동사 서술어(선물해요·전해요·선사해요·불어넣어요·물들여요 등)와 권유형 서술어(만나보세요·함께해요·경험해보세요 등) 금지 — 시적 수식은 문장 앞쪽 수식어로 한 번까지만.
  · 브랜드 시점으로 써라. 고객 시점 서술("~을 배워요", "~을 경험해요") 금지 — "헌 옷 수선을 배워요"(X) → "헌 옷 수선 워크숍을 운영하고 있어요"(O).
  · 브랜드명은 넣지 마라(카드에 이름이 따로 보인다 — 이름 없이 서는 문장으로).
  · 5개 앵글: ①핵심 제품·방식(가장 구체) ②철학·태도를 구체 행동으로 ③고객이 얻는 경험 ④숫자·이력 근거(조사에 있을 때만, 없으면 다른 각도) ⑤협업 파트너가 끌릴 지점.
  · 형용사를 줄이고 명사로 말하라. "감성적인 소품"(X) → "폐원단으로 짓는 파우치"(O).
- descriptions 5개 (각 3~5문장, 어미는 아래 '어미 리듬' 규칙):
  · ⭐⭐1인칭 시점 필수 — 사장이 자기 브랜드를 직접 말하는 어투. ①문장 주어로 브랜드명·'이곳'·'이 브랜드'를 쓰지 마라('○○는/은 ~해요' 금지). ②브랜드명 자체를 문장에 넣지 마라("안녕하세요 ○○입니다" 같은 자기소개도 금지). ③주어는 '저희/우리' 또는 생략 — ⚠️매 문장을 '저희는'으로 시작하지 말고 자연스럽게 변주해라(주어 생략을 적극 활용). 예: "호락호락도서관은 매력적인 공간이에요"(X) → "매력적인 공간을 가꿔가고 있어요"(O).
  · ⭐⭐어미 리듬 = 문장의 역할이 어미를 정한다(기능 기반 혼합체). 믿음·주장·확정 선언(뼈대)은 "~합니다"("자신을 표현하는 방법이라고 생각합니다" / "취향과 표현을 발견합니다"), 이유·부연·숨 고르기(연결)는 "~이에요/~예요"("이야기가 담기기 때문이에요"), 바람·지향(마무리)은 차분한 "~바랍니다". ⚠️합니다만 연속=사보처럼 딱딱 / 에요만 연속=수다처럼 가벼움 — 선언 사이에 부연이 끼며 숨 쉬는 리듬으로 섞어라. 애교체(~한답니다·~하고 있죠·~거든요)는 지양(조용한 확신이 기준). 과한 이모지·느낌표 금지.
  · ⭐Why가 한 번은 보이게 — 5개 후보 전체에서 "왜 이 일을 하는가"(브랜드가 믿는 가치)가 최소 한 번은 드러나야 한다. 단 Why도 조사 메모의 구체에 뿌리내려야 하며("정성을 담습니다"류 어디에나 붙는 철학 금지), 모든 후보를 "우리는 ~을 믿습니다. 그래서"로 시작하는 템플릿 반복은 금지 — 철학·시작스토리 앵글에 강하게, 나머지 앵글은 활동→경험 흐름으로.
  · ⭐시점 전환 — 브랜드의 바람 대신 사람들이 얻는 경험을 확정 서술하라. "참가자들이 ~하길 바라는 마음으로요"(X) → "참가자들은 만들어가며 자신만의 취향과 표현을 발견합니다"(O). 활동 나열보다 그 활동으로 사람들이 무엇을 얻는지가 먼저.
  · 안내·영업 꼬리 금지 — "~하실 수 있도록 돕고 있어요", "~함께 하고 싶어요" 같은 서비스 안내 멘트는 빼라. 믿음과 경험을 진술하면 초대는 저절로 전해진다.
  · ⭐⭐상투어 블랙리스트 금지 — "믿습니다 / 응원합니다·응원해요 / 빛나는(미래·성장 등) / 든든한 버팀목 / 소중한 / 특별한 / 함께 성장 / 꿈을 향해 / 첫걸음·시작점" 같은 추상 격려·감정어를 쓰지 마라. 이런 말은 아무 브랜드에나 붙는 공허한 상투어다 — 이 브랜드가 아닌 문장은 지워라.
  · ⭐⭐마무리 규칙(핵심) — 마지막 문장을 추상 응원·격려·바람으로 끝내지 마라("~되기를 바랍니다 / ~응원합니다"류 마무리 금지). 대신 그 브랜드만의 구체 사실이나 담백한 진술로 닫아라. 예: "빛나는 미래를 응원합니다"(X) → "매주 목요일 저녁, 함께 책을 읽습니다"(O).
  · ⭐형용사보다 명사·행위 — 감정 형용사("빛나는·소중한·특별한")를 줄이고 조사 자료의 구체 사실(활동·프로그램·공간·재료·방식)로 말하라.
  · ⚠️균형 — 위 세 규칙은 따뜻함(warmth)을 죽이라는 게 아니다. 담백함(조용한 확신)은 유지하되 구체에 뿌리내리지 않은 빈 감정어만 걷어내는 거다. 지나치게 사무적·건조해지지 않게, 온기는 구체 사실 속에서 배어나게 하라.
  · 1문장째 = 우리가 무엇을 하는 곳인지 구체적으로. 일반론("~을 사랑하는 브랜드예요") 금지.
  · 가운데 = 조사 메모의 사실 2~3개를 구체적으로(제품·활동·공간·이력 — 고유명사·재료·방식 그대로). "다양한 활동을 해요"처럼 뭉뚱그리지 마라.
  · 마지막 = 그 앵글의 주제와 자연스럽게 이어지는 마무리 한 문장. 협업의 여지를 부드럽게 남기되, 모든 후보를 일률적인 협업 초대로 끝내지 마라(영업 멘트 금지).
  · 5개 앵글: 시작 스토리 / 제품·방식 / 활동·경험 / 고객·쓰임 / 협업 상상.
- ⚠️조사 메모에 구체 명사·사실이 부족하면 위 개수·구체성 요구보다 '창작·과장 금지'가 우선이다. 없는 디테일을 지어내지 말고, 메모 안에서 가장 구체적인 수준으로만 써라.
- ⭐가중 키워드가 주어지면 그 방향을 최우선으로 반영해 모든 후보를 그 결에 맞춘다. 단 키워드를 나열하지 말고 문장에 녹여라.
- 조사 메모 안의 사실만 쓴다. 창작·과장 금지. identity(주소·홈피 등)는 확인된 것만, 없으면 빈 문자열.
- 인스타: 실제 확인된 핸들만 identity.instagram에 넣는다(추측 금지). 확정 못 하면 identity.instagram은 빈 문자열로 두고, 대신 instagramCandidates에 도메인·브랜드명 기반 그럴듯한 추정 핸들 2~4개를 제시한다(사장이 직접 고를 후보용). 예: 도메인이 canvasgarden.shop이면 @canvasgarden, @canvasgarden_official, @canvasgarden.shop 등.
- activityHints: 조사 메모에 실제로 언급된 이 브랜드의 활동(워크숍·클래스·팝업·제품라인 등)만 0~3건. collabHints: 메모에 파트너명이 드러난 협업 소식만 0~3건. 각 항목의 source는 그 정보가 나온 출처 유형(네이버 블로그 후기/카페글/웹 검색/인스타그램)으로. ⚠️메모에 없으면 절대 만들지 말고 빈 배열로 둬라(참고용 힌트라 사실만).
- blockHints: 조사에서 근거가 뚜렷할 때만 추천 블록 최대 2개.
  공개 수치 발견(팔로워·서포터·펀딩액·판매량·매출·운영 연차·직원 규모·입점처 수 등, ⚠️후기 수·별점은 제외) → metrics(items에 label·value 밑그림) /
  언론·수상·방송 → press(items에 label=매체·수상명, year, desc=그 매체가 이 브랜드를 소개한 내용 한 줄 요약 "해요체". desc는 조사 메모에 실제로 드러난 내용만 — 없으면 빈 문자열, 창작 금지) /
  공간 운영 흔적 → space(items 없음, desc=공간이 어떤 분위기이고 무엇을 할 수 있는지 조사 메모 근거로 해요체 한두 문장. 근거 없으면 빈 문자열).
  ⚠️reviews(고객 후기) 블록은 지금은 추천하지 마라 — 후기 표현은 별도 재설계 예정이라 blockHints에 reviews를 넣지 않는다.
  reason은 반드시 "~에서 …을 봤어요" 형태의 근거 한 줄. 근거 없으면 빈 배열.
- seeksHint: 조사에서 이 브랜드가 어떤 파트너·협업을 원하는지 근거가 보이면 제안(없으면 null). 지어내지 않는다. types는 콜라보 유형(제품콜라보·팝업·워크숍·공동굿즈·공동콘텐츠·행사참여·공간대여 중), note는 해요체 한두 문장, reason은 '~에서 봤어요' 근거.

조사 메모 → 출력 매핑(각 항목의 근거 섹션. 해당 섹션이 없거나 "확인 안 됨"이면 그 출력은 빈 값/빈 배열/null로 둔다):
- [브랜드가 직접 쓴 소개] 메타 → oneLiners·descriptions의 사실 근거(사장 직접 설명 다음 순위)
- [정체]의 창업 배경·철학 → descriptions의 스토리 앵글 근거
- [활동] + [네이버 표적검색] + 블로그·카페 후기 → activityHints
- [콜라보] + [네이버 표적검색]의 콜라보 흔적 → collabHints (파트너명 명시된 것만)
- [원하는 협업] → seeksHint
- [숫자] → blockHints(metrics) / [알려짐] → blockHints(press) / [공간] → blockHints(space) (⚠️후기는 지금 다루지 않음 — reviews 블록 생성 금지)
- [고객] → descriptions에서 고객 맥락으로 활용
시간 감각: 연도가 보이면 최근 정보 우선. 오래된 활동은 과거형("~했어요")으로 쓰고, 지금도 하는지 불확실하면 단정하지 마라. 연도 정보가 아예 없으면 현재 진행형 단정을 피하고 "~해왔어요" 같은 완곡한 표현을 써라.

⛔출력 직전 자기검열(descriptions 5개 각각) — 다음 상투어가 한 단어라도 있으면 그 문장을 구체 사실로 다시 써라: 믿습니다 / 응원합니다·응원해요·지지합니다 / 빛나는 / 든든한 / 소중한 / 특별한 / 함께 성장 / 꿈(을 향해·을 펼치다) / 첫걸음·시작점 / 긍정적인 에너지 / 새로운 내일·미래. 특히 각 후보의 마지막 문장이 "~응원합니다 / ~바랍니다"류 추상 격려로 끝나면 안 된다 — 그 브랜드만의 구체 사실(활동·프로그램·공간·재료·방식·시간)로 닫아라. 이건 warmth를 죽이라는 게 아니라, 구체에 뿌리내리지 않은 빈 감정어만 걷어내라는 것이다(담백한 온기는 사실 속에서 배어난다).`;

class ClaudeSearchProvider implements SearchProvider {
  private _client: Anthropic | null = null;
  private client() {
    // ANTHROPIC_API_KEY를 env에서 읽음. maxRetries=4 → 529/과부하 일시 오류 자동 재시도.
    return (this._client ??= new Anthropic({ maxRetries: 4 }));
  }

  private textOf(content: Anthropic.ContentBlock[]): string {
    return content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");
  }

  async lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]> {
    const client = this.client();

    // 1단계: web_search로 사실 조사 — ⚡비용 최적화:
    //  · 단일 호출(루프 없음) → 검색 결과가 다음 호출에 누적되는 토큰 폭증 제거
    //  · max_uses=2 → 검색 횟수 제한 (검색비 + 결과 토큰 둘 다 캡)
    //  · max_tokens 축소 + "핵심만 간결히" → 출력 토큰 캡
    const researchPrompt = `다음 한국 업체/브랜드를 웹에서 딱 한 번만 검색해서 조사해줘: "${query}"${
      hintUrl ? `\n참고 링크(이 링크를 우선 확인): ${hintUrl}` : ""
    }
찾을 것: 무엇을 하는 곳인지, 인스타그램 핸들, 홈페이지, 주소, 브랜드 분위기·가치.
같은 이름의 다른 업체가 있으면 각각 구분해서. 확실하지 않은 건 추측하지 말고 "확인 못 함"으로.
짧은 메모 형식으로 핵심만(장황한 설명·인용 금지).`;

    const research = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      // ⚡max_uses=1: 검색 1회로 제한 → web_search 결과(input 토큰 80% 차지)를 절반으로.
      tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 1 }],
      messages: [{ role: "user", content: researchPrompt }],
    });
    const researchText = this.textOf(research.content);
    console.log("[enrich] research usage:", JSON.stringify(research.usage));

    // 2단계: 조사 요약 → 등록 폼 후보로 구조화 (web_search 없음 → input 작음)
    const structured = await client.messages.parse({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      system: ENRICH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `원래 검색어: "${query}"\n\n[웹 조사 요약]\n${researchText}\n\n위 조사 내용을 등록 폼 후보로 정리해줘.`,
        },
      ],
      output_config: { format: zodOutputFormat(EnrichResultSchema) },
    });

    console.log("[enrich] structure usage:", JSON.stringify(structured.usage));
    return (structured.parsed_output?.candidates ?? []) as EnrichCandidate[];
  }
}

// ── 네이버 검색(무료) + Gemini Flash(구조화) provider ──
// ⚡ 비용 최적화: 검색비 0(네이버 일 25,000회 무료) + 구조화 Gemini Flash(호출당 ~5원).
//    Claude web_search($0.18/호출) 대비 30배 이상 절감. 한국 로컬 업체 주소/업종 정확도↑.

/** 네이버 검색 응답 item (필요 필드만) */
interface NaverItem {
  title?: string;
  link?: string;
  category?: string;
  description?: string;
  telephone?: string;
  address?: string;
  roadAddress?: string;
  bloggername?: string;
}

/** Gemini용 응답 스키마 (EnrichResultSchema의 OpenAPI 형태) */
const GEMINI_RESULT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    candidates: {
      type: Type.ARRAY,
      description: "같은 이름의 서로 다른 업체는 각각 별도 후보로",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "정규화된 상호명" },
          oneLiner: { type: Type.STRING, description: "한 줄 소개 초안 (없으면 빈 문자열)" },
          region: { type: Type.STRING, description: "지역 (예: 서울 성수). 없으면 빈 문자열" },
          address: { type: Type.STRING, description: "주소. 없으면 빈 문자열" },
          instagram: { type: Type.STRING, description: "@handle 형식. 없으면 빈 문자열" },
          homepage: { type: Type.STRING, description: "홈페이지 URL. 없으면 빈 문자열" },
          description: { type: Type.STRING, description: "소개 한 문단 초안" },
          values: { type: Type.ARRAY, items: { type: Type.STRING }, description: "브랜드 결 칩 2~4개" },
          sources: {
            type: Type.ARRAY,
            description: "확인된 검증가능 필드의 출처",
            items: {
              type: Type.OBJECT,
              properties: {
                field: { type: Type.STRING, description: "instagram|homepage|address|name|description" },
                label: { type: Type.STRING },
                url: { type: Type.STRING },
              },
              required: ["field", "label", "url"],
            },
          },
          missing: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "웹에서 확인 못 한 검증가능 필드 (instagram|homepage|address)",
          },
          hint: { type: Type.STRING, description: "동명 구분용 한 줄 (지역·업종). 없으면 빈 문자열" },
        },
        required: ["name", "oneLiner", "description", "values", "sources", "missing"],
      },
    },
  },
  required: ["candidates"],
};

// ── 오귀속 가드(피망당구클럽 114On 사건 2026-07-19) ──
// 집계·디렉토리·기관 사이트는 브랜드 홈페이지가 아니다. 이런 도메인의 메타를
// "브랜드가 직접 쓴 소개 · 신뢰도 최상"으로 승격하면 무관한 서비스 소개(전화번호검색 등)가
// 소개서 재료로 주입된다. pickHomepage(승격)·extractLinksFromResearch(링크 후보) 공용.
const DIRECTORY_HOSTS = [
  "114.co.kr", // 전화번호부 — "○○ - 114On" 디렉토리 페이지가 웹문서 상위에 흔함
  "bizno.net", "moneypin.biz", "nicebizinfo.com", // 사업자정보 조회
  "saramin.co.kr", "jobkorea.co.kr", "jobplanet.co.kr", "rocketpunch.com", "wanted.co.kr", "catch.co.kr", // 채용·기업정보
  "diningcode.com", "mangoplate.com", "siksinhot.com", "yogiyo.co.kr", "baemin.com", // 맛집·배달 집계
  "spoinfo.or.kr", // 체육시설알리미(공단) — or.kr 블랭킷 차단은 비영리 브랜드를 다치게 해서 개별 등재
  "tabling.co.kr", "catchtable.co.kr", // 예약 플랫폼 — 제미나이가 홈페이지로 오인(콜렉트마이페이보릿 사건)
];
export function isDirectoryHost(host: string): boolean {
  const h = host.replace(/^www\./, "").toLowerCase();
  if (h.endsWith(".go.kr")) return true; // 정부·공공(체육시설알리미 등)은 브랜드 홈페이지일 수 없다
  return DIRECTORY_HOSTS.some((d) => h === d || h.endsWith("." + d));
}

/** fetch한 페이지가 정말 이 브랜드의 것인가 — html(제목·본문·푸터 상호 포함)에 브랜드명이
 *  통째로(공백 무시) 등장해야 인정. 남의 사이트(미등재 디렉토리 등)의 메타·인스타 승격을 차단.
 *  안전 방향: 확인 실패 시 버린다(최악=메타 없이 thin 폴백 > 최악=헛소리 주입). */
export function homepageBelongsToBrand(html: string, brandName: string): boolean {
  const key = brandName.replace(/\s/g, "").toLowerCase();
  if (key.length < 2) return false;
  const hay = html.slice(0, 300_000).replace(/\s/g, "").toLowerCase();
  return hay.includes(key);
}

class NaverGeminiProvider implements SearchProvider {
  private naverId = process.env.NAVER_CLIENT_ID!;
  private naverSecret = process.env.NAVER_CLIENT_SECRET!;
  private _ai: GoogleGenAI | null = null;
  private ai() {
    return (this._ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! }));
  }
  private _claude: Anthropic | null = null;
  private claude() {
    // Gemini 전멸 시 폴백용. ANTHROPIC_API_KEY 사용(이미 결제된 키).
    return (this._claude ??= new Anthropic({ maxRetries: 2 }));
  }

  /** 네이버 검색 API 1종 호출. 실패해도 throw 안 하고 빈 배열(graceful). */
  private async naver(
    type: "local" | "webkr" | "blog" | "cafearticle" | "kin",
    query: string,
    display: number
  ): Promise<NaverItem[]> {
    try {
      const url = `https://openapi.naver.com/v1/search/${type}.json?query=${encodeURIComponent(query)}&display=${display}`;
      const res = await fetch(url, {
        headers: { "X-Naver-Client-Id": this.naverId, "X-Naver-Client-Secret": this.naverSecret },
      });
      if (!res.ok) {
        console.warn(`[enrich] naver ${type} ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { items?: NaverItem[] };
      return data.items ?? [];
    } catch (e) {
      console.warn(`[enrich] naver ${type} error`, e);
      return [];
    }
  }

  /** 네이버 결과의 <b>태그·HTML 엔티티 제거 */
  private clean(s?: string): string {
    if (!s) return "";
    return s
      .replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
      .trim();
  }

  /** 네이버 결과 링크에서 브랜드 홈페이지(네이버/블로그/SNS/집계사이트 아닌 도메인) 하나 고르기.
   *  2패스: 얕은 경로(루트·1단) 우선 — 깊은 상세경로(/detail/123 등)는 디렉토리 문서가 흔해서
   *  후순위로 미루고, 최종 채택 여부는 gather()의 브랜드 실재 검증이 판정한다. */
  private pickHomepage(items: NaverItem[]): string | undefined {
    const candidates: { origin: string; depth: number }[] = [];
    for (const it of items) {
      try {
        const u = new URL(it.link ?? "");
        const host = u.hostname.replace(/^www\./, "");
        if (/(^|\.)(naver|blog|instagram|facebook|youtube|tistory|kakao)\./.test(host)) continue;
        if (isDirectoryHost(host)) continue; // 집계·디렉토리 — 브랜드 홈페이지 아님
        const depth = u.pathname.split("/").filter(Boolean).length;
        candidates.push({ origin: u.origin, depth });
      } catch {
        /* 잘못된 URL 스킵 */
      }
    }
    return (candidates.find((c) => c.depth <= 1) ?? candidates[0])?.origin;
  }

  /** 홈페이지 정적 HTML 1회 fetch — 인스타 스니핑 + 메타 수확이 같은 html을 재사용(fetch 1회 유지) */
  private async fetchHomepage(homepage: string): Promise<{ html: string } | undefined> {
    try {
      const res = await fetch(homepage, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; collab5bot/1.0)" },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) return undefined;
      return { html: await res.text() };
    } catch {
      return undefined;
    }
  }

  /** 홈페이지 HTML에서 실제 instagram.com/핸들 링크만 추출(확실한 신호 — 추측 아님) */
  private sniffInstagramFromHtml(html: string): string | undefined {
    const SKIP = new Set(["p", "reel", "reels", "explore", "accounts", "about", "developer", "legal", "tv", "stories"]);
    // instagram.com/handle (이메일·문구가 아닌 실제 링크만)
    for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g)) {
      const handle = m[1].replace(/\.$/, "");
      if (!SKIP.has(handle.toLowerCase())) return "@" + handle;
    }
    return undefined;
  }

  /** 홈페이지 HTML에서 브랜드가 직접 쓴 메타(title·description·og:*) 수확 — 신뢰도 최상 소스.
   *  이미 fetch한 html 재활용(추가 비용 0). 각 값은 clean(엔티티 제거)·trim 후 최대 300자. */
  private extractHomepageMeta(html: string): { title?: string; desc?: string } {
    const head = html.slice(0, 200_000);
    const cap = (s?: string): string | undefined => {
      const v = this.clean(s);
      return v ? v.slice(0, 300) : undefined;
    };
    // <meta ... name|property="key" ... content="..."> — 속성 순서 양방향 대응
    const meta = (attr: "name" | "property", key: string): string | undefined => {
      const re = new RegExp(
        `<meta[^>]*${attr}=["']${key}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*${attr}=["']${key}["']`,
        "i"
      );
      const m = head.match(re);
      return cap(m?.[1] ?? m?.[2]);
    };
    const titleTag = cap(head.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]);
    const title = meta("property", "og:title") ?? titleTag ?? meta("property", "og:site_name");
    const desc = meta("property", "og:description") ?? meta("name", "description");
    return { title, desc };
  }

  /** 홈페이지 fetch 1회 → 인스타 스니핑 + 브랜드가 직접 쓴 메타(title·description) 동시 수확.
   *  verified: fetch한 페이지에 브랜드명이 실재하는가 — false면 남의 사이트(오귀속).
   *  undefined = fetch 실패로 검증 불가(봇 차단 등 — 오귀속 단정도 불가). */
  private async fetchHomepageSignals(
    homepage: string,
    brandName: string
  ): Promise<{ instagram?: string; title?: string; desc?: string; verified?: boolean }> {
    const page = await this.fetchHomepage(homepage);
    if (!page) return {};
    const meta = this.extractHomepageMeta(page.html);
    return {
      instagram: this.sniffInstagramFromHtml(page.html),
      ...meta,
      verified: homepageBelongsToBrand(page.html, brandName),
    };
  }

  /** 지역+웹문서+블로그+카페+표적쿼리 병렬 검색 + 홈페이지 인스타·메타 수확 → '조사 메모'로 조립.
   *  region이 있으면 지역검색 정확도↑(동명 업체 구분). 블로그·카페=소비자 후기 신호.
   *  표적쿼리(콜라보·팝업·워크숍)=activityHints·collabHints의 근거가 될 흔적 채굴. */
  private async gather(query: string, region?: string): Promise<string> {
    const localQuery = region?.trim() ? `${query} ${region.trim()}` : query;
    const [local, web, blog, cafe, collabBlog, popupBlog, workshopBlog] = await Promise.all([
      this.naver("local", localQuery, 5),
      this.naver("webkr", query, 3),
      this.naver("blog", query, 5),
      this.naver("cafearticle", query, 3),
      this.naver("blog", `${query} 콜라보`, 3),
      this.naver("blog", `${query} 팝업`, 3),
      this.naver("blog", `${query} 워크숍 클래스`, 3),
    ]);

    // 홈페이지 정적 HTML 1회 fetch — 인스타 링크 확인 + 메타(브랜드가 직접 쓴 소개) 수확
    let homepage = this.pickHomepage([...local, ...web]);
    let signals = homepage ? await this.fetchHomepageSignals(homepage, query) : {};
    // 오귀속 가드 — fetch했는데 페이지 어디에도 브랜드명이 없으면 남의 사이트다(미등재 디렉토리 등).
    // 메타·인스타·홈페이지 링크 전부 폐기: 같은 오염원에서 나온 것들이라 하나만 남겨도 사고.
    if (signals.verified === false) {
      console.log("[enrich] homepage-misattr", JSON.stringify({ query, dropped: homepage }));
      homepage = undefined;
      signals = {};
    }
    const sniffedIg = signals.instagram;

    // 동명 노이즈 필터 — 블로그·카페·표적검색은 제목+설명에 브랜드명이 통째로(공백 무시) 들어간 것만.
    // (예: "캔버스가든" 검색이 "에르메스 가든파티 캔버스"·"스누피가든"에 분리 매칭되는 오염 차단)
    const brandKey = query.replace(/\s/g, "");
    const mentionsBrand = (it: NaverItem) =>
      (this.clean(it.title) + this.clean(it.description)).replace(/\s/g, "").includes(brandKey);
    // negative-region 재랭킹 — 사용자 지역이 있으면, '다른 광역을 명시한' 문서(=동명 타지역 업체)를
    //   추가로 드롭. 지역 언급이 없는 문서는 안 건드린다(본인 후기가 동네명 생략하는 경우 보호).
    const rgn = region?.trim() ?? "";
    const docText = (it: NaverItem) => `${this.clean(it.title)} ${this.clean(it.description)}`;
    const keep = rgn
      ? (it: NaverItem) => mentionsBrand(it) && !regionConflict(rgn, docText(it))
      : mentionsBrand;
    const blogF = blog.filter(keep);
    const cafeF = cafe.filter(keep);
    const collabF = collabBlog.filter(keep);
    const popupF = popupBlog.filter(keep);
    const workshopF = workshopBlog.filter(keep);

    // 지도 교차검증 — local(지도) 결과 주소가 사용자 지역과 같은 광역인가.
    //   일치=지도가 이 브랜드를 맞게 특정(앵커 신뢰) / 불일치=동명 타지역 업체 오매칭 의심 / 0건=미등록.
    const localAddr = (it: NaverItem) =>
      `${this.clean(it.roadAddress)} ${this.clean(it.address)} ${this.clean(it.title)}`;
    const mapMatched = !!rgn && local.some((it) => regionMatches(rgn, localAddr(it)));
    const mapCollided = !!rgn && local.length > 0 && !mapMatched;

    const parts: string[] = [];
    // 메모 최상단 — 브랜드가 직접 쓴 소개(홈페이지 메타)가 있으면 가장 먼저
    if (signals.title || signals.desc) {
      parts.push("[브랜드가 직접 쓴 소개 — 홈페이지 메타 · 신뢰도 최상]");
      if (signals.title) parts.push(`· 제목: ${signals.title}`);
      if (signals.desc) parts.push(`· 소개: ${signals.desc}`);
      parts.push("");
    }
    if (sniffedIg || homepage) {
      parts.push("[홈페이지 직접 확인 — 신뢰도 높음]");
      if (homepage) parts.push(`· 홈페이지: ${homepage}`);
      parts.push(
        sniffedIg
          ? `· 인스타그램: ${sniffedIg} (홈페이지 링크에서 실제 확인됨 — 이 값을 신뢰해서 채워)`
          : `· 인스타그램: 홈페이지 정적 HTML에서 링크 확인 안 됨(추측하지 말 것)`
      );
    }
    // 지도 교차검증 결과를 메모 상단에 명시 — 구조화 모델이 지역 안 맞는 정보를 거르게.
    if (mapMatched) {
      parts.push(
        `\n[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(${rgn})과 일치 — 이 업체가 맞아요. 주소·업종은 신뢰.`
      );
    } else if (mapCollided) {
      parts.push(
        `\n[지도 교차검증] ⚠️ 네이버 지도 결과가 입력 지역(${rgn})과 불일치 — 동명의 다른 지역 업체가 섞였을 수 있어요. 지역이 안 맞는 정보는 이 브랜드 것으로 단정하지 마세요.`
      );
    }
    if (local.length) {
      parts.push("\n[네이버 지역검색 — 주소·업종·전화]");
      for (const it of local) {
        parts.push(
          `· ${this.clean(it.title)} | 업종:${this.clean(it.category)} | 도로명:${this.clean(it.roadAddress)} | 지번:${this.clean(it.address)} | 전화:${this.clean(it.telephone)} | 링크:${it.link ?? ""}`
        );
      }
    }
    if (web.length) {
      parts.push("\n[네이버 웹문서 — 홈페이지·SNS 단서]");
      for (const it of web) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)} | 링크:${it.link ?? ""}`);
      }
    }
    if (blogF.length) {
      parts.push("\n[네이버 블로그 — 소비자 후기·분위기 단서]");
      for (const it of blogF) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)}`);
      }
    }
    if (cafeF.length) {
      parts.push("\n[네이버 카페글 — 실사용 후기·평판 단서]");
      for (const it of cafeF) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)}`);
      }
    }
    // 표적검색 — 콜라보·팝업·워크숍 흔적(쿼리 종류 표기). 0건이면 섹션 생략.
    const targeted: [string, NaverItem[]][] = [
      ["콜라보", collabF],
      ["팝업", popupF],
      ["워크숍", workshopF],
    ];
    if (targeted.some(([, items]) => items.length)) {
      parts.push("\n[네이버 표적검색 — 콜라보·팝업·워크숍 흔적]");
      for (const [label, items] of targeted) {
        for (const it of items) {
          parts.push(`· (${label}) ${this.clean(it.title)} | ${this.clean(it.description)}`);
        }
      }
    }
    return parts.join("\n") || "(검색 결과 없음)";
  }

  // 과부하(503)·레이트리밋(429) 시 다음 모델로 폴백.
  // ⚡ 2.5-flash-lite 1순위(2026-07-01 가성비 최적화): 토큰 $0.10/$0.40 + grounding 무료 1,500건/일.
  //   3.1-flash-lite 대비 토큰 2.5배↓ & grounding 무료 9배↑(일1500 vs 월5000). 구조화·검색엔 이 품질로 충분.
  //   폴백 2.0-flash-lite(토큰 최저 $0.075/$0.30) → 2.5-flash(더 똑똑, 안전망).
  // ⚠️gemini-2.0-flash-lite는 2026-07 기준 404(서비스 종료) — 제거함
  private static readonly GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.5-flash"];
  // 검색 모델 최종 판정(대표 A/B 체감 2026-07-19): flash 1콜 승 — lite 병렬 3콜 병합보다 체감 우위.
  // 기본 1콜(ENRICH_SEARCH_RUNS로 병렬 늘리기 가능), 비접지 시 검색전략 변형 프롬프트로 flash 1회 재시도.
  // 콜당 토큰비 ~6원. lite 병합으로 되돌리기 = PRIMARY를 lite로 + ENRICH_SEARCH_RUNS=3.
  private static readonly SEARCH_PRIMARY = "gemini-2.5-flash";
  private static readonly SEARCH_RESCUE = "gemini-2.5-flash";

  // 모델당 1회 시도(무료 티어 RPM 절약) → 503/429면 즉시 다음 모델로. 전부 실패하면 throw.
  // schema/system을 인자로 받아 구조화 호출을 재사용(구조화·5지선다 공용).
  private async generate(
    contents: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseSchema: any = GEMINI_RESULT_SCHEMA,
    systemInstruction: string = ENRICH_SYSTEM,
    temperature = 0.4
  ): Promise<string> {
    let lastErr: unknown;
    // ENRICH_GEN_MODEL: 생성(구조화) 모델 강제 지정 — A/B 실험·모델 전환용(기본 lite→flash 폴백 체인)
    const genModels = process.env.ENRICH_GEN_MODEL
      ? [process.env.ENRICH_GEN_MODEL]
      : NaverGeminiProvider.GEMINI_MODELS;
    for (const model of genModels) {
      try {
        const response = await this.ai().models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema,
            temperature,
          },
        });
        return response.text ?? "";
      } catch (e) {
        lastErr = e;
        const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
        if (status === 503 || status === 429) {
          console.warn(`[enrich] gemini ${model} ${status} → 다음 모델 폴백`);
          continue;
        }
        throw e; // 과부하 외 에러는 즉시 전파
      }
    }
    throw lastErr;
  }

  // 제미나이 자체 웹 검색(Google Search grounding). 네이버와 별개 소스로 조사.
  // ⚠️ grounding은 responseSchema와 동시 사용 불가 → 순수 텍스트 조사 단계로만.
  //    ENRICH_GEMINI_SEARCH=0 이면 비활성(네이버 단독). grounding은 유료 쿼터 소모.
  private async geminiSearch(
    query: string,
    region?: string,
    businessType?: string,
    anchor?: string
  ): Promise<string> {
    if (process.env.ENRICH_GEMINI_SEARCH === "0") return "";
    // 네이버 검증 앵커 — '어느 업체인지' 조준용(대표 아이디어 2026-07-15). 내용 받아쓰기 금지로 바이어스 방어.
    const anchorBlock = anchor
      ? `\n[업체 특정 앵커 — 네이버 실측 데이터로 이미 확인된 이 업체의 신원]\n${anchor}\n(⚠️이 앵커는 '어느 업체인지' 특정하는 용도로만 써라. 조사 내용은 앵커를 받아쓰지 말고 네가 웹에서 직접 확인한 것만 적어라. 공식 홈페이지 도메인이 있으면 그 사이트 내용을 우선 검색해라. 앵커와 다른 업체의 정보는 절대 섞지 마라.)\n`
      : "";
    // 지역+업종 = 동명 업체 판별 신호. 틀린 업체 정보를 채우느니 빈손이 낫다(솔직 배너가 받아줌).
    // '업종·하는 일'은 고객 자유입력이라 웹 분류와 표현이 다를 수 있음 → 동명 판정 기준을
    // 계열 관용으로 캘리브레이션(대표 지시 2026-07-19: '명백히 다르다' 판단 강화).
    const hintBits = [
      region?.trim() && `위치: ${region.trim()}`,
      businessType?.trim() && `업종·하는 일: ${businessType.trim()}`,
    ].filter(Boolean);
    const loc = hintBits.length
      ? `\n(⭐브랜드 특정 힌트 → ${hintBits.join(" · ")}.
⚠️동명의 남의 업체 판별 기준 — '업종·하는 일'은 고객이 자기 말로 적은 표현이라 웹의 분류·표현과 얼마든지 다를 수 있다:
· 표현이 달라도 같은 계열이면 같은 업체로 본다 — 예: "감자탕"↔"한식·국밥·해장국", "카페"↔"LP카페·디저트·브런치", "공방"↔"클래스·핸드메이드 스튜디오".
· 남의 업체로 판정하는 건 둘 중 하나일 때만: ①위치가 다른 지역이거나 ②하는 일의 뿌리가 서로 양립 불가능할 때(예: 당구장 vs 꽃집). 이때 그 업체 정보는 한 줄도 섞지 마.
· 애매하면 위치 일치를 우선 근거로 삼아라. 힌트와 맞는 업체를 못 찾았으면 지어내지 말고 모든 소제목에 "확인 안 됨"이라고 써.)`
      : "";
    // 검색 전략 — 교차검증(2026-07-19, gemini-2.5-flash 자가 비평)에서 채택:
    // ①검색어 조합 명시 ②소상공인=UGC 인지 ③2차 재시도는 "지역 검색어로 넓게→그 안에서 상호 찾기"로 전환.
    const searchStrategy = (round: number) =>
      round === 1
        ? `\n검색은 한 조합만 하지 말고 여러 조합을 시도해 — "${query}", "${query} ${region?.trim() ?? ""}", "${query} ${businessType?.trim() ?? ""}" 등. 웹 존재감이 약한 동네 가게일 수 있다 — 공식 출처가 없으면 블로그·카페 후기, 지역 커뮤니티 글, 지도 서비스 등록 정보에서도 유의미한 정보를 적극 발굴해(어디서 봤는지 함께).`
        : `\n⚠️직전 조사에서 검색 근거를 못 찾았다. 검색 전략을 바꿔라: ①지역 기반 일반 검색어("${region?.trim() ?? ""} ${businessType?.trim() ?? ""}", "${region?.trim() ?? ""} ${businessType?.trim() ?? ""} 후기/맛집")로 넓게 검색한 뒤 그 결과 안에서 '${query}'를 찾아라 ②상호의 띄어쓰기를 바꿔서도 검색해봐 ③영업시간·메뉴·주차 같은 방문 정보 중심 검색도 시도. 그래도 못 찾으면 지어내지 말고 "확인 안 됨"으로.`;
    const promptFor = (round: number) => `절대 추측하거나 사실이 아닌 정보를 지어내지 마. 웹에서 확인된 것만 적는다.
"${query}" 브랜드/업체를 웹에서 조사해줘.${searchStrategy(round)}${loc}${anchorBlock}
아래 소제목 순서 그대로, 확인된 사실만 개조식으로 정리해줘. 전체 1500자 이내. 해당 정보가 없으면 그 소제목에 "확인 안 됨" 한 줄만 — 소제목 설명에 나온 단어(워크숍·클래스·팔로워·펀딩 등)를 실제 확인 없이 되풀이해 적지 마라.

[정체] 무엇을 만들고/하는 곳인지 한두 줄 + 창업 배경·브랜드 철학·시작 이야기가 있으면 두세 줄
[제품/특징] 주력 제품·서비스와 그 특징·차별점 (재료·방식 등, 각 한 줄)
[활동] 워크숍·클래스·팝업·제품 라인 등 실제로 한 활동 (각각 무엇이었는지)
[콜라보] 다른 브랜드·공간·작가와 함께한 협업 이력 (파트너 이름이 확인된 것만)
[원하는 협업] 이 브랜드가 찾는 파트너·하고 싶다고 밝힌 협업 (모집글·인터뷰 발언 등 근거 필수)
[고객] 주요 고객층·타겟 (연령·관심사 등, 확인된 것만)
[알려짐] 언론·매거진·방송·수상 노출 — ⚠️구체적인 매체명·프로그램명·수상명을 반드시 함께(예: "○○매거진 2023년 소개", "△△대상 수상"). 매체·수상 이름을 모르면 그 줄은 생략(막연히 "매체 노출"이라고만 쓰지 마)
[공간] 오프라인 매장·쇼룸·작업실·카페 운영 여부와 위치
[신뢰정보] 홈페이지 URL · 주소
[키워드] 위 조사에서 이 브랜드를 나타내는 짧은 키워드 8~15개, 쉼표로 구분 (각 2~15자 명사구 — 제품·소재·활동·분위기·강점 위주. 문장 금지, 다른 브랜드 것 섞지 말 것)
출처는 공식 홈페이지·언론 보도가 있으면 우선하되, 지역 소상공인은 그런 출처가 없는 경우가 많다 — 네이버 플레이스·지도 등록 정보, 블로그·카페 후기, 지역 커뮤니티 글 등 웹에서 확인 가능한 출처를 폭넓게 활용해(어디서 봤는지 함께). 연도·날짜가 보이면 함께 적어줘(오래된 정보 구분용).
⭐인스타그램은 실제 instagram.com/○○ 페이지를 확인한 경우에만 @핸들. 브랜드명·도메인으로 추측 금지 — 확인 안 되면 "인스타: 확인 안 됨".
확실하지 않으면 적지 말고 넘어가. 과장·추측 금지.`;
    // 플랜B 병렬 병합(대표 확정 2026-07-19): lite N콜을 병렬로(대기시간 = 1콜) —
    // 각 콜이 독립 grounding 주사위. 마지막 1콜은 검색전략 변형(promptFor(2))으로 다양성 확보.
    // 접지 성공분만 합쳐 메모로. 전멸 시 flash 1회 안전망(promptFor(2)). 비접지 = 검색 과금 0.
    const runs = Math.max(1, Math.min(4, Number(process.env.ENRICH_SEARCH_RUNS) || 1));
    const attempts = await Promise.all(
      Array.from({ length: runs }, (_, i) =>
        this.searchAttempt(
          NaverGeminiProvider.SEARCH_PRIMARY,
          promptFor(runs > 1 && i === runs - 1 ? 2 : 1),
          `병렬${i + 1}/${runs}`
        )
      )
    );
    let grounded = attempts.filter((t) => t);
    if (!grounded.length) {
      console.warn("[enrich] lite 병렬 전멸 → flash 안전망 1회");
      const rescue = await this.searchAttempt(NaverGeminiProvider.SEARCH_RESCUE, promptFor(2), "안전망");
      if (rescue) grounded = [rescue];
    }
    console.log("[enrich] search-merge", JSON.stringify({ runs, grounded: grounded.length }));
    if (!grounded.length) return "";
    if (grounded.length === 1) return grounded[0];
    return grounded
      .map((g, i) => `《병렬 조사 ${i + 1} — 같은 업체를 독립 조사한 결과. 겹치는 내용 = 상호 보강 근거》\n${g}`)
      .join("\n\n");
  }

  /** 검색 1시도(모델·프롬프트 지정) — 접지 성공 시 텍스트, 실패·비접지·에러는 ""(슬롯만 조용히 실패). */
  private async searchAttempt(model: string, prompt: string, tag: string): Promise<string> {
    try {
      const response = await this.ai().models.generateContent({
        model,
        contents: prompt,
        config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
      });
      // ⭐그라운딩 근거 체크 — 근거 없으면 웹을 안 보고 지어낸 답변(캔버스가든 상상업체 사고 이후 도입) → 폐기.
      const gm = response.candidates?.[0]?.groundingMetadata;
      const grounded = !!(gm?.groundingChunks?.length || gm?.groundingSupports?.length);
      if (!grounded) {
        console.warn(`[enrich] gemini ${model} ${tag} 비접지 → 폐기`);
        return "";
      }
      return (response.text ?? "").trim();
    } catch (e) {
      const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
      console.warn(`[enrich] gemini search ${model} ${tag} 실패(${status ?? "?"})`);
      return ""; // 이 슬롯만 포기 — 나머지 병렬 슬롯·안전망이 커버
    }
  }

  // 네이버 메모 + 제미나이 웹 조사 메모를 라벨 붙여 합침(구조화 단계 입력용).
  // ⭐신뢰 서열을 라벨에 박음(대표 지시 2026-07-15): 네이버 = 실측 API 데이터(할루시네이션 없음) → 우선.
  //   제미나이 = 생성 기반(접지 확인은 했지만 여전히 보조). 모든 하위 소비자(구조화·options·draft)가 이 라벨을 본다.
  private combineResearch(naver: string, gemini: string): string {
    const parts = [
      `[출처 1 · 네이버 검색 API — 실측 데이터라 사실성 최상. 단 무관한 업체의 문서가 섞일 수 있으니 브랜드 일치 확인 후 사용. 특히 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색] 블록은 최상위 신뢰]\n${naver || "(결과 없음)"}`,
    ];
    if (gemini)
      parts.push(
        `[출처 2 · 제미나이 웹 조사 — 보조 자료. 출처 1과 충돌하는 내용은 무조건 출처 1을 따를 것]\n${gemini}`
      );
    return parts.join("\n\n");
  }

  /** 빈 문자열 optional 필드 정리 (Gemini/Haiku가 ""로 채우는 경우 → undefined) */
  private normalize(cands: EnrichCandidate[]): EnrichCandidate[] {
    return cands.map((c) => ({
      ...c,
      region: c.region || undefined,
      address: c.address || undefined,
      instagram: c.instagram || undefined,
      homepage: c.homepage || undefined,
      hint: c.hint || undefined,
    }));
  }

  /** Gemini 전멸 시 안전망 — Haiku(이미 결제된 Anthropic 키)로 구조화. 안정적·저렴. */
  private async structureWithHaiku(query: string, research: string, extra: string): Promise<EnrichCandidate[]> {
    const structured = await this.claude().messages.parse({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system: ENRICH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `원래 검색어: "${query}"\n\n[조사 자료]\n${research}${extra}\n\n두 출처를 비교·종합해서 등록 폼 후보로 정리해줘. 서로 보완되는 정보는 합치고, 확실한 것만 채워.`,
        },
      ],
      output_config: { format: zodOutputFormat(EnrichResultSchema) },
    });
    return this.normalize((structured.parsed_output?.candidates ?? []) as EnrichCandidate[]);
  }

  /** 조사 메모 → 등록 폼 후보. Gemini 우선, 전멸 시 Haiku 폴백. */
  private async structure(query: string, research: string, extra = ""): Promise<EnrichCandidate[]> {
    const prompt = `원래 검색어: "${query}"\n\n[조사 자료 — 네이버 검색 + 제미나이 웹 조사]\n${research}${extra}\n\n두 출처를 비교·종합해서 등록 폼 후보로 정리해줘. ⭐충돌하면 출처 1(네이버 — 실측 데이터)을 우선하고, 그 안에서도 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색]이 최상위. 서로 보완되는 정보는 합치고, 확실한 것만 채워. 빈 문자열 필드는 missing 처리하거나 생략해. description은 모든 문장을 '해요체'로 끝내(~해요/~예요/~있어요). '~합니다/~습니다' 금지.`;
    try {
      const text = await this.generate(prompt);
      const parsed = JSON.parse(text) as EnrichResult;
      return this.normalize(parsed.candidates ?? []);
    } catch (e) {
      const status = (e as { status?: number })?.status;
      console.warn(`[enrich] Gemini 구조화 실패(${status ?? "parse?"}) → Haiku 폴백`);
      return this.structureWithHaiku(query, research, extra);
    }
  }

  async lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]> {
    // 네이버 검색 + 제미나이 웹 조사를 병렬로 → 두 소스 종합 → 제미나이 구조화
    const [naver, gemini] = await Promise.all([this.gather(query), this.geminiSearch(query)]);
    const research = this.combineResearch(naver, gemini);
    const extra = hintUrl ? `\n\n참고 링크(우선 확인): ${hintUrl}` : "";
    return this.structure(query, research, extra);
  }

  // 조사 메모(네이버+제미나이)만 생성 — 느린 크롤 단계(위저드가 백그라운드로 먼저 돌림).
  // ⭐네이버 선행(+~1초) → 검증 앵커를 제미나이에 전달해 업체를 조준(동명 업체 오인·상상 원천 차단).
  //   앵커는 검증 블록(지도✅·홈피메타)이 있을 때만 — 없으면 기존과 동일(바이어스 방지). 콜 수 불변.
  async research(name: string, region?: string, businessType?: string): Promise<string> {
    const naver = await this.gather(name, region);
    const anchor = extractNaverAnchor(naver);
    const gemini = await this.geminiSearch(name, region, businessType, anchor ?? undefined);
    return this.combineResearch(naver, gemini);
  }

  // EnrichOptions 정규화(빈 문자열 → undefined, 후보 5개/결 4개 제한)
  private normalizeOptions(o: EnrichOptions): EnrichOptions {
    const id = o.identity ?? { name: "" };
    return {
      identity: {
        name: id.name || "",
        region: id.region || undefined,
        address: cleanAddress(id.address),
        instagram: id.instagram || undefined,
        homepage: id.homepage || undefined,
        hint: id.hint || undefined,
      },
      instagramCandidates: Array.from(
        new Set(
          (o.instagramCandidates ?? [])
            .filter((s): s is string => typeof s === "string" && !!s.trim())
            .map((s) => {
              const h = s.trim().replace(/^@?/, "@");
              return h;
            })
            .filter((h) => h !== id.instagram) // 확정값과 중복 제거
        )
      ).slice(0, 4),
      oneLiners: (o.oneLiners ?? []).filter(Boolean).slice(0, 5),
      descriptions: (o.descriptions ?? []).filter(Boolean).slice(0, 5),
      values: (o.values ?? []).filter(Boolean).slice(0, 4),
      activityHints: (o.activityHints ?? [])
        .filter((h) => h && h.title?.trim() && h.desc?.trim())
        .slice(0, 3),
      collabHints: (o.collabHints ?? [])
        .filter((h) => h && h.partner?.trim() && h.desc?.trim())
        .slice(0, 3),
      blockHints: (o.blockHints ?? [])
        .filter(
          (h) =>
            h &&
            ["metrics", "press", "space", "reviews"].includes(h.type) &&
            !!h.reason?.trim()
        )
        .slice(0, 2)
        .map((h) => {
          const items = (h.items ?? []).filter((it) => it && !!it.label?.trim());
          return {
            type: h.type,
            reason: h.reason.trim(),
            desc: h.desc?.trim() || undefined, // space 공간 소개 밑그림
            items: items.length
              ? items.map((it) => ({
                  label: it.label.trim(),
                  value: it.value || undefined,
                  year: it.year || undefined,
                  desc: it.desc?.trim() || undefined, // press 기사 한 줄 요약
                }))
              : undefined,
          };
        }),
      seeksHint:
        o.seeksHint && o.seeksHint.note?.trim() && o.seeksHint.reason?.trim()
          ? {
              types: (o.seeksHint.types ?? []).filter(Boolean).slice(0, 3),
              note: o.seeksHint.note.trim(),
              reason: o.seeksHint.reason.trim(),
            }
          : null,
    };
  }

  // 홈페이지 딥리드 발췌 → 프롬프트 블록. 1차 자료 우선·베끼기 금지 규칙 포함.
  // digest가 비면 빈 헤더도 넣지 않는다(thin 오판 방지 관례와 동일).
  private digestBlock(d?: string): string {
    return d?.trim()
      ? `[홈페이지 직접 읽기 — 사장이 확인한 공식 홈페이지에서 발췌]\n${d.trim()}\n\n⭐⭐홈페이지 발췌는 가장 신뢰할 1차 자료야. 숫자·미션·활동명·파트너명·연혁이 조사 자료와 다르면 홈페이지 쪽을 우선해서 반영해. 단, 홈페이지 문장을 그대로 베끼지 말고 새로 써. ⚠️발췌 원문의 문체(사무적 격식체·홍보체)에 끌려가지 말고, 어미는 우리 '어미 리듬' 규칙(선언=~합니다 / 부연=~이에요)대로 새로 써라. "[홈페이지—라벨]"은 어느 메뉴에서 가져왔는지 참고용 힌트야.\n\n`
      : "";
  }

  // 5지선다 생성 공용 — Gemini 우선, 전멸 시 Haiku.
  private async generateOptions(prompt: string, temperature: number): Promise<EnrichOptions> {
    try {
      const text = await this.generate(prompt, GEMINI_OPTIONS_SCHEMA, OPTIONS_SYSTEM, temperature);
      return this.normalizeOptions(JSON.parse(text) as EnrichOptions);
    } catch (e) {
      console.warn(`[options] gemini 실패 → Haiku 폴백`, (e as { status?: number })?.status);
      const structured = await this.claude().messages.parse({
        model: "claude-haiku-4-5",
        max_tokens: 2000,
        system: OPTIONS_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(OptionsResultSchema) },
      });
      return this.normalizeOptions(
        (structured.parsed_output ?? { identity: { name: "" } }) as EnrichOptions
      );
    }
  }

  // 조사 메모 + (사장 설명 + 키워드) → 한줄소개·브랜드소개 5지선다(빠른 생성 단계).
  async options(input: OptionsInput): Promise<EnrichOptions> {
    const note = input.ownerNote?.trim()
      ? `⭐⭐가장 중요 — 사장이 직접 쓴 브랜드 핵심 설명이야. 이 내용·관점·강조점을 모든 후보의 최우선 중심으로 삼아줘(조사 자료보다 이걸 우선):\n"${input.ownerNote.trim()}"\n\n`
      : "";
    const kw = input.focusKeywords?.length
      ? `⭐사장이 직접 고른 키워드(이것들이 곧 이 브랜드다 — 모든 후보의 재료로 최우선 사용. 단, 나열하지 말고 자연스러운 문장으로 녹여라): ${input.focusKeywords.join(", ")}\n\n`
      : "";
    // ⭐ 별표 = 한 줄 소개에 반드시 반영(캡 3, 순서=우선). 40자 안에 다 못 담으면 뒤 순위는 장문으로.
    const starred = (input.starredKeywords ?? []).filter((s) => s?.trim()).slice(0, 3);
    const star = starred.length
      ? `⭐⭐한 줄 소개(oneLiners)에 반드시 반영할 핵심(우선순위 순): ${starred.join(" > ")}. 1순위는 모든 한 줄 후보에 꼭 담고, 자리가 부족하면 뒤 순위는 descriptions(장문)에서 비중 있게 다뤄.\n\n`
      : "";
    const verbatim = (input.verbatimKeywords ?? []).filter((s) => s?.trim());
    const verb = verbatim.length
      ? `⭐그대로 쓸 문구(사장이 직접 쓴 표현 — 의역·바꿔쓰기 금지, 원문 그대로 등장시켜): ${verbatim.map((v) => `"${v}"`).join(", ")}\n\n`
      : "";
    const prompt = `브랜드명: "${input.name}"\n\n${note}${kw}${star}${verb}${this.digestBlock(input.homepageDigest)}[조사 자료 — 네이버 검색 + 제미나이 웹 조사]\n${input.research}\n\n위 정보로 한 줄 소개 5개, 브랜드 소개 5개(각 3~5문장, 어미는 시스템 지침의 '어미 리듬' — 선언=~합니다/부연=~이에요 혼합), 브랜드 결 단어 2~4개, identity(지역·주소·인스타·홈피)를 뽑아줘.
⭐⭐자료 신뢰 순서(충돌 시 위가 이긴다): ①홈페이지 발췌(있으면) ②네이버의 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색] ③기타 네이버 문서(무관한 업체 문서일 수 있으니 브랜드 일치 확인) ④제미나이 조사.
⭐identity.address는 도로명/지번 주소만(예: "서울 성동구 금호로 66 402호") — [네이버 지역검색]에 도로명이 있으면 그걸 그대로 써라(가장 정확). ⚠️전화번호·사업자등록번호·통신판매업신고번호·이메일은 절대 넣지 마라(그건 주소가 아니야).
⭐identity.homepage는 조사 자료에 URL이 있으면 채워줘. identity.instagram은 ⚠️'홈페이지 직접 확인' 항목에서 실제 확인된 핸들이 있을 때만 채워 — 그 외에는 추측하지 말고 빈 문자열로 둬(무관한 계정도 금지).
⭐단 instagram이 확정 안 됐으면 instagramCandidates에 도메인·브랜드명 기반 그럴듯한 추정 핸들 2~4개를 넣어줘(사장이 직접 고를 후보). 예: 도메인이 canvasgarden.shop이면 @canvasgarden, @canvasgarden_official, @canvasgarden.shop 등.
나머지는 사실만 쓰고, 확인 안 된 필드는 빈 문자열. 짧은 필드(note·desc·힌트 등)는 해요체, 브랜드 소개(descriptions)만 '어미 리듬' 혼합체.
⭐⭐oneLiners 필수 점검: 브랜드명(상호)을 문장 안에 절대 넣지 마라. 서술어는 말로 소개하듯 행위+진행형("~을 만들고 있어요/열고 있어요/만들어 가고 있어요")으로 — 단답 현재형("~을 만들어요/열어요"), "만나보세요·함께해요" 같은 권유형, "선물해요·선사해요" 같은 감성형 금지.
⭐activityHints·collabHints는 조사 자료·홈페이지 발췌에 실제로 언급된 활동·협업만 0~3건씩(source=출처 유형, 홈페이지 발췌면 "홈페이지"). 자료에 없으면 빈 배열 — 지어내기 금지.`;
    return this.generateOptions(prompt, 0.9);
  }

  // draft·oneLiners 공용 — 폼 입력을 프롬프트용 메모로 조립
  private draftInfo(input: DraftInput): string {
    return [
      input.oneLiner?.trim() && `한 줄 소개: ${input.oneLiner.trim()}`,
      input.values?.length && `브랜드를 표현하는 말: ${input.values.join(", ")}`,
      input.offers?.length && `제공 가능한 콜라보: ${input.offers.join(", ")}`,
      input.targetAudience?.length && `주요 고객: ${input.targetAudience.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  // 폼 정보 + (네이버 + 제미나이) → 브랜드 소개 5지선다. round마다 변주(다시 받기).
  async draft(input: DraftInput): Promise<string[]> {
    const research = await this.research(input.name);
    const info = this.draftInfo(input);
    const kw = (input.focusKeywords?.length ? input.focusKeywords : input.values) ?? [];
    const round = input.round ?? 0;
    const prompt = `브랜드명: "${input.name}"\n\n[사용자 입력]\n${
      info || "(입력이 적어요 — 조사 자료 위주로)"
    }\n\n${kw.length ? `⭐가중 키워드(가장 중요하게 반영): ${kw.join(", ")}\n\n` : ""}[조사 자료]\n${research}\n\n위 자료로 '브랜드 소개' 후보 5개를 서로 다른 앵글로(각 3~5문장, 어미는 시스템 지침의 '어미 리듬' — 선언=~합니다/부연=~이에요 혼합). oneLiners·values·identity도 채워줘.${
      round > 0 ? " 이전과는 다른 표현·각도로 새롭게 써줘." : ""
    }`;
    const opts = await this.generateOptions(prompt, round > 0 ? 1.0 : 0.9);
    return opts.descriptions;
  }

  // 폼 정보 + (네이버 + 제미나이) → 한 줄 소개 후보 3개(초안받기 2스텝용). draft와 같은 파이프라인.
  async oneLiners(input: DraftInput): Promise<string[]> {
    const research = await this.research(input.name);
    const info = this.draftInfo(input);
    const kw = (input.focusKeywords?.length ? input.focusKeywords : input.values) ?? [];
    const round = input.round ?? 0;
    const prompt = `브랜드명: "${input.name}"\n\n[사용자 입력]\n${
      info || "(입력이 적어요 — 조사 자료 위주로)"
    }\n\n${kw.length ? `⭐가중 키워드(가장 중요하게 반영): ${kw.join(", ")}\n\n` : ""}[조사 자료]\n${research}\n\n위 자료로 '한 줄 소개' 후보를 서로 다른 앵글로 뽑아줘. ⭐각 후보는 40자 이내로, 브랜드 정체성(무엇을·어떻게·누구에게)이 한 줄에 드러나게. 서술어는 말로 소개하듯 행위+진행형("~을 만들고 있어요/열고 있어요")으로 — 단답 현재형("~을 만들어요/열어요") 금지. 과장·오글거리는 표현 금지. descriptions·values·identity도 형식에 맞게 채워줘.${
      round > 0 ? " 이전과는 다른 표현·각도로 새롭게 써줘." : ""
    }`;
    const opts = await this.generateOptions(prompt, round > 0 ? 1.0 : 0.9);
    return opts.oneLiners.filter((s) => s.trim()).slice(0, 3);
  }

  // 한 줄 소개 + 브랜드 소개를 한 번에 — 초안받기 이중 크롤 제거(research 1회 + 생성 1회).
  // generateOptions 응답이 oneLiners·descriptions를 둘 다 담는 것을 그대로 활용한다.
  async draftBoth(input: DraftInput): Promise<{ oneLiners: string[]; descriptions: string[]; researchMemo?: string }> {
    const research = input.researchMemo ?? (await this.research(input.name));
    const info = this.draftInfo(input);
    const kw = (input.focusKeywords?.length ? input.focusKeywords : input.values) ?? [];
    const round = input.round ?? 0;
    // ⭐ 별표 = 한 줄 소개 반드시 반영(캡 3, 순서=우선순위). 자리 부족하면 뒤 순위는 장문으로.
    const starred = (input.starredKeywords ?? []).filter((s) => s?.trim()).slice(0, 3);
    const verbatim = (input.verbatimKeywords ?? []).filter((s) => s?.trim());
    const starLine = starred.length
      ? `⭐⭐한 줄 소개에 반드시 반영할 핵심(우선순위 순, 최대 3개): ${starred.join(" > ")}. 1순위는 모든 한 줄 후보에 꼭 담고, 40자 안에 다 못 담으면 뒤 순위는 '브랜드 소개'(장문)로 넘겨.\n`
      : "";
    const verbatimLine = verbatim.length
      ? `⭐그대로 넣을 문구(의역·표현 변형 절대 금지, 원문 그대로 등장시켜): ${verbatim.join(", ")}.\n`
      : "";
    const prompt = `브랜드명: "${input.name}"\n\n[사용자 입력]\n${
      info || "(입력이 적어요 — 조사 자료 위주로)"
    }\n\n${kw.length ? `⭐가중 키워드(가장 중요하게 반영): ${kw.join(", ")}\n` : ""}${starLine}${verbatimLine}\n${this.digestBlock(input.homepageDigest)}[조사 자료]\n${research}\n\n⭐자료 신뢰 순서(충돌 시 위가 이긴다): ①홈페이지 발췌 ②네이버 검증 블록(직접 쓴 소개·지도 교차검증·지역검색) ③기타 네이버 문서 ④제미나이 조사.\n위 자료로 '한 줄 소개' 후보 3개(각 40자 이내 — 브랜드 정체성이 무엇을·어떻게·누구에게 한 줄에 드러나게, 서술어는 말로 소개하듯 행위+진행형 "~을 만들고 있어요/열고 있어요"로 — 단답 현재형 "~을 만들어요/열어요" 금지, 과장·오글거리는 표현 금지)와 '브랜드 소개' 후보 5개(서로 다른 앵글, 각 3~5문장, 어미는 시스템 지침의 '어미 리듬' — 선언=~합니다/부연=~이에요 혼합)를 함께 만들어줘. values·identity도 형식에 맞게 채워줘.${
      round > 0 ? " 이전과는 다른 표현·각도로 새롭게 써줘." : ""
    }`;
    const opts = await this.generateOptions(prompt, round > 0 ? 1.0 : 0.9);
    return {
      oneLiners: opts.oneLiners.filter((s) => s.trim()).slice(0, 3),
      descriptions: opts.descriptions,
      researchMemo: research, // 자세히 재생성이 재사용(재크롤 방지)
    };
  }

  // 앵커 재생성 전용 스키마 — descriptions 배열만(형식 군더더기 제거로 앵커에 집중).
  private static readonly ANCHOR_SCHEMA = {
    type: Type.OBJECT,
    properties: {
      descriptions: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "앵커 브랜드 소개 후보 — 각 3~5문장 해요체, 서로 다른 렌즈로 겹치지 않게",
      },
    },
    required: ["descriptions"],
  };

  // 고른/수정한 한 줄 소개를 '관통 주제'로 삼아 '앵커' 자세히 N개만 생성(N=DESC_ANCHOR_COUNT).
  // ⚡콜 규율: Gemini 1콜(재크롤 없음 — researchMemo 재사용). Gemini 전멸 시 Haiku 폴백.
  // ⭐핵심: 한 줄은 *주제*지 *내용*이 아니다 — 그대로 부연 말고 그 주제의 다른 측면을 조사자료에서 끌어와 확장.
  //    앵커끼리도 '서로 다른 렌즈'(어떻게/왜/누구에게/무엇을/분위기 중 N개)로 안 겹치게.
  //    나머지 자유 M개는 클라가 사전 생성 풀에서 블렌드(서버는 앵커만 만든다).
  async regenDescriptions(input: RegenDescInput): Promise<string[]> {
    const n = DESC_ANCHOR_COUNT;
    const chosen = input.chosenOneLiner.trim();
    const kw = (input.focusKeywords?.length ? input.focusKeywords : input.values) ?? [];
    const prompt = `브랜드명: "${input.name}"

⭐⭐사장이 최종 선택한 '한 줄 소개' — 이 문장을 아래 브랜드 소개 후보 전체의 공통 *관통 주제*로 삼아라:
"${chosen}"

${kw.length ? `⭐가중 키워드(나열 말고 문장에 자연스럽게 녹여라): ${kw.join(", ")}\n\n` : ""}${this.digestBlock(input.homepageDigest)}[조사 자료]
${input.researchMemo?.trim() || "(추가 조사 자료 없음 — 위 한 줄 소개와 키워드를 중심으로, 없는 사실은 지어내지 말고 담백하게)"}

⭐지시 — '앵커' 브랜드 소개 ${n}개를 써라(descriptions 배열에 정확히 ${n}개):
- 위 '한 줄 소개'가 담은 핵심을 ${n}개 후보가 공통으로 관통하게. 주제는 하나다 — 서로 다른 얘기를 하면 안 돼.
- ⚠️한 줄 소개는 *주제*지 *내용*이 아니다. 그 문장을 그대로 부연·반복하지 말고, 그 주제의 서로 다른 측면을 위 [조사 자료]에서 끌어와 확장하라.
- ⚠️${n}개 앵커끼리도 겹치면 안 된다 — 각 앵커에 아래 렌즈 중 서로 다른 하나씩을 부여해 ${n}개를 뚜렷이 구분하라:
  · 어떻게(방식·과정) · 왜(계기·철학) · 누구에게(고객·쓰임) · 무엇을(제품·핵심) · 분위기·감각
- 각 3~5문장. ⭐어미는 시스템 지침의 '어미 리듬'(기능 기반 혼합체 — 선언·확정=~합니다 / 이유·부연=~이에요·~예요 / 지향=~바랍니다)을 그대로 따르고, 서사 원칙(Why 한 번은 보이게·시점 전환·안내/영업 꼬리 금지)도 지켜라 — ⚠️함께 노출될 다른 후보들과 어미·톤이 일치해야 한다(혼자 해요체로만 쓰면 안 됨). 1인칭 사장 시점 — 브랜드명·'이곳'·'이 브랜드'를 문장 주어로 쓰지 마라('저희/우리' 또는 주어 생략).
- ⚠️collab5·플랫폼·"좋은 협업은 좋은 소개에서" 같은 서비스 철학·미션 문구는 넣지 마라. 이 소개는 사장님 1인칭 목소리다.`;
    try {
      const text = await this.generate(
        prompt,
        NaverGeminiProvider.ANCHOR_SCHEMA,
        OPTIONS_SYSTEM,
        0.9
      );
      const arr = (JSON.parse(text) as { descriptions?: unknown }).descriptions;
      const list = Array.isArray(arr)
        ? arr.filter((s): s is string => typeof s === "string" && !!s.trim())
        : [];
      if (list.length) return list.slice(0, n);
      throw new Error("empty anchors");
    } catch (e) {
      console.warn(`[regen] gemini 앵커 실패 → Haiku 폴백`, (e as { status?: number })?.status);
      const structured = await this.claude().messages.parse({
        model: "claude-haiku-4-5",
        max_tokens: 1200,
        system: OPTIONS_SYSTEM,
        messages: [{ role: "user", content: prompt }],
        output_config: { format: zodOutputFormat(z.object({ descriptions: z.array(z.string()) })) },
      });
      return (structured.parsed_output?.descriptions ?? [])
        .filter((s) => !!s?.trim())
        .slice(0, n);
    }
  }

  async recrawl(input: RecrawlInput): Promise<EnrichCandidate | null> {
    // 인스타 핸들·홈피 도메인까지 검색어에 섞어 네이버+제미나이 둘 다 더 깊이 조사
    const terms = [input.name, input.homepage, input.instagram?.replace(/^@/, "")].filter(Boolean).join(" ");
    const [naver, gemini] = await Promise.all([this.gather(terms), this.geminiSearch(terms)]);
    const research = this.combineResearch(naver, gemini);
    const extra = `\n\n사용자가 알려준 링크: 인스타=${input.instagram ?? "없음"}, 홈페이지=${input.homepage ?? "없음"} (이 둘은 확인된 것으로 sources에 넣어도 됨)`;
    const cands = await this.structure(input.name, research, extra);
    return cands[0] ?? null;
  }
}

// 검색 단계 추상화 — 우선순위: 네이버+Gemini → Claude → Mock. ENRICH_FORCE_MOCK=1이면 무조건 Mock.
// ⚡ ENRICH_FORCE_MOCK=1 이면 키가 있어도 무조건 Mock(=비용 0). 위저드 UX 개발 중 안전장치.
function pickProvider(): SearchProvider {
  if (process.env.ENRICH_FORCE_MOCK === "1") return new MockSearchProvider();
  const hasNaver = !!(process.env.NAVER_CLIENT_ID && process.env.NAVER_CLIENT_SECRET);
  const hasGemini = !!process.env.GEMINI_API_KEY;
  if (hasNaver && hasGemini) return new NaverGeminiProvider();
  if (process.env.ANTHROPIC_API_KEY?.startsWith("sk-ant")) return new ClaudeSearchProvider();
  return new MockSearchProvider();
}
const provider: SearchProvider = pickProvider();

export async function enrichLookup(query: string, hintUrl?: string): Promise<EnrichResult> {
  return { candidates: await provider.lookup(query, hintUrl) };
}

/** 재크롤링 — provider가 지원하면 더 풍부한 단일 후보, 아니면 null. */
export async function enrichRecrawl(input: RecrawlInput): Promise<EnrichCandidate | null> {
  return provider.recrawl ? provider.recrawl(input) : null;
}

/** 소개 초안 5지선다 — provider가 지원하면 AI 생성, 아니면 규칙 기반 1개. */
export async function enrichDraft(input: DraftInput): Promise<string[]> {
  if (provider.draft) return provider.draft(input);
  const bits: string[] = [];
  if (input.oneLiner?.trim()) bits.push(input.oneLiner.trim().replace(/[.\s]*$/, "."));
  if (input.values?.length)
    bits.push(`${input.values.slice(0, 3).join(", ")} — 우리를 잘 보여주는 말이에요.`);
  if (input.name.trim()) bits.push(`${input.name.trim()}의 이야기를 카드에 담았어요.`);
  return bits.length ? [bits.join(" ")] : [];
}

/** 한 줄 소개 후보 3개(초안받기 2스텝용) — provider가 지원하면 AI 생성, 아니면 규칙 기반. 각 40자 이내. */
export async function enrichOneLiners(input: DraftInput): Promise<string[]> {
  if (provider.oneLiners) return provider.oneLiners(input);
  // 규칙 기반 폴백 — ruleDraft 스타일 후보
  const name = input.name.trim() || "우리 브랜드";
  const vibe = input.values?.slice(0, 2).join("·");
  const out = [
    input.oneLiner?.trim(),
    vibe ? `${vibe}${josa(vibe, "을", "를")} 담아 만드는 ${name}` : `정성으로 만드는 ${name}`,
    `결이 맞는 분들과 함께하는 ${name}`,
  ].filter((s): s is string => !!s);
  return Array.from(new Set(out)).slice(0, 3);
}

/** 한 줄 소개 3개 + 브랜드 소개 5개를 한 번에(draft2) — provider가 지원하면 크롤 1회로 통합,
 *  미지원이면 기존 enrichOneLiners + enrichDraft 순차 폴백(하위호환). */
export async function enrichDraftBoth(
  input: DraftInput
): Promise<{ oneLiners: string[]; descriptions: string[]; researchMemo?: string }> {
  if (provider.draftBoth) return provider.draftBoth(input);
  const oneLiners = await enrichOneLiners(input);
  const descriptions = await enrichDraft(input);
  return { oneLiners, descriptions };
}

/** 고른/수정한 한 줄 소개를 관통 주제로 '자세히 소개' 5개만 재생성(+1 Gemini 콜, 재크롤 없음).
 *  provider 미지원이면 규칙 기반 담백한 1개로 폴백. */
export async function enrichRegenDescriptions(input: RegenDescInput): Promise<string[]> {
  if (provider.regenDescriptions) return provider.regenDescriptions(input);
  const ol = input.chosenOneLiner.trim();
  return ol ? [`${ol.replace(/[.\s]*$/, "")}. 저희다운 방식으로 꾸준히 이어가고 있어요.`] : [];
}

/** 조사 메모 생성(백그라운드 크롤) — 위저드가 키워드 입력받는 동안 먼저 돌린다. */
export async function enrichResearch(
  name: string,
  region?: string,
  businessType?: string
): Promise<string> {
  return provider.research ? provider.research(name, region, businessType) : "";
}

/** 조사 메모 + 가중 키워드 → 한줄소개·브랜드소개 5지선다. */
export async function enrichOptions(input: OptionsInput): Promise<EnrichOptions | null> {
  return provider.options ? provider.options(input) : null;
}

// ── 크롤→키워드 재설계: 조사메모 오프라인 파싱(LLM 없음, 콜 0) ──
// 제미나이 조사메모의 [소제목] 구조를 선택용 키워드 칩으로 변환.
// 신뢰정보(홈피·주소)는 칩 제외 — 링크 확인 게이트에서 별도 처리.
const CHIP_SECTIONS: Record<string, { label: string; factual: boolean }> = {
  정체: { label: "정체", factual: false },
  "제품/특징": { label: "제품", factual: false },
  제품: { label: "제품", factual: false },
  활동: { label: "활동", factual: false },
  콜라보: { label: "콜라보", factual: false },
  "원하는 협업": { label: "원하는협업", factual: false },
  고객: { label: "고객", factual: false },
  알려짐: { label: "알려짐", factual: true }, // 사실 게이트(방송·수상·언론)
  공간: { label: "공간", factual: false },
  키워드: { label: "키워드", factual: false }, // 제미나이가 스스로 증류한 짧은 명사구 모음
};
// 섹션과 무관하게 사실 게이트로 승격시키는 단서(오귀속 시 거짓말이 될 고유명사·수치).
const FACTUAL_RE = /방송|수상|대상|선정|일보|매거진|언론|미쉐린|빕구르망|백종원|출연|인증|팔로워/;

// 콤마 조각화 전에 "쪼개면 안 되는 콤마"를 보호 표시(제어문자)로 치환.
// 대상: ①숫자 사이 천 단위 구분자(예: "12,345명") ②괄호 안 콤마(예: "(3,000m²)").
// 둘 다 안 막으면 "최대 규모 (3" / "000m²)"·"12" / "345명"처럼 숫자가 쪼개진다.
function guardParenCommas(s: string): string {
  const arr = Array.from(s);
  let depth = 0;
  let out = "";
  for (let i = 0; i < arr.length; i++) {
    const ch = arr[i];
    if (ch === "(" || ch === "\uFF08") depth++;
    else if (ch === ")" || ch === "\uFF09") depth = Math.max(0, depth - 1);
    const isDigitComma = /\d/.test(arr[i - 1] ?? "") && /\d/.test(arr[i + 1] ?? "");
    if ((ch === "," || ch === "\uFF0C") && (depth > 0 || isDigitComma)) {
      out += ch === "," ? "\u0000" : "\u0001";
    } else {
      out += ch;
    }
  }
  return out;
}
function unguardParenCommas(s: string): string {
  return s.split("\u0000").join(",").split("\u0001").join("\uFF0C");
}

/**
 * 크롤 조사메모 → 선택용 키워드 칩(오프라인, 콜 0).
 * 유저가 '나를 나타내는 것'을 고르면 그게 생성 재료가 된다. 사실 게이트(factual)는
 * 기본 OFF·탭 확인 대상. 메모가 비었거나 구조가 없으면 빈 배열(→ thin 폴백).
 */
export function extractChipsFromResearch(
  research: string,
  brandName?: string,
  businessType?: string
): KeywordChip[] {
  if (!research) return [];
  const brand = brandName?.trim();
  const gi = research.indexOf("[출처 2"); // 제미나이 조사부분(구조 깔끔) 우선
  const body = gi >= 0 ? research.slice(gi) : research;
  // 네이버 파트의 '브랜드가 직접 쓴 소개'(홈페이지 메타 = 신뢰도 최상)도 칩 소스로 —
  // 제미나이가 폐기/실패해도 네이버가 본인을 찾았으면 빈손이 아니게(캔버스가든 사건 보강).
  const naverPart = gi >= 0 ? research.slice(0, gi) : research;
  const metaDesc = /^\s*·\s*소개:\s*(.+)$/m
    .exec(naverPart)?.[1]
    ?.replace(/[.…]+\s*$/, "") // 메타 잘림 말줄임(…/..) 제거
    .trim();
  const parts = body.split(/\n?\s*\[([^\]\n]+)\]\s*/); // [pre, header, body, header, body, ...]
  const chips: KeywordChip[] = [];
  const STOPWORDS = /^(또한|그리고|하지만|특히|및|기타|등|다만|그러나|이\s*외|그\s*외)$/;
  const push = (raw: string, sec: { label: string; factual: boolean }) => {
    const text = raw
      .replace(/^(이\s*외에도|그\s*외에도|이외에도)\s*/, "")
      .replace(/[.。]\s*$/, "")
      .trim();
    const maxLen = /숫자|알려짐/.test(sec.label) ? 40 : 28;
    if (text.length < 2 || text.length > maxLen) return false;
    if (/확인\s*안\s*됨|해당\s*없음|없습니다/.test(text)) return false;
    if (STOPWORDS.test(text)) return false;
    // 후기·리뷰 관련은 지금 제외(별도 재설계 예정 — 백로그). 방어적 필터.
    if (/후기|리뷰|별점|평점/.test(text)) return false;
    // 행정 정보는 키워드가 아니다 — 사업자·신고번호·주소(주소는 identity로 이미 감)
    if (/사업자|통신판매|신고번호|등록번호|고유번호|^주소/.test(text)) return false;
    // 거래·운영 정보는 콜라보 키워드가 아니다(대표 지시 2026-07-19 — 장모님해장국 사건).
    //   메뉴 가격·전화번호·영업시간은 소개서 재료로 무의미 → 제외.
    //   ⚠️ "운영 연차 30년"·"팔로워 1.5만"처럼 브랜드 임팩트 숫자는 살린다(원/전화/시간 패턴만 저격).
    if (/\d[\d,]*\s*원(?![가-힣])/.test(text)) return false; // 가격("설렁탕 11,000원"·"해장국 11,000원")
    if (/전화|연락처|대표번호|문의(?:처|전화)?\s*[:：]?\s*\d|☎|℡/.test(text)) return false; // 전화 라벨
    if (/(?<![-\d])\d{2,4}[-.\s]\d{3,4}[-.\s]\d{4}(?![-\d])/.test(text)) return false; // 전화번호 형태(02-379-4294)
    if (/영업\s*시간|운영\s*시간|영업\s*중|브레이크\s*타임|라스트\s*오더|매일\s*\d{1,2}[:\s]\d{2}|\d{1,2}\s*[:시]\s*\d{2}\s*[-~–]\s*\d{1,2}/.test(text))
      return false; // 영업시간("영업시간 매일 06 00 - 21 00")
    // 실질 내용(한글·영문·숫자)이 없으면 배제 — "###", "()", "···", "-" 같은 기호 잔재 차단.
    if (!/[가-힣a-zA-Z0-9]/.test(text)) return false;
    // 메타·잡음 단어 단독은 배제 — "결과", "검색결과", "정보 없음" 등.
    if (/^(결과|검색\s*결과|정보|내용|미상|불명|없음|해당\s*사항)$/.test(text)) return false;
    // 매체명 없는 막연한 노출 언급 배제 — "매체 노출 2023년" 등(매체명 있으면 그 이름으로 시작함).
    if (/^(매체|언론|미디어|방송|신문)\s*(노출|소개)/.test(text)) return false;
    // 동사형 문장·접속 조각 배제(키워드는 명사구) — "~탐구합니다"·"~배우고"·"~짜거나" 등
    if (/(다|요|죠|고|며|나|서)\.?$/.test(text)) return false;
    // 고아 조사 배제 — 앞 명사가 클렌징으로 떨어져 나가 조사만 남은 조각("운영 연차 으로 운영 중")
    if (/(^|\s)(으로|이라|이며|이고)(\s|$)/.test(text)) return false;
    // 프롬프트 잔향 배제 — 소제목 설명 어휘를 확인 없이 되풀이한 것(lite 병합에서 관찰:
    // 숫자 없는 "펀딩 달성액"·"인스타그램 팔로워 수", 단독 "다른 브랜드"·"워크숍" 등)
    if (/^(다른\s*브랜드|인스타그램\s*팔로워(\s*수)?|팔로워\s*수|구독자\s*수|펀딩\s*달성액|펀딩\s*달성률|누적\s*판매량|제품\s*라인|주력\s*제품|워크숍|클래스|팝업|공간|작가|서비스)$/.test(text))
      return false;
    // 미완결 조각 배제(접속·비교·관형 어미로 끝) — "'호락호락'이라는 이름처럼", "~을 위한" 등
    if (/(처럼|같은|같이|위한|위해|통한|통해|관한|관련|대한|이라는|라는|든지|거나|면서|로서|로써|등의|에서|으로|에게|까지|부터|보다|브랜드로|곳으로)$/.test(text))
      return false;
    // 소개문 조각 배제 — "○○은 서울 보문동에 위치한 워크숍" 같은 문장형(키워드 아님)
    if (/(에|에서)\s*(위치|자리|소재)/.test(text)) return false;
    // 브랜드명 자체·브랜드명 주어 문장은 칩이 아니다 ("캔버스가든", "캔버스가든은 ~")
    if (brand && (text === brand || new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*(은|는|이|가|의)?(\\s|$)`).test(text)))
      return false;
    const key = text.replace(/\s/g, "");
    // 사용자가 이미 입력한 업종과 동일한 칩은 무의미("당구장" 입력자에게 "당구장" 칩) — 제외
    if (businessType && key === businessType.replace(/\s/g, "")) return false;
    // 완전 동일(공백 무시)만 여기서 제거 — 포함관계 가족 통합은 마지막에 한 번에(consolidateChipFamilies)
    if (chips.some((e) => e.text.replace(/\s/g, "") === key)) return false;
    chips.push({ text, section: sec.label, factual: sec.factual || /\d/.test(text) || FACTUAL_RE.test(text) });
    return true;
  };
  for (let i = 1; i < parts.length; i += 2) {
    const sec = CHIP_SECTIONS[parts[i].trim()];
    if (!sec) continue;
    // [키워드]는 콤마 나열 전체를 받는다(캡 넉넉히). 서사 섹션은 조각 남발 방지 캡.
    const isKwSec = sec.label === "키워드";
    const isNumSec = /숫자|알려짐/.test(sec.label);
    const maxPerSection = isKwSec ? 15 : 6;
    const maxFragsPerLine = isKwSec ? 20 : 3;
    const lineMax = isNumSec ? 40 : 28;
    let count = 0;
    for (const rawLine of (parts[i + 1] ?? "").split(/\n/)) {
      // 실메모 정리: 마크다운(볼드·#헤더·불릿) + 빈 괄호 + 끝 괄호(출처) 제거
      let line = rawLine
        .replace(/\*\*/g, "")
        .replace(/^[\s#>·•\-*]+/, "") // 앞머리 마크다운(### 헤더·> 인용·불릿)
        .replace(/[（(]\s*[)）]/g, "") // 빈 괄호 "()" 제거 → "결과()" 같은 잔재 차단
        .replace(/\s*[（(][^)）]*[)）]\s*$/g, "") // 끝 괄호(출처)
        .replace(/[#*`]+/g, "") // 남은 마크다운 기호
        .trim();
      // 숫자·이력은 라벨을 살린다("팔로워 1.5만") — 시점 클로즈만 제거. 그 외 섹션은 "라벨:" 접두 제거.
      if (isNumSec) {
        line = line
          .replace(/\s*\d{4}년\s*(?:\d{1,2}월\s*)?(?:\d{1,2}일\s*)?기준\s*/g, " ")
          // 위에서 괄호 안 '기준' 문구만 빠지면 "( )" 껍데기가 남는다(끝마침표 등으로 끝괄호 제거를 못 탄 경우) → 청소
          .replace(/[（(]\s*[)）]/g, " ")
          .replace(/:\s*/g, " ")
          .replace(/\s*[,，]\s*(?=[,，)．.]|$)/g, "") // 빈 괄호 제거로 뜬 외톨이 콤마 정리
          .replace(/\s+([,，])/g, "$1") // 콤마 앞 공백(빈 괄호 자리) 제거
          .replace(/\s+/g, " ")
          .replace(/[\s,，·]+$/g, "") // 끝에 남은 구분자
          .trim();
      } else {
        line = line.replace(/^[\w가-힣/ ]{1,8}:\s*/, "").trim();
      }
      if (!line || /확인\s*안\s*됨|해당\s*없음/.test(line)) continue;
      if (!isKwSec && line.length <= lineMax) {
        if (push(line, sec)) count++;
      } else {
        // 긴 문장·콤마 나열 → 조각 단위(실메모는 문단·나열형이 흔함).
        // 괄호 안 콤마("(3,000m²)")는 보호 후 분리 — 숫자가 쪼개지지 않게.
        let sub = 0;
        for (const rawFrag of guardParenCommas(line).split(/[,，;·、]|(?<=[다요음])\.\s*/)) {
          const f = unguardParenCommas(rawFrag)
            .replace(/^(그리고|또한|하지만|특히|및)\s+/, "")
            .replace(/\s*(등|등을|등이)$/, "")
            .trim();
          if (push(f, sec)) {
            count++;
            if (++sub >= maxFragsPerLine) break;
          }
        }
      }
      if (count >= maxPerSection) break;
    }
  }
  // ── 네이버 칩(대표 지시 2026-07-19 "네이버+제미나이 조합") — 제미나이가 빈손이어도
  //    네이버가 검증해 둔 정보를 버리지 않는다. 오프라인 파싱(콜 0), push의 포함관계 통일로 중복 정리. ──

  // ① 지도확인 칩: 지도 교차검증 ✅일 때만(동명 타지역 오귀속 방지), 브랜드명이 든 지역검색
  //    행의 업종 카테고리("스포츠,오락>당구장")를 검증된 칩으로.
  //    ⚠️ 네이버 검색 API는 지도 UI와 달리 최상위 umbrella까지 준다("음식점>카페,디저트").
  //    "음식점"류 최상위 뭉텅이는 브랜드를 설명 못 함(전국 모든 식당) → 제외. 카페·디저트 등 리프만.
  if (naverPart.includes("[지도 교차검증] ✅") && brand) {
    // 최상위 뭉텅이 제외 — 브랜드 특성 없음. 요리 대분류(한식·중식…)도 포함(감자탕집→'한식' 무의미).
    const GENERIC_CATEGORY =
      /^(음식점|쇼핑|생활|편의|서비스|종합|매장|상점|점포|기타|한식|중식|일식|양식|분식|아시아음식|아시안|세계음식|뷔페|퓨전요리|퓨전|음식)$/;
    const brandKey = brand.replace(/\s/g, "");
    const localBlock = naverPart.match(/\[네이버 지역검색[^\]]*\]\n([\s\S]*?)(?=\n\[|$)/)?.[1] ?? "";
    const catSec = { label: "지도확인", factual: false }; // 지도가 이미 검증 → 사실 게이트 불필요
    for (const line of localBlock.split("\n")) {
      const title = line.match(/^·\s*([^|]+)\|/)?.[1] ?? "";
      if (!title.replace(/\s/g, "").includes(brandKey)) continue; // 동명·이웃 업체 행 제외
      const cat = line.match(/업종:([^|]*)/)?.[1] ?? "";
      for (const token of cat.split(/[>,/·]/)) {
        const t = token.trim();
        if (t.length >= 2 && t.length <= 12 && !GENERIC_CATEGORY.test(t)) push(t, catSec);
      }
    }
  }

  // (후기흔적 칩은 2026-07-19 대표 지시로 은퇴 — 소비자 후기는 의견 편차·부정 후기 유입 위험이
  //  있어 칩 소스에서 제외. 블로그·카페 검색 자체는 유지: 링크 후보·지역 신호·생성 참고자료로만 쓴다.
  //  근본 개선은 [[크롤-키워드-재설계]] '후기 재설계' 백로그에서.)

  // 홈페이지 메타 소개(신뢰도 최상) → 칩. 통짜가 짧으면 그대로, 길면 조각 분리.
  // 제미나이·네이버 칩과는 push의 포함관계 통일로 자동 중복 정리. 맨 앞에 두어 우선 노출.
  if (metaDesc) {
    const metaSec = { label: "우리 소개(홈페이지)", factual: false };
    const before = chips.length;
    if (metaDesc.length <= 28) push(metaDesc, metaSec);
    else
      for (const frag of metaDesc.split(/[,，;·、]|\s+(?:그리고|및)\s+/)) {
        const f = frag.replace(/\.{2,}$|…$/g, "").trim();
        if (push(f, metaSec)) {
          if (chips.length - before >= 4) break;
        }
      }
    if (chips.length > before) chips.unshift(...chips.splice(before)); // 메타 칩을 맨 앞으로
  }
  return consolidateChipFamilies(chips, businessType).slice(0, 28);
}

// 수식형 선호 판단용 긍정 어휘(오프라인 사전 — LLM 콜 0)
const POSITIVE_RE =
  /맛있|맛난|정성|수제|손수|신선|푸짐|친절|깔끔|유명|인기|특제|시그니처|프리미엄|전통|원조|장인|엄선|풍부|따뜻|아늑|감성|매력|특별|건강|국내산|제철|당일|직접/;

/** 포함관계 '가족' 통합(대표 정책 2026-07-19) — "감자탕·맛있는 감자탕·얼큰 감자탕"처럼
 *  한 뿌리(최소형)를 공유하는 칩들은 [뿌리 1개 + 가장 긍정적인 수식형 1개]만 남긴다.
 *  수식형만 남기면 "얼큰 감자탕"이 업체 전체를 대표해버리는 왜곡이 생겨서(얼큰만 파는 집이 아님),
 *  뿌리가 사실의 안전판, 수식형 1개가 표현의 결. "카페+LP 카페"도 둘 다 생존.
 *  사용자 입력 업종은 '가상 뿌리' — 그 수식형들도 1개로 압축(뿌리 칩 자체는 입력 중복으로 이미 제외).
 *  수식형 선정: 긍정 어휘 사전 히트 우선 → 동점이면 더 구체적인(긴) 쪽 → 동점이면 먼저 온 것. */
function consolidateChipFamilies(chips: KeywordChip[], businessType?: string): KeywordChip[] {
  const keys = chips.map((c) => c.text.replace(/\s/g, ""));
  const btKey = businessType?.replace(/\s/g, "") ?? "";
  // 각 칩의 뿌리 = 자기 텍스트 안에 통째로 들어있는 가장 짧은 다른 칩(또는 입력 업종). 없으면 자신이 뿌리.
  const baseKeyOf = chips.map((_, i) => {
    let base: string | null = null;
    for (const k of btKey.length >= 2 ? [...keys, btKey] : keys) {
      if (k === keys[i] || k.length < 2) continue;
      if (keys[i].includes(k) && (base === null || k.length < base.length)) base = k;
    }
    return base;
  });
  // 가족별로 가장 긍정적인 수식형 1개 선발
  const best = new Map<string, { idx: number; score: number }>();
  chips.forEach((c, i) => {
    const b = baseKeyOf[i];
    if (!b) return;
    const score = (POSITIVE_RE.test(c.text) ? 100 : 0) + Math.min(keys[i].length, 99);
    const cur = best.get(b);
    if (!cur || score > cur.score) best.set(b, { idx: i, score });
  });
  const winners = new Set([...best.values()].map((v) => v.idx));
  return chips.filter((_, i) => baseKeyOf[i] === null || winners.has(i));
}

/** 업종 스타터 키워드 — 크롤 빈손 폴백용 '혹시 해당되나요?' 추측 칩(정적, 콜 0). */
const TYPE_STARTERS: { match: RegExp; chips: string[] }[] = [
  { match: /카페|커피|로스터/, chips: ["직접 로스팅", "디저트", "브런치", "테이크아웃", "반려동물 동반", "원데이 클래스"] },
  { match: /반찬|밀키트|delicatessen|반찬가게|밑반찬/, chips: ["매일 조리", "국내산 재료", "택배 배송", "정기 구독", "당일 생산"] },
  { match: /빈티지|편집|셀렉트|소품|편집숍/, chips: ["빈티지 셀렉트", "핸드픽", "일상 소품", "시즌 컬렉션", "입고 알림"] },
  { match: /공방|클래스|워크숍|핸드메이드|수제/, chips: ["원데이 클래스", "수제 제작", "소량 생산", "주문 제작", "체험 프로그램"] },
  { match: /베이커리|빵|디저트|케이크/, chips: ["당일 생산", "천연 발효", "예약 케이크", "비건 옵션", "제철 재료"] },
  { match: /꽃|플라워|플로리스트/, chips: ["제철 꽃", "주문 제작", "구독 배송", "클래스 운영", "행사 장식"] },
  { match: /의류|패션|브랜드|디자이너/, chips: ["자체 제작", "소량 생산", "시즌 컬렉션", "지속가능 소재", "팝업 참여"] },
  { match: /당구|포켓볼|빌리아드|빌리어드/, chips: ["동호회 모임", "정기 대회", "레슨 운영", "단체 이용", "심야 영업"] },
  { match: /스포츠|체육|볼링|탁구|배드민턴|테니스|골프|헬스|피트니스|필라테스|요가|클라이밍|수영|복싱|주짓수|태권도|검도/, chips: ["레슨 운영", "동호회 모임", "단체 이용", "초보 환영", "장비 대여"] },
  { match: /식당|맛집|음식|한식|중식|일식|양식|분식|고기|구이|치킨|피자|버거|족발|보쌈|국밥|국수|칼국수|백반|덮밥|초밥|횟집|도시락|감자탕|해장국|설렁탕|곰탕|삼계탕|매운탕|추어탕|우거지탕|뼈해장국|순대국|찌개|전골|쌀국수|마라|훠궈|아구찜|갈비찜/, chips: ["단체석", "예약 가능", "포장 가능", "점심 영업", "제철 재료"] },
  { match: /술집|주점|포차|펍|호프|이자카야|와인|칵테일|바틀/, chips: ["안주 자신", "단체석", "예약 가능", "심야 영업", "혼술 환영"] },
  { match: /미용|헤어|네일|뷰티|피부|속눈썹|왁싱|메이크업/, chips: ["예약제", "1인 운영", "맞춤 시술", "단골 많음", "당일 예약"] },
];
export function starterChipsForType(businessType: string): KeywordChip[] {
  const t = (businessType || "").trim();
  const hit = TYPE_STARTERS.find((s) => s.match.test(t));
  const base = hit?.chips ?? ["직접 제작", "소량 생산", "정성", "단골 많음", "주문 제작"];
  return base.map((text) => ({ text, section: "추천", factual: false }));
}

export interface LinkFinds {
  instagram?: string; // 대표 후보(첫 번째)
  instagramConfirmed: boolean; // 홈페이지 링크로 실제 확인됨(그래도 자동첨부 금지 — 제안만)
  instagramCandidates: string[]; // 의심되는 인스타 후보들(여러 개면 유저가 리스트에서 선택)
  homepage?: string;
  homepageCandidates: string[]; // 홈페이지 후보들
}

// 홈페이지가 아님 — 포털·SNS·오픈마켓 도메인.
const NOT_HOMEPAGE =
  /(naver|blog|instagram|facebook|youtube|tistory|kakao|band|twitter|x\.com|threads|wadiz|coupang|smartstore|11st|gmarket|linktr|notion|google|daum)/i;

/** 주소 필드 정화 — 전화·사업자등록번호·통신판매업신고·이메일이 섞여 들어오는 경우 제거.
 *  주소 고유의 숫자(도로명 66·402호·413-111번지)는 보존한다. */
function cleanAddress(raw?: string): string | undefined {
  if (!raw) return undefined;
  let a = raw.trim();
  a = a.replace(/(사업자\s*등록\s*번호|사업자번호)\s*[:：]?\s*[\d-]+/g, "");
  a = a.replace(/통신판매업\s*신고\s*번호?\s*[:：]?\s*\S+/g, "");
  a = a.replace(/제?\s*\d{4}-[가-힣]+-\d+\s*호?/g, ""); // 통신판매 신고번호 형태 (제2022-서울성동-01605)
  a = a.replace(/\b\d{3}-\d{2}-\d{5}\b/g, ""); // 사업자등록번호 형태
  a = a.replace(/(전화|연락처|문의|대표번호|tel|phone)\s*[:：]?\s*[\d-]+/gi, "");
  a = a.replace(/\b0\d{1,2}-\d{3,4}-\d{4}\b/g, ""); // 지역/휴대 전화
  a = a.replace(/\b(1[0-9]{3})-\d{4}\b/g, ""); // 대표번호 15xx-xxxx
  a = a.replace(/[\w.+-]+@[\w.-]+\.\w+/g, ""); // 이메일
  a = a.replace(/(이메일|메일|email|팩스|fax)\s*[:：]?\s*/gi, "");
  // 남은 라벨·구분자 정리
  a = a
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,·|/]+|[\s,·|/]+$/g, "")
    .trim();
  return a || undefined;
}

/** 조사메모에서 인스타/홈피 '후보들'을 오프라인 추출(콜 0, 창작 없음 — 메모에 실제 등장한 것만).
 *  여러 개면 유저가 리스트에서 선택, 단일이면 맞아요/아니에요. 자동첨부 금지. */
export function extractLinksFromResearch(research: string): LinkFinds {
  const empty: LinkFinds = { instagramConfirmed: false, instagramCandidates: [], homepageCandidates: [] };
  if (!research) return empty;

  // ── 홈페이지 후보: 메모 내 URL 수집(포털·SNS·오픈마켓 제외), 호스트로 dedupe ──
  const hostSeen = new Set<string>();
  const homepageCandidates: string[] = [];
  const addHp = (raw: string, front = false) => {
    const clean = raw.replace(/[.,)\]|]+$/, "").trim();
    const norm = /^https?:\/\//i.test(clean) ? clean : `https://${clean}`;
    let host: string;
    try {
      host = new URL(norm).hostname.replace(/^www\./, "");
    } catch {
      return;
    }
    if (NOT_HOMEPAGE.test(host) || isDirectoryHost(host) || hostSeen.has(host)) return;
    hostSeen.add(host);
    if (front) homepageCandidates.unshift(norm);
    else homepageCandidates.push(norm);
  };
  // "홈페이지: domain.com" 라인(스킴 없어도) 우선
  const hpLine = research.match(/홈페이지[^\n:]*:\s*([^\s)|]+\.[a-z]{2,}[^\s)|]*)/i)?.[1];
  if (hpLine && !/확인\s*안\s*됨/.test(hpLine)) addHp(hpLine, true);
  for (const m of research.matchAll(/https?:\/\/[^\s)"'|]+/g)) addHp(m[0]);
  const homepage = homepageCandidates[0];

  // ── 인스타 후보: 확인된 핸들 + 메모 내 instagram.com/xxx + 홈피 도메인 기반 추측 1개 ──
  const igSeen = new Set<string>();
  const instagramCandidates: string[] = [];
  const addIg = (h: string) => {
    const handle = "@" + h.replace(/^@/, "").replace(/\/+$/, "").toLowerCase();
    if (!/^@[a-z0-9._]{2,30}$/.test(handle)) return; // 한글·잡값 배제
    if (igSeen.has(handle)) return;
    igSeen.add(handle);
    instagramCandidates.push(handle);
  };
  const igLine = research.match(/인스타그램:\s*(@?[\w.]+)([^\n]*)/);
  let instagramConfirmed = false;
  if (igLine && !/확인\s*안\s*됨|추측/.test(igLine[1])) {
    addIg(igLine[1]);
    instagramConfirmed = /실제 확인됨|링크에서/.test(igLine[2] ?? "");
  }
  for (const m of research.matchAll(/instagram\.com\/([a-zA-Z0-9._]+)/g)) addIg(m[1]);
  if (homepage) {
    try {
      const base = new URL(homepage).hostname.replace(/^www\./, "").split(".")[0];
      if (/^[a-z0-9]{2,}$/i.test(base)) addIg(base);
    } catch {
      /* noop */
    }
  }

  return {
    instagram: instagramCandidates[0],
    instagramConfirmed,
    instagramCandidates: instagramCandidates.slice(0, 4),
    homepage,
    homepageCandidates: homepageCandidates.slice(0, 4),
  };
}

/** 크롤 신호 티어 — thin(빈손 뼈대) 판정. rich=홈피메타·지도일치·칩 충분 / thin=그 외. */
/** 네이버 메모에서 '검증된 신원 앵커'만 추출 — 제미나이 검색 조준용(대표 아이디어 2026-07-15).
 *  검증 블록(지도 교차검증 ✅ 또는 홈페이지 메타)이 없으면 null — 불확실한 정보로 바이어스 만들지 않는다.
 *  주소·업종은 지도 ✅일 때만(지도 없이 지역검색만 있으면 동명 업체일 수 있음). */
export function extractNaverAnchor(naverMemo: string): string | null {
  if (!naverMemo) return null;
  const mapOk = naverMemo.includes("[지도 교차검증] ✅");
  const hasMeta = naverMemo.includes("[브랜드가 직접 쓴 소개");
  if (!mapOk && !hasMeta) return null;
  const bits: string[] = [];
  const hp = /^\s*·\s*홈페이지:\s*(https?:\/\/\S+)/m.exec(naverMemo)?.[1];
  if (hp) bits.push(`공식 홈페이지: ${hp}`);
  const title = /^\s*·\s*제목:\s*(.+)$/m.exec(naverMemo)?.[1]?.trim();
  if (title) bits.push(`홈페이지 제목: ${title}`);
  const desc = /^\s*·\s*소개:\s*(.+)$/m.exec(naverMemo)?.[1]?.trim();
  if (desc) bits.push(`브랜드가 직접 쓴 소개: ${desc}`);
  if (mapOk) {
    const road = /도로명:\s*([^|\n]+)/.exec(naverMemo)?.[1]?.trim();
    if (road) bits.push(`주소(지도 확인됨): ${road}`);
    const cat = /업종:\s*([^|\n]+)/.exec(naverMemo)?.[1]?.trim();
    if (cat) bits.push(`업종(지도 확인됨): ${cat}`);
  }
  return bits.length ? bits.join("\n") : null;
}

// 지명이 아닌데 '동'으로 끝나는 일반어 — 오탐 방지
const DONG_BLOCKLIST =
  /^(활동|운동|이동|자동|행동|감동|공동|협동|합동|노동|아동|부동|작동|출동|생동|변동|유동|파동|맥동|진동|약동|박동|소동|폭동|선동|가동|기동|구동|시동|수동|능동|충동|율동|연동|동동)$/;
const METRO_ONLY =
  /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)$/;

/** 동명 타지역 업체 감지(동 단위) — 크롤 메모가 입력 지역과 다른 동네 업체로 보이면 충돌 지명을 반환.
 *  광역(regionConflict)은 '서울 보문동 vs 서울 성수동'을 못 잡아서(둘 다 서울) 동 스템으로 보완.
 *  판단 불가(사용자 지역에 세부 지명 없음·메모에 지명 없음)면 null — 안전 쪽으로 미적용. */
export function detectRegionMismatch(research: string, region?: string): string | null {
  const r = region?.trim();
  if (!r || !research) return null;
  // 광역 자체가 충돌하면 바로 (기존 인프라 재사용)
  if (regionConflict(r, research)) return "다른 지역";
  // 사용자 지역의 세부 지명 스템 — "서울 보문동" → "보문" ('보문로' 표기 변형도 매칭되게 접미 제거)
  const userStems = [...r.matchAll(/([가-힣]{2,7})(동|구|로|가|읍|면|리)(?=\s|$)/g)]
    .map((m) => m[1])
    .filter((s) => s.length >= 2 && !METRO_ONLY.test(s));
  if (!userStems.length) return null;
  if (userStems.some((s) => research.includes(s))) return null; // 스템이 메모 어디든 등장 → 본인 가능성
  // 메모에서 장소성 '○○동' 토큰 수집 — 사용자 동네는 없는데 다른 동네만 있으면 충돌
  const found = new Set<string>();
  for (const m of research.matchAll(/(?:^|[\s(·,])([가-힣]{2,7}동)(?=[\s,).·]|$)/gm)) {
    if (!DONG_BLOCKLIST.test(m[1])) found.add(m[1]);
  }
  if (!found.size) return null; // 메모에 지명 자체가 없음 → 판단 보류
  return [...found].slice(0, 2).join("·");
}

export function researchTier(research: string, chipCount: number): "rich" | "thin" {
  if (!research) return "thin";
  const hasOwnerMeta = research.includes("[브랜드가 직접 쓴 소개");
  const mapMatched = research.includes("[지도 교차검증] ✅");
  if (hasOwnerMeta || mapMatched || chipCount >= 3) return "rich";
  return "thin";
}
