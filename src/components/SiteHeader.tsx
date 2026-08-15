// 전 페이지 공용 헤더 — 서버 컴포넌트. 세션 유무로 우측 영역 분기.
import Link from "next/link";
import { getSessionUserLight } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { Avatar } from "./Avatar";
import { HeaderNavLinks } from "./HeaderNavLinks";

export async function SiteHeader() {
  const user = await getSessionUserLight();
  const profile = user ? await getProfile(user.id) : null;
  const displayName = profile?.brandName || user?.email?.split("@")[0] || "";

  return (
    <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-hairline bg-canvas px-4 sm:px-6 print:hidden">
      {/* 로고 — 모바일에서도 워드마크 노출(대표 지시 07-31).
          ⚠️ 예전엔 모바일=심볼만이었다. 좁은 폰(375·360)에서 워드마크(123px)+우측메뉴(244px)가
             가용폭을 넘겨 **전 페이지에 가로 스크롤**이 생겼기 때문(QA 07-29).
             이번에 우측의 '브랜드 소개서' 버튼을 없애고 돋보기를 검색칩 하나로 합쳐 폭을 회수해서
             워드마크를 되살릴 수 있게 됐다. 모바일은 h-6로 한 단 줄여 여유를 더 둔다.
             body/html에 overflow-x-hidden으로 덮는 우회는 홈의 100vmax 풀블리드 밴드를 잘라먹으므로 금지.
          ⚠️ 터치 타깃 — 전엔 28×28이라 눌러도 잘 안 먹었다(대표 제보). 헤더 높이(56px)를 꽉 채우고
             좌우 패딩을 준 뒤 -ml-2로 되당겨, **보이는 위치는 그대로 두고 누를 수 있는 면적만** 키운다. */}
      <Link
        href="/"
        className="-ml-2 flex h-full min-w-0 shrink-0 items-center rounded-md px-2 hover:bg-surface-soft"
        aria-label="collab5 홈"
      >
        {/* 📏 높이는 **잉크 높이**다 — 08-16에 로고 SVG의 viewBox를 잉크에 맞게 조였다.
            전엔 viewBox(232×56) 안에 세로 47%가 빈 여백이라, `h-6`(25.5px)을 줘도 실제로
            보이는 글자는 13.6px뿐이었다. 그래서 "로고 폰트가 작다"(대표)로 보였던 것.
            지금은 박스≈잉크라, 아래 20/28이 곧 화면에서 보이는 크기다.
            🪤 폭 예산 — 잉크 종횡비 6.14이라 높이 1px = 폭 6.1px다. 360px 폰의 `/search`
               헤더(로고+매거진칩+로그인)가 제일 빡빡해서 여기가 상한을 정한다. 20px일 때
               로고 오른쪽에 15.7px 남는다(실측). 더 키우려면 먼저 그 화면부터 재라. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-lockup.svg" alt="" aria-hidden="true" className="h-[20px] w-auto sm:h-[28px]" />
      </Link>
      {/* 14px 정수 — text-sm은 루트 17px 탓에 14.875px(분수)가 된다. 헤더는 전 페이지 공통이라
          여기 하나가 앱 전체에 분수 픽셀을 흩뿌리고 있었다(07-31 실측). */}
      <nav className="flex min-w-0 items-center gap-1.5 text-[14px] sm:gap-2">
        {/* 이동 링크 2개는 `HeaderNavLinks`로 옮겼다 — **홈에서만 숨기기** 위해서다(대표 08-14).
            홈은 헤더 밑에 `HomeMenuBar`가 같은 두 링크를 들고 있어 헤더에 또 두면 중복이 된다.
            아래 계정 영역은 서버에서 세션을 읽으므로 여기 그대로 남는다(홈에서도 노출). */}
        <HeaderNavLinks />
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
            className="ml-0.5 flex h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3 font-medium text-mute hover:text-ink"
          >
            로그인
          </Link>
        )}
      </nav>
    </header>
  );
}
