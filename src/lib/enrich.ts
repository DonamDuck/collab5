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
  focusKeywords?: string[]; // 가중 키워드 — 생성 방향을 잡는다
  round?: number; // 0=첫 초안, 1+=다시 받기(다른 맥락)
}

/** 키워드 가중 5지선다 생성 입력 — research(백그라운드 크롤 결과)를 재사용 */
export interface OptionsInput {
  name: string;
  research: string; // enrichResearch()가 만든 조사 메모(네이버+제미나이)
  focusKeywords?: string[];
  ownerNote?: string; // 사장이 직접 쓴 한두 문장 — 생성의 최우선 중심축
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
}

/** 검색 단계 추상화 — mock ↔ Claude/Gemini 교체 지점. */
export interface SearchProvider {
  lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]>;
  /** (선택) 인스타/홈피 기반 재크롤링 — 더 풍부한 단일 후보 */
  recrawl?(input: RecrawlInput): Promise<EnrichCandidate | null>;
  /** (선택) 폼 정보 기반 소개 글 5개 초안 — round로 다른 각도 변주 */
  draft?(input: DraftInput): Promise<string[]>;
  /** (선택) 브랜드명(+지역)으로 조사 메모만 생성(백그라운드 크롤 — 느린 단계) */
  research?(name: string, region?: string): Promise<string>;
  /** (선택) 조사 메모 + 키워드 → 한줄소개·브랜드소개 5지선다(빠른 생성 단계) */
  options?(input: OptionsInput): Promise<EnrichOptions>;
}

// collab5 브랜드 보이스 — `~/Desktop/COLLAB_BRAND_SYSTEM.md`(v0.2)를 소개 글 생성용으로 증류.
// 모든 AI 생성 텍스트(소개·구조화 description)는 이 기준을 통과한다.
const BRAND_VOICE = `[collab5 브랜드 보이스 — 이 말투를 반드시 지켜라]
말투:
- ⭐반드시 '해요체'로 쓴다 (예: ~해요, ~예요, ~이에요, ~드려요, ~있어요). '~합니다/~습니다/~입니다' 같은 격식체는 절대 쓰지 마라.
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
        `정성으로 짓는 우리만의 이야기${kw}`,
        `일상에 스며드는 손맛의 브랜드`,
        `결이 맞는 사람들과 함께 자라는 곳`,
        `작지만 단단한 로컬 브랜드`,
        `오래 남을 것을 고민하는 브랜드`,
      ],
      descriptions: (await this.draft({ name, values: input.focusKeywords })).slice(0, 5),
      values: input.focusKeywords?.slice(0, 4) ?? ["정성", "손맛", "로컬"],
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
  descriptions: z.array(z.string()).describe("브랜드 소개 후보 5개 — 서로 다른 앵글, 각 3~5문장 해요체"),
  values: z.array(z.string()).describe("브랜드 결 단어 2~4개"),
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
      description: "브랜드 소개 후보 5개 — 서로 다른 앵글, 각 3~5문장 해요체",
    },
    values: { type: Type.ARRAY, items: { type: Type.STRING }, description: "브랜드 결 단어 2~4개" },
  },
  required: ["identity", "instagramCandidates", "oneLiners", "descriptions", "values"],
};

const OPTIONS_SYSTEM = `너는 콜라보 플랫폼 collab5의 브랜드 소개 카피라이터야. 웹 조사 메모를 바탕으로 브랜드가 고를 수 있는 '한 줄 소개'와 '브랜드 소개'를 각각 5개씩 서로 다른 앵글로 만든다.

${BRAND_VOICE}

