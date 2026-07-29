// 전 페이지 공용 헤더 — 서버 컴포넌트. 세션 유무로 우측 영역 분기.
import Link from "next/link";
import { getSessionUserLight } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { Avatar } from "./Avatar";

export async function SiteHeader() {
  const user = await getSessionUserLight();
  const profile = user ? await getProfile(user.id) : null;
  const displayName = profile?.brandName || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-6 print:hidden">
      {/* ⚠️ 좁은 폰(375·360px)에서 워드마크(123px)+우측메뉴(244px)가 가용폭을 넘겨
          페이지 전체에 가로 스크롤이 생겼다(전 페이지 공통이라 영향 큼, QA 07-29).
          모바일은 심볼만, sm↑는 워드마크로 분기해 93.5px을 회수한다.
          body/html에 overflow-x-hidden으로 덮으면 홈의 100vmax 풀블리드 밴드가 잘리므로 금지. */}
      <Link href="/" className="flex min-w-0 items-center" aria-label="collab5 홈">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-mark.svg" alt="" aria-hidden="true" className="h-7 w-7 sm:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.svg" alt="" aria-hidden="true" className="hidden h-7 w-auto sm:block" />
      </Link>
      <nav className="flex items-center gap-1.5 text-sm sm:gap-2">
        {/* 찾기 — 돋보기 아이콘 */}
        <Link
          href="/search"
          aria-label="찾기"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-mute hover:bg-surface-soft hover:text-ink"
        >
          <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
        </Link>
        {/* 브랜드 소개서 만들기 → 짧게 '브랜드 소개서' */}
        <Link
          href="/register"
          className="shrink-0 whitespace-nowrap rounded-md border border-border-strong bg-surface px-3 py-1.5 font-medium text-ink"
        >
          브랜드 소개서
        </Link>
        {user ? (
          /* 프로필 원형(→ 내 소개서). 로그아웃은 /my 페이지에서. */
          <Link
            href="/my"
            aria-label="내 소개서"
            className="ml-0.5 flex shrink-0 items-center rounded-pill hover:opacity-90"
          >
            <Avatar image={profile?.profileImage || undefined} name={displayName || "?"} size={32} />
          </Link>
        ) : (
          <Link
            href="/login"
            className="ml-0.5 shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 font-medium text-mute hover:text-ink"
          >
            로그인
          </Link>
        )}
      </nav>
    </header>
  );
}
