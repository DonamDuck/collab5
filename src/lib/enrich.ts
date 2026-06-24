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

/** 검색 단계 추상화 — mock ↔ Claude/Gemini 교체 지점. */
export interface SearchProvider {
  lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]>;
  /** (선택) 인스타/홈피 기반 재크롤링 — 더 풍부한 단일 후보 */
  recrawl?(input: RecrawlInput): Promise<EnrichCandidate | null>;
}

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
규칙:
- description(소개 한 문단)과 values(브랜드 결 칩 2~4개)는 매력적인 '초안'으로 작성한다. 사용자가 검수·수정할 전제다.
- instagram·homepage·address는 조사에서 실제로 확인된 것만 채우고, 각각 sources에 출처(label=도메인/서비스명, url)를 남긴다. 확인 안 되면 비우고 missing에 넣는다. 절대 지어내지 마라.
- 콜라보 유형·지역규모 같은 필터 항목은 추측하지 마라(폼에서 사람이 직접 고른다).
- 같은 이름의 서로 다른 업체가 보이면 candidates 배열에 각각 담고, hint(지역·업종 한 줄)로 구분한다.
- 모든 텍스트는 자연스러운 한국어 해요체.`;

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

  /** 네이버 검색 API 1종 호출. 실패해도 throw 안 하고 빈 배열(graceful). */
  private async naver(type: "local" | "webkr" | "blog", query: string, display: number): Promise<NaverItem[]> {
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

  /** 지역+웹문서+블로그를 병렬 검색해 Gemini에 줄 '조사 메모'로 조립 */
  private async gather(query: string): Promise<string> {
    const [local, web, blog] = await Promise.all([
      this.naver("local", query, 5),
      this.naver("webkr", query, 5),
      this.naver("blog", query, 3),
    ]);

    const parts: string[] = [];
    if (local.length) {
      parts.push("[네이버 지역검색 — 주소·업종·전화]");
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
      parts.push("\n[네이버 블로그 — 분위기·후기 단서]");
      for (const it of blog) {
        parts.push(`· ${this.clean(it.title)} | ${this.clean(it.description)}`);
      }
    }
    return parts.join("\n") || "(검색 결과 없음)";
  }

  /** 조사 메모 → 등록 폼 후보 (Gemini structured output) */
  private async structure(query: string, research: string, extra = ""): Promise<EnrichCandidate[]> {
    const response = await this.ai().models.generateContent({
      model: "gemini-2.5-flash",
      contents: `원래 검색어: "${query}"\n\n[네이버 조사 메모]\n${research}${extra}\n\n위 조사 내용을 등록 폼 후보로 정리해줘. 빈 문자열 필드는 missing 처리하거나 생략해.`,
      config: {
        systemInstruction: ENRICH_SYSTEM,
        responseMimeType: "application/json",
        responseSchema: GEMINI_RESULT_SCHEMA,
        temperature: 0.4,
      },
    });
    const text = response.text ?? "";
    let parsed: EnrichResult;
    try {
      parsed = JSON.parse(text) as EnrichResult;
    } catch {
      console.warn("[enrich] gemini JSON parse 실패");
      return [];
    }
    // 빈 문자열 optional 필드 정리(Gemini가 ""로 채우는 경우 → undefined)
    return (parsed.candidates ?? []).map((c) => ({
      ...c,
      region: c.region || undefined,
      address: c.address || undefined,
      instagram: c.instagram || undefined,
      homepage: c.homepage || undefined,
      hint: c.hint || undefined,
    }));
  }

  async lookup(query: string, hintUrl?: string): Promise<EnrichCandidate[]> {
    const research = await this.gather(query);
    const extra = hintUrl ? `\n\n참고 링크(우선 확인): ${hintUrl}` : "";
    return this.structure(query, research, extra);
  }

  async recrawl(input: RecrawlInput): Promise<EnrichCandidate | null> {
    // 인스타 핸들·홈피 도메인까지 검색어에 섞어 더 깊이 조사
    const terms = [input.name, input.homepage, input.instagram?.replace(/^@/, "")].filter(Boolean).join(" ");
    const research = await this.gather(terms);
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
