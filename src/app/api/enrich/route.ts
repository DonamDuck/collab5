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
  enrichRegenDescriptions,
  enrichOneLiners,
  enrichResearch,
  enrichOptions,
  extractChipsFromResearch,
  starterChipsForType,
  extractLinksFromResearch,
  extractMapLinkFromResearch,
  researchTier,
  detectRegionMismatch,
} from "@/lib/enrich";
import { fetchHomepageDigest, fetchArticleExcerpts } from "@/lib/homepage";
import { fetchInstagramDigest } from "@/lib/instagram";

// 홈페이지 딥리드(예산 8초) + Gemini 생성 여유 — Vercel 기본값(짧음) 대신 명시
export const maxDuration = 60;

// 확정 홈페이지 URL → 서버에서 딥리드 발췌 생성. 실패는 전부 조용한 저하(undefined → 기존 동작).
// digest 텍스트는 서버에서만 만든다 — 클라이언트가 보낸 텍스트를 프롬프트에 넣지 않는다(주입 차단).
async function digestOf(homepage: unknown): Promise<string | undefined> {
  const hp = typeof homepage === "string" ? homepage.trim() : "";
  if (!hp) return undefined;
  try {
    const d = await fetchHomepageDigest(hp);
    return d.ok ? d.digest : undefined;
  } catch (e) {
    console.warn("[enrich] homepage digest failed:", e);
    return undefined;
  }
}