작성 규칙:
- oneLiners 5개: 한 줄(15~30자), 서로 확실히 다른 관점(무엇을 만드는지 / 가치 / 고객 경험 / 분위기 / 시작 스토리).
- descriptions 5개: 각 3~5문장, 서로 다른 앵글. 모두 해요체. '~합니다/~습니다' 금지.
- ⭐가중 키워드가 주어지면 그 방향을 최우선으로 반영해 모든 후보를 그 결에 맞춘다.
- 조사 메모 안의 사실만 쓴다. 창작·과장 금지. identity(주소·홈피 등)는 확인된 것만, 없으면 빈 문자열.
- 인스타: 실제 확인된 핸들만 identity.instagram에 넣는다(추측 금지). 확정 못 하면 identity.instagram은 빈 문자열로 두고, 대신 instagramCandidates에 도메인·브랜드명 기반 그럴듯한 추정 핸들 2~4개를 제시한다(사장이 직접 고를 후보용). 예: 도메인이 canvasgarden.shop이면 @canvasgarden, @canvasgarden_official, @canvasgarden.shop 등.`;

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

  /** 네이버 결과 링크에서 브랜드 홈페이지(네이버/블로그/SNS 아닌 도메인) 하나 고르기 */
  private pickHomepage(items: NaverItem[]): string | undefined {
    for (const it of items) {
      try {
        const u = new URL(it.link ?? "");
        const host = u.hostname.replace(/^www\./, "");
        if (/(^|\.)(naver|blog|instagram|facebook|youtube|tistory|kakao)\./.test(host)) continue;
        return u.origin;
      } catch {
        /* 잘못된 URL 스킵 */
      }
    }
    return undefined;
  }

  /** 홈페이지 정적 HTML에서 실제 instagram.com/핸들 링크만 추출(확실한 신호 — 추측 아님) */
  private async sniffInstagram(homepage: string): Promise<string | undefined> {
    const SKIP = new Set(["p", "reel", "reels", "explore", "accounts", "about", "developer", "legal", "tv", "stories"]);
    try {
      const res = await fetch(homepage, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; collab5bot/1.0)" },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) return undefined;
      const html = await res.text();
      // instagram.com/handle (이메일·문구가 아닌 실제 링크만)
      for (const m of html.matchAll(/instagram\.com\/([A-Za-z0-9_.]{2,30})/g)) {
        const handle = m[1].replace(/\.$/, "");
        if (!SKIP.has(handle.toLowerCase())) return "@" + handle;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /** 지역+웹문서+블로그+카페 병렬 검색 + 홈페이지 인스타 스니핑 → '조사 메모'로 조립.
   *  region이 있으면 지역검색 정확도↑(동명 업체 구분). 블로그·카페=소비자 후기 신호. */
  private async gather(query: string, region?: string): Promise<string> {
    const localQuery = region?.trim() ? `${query} ${region.trim()}` : query;
    const [local, web, blog, cafe] = await Promise.all([
      this.naver("local", localQuery, 4),
      this.naver("webkr", query, 3),
      this.naver("blog", query, 4),
      this.naver("cafearticle", query, 3),
    ]);

    // 홈페이지 정적 HTML에서 인스타 링크 직접 확인(가장 신뢰할 수 있는 신호)
    const homepage = this.pickHomepage([...local, ...web]);
    const sniffedIg = homepage ? await this.sniffInstagram(homepage) : undefined;

    const parts: string[] = [];
    if (sniffedIg || homepage) {
      parts.push("[홈페이지 직접 확인 — 신뢰도 높음]");
      if (homepage) parts.push(`· 홈페이지: ${homepage}`);
      parts.push(
        sniffedIg
          ? `· 인스타그램: ${sniffedIg} (홈페이지 링크에서 실제 확인됨 — 이 값을 신뢰해서 채워)`
          : `· 인스타그램: 홈페이지 정적 HTML에서 링크 확인 안 됨(추측하지 말 것)`
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
    if (blog.length) {
      parts.push("\n[네이버 블로그 — 소비자 후기·분위기 단서]");
      for (const it of blog) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)}`);
      }
    }
    if (cafe.length) {
      parts.push("\n[네이버 카페글 — 실사용 후기·평판 단서]");
      for (const it of cafe) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)}`);
      }
    }
    return parts.join("\n") || "(검색 결과 없음)";
  }

  // 과부하(503)·레이트리밋(429) 시 다음 모델로 폴백.
  // ⚡ 2.5-flash-lite 1순위(2026-07-01 가성비 최적화): 토큰 $0.10/$0.40 + grounding 무료 1,500건/일.
  //   3.1-flash-lite 대비 토큰 2.5배↓ & grounding 무료 9배↑(일1500 vs 월5000). 구조화·검색엔 이 품질로 충분.
  //   폴백 2.0-flash-lite(토큰 최저 $0.075/$0.30) → 2.5-flash(더 똑똑, 안전망).
  private static readonly GEMINI_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash-lite", "gemini-2.5-flash"];

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
    for (const model of NaverGeminiProvider.GEMINI_MODELS) {
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
  private async geminiSearch(query: string, region?: string): Promise<string> {
    if (process.env.ENRICH_GEMINI_SEARCH === "0") return "";
    const loc = region?.trim() ? `\n(위치 힌트: ${region.trim()} — 이 지역의 그 업체를 특정해줘. 동명 업체 주의.)` : "";
    const prompt = `"${query}" 브랜드/업체를 웹에서 조사해줘.${loc} 무엇을 하는 곳인지, 시작·스토리, 특징·강점, 주요 고객, 분위기·평판, 홈페이지 URL, 그리고 블로그·카페 등의 실사용 후기·평판을 사실 위주로 간결한 메모로 정리해줘.
