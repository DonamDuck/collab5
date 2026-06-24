// POST /api/enrich — 업체명 → enrich 후보(폼 초안) 리스트.
// 지금은 mock(키 불필요). 키 발급 후 lib/enrich.ts의 provider만 Claude로 교체하면
// 이 라우트는 그대로 동작한다(응답 스키마 동일).
import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { enrichLookup, enrichRecrawl } from "@/lib/enrich";

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
