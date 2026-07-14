// POST /api/enrich — 업체명 → enrich 후보(폼 초안) 리스트.
// 지금은 mock(키 불필요). 키 발급 후 lib/enrich.ts의 provider만 Claude로 교체하면
// 이 라우트는 그대로 동작한다(응답 스키마 동일).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import {
  enrichLookup,
  enrichRecrawl,
  enrichDraft,
  enrichDraftBoth,
  enrichOneLiners,
  enrichResearch,
  enrichOptions,
  extractChipsFromResearch,
  starterChipsForType,
  extractLinksFromResearch,
  researchTier,
} from "@/lib/enrich";

// 임시 진단: web_search 없는 최소 호출 — 전반 과부하 vs web_search 특정 구분용.
export async function GET() {
  try {
    const client = new Anthropic({ maxRetries: 1 });
    const res = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 20,
      messages: [{ role: "user", content: "'OK'라고만 답해줘." }],
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
    return NextResponse.json({ ok: true, text });
  } catch (e) {
    const status = e instanceof Anthropic.APIError ? e.status : undefined;
    return NextResponse.json({ ok: false, status, message: String(e) });
  }
}

export async function POST(req: Request) {
  let body: {
    mode?: unknown;
    query?: unknown;
    hintUrl?: unknown;
    name?: unknown;
    instagram?: unknown;
    homepage?: unknown;
    oneLiner?: unknown;
    values?: unknown;
    offers?: unknown;
    targetAudience?: unknown;
    focusKeywords?: unknown;
    starredKeywords?: unknown;
    verbatimKeywords?: unknown;
    researchMemo?: unknown;
    businessType?: unknown;
    ownerNote?: unknown;
    research?: unknown;
    region?: unknown;
    round?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "잘못된 요청이에요." }, { status: 400 });
  }

  // ── 재크롤링 모드: 인스타/홈피 기반 추가 조사 → 풍부한 단일 후보 ──
  if (body.mode === "recrawl") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "업체명이 필요해요." }, { status: 400 });
    }
    try {
      const candidate = await enrichRecrawl({
        name,
        instagram: typeof body.instagram === "string" ? body.instagram.trim() || undefined : undefined,
        homepage: typeof body.homepage === "string" ? body.homepage.trim() || undefined : undefined,
      });
      return NextResponse.json({ candidate });
    } catch (e) {
      console.error("[enrich] recrawl failed:", e);
      return NextResponse.json(
        { candidate: null, error: "추가 조사에 실패했어요. 찾은 정보로 계속 진행할게요." },
        { status: 200 }
      );
    }
  }

  const strArr = (v: unknown): string[] | undefined =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : undefined;

  // ── 조사 모드: 브랜드명 → 조사 메모만(백그라운드 크롤). 위저드가 키워드 받는 동안 먼저 호출 ──
  if (body.mode === "research") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    const region = typeof body.region === "string" ? body.region.trim() || undefined : undefined;
    try {
      const research = await enrichResearch(name, region);
      return NextResponse.json({ research });
    } catch (e) {
      console.error("[enrich] research failed:", e);
      return NextResponse.json({ research: "", error: "조사에 실패했어요." }, { status: 200 });
    }
  }

  // ── 키워드 모드(크롤→키워드 재설계): 상호+지역+업종 → 크롤 1회 → 선택용 칩 + 링크 후보 + 티어.
  //    research 메모를 함께 반환해 이후 생성(draft2)에서 재사용 → 재크롤 방지(콜 절감). ──
  if (body.mode === "keywords") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    const region = typeof body.region === "string" ? body.region.trim() || undefined : undefined;
    const businessType = typeof body.businessType === "string" ? body.businessType.trim() : "";
    try {
      const memo = await enrichResearch(name, region);
      const chips = extractChipsFromResearch(memo);
      // 칩이 없으면 유저 관점에선 빈손(thin) — 홈피 메타가 있어도 고를 게 없으면
      // 솔직 배너 + 업종 스타터로 안내한다(제미나이 degrade·레이트리밋 시에도 빈 화면 방지).
      const tier = chips.length === 0 ? "thin" : researchTier(memo, chips.length);
      const links = extractLinksFromResearch(memo);
      const starter = tier === "thin" || chips.length < 3 ? starterChipsForType(businessType) : [];
      return NextResponse.json({ chips, starter, tier, links, research: memo });
    } catch (e) {
      console.error("[enrich] keywords failed:", e);
      return NextResponse.json(
        {
          chips: [],
          starter: starterChipsForType(businessType),
          tier: "thin",
          links: {},
          research: "",
          error: "조사에 실패했어요. 직접 골라주시거나 작성해 주세요.",
        },
        { status: 200 }
      );
    }
  }

  // ── 5지선다 모드: 조사 메모 + 가중 키워드 → 한줄소개·브랜드소개 후보 5개씩 ──
  if (body.mode === "options") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    try {
      const options = await enrichOptions({
        name,
        research: typeof body.research === "string" ? body.research : "",
        focusKeywords: strArr(body.focusKeywords),
        starredKeywords: strArr(body.starredKeywords),
        verbatimKeywords: strArr(body.verbatimKeywords),
        ownerNote: typeof body.ownerNote === "string" ? body.ownerNote : undefined,
      });
      return NextResponse.json({ options });
    } catch (e) {
      console.error("[enrich] options failed:", e);
      return NextResponse.json(
        { options: null, error: "지금은 후보 만들기가 어려워요. 잠시 후 다시 시도해 주세요." },
        { status: 200 }
      );
    }
  }

  // ── 초안 모드: 폼 정보 기반 브랜드 소개 5지선다(백엔드 크롤링 + AI 작성) ──
  if (body.mode === "draft") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    }
    try {
      const descriptions = await enrichDraft({
        name,
        oneLiner: typeof body.oneLiner === "string" ? body.oneLiner : undefined,
        values: strArr(body.values),
        offers: strArr(body.offers),
        targetAudience: strArr(body.targetAudience),
        focusKeywords: strArr(body.focusKeywords),
        round: typeof body.round === "number" ? body.round : 0,
      });
      return NextResponse.json({ descriptions });
    } catch (e) {
      console.error("[enrich] draft failed:", e);
      return NextResponse.json(
        { descriptions: [], error: "지금은 초안 작성이 어려워요. 잠시 후 다시 시도하거나 직접 입력해 주세요." },
        { status: 200 }
      );
    }
  }

  // ── draft2 모드: 한 줄 소개 3개 + 브랜드 소개 5개를 크롤 1회로 한 번에(초안받기 이중 크롤 제거) ──
  if (body.mode === "draft2") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    }
    try {
      const { oneLiners, descriptions } = await enrichDraftBoth({
        name,
        oneLiner: typeof body.oneLiner === "string" ? body.oneLiner : undefined,
        values: strArr(body.values),
        offers: strArr(body.offers),
        targetAudience: strArr(body.targetAudience),
        focusKeywords: strArr(body.focusKeywords),
        starredKeywords: strArr(body.starredKeywords),
        verbatimKeywords: strArr(body.verbatimKeywords),
        researchMemo: typeof body.researchMemo === "string" ? body.researchMemo : undefined,
        round: typeof body.round === "number" ? body.round : 0,
      });
      return NextResponse.json({ oneLiners, descriptions });
    } catch (e) {
      console.error("[enrich] draft2 failed:", e);
      return NextResponse.json(
        {
          oneLiners: [],
          descriptions: [],
          error: "지금은 초안 작성이 어려워요. 잠시 후 다시 시도하거나 직접 입력해 주세요.",
        },
        { status: 200 }
      );
    }
  }

  // ── 한 줄 소개 모드: 폼 정보 기반 한 줄 소개 후보 3개(초안받기 2스텝 스텝1용) ──
  if (body.mode === "oneLiners") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "브랜드 이름이 필요해요." }, { status: 400 });
    }
    try {
      const oneLiners = await enrichOneLiners({
        name,
        oneLiner: typeof body.oneLiner === "string" ? body.oneLiner : undefined,
        values: strArr(body.values),
        offers: strArr(body.offers),
        targetAudience: strArr(body.targetAudience),
        focusKeywords: strArr(body.focusKeywords),
        round: typeof body.round === "number" ? body.round : 0,
      });
      return NextResponse.json({ oneLiners });
    } catch (e) {
      console.error("[enrich] oneLiners failed:", e);
      return NextResponse.json(
        { oneLiners: [], error: "지금은 초안 작성이 어려워요. 잠시 후 다시 시도하거나 직접 입력해 주세요." },
        { status: 200 }
      );
    }
  }

  // ── 기본: 업체명 → 후보 리스트 ──
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "브랜드 이름을 입력해 주세요." }, { status: 400 });
  }
  const hintUrl = typeof body.hintUrl === "string" ? body.hintUrl.trim() : undefined;

  try {
    const result = await enrichLookup(query, hintUrl);
    return NextResponse.json(result);
  } catch (e) {
    // graceful degradation — 실패해도 빈 응답이 아니라 안내 메시지 + 빈 후보.
    console.error("[enrich] lookup failed:", e);
    return NextResponse.json(
      {
        candidates: [],
        error: "지금은 자동으로 불러오기가 어려워요. 잠시 후 다시 시도하거나 아래에 직접 입력해 주세요.",
      },
      { status: 200 }
    );
  }
}
