// 전 페이지 공용 헤더 — 서버 컴포넌트. 세션 유무로 우측 영역 분기.
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
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
      <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
        {/* 찾기 — 돋보기 아이콘 */}
        <a
          href="/search"
          aria-label="찾기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-surface-soft hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
        </a>
        {/* 콜라보 카드 만들기 → 짧게 '콜라보 카드' */}
        <a
          href="/register"
          className="shrink-0 whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink"
        >
          콜라보 카드
        </a>
        {user ? (
          /* 프로필 원형(→ 내 소개서). 로그아웃은 /my 페이지에서. */
          <a
            href="/my"
            aria-label="내 소개서"
            className="ml-0.5 flex shrink-0 items-center rounded-pill hover:opacity-90"
          >
            <Avatar image={profile?.profileImage || undefined} name={displayName || "?"} size={32} />
          </a>
        ) : (
          <a
            href="/login"
            className="ml-0.5 shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-mute hover:text-ink"
          >
            로그인
          </a>
        )}
      </nav>
    </header>
  );
}
