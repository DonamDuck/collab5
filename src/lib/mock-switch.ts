import { NextResponse, type NextRequest } from "next/server";
import { RENT_MOCK_COOKIE } from "./rent-mock";
import { MOCK_CASES } from "./rent-mock-data";

// 🧪목 데이터 켜고 끄기 (09-17 하루 가게 → 09-18 사이트 전체) · 개발 빌드 전용
//
// `?case=<이름>&to=<경로>` → 쿠키를 넣고 그 화면으로 보낸다. `?off=1` → 쿠키를 지우고 지도로 돌아간다.
// 주소가 둘이다. `/dev/mock`(사이트 지도가 쓴다)과 `/dev/rent-mock`(09-17부터 대표·디자인팀이 쓰던 링크). 하는 일은 같다.
// 🚨운영에선 404. 목 모드 자체도 `rent-mock.ts`가 운영에서 안 켜지게 막지만, 스위치가 살아 있을 이유가 없다.
// 🔒`to`는 우리 사이트 안 경로만 받는다(`/`로 시작하고 `//`·`\`가 없는 것). 아니면 남의 사이트로 튕기는 링크가 된다.
export function mockSwitch(req: NextRequest, home: string): NextResponse {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  const q = req.nextUrl.searchParams;
  // 🪤`req.url`은 개발 서버에서 `localhost`로 바뀌어 온다. 127.0.0.1로 연 사람을 localhost로 튕기면 쿠키가 다른 호스트에 남아
  //   케이스가 안 먹는다(09-18 실측). 브라우저가 보낸 Host 그대로 돌려보낸다.
  const origin = `${req.nextUrl.protocol}//${req.headers.get("host") ?? req.nextUrl.host}`;

  if (q.get("off") === "1") {
    const res = NextResponse.redirect(new URL(home, origin));
    res.cookies.delete(RENT_MOCK_COOKIE);
    return res;
  }

  const id = q.get("case") ?? "";
  if (!MOCK_CASES.some((c) => c.id === id)) {
    return new NextResponse(`모르는 케이스예요: ${id}`, { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const raw = q.get("to") ?? home;
  const to = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : home;

  const res = NextResponse.redirect(new URL(to, origin));
  // httpOnly — 화면 스크립트가 읽을 일이 없다. 띠는 서버(레이아웃)가 읽어서 그린다.
  res.cookies.set(RENT_MOCK_COOKIE, id, { path: "/", httpOnly: true, sameSite: "lax" });
  return res;
}