// 확정 인스타 핸들 → 바이오 + (조사 메모 속 게시물 URL의) 캡션 발췌. 실패는 조용한 저하.
// digest 텍스트는 서버에서만 만든다 — 클라이언트 텍스트를 프롬프트에 넣지 않는다(주입 차단).
async function igDigestOf(instagram: unknown, researchMemo: unknown): Promise<string | undefined> {
  const handle = typeof instagram === "string" ? instagram.trim() : "";
  if (!handle) return undefined;
  try {
    const d = await fetchInstagramDigest(handle, typeof researchMemo === "string" ? researchMemo : undefined);
    if (d.ok) console.log(`[enrich] instagram digest: bio+${d.posts}posts (@${handle.replace(/^@/, "")})`);
    return d.ok ? d.digest : undefined;
  } catch (e) {
    console.warn("[enrich] instagram digest failed:", e);
    return undefined;
  }
}

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
    chosenOneLiner?: unknown;
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
      const memo = await enrichResearch(name, region, businessType || undefined);
      // 동명 타지역 업체 감지 — 틀린 브랜드의 칩·링크·메모를 통째로 버린다(오귀속 사고 방지).
      // 솔직 배너 + 업종 스타터로 진행하고, 메모는 생성 단계가 헷갈리지 않게 짧은 사실 노트로 대체.
      const mismatch = detectRegionMismatch(memo, region);
      if (mismatch) {
        console.log("[enrich] region-mismatch", JSON.stringify({ name, region, found: mismatch }));
        return NextResponse.json({
          chips: [],
          starter: starterChipsForType(businessType),
          tier: "thin",
          links: {},
          research: `[동명 업체 제외] 웹 검색에서는 '${mismatch}' 쪽의 동명 업체만 확인돼, 입력하신 지역(${region})의 '${name}' 정보는 반영하지 않았어요. 아래 사용자가 고른 키워드와 직접 입력한 정보만으로 작성해 주세요.`,
          mismatch: true,
        });
      }
      const chips = extractChipsFromResearch(memo, name, businessType || undefined);
      // 칩이 없으면 유저 관점에선 빈손(thin) — 홈피 메타가 있어도 고를 게 없으면
      // 솔직 배너 + 업종 스타터로 안내한다(제미나이 degrade·레이트리밋 시에도 빈 화면 방지).
      const tier = chips.length === 0 ? "thin" : researchTier(memo, chips.length);
      // 지도 링크는 코드가 좌표로 조립해 메모에 심어둔 값 — 위저드 링크 확인 화면에 함께 보여준다.
      // name 전달 필수 — 지역검색은 이웃 업체 줄도 함께 주므로 상호가 일치하는 줄의 링크만 쓴다.
      const links = { ...extractLinksFromResearch(memo, name), mapUrl: extractMapLinkFromResearch(memo) };
      // 칩이 6개 미만이면 업종 스타터로 보강 — 네이버 칩만 2~3개 나온 소형 업체가
      // 유용한 스타터('혹시 해당되나요?')까지 잃지 않게(07-19 네이버 칩 도입으로 경계 상향).
      const starter = tier === "thin" || chips.length < 6 ? starterChipsForType(businessType) : [];
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
        homepageDigest: await digestOf(body.homepage), // 확정 홈페이지 딥리드(실패 시 undefined)
        instagramDigest: await igDigestOf(body.instagram, body.research), // 확정 인스타 딥리드(실패 시 undefined)
        pressDigest:
          (await fetchArticleExcerpts(
            typeof body.research === "string" ? body.research : undefined
          ).catch(() => "")) || undefined, // 메모 속 기사 본문 발췌(실패 시 undefined)
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
      const { oneLiners, descriptions, researchMemo } = await enrichDraftBoth({
        name,
        // 크롤 씨앗 — 다시받기가 주소 파생 region + enrichment.seed.businessType을 넘겨 위저드 수준 정확도로
        region: typeof body.region === "string" ? body.region.trim() || undefined : undefined,
        businessType:
          typeof body.businessType === "string" ? body.businessType.trim() || undefined : undefined,
        oneLiner: typeof body.oneLiner === "string" ? body.oneLiner : undefined,
        values: strArr(body.values),
        offers: strArr(body.offers),
        targetAudience: strArr(body.targetAudience),
        focusKeywords: strArr(body.focusKeywords),
        starredKeywords: strArr(body.starredKeywords),
        verbatimKeywords: strArr(body.verbatimKeywords),
        researchMemo: typeof body.researchMemo === "string" ? body.researchMemo : undefined,
        homepageDigest: await digestOf(body.homepage), // 확정 홈페이지 딥리드(실패 시 undefined)
        instagramDigest: await igDigestOf(body.instagram, body.researchMemo), // 확정 인스타 딥리드(실패 시 undefined)
        pressDigest:
          (await fetchArticleExcerpts(
            typeof body.researchMemo === "string" ? body.researchMemo : undefined
          ).catch(() => "")) || undefined, // 메모 속 기사 본문 발췌(실패 시 undefined)
        round: typeof body.round === "number" ? body.round : 0,
      });
      // researchMemo = 자세히 재생성(descFromOneLiner)이 재사용 → 재크롤 방지(콜 절감)
      return NextResponse.json({ oneLiners, descriptions, researchMemo });
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

  // ── 자세히 재생성 모드: 고른/수정한 한 줄 소개를 관통 주제로 자세히 5개만 다시 생성 ──
  //    ⚡콜 규율: 재크롤 없이 generateOptions 1콜만(researchMemo 재사용). 클라가 한줄 텍스트만 전달. ──
  if (body.mode === "descFromOneLiner") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const chosenOneLiner =
      typeof body.chosenOneLiner === "string" ? body.chosenOneLiner.trim() : "";
    if (!name || !chosenOneLiner) {
      return NextResponse.json({ error: "브랜드 이름과 한 줄 소개가 필요해요." }, { status: 400 });
    }
    try {
      // 앵커 N개만 생성(N=DESC_ANCHOR_COUNT). 자유 M개 블렌드는 클라(사전 생성 풀 보유)가 담당.
      const anchors = await enrichRegenDescriptions({
        name,
        chosenOneLiner,
        researchMemo: typeof body.researchMemo === "string" ? body.researchMemo : undefined,
        focusKeywords: strArr(body.focusKeywords),
        values: strArr(body.values),
        homepageDigest: await digestOf(body.homepage), // 확정 홈페이지 딥리드(실패 시 undefined)
        instagramDigest: await igDigestOf(body.instagram, body.researchMemo), // 확정 인스타 딥리드(실패 시 undefined)
      });
      return NextResponse.json({ anchors });
    } catch (e) {
      console.error("[enrich] descFromOneLiner failed:", e);
      // 실패해도 기존 자세히 후보를 그대로 쓰게 빈 배열 — 클라가 교체하지 않고 유지
      return NextResponse.json(
        { anchors: [], error: "자세히 소개를 다시 만들지 못했어요. 기존 후보로 계속 진행할게요." },
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
