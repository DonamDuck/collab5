// 서버(RSC·서버액션)용 Supabase Auth 클라이언트 — anon 키 + 쿠키 세션.
// 데이터 접근은 여전히 repo(service_role)로만. 여긴 Auth 전용.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

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

/** 현재 로그인 유저 (없거나 auth 미설정이면 null) */
export async function getSessionUser(): Promise<User | null> {
  if (!authEnabled()) return null;
  try {
    const supabase = await createAuthClient();
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
