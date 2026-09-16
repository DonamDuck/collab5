import { NextResponse, type NextRequest } from "next/server";
import { RENT_MOCK_COOKIE } from "@/lib/rent-mock";
import { MOCK_CASES } from "@/lib/rent-mock-data";

// 🧪하루 가게 목 데이터 켜고 끄기 (2026-09-17) · 개발 빌드 전용
//
// `?case=<이름>&to=<경로>` → 쿠키를 넣고 그 화면으로 보낸다. `?off=1` → 쿠키를 지우고 지도로 돌아간다.
// 🚨운영에선 404. 목 모드 자체도 `rent-mock.ts`가 운영에서 안 켜지게 막지만, 스위치가 살아 있을 이유가 없다.
// 🔒`to`는 우리 사이트 안 경로만 받는다(`/`로 시작하고 `//`·`\`가 없는 것). 아니면 남의 사이트로 튕기는 링크가 된다.
const DEV = process.env.NODE_ENV === "development";

export async function GET(req: NextRequest) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const q = req.nextUrl.searchParams;

  if (q.get("off") === "1") {
    const res = NextResponse.redirect(new URL("/dev/rent-map", req.url));
    res.cookies.delete(RENT_MOCK_COOKIE);
    return res;
  }

  const id = q.get("case") ?? "";
  if (!MOCK_CASES.some((c) => c.id === id)) {
    return new NextResponse(`모르는 케이스예요: ${id}`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const raw = q.get("to") ?? "/dev/rent-map";
  const to = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/dev/rent-map";

  const res = NextResponse.redirect(new URL(to, req.url));
  // httpOnly — 화면 스크립트가 읽을 일이 없다. 띠는 서버(레이아웃)가 읽어서 그린다.
  res.cookies.set(RENT_MOCK_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
