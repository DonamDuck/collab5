// 전 페이지 공용 헤더 — 서버 컴포넌트. 세션 유무로 우측 영역 분기.
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { signOutAction } from "@/lib/auth-actions";
import { Avatar } from "./Avatar";

export async function SiteHeader() {
  const user = await getSessionUser();
  const profile = user ? await getProfile(user.id) : null;
  const displayName = profile?.brandName || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-6">
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.svg" alt="collab5" className="h-7 w-auto" />
      </a>
      <nav className="flex items-center gap-1 text-sm">
        <a href="/search" className="rounded-md px-3 py-1.5 text-mute hover:text-ink">
          찾기
        </a>
        <a
          href="/register"
          className="rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink"
        >
          콜라보 카드 만들기
        </a>
        {user ? (
          <>
            <a
              href="/my"
              className="ml-1 flex items-center gap-2 rounded-md px-2 py-1 hover:bg-surface-soft"
              aria-label="내 소개서"
            >
              <Avatar image={profile?.profileImage || undefined} name={displayName || "?"} size={30} />
              <span className="hidden font-medium text-ink sm:inline">{displayName}</span>
            </a>
            <form action={signOutAction}>
              <button type="submit" className="rounded-md px-2 py-1.5 text-mute hover:text-ink">
                로그아웃
              </button>
            </form>
          </>
        ) : (
          <a href="/login" className="ml-1 rounded-md px-3 py-1.5 font-medium text-mute hover:text-ink">
            로그인
          </a>
        )}
      </nav>
    </header>
  );
}
