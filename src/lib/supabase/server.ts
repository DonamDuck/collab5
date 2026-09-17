// 서버(RSC·서버액션)용 Supabase Auth 클라이언트 — anon 키 + 쿠키 세션.
// 데이터 접근은 여전히 repo(service_role)로만. 여긴 Auth 전용.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";
import { devSessionActive, devUser } from "@/lib/dev-session";
import { getRentMock, type MockCase } from "@/lib/rent-mock";

/** 🧪09-18 목 데이터 — 케이스의 가상 사용자를 세션처럼 돌려준다(개발 빌드 전용, `getRentMock`이 운영에선 null).
 *  09-17엔 `getSessionUserId`만 가상 사용자였고 헤더·`/my`는 실제 계정이라 둘이 어긋났다. 이제 같은 사람이다.
 *  `id`는 `mock-uuid-<번호>` — `profiles.ts`의 `getProfile`이 목 모드에서 이 모양으로 찾는다. */
function mockUser(m: MockCase): User | null {
  const id = m.viewer.userId;
  if (id === null) return null;
  const p = m.data.profiles.find((x) => x.id === id);
  return {
    id: `mock-uuid-${id}`, email: p?.email || undefined, aud: "authenticated", role: "authenticated",
    app_metadata: {}, user_metadata: { brand_name: p?.brandName ?? "" }, created_at: "2026-01-01T00:00:00.000Z",
  } as unknown as User;
}

export function authEnabled(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function createAuthClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // RSC 렌더 중 set 불가 — 미들웨어가 세션을 갱신하므로 무시 가능
          }
        },
      },
    }
  );
}

/** 현재 로그인 유저 — getUser()로 서버 검증(네트워크 왕복). 보안 게이트(예: /my 리다이렉트)에 사용. */
/** 지금 «로컬 가짜 로그인»으로 도는 중인가. 화면이 개발용 입력을 섞을지 판단할 때만 쓴다.
 *  🚨판정은 `lib/dev-session.ts` 한 곳에만 있다 — 게이트를 여러 벌 두지 않는다. */
export function isDevSession(): boolean {
  return devSessionActive(authEnabled());
}

export async function getSessionUser(): Promise<User | null> {
  const mock = await getRentMock();
  if (mock) return mockUser(mock);
  // 🔒로컬 전용 가짜 로그인 — 진짜 인증이 «설정돼 있으면 절대 안 탄다**(`lib/dev-session.ts` 게이트 참조).
  if (devSessionActive(authEnabled())) return devUser();
  if (!authEnabled()) return null;
  try {
    const supabase = await createAuthClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}

/** 현재 로그인 유저 — 쿠키의 세션만 읽음(네트워크 없음). 미들웨어가 매 요청 getUser로 이미 검증·갱신하므로
 *  헤더 등 표시용 조회는 이걸로 왕복을 아낀다. (보안 게이트에는 getSessionUser 사용) */
export async function getSessionUserLight(): Promise<User | null> {
  const mock = await getRentMock();
  if (mock) return mockUser(mock);
  // 🔒로컬 전용 가짜 로그인 — 진짜 인증이 «설정돼 있으면 절대 안 탄다**(`lib/dev-session.ts` 게이트 참조).
  if (devSessionActive(authEnabled())) return devUser();
  if (!authEnabled()) return null;
  try {
    const supabase = await createAuthClient();
    const { data } = await supabase.auth.getSession();
    return data.session?.user ?? null;
  } catch {
    return null;
  }
}