⭐인스타그램은 실제 instagram.com/○○ 페이지를 웹에서 확인한 경우에만 @핸들을 적어. 브랜드명이나 도메인으로 추측하지 마 — 도메인이 canvasgarden.shop이라도 instagram.com/canvasgarden이 실제 존재하는지 확인 안 되면 절대 적지 말고 "인스타: 확인 안 됨"이라고 해. 지어낸 핸들은 틀린 정보라 넣으면 안 돼.
확실하지 않은 건 추측하지 말고 넘어가. 짧은 개조식으로.`;
    // 보조 소스라 실패 시 빠르게 포기(네이버 단독). 429는 쿼터/레이트리밋 → 모델 공유라 재시도 무의미.
    for (const model of NaverGeminiProvider.GEMINI_MODELS) {
      try {
        const response = await this.ai().models.generateContent({
          model,
          contents: prompt,
          config: { tools: [{ googleSearch: {} }], temperature: 0.2 },
        });
        return (response.text ?? "").trim();
      } catch (e) {
        const status = (e as { status?: number; code?: number })?.status ?? (e as { code?: number })?.code;
        if (status === 503) {
          console.warn(`[enrich] gemini search ${model} 503 → 다음 모델 폴백`);
          continue; // 일시 과부하만 다음 모델 시도
        }
        // 429(쿼터)·grounding 미지원·기타 → 즉시 네이버 단독으로 degrade(지연 최소화)
        console.warn(`[enrich] gemini search ${model} 실패(${status ?? "?"}) → 네이버 단독`);
        return "";
      }
    }
    return "";
  }

  // 네이버 메모 + 제미나이 웹 조사 메모를 라벨 붙여 합침(구조화 단계 입력용).
  private combineResearch(naver: string, gemini: string): string {
    const parts = [`[출처 1 · 네이버 검색]\n${naver || "(결과 없음)"}`];
    if (gemini) parts.push(`[출처 2 · 제미나이 웹 조사]\n${gemini}`);
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
    const prompt = `원래 검색어: "${query}"\n\n[조사 자료 — 네이버 검색 + 제미나이 웹 조사]\n${research}${extra}\n\n두 출처를 비교·종합해서 등록 폼 후보로 정리해줘. 서로 보완되는 정보는 합치고, 확실한 것만 채워. 빈 문자열 필드는 missing 처리하거나 생략해. description은 모든 문장을 '해요체'로 끝내(~해요/~예요/~있어요). '~합니다/~습니다' 금지.`;
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
  async research(name: string, region?: string): Promise<string> {
    const [naver, gemini] = await Promise.all([
      this.gather(name, region),
      this.geminiSearch(name, region),
    ]);
    return this.combineResearch(naver, gemini);
  }

  // EnrichOptions 정규화(빈 문자열 → undefined, 후보 5개/결 4개 제한)
  private normalizeOptions(o: EnrichOptions): EnrichOptions {
    const id = o.identity ?? { name: "" };
    return {
      identity: {
        name: id.name || "",
        region: id.region || undefined,
        address: id.address || undefined,
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
    };
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
      ? `⭐가중 키워드(중요하게 반영): ${input.focusKeywords.join(", ")}\n\n`
      : "";
    const prompt = `브랜드명: "${input.name}"\n\n${note}${kw}[조사 자료 — 네이버 검색 + 제미나이 웹 조사]\n${input.research}\n\n위 정보로 한 줄 소개 5개, 브랜드 소개 5개(각 3~5문장, 모두 해요체), 브랜드 결 단어 2~4개, identity(지역·주소·인스타·홈피)를 뽑아줘.
