// Supabase 세션 갱신 미들웨어 — ⚠️ Next16에선 proxy 컨벤션 권장(경고만 뜸). dev 서버 재시작 가능할 때 proxy.ts로 리네임 — 만료 토큰을 재발급해 쿠키에 반영.
// env 없으면(로컬 mock) 통과만.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // 🔒09-17 개발용 화면(`/dev/*` — 하루 가게 목 데이터 지도·메일 미리보기)은 운영에서 진짜 404로.
  //   페이지 안의 `notFound()`는 스트리밍이 먼저 시작돼 상태 코드가 200으로 나가고 탭 제목도 샌다(운영 빌드 실측).
  if (process.env.NODE_ENV !== "development" && request.nextUrl.pathname.startsWith("/dev/")) {
    return new NextResponse("Not Found", { status: 404 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });
  await supabase.auth.getUser(); // 세션 리프레시 트리거
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