⭐identity.homepage는 조사 자료에 URL이 있으면 채워줘. identity.instagram은 ⚠️'홈페이지 직접 확인' 항목에서 실제 확인된 핸들이 있을 때만 채워 — 그 외에는 추측하지 말고 빈 문자열로 둬(무관한 계정도 금지).
⭐단 instagram이 확정 안 됐으면 instagramCandidates에 도메인·브랜드명 기반 그럴듯한 추정 핸들 2~4개를 넣어줘(사장이 직접 고를 후보). 예: 도메인이 canvasgarden.shop이면 @canvasgarden, @canvasgarden_official, @canvasgarden.shop 등.
나머지는 사실만 쓰고, 확인 안 된 필드는 빈 문자열. 모든 문장은 '해요체'로 끝내('~합니다/~습니다' 금지).`;
    return this.generateOptions(prompt, 0.9);
  }

  // 폼 정보 + (네이버 + 제미나이) → 브랜드 소개 5지선다. round마다 변주(다시 받기).
  async draft(input: DraftInput): Promise<string[]> {
    const research = await this.research(input.name);
    const info = [
      input.oneLiner?.trim() && `한 줄 소개: ${input.oneLiner.trim()}`,
      input.values?.length && `브랜드를 표현하는 말: ${input.values.join(", ")}`,
      input.offers?.length && `제공 가능한 콜라보: ${input.offers.join(", ")}`,
      input.targetAudience?.length && `주요 고객: ${input.targetAudience.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");
    const kw = (input.focusKeywords?.length ? input.focusKeywords : input.values) ?? [];
    const round = input.round ?? 0;
    const prompt = `브랜드명: "${input.name}"\n\n[사용자 입력]\n${
      info || "(입력이 적어요 — 조사 자료 위주로)"
    }\n\n${kw.length ? `⭐가중 키워드(가장 중요하게 반영): ${kw.join(", ")}\n\n` : ""}[조사 자료]\n${research}\n\n위 자료로 '브랜드 소개' 후보 5개를 서로 다른 앵글로(각 3~5문장, 모두 해요체). oneLiners·values·identity도 채워줘.${
      round > 0 ? " 이전과는 다른 표현·각도로 새롭게 써줘." : ""
    }`;
    const opts = await this.generateOptions(prompt, round > 0 ? 1.0 : 0.9);
    return opts.descriptions;
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

/** 조사 메모 생성(백그라운드 크롤) — 위저드가 키워드 입력받는 동안 먼저 돌린다. */
export async function enrichResearch(name: string, region?: string): Promise<string> {
  return provider.research ? provider.research(name, region) : "";
}

/** 조사 메모 + 가중 키워드 → 한줄소개·브랜드소개 5지선다. */
export async function enrichOptions(input: OptionsInput): Promise<EnrichOptions | null> {
  return provider.options ? provider.options(input) : null;
}
