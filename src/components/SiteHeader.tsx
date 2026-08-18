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
        {/* 📏 높이 = 화면에서 보이는 크기다(파일이 잉크에 딱 맞게 잘려 있다).
            🖼 08-19 **텍스트형 로고로 교체** — 대표가 직접 만든 워드마크(`o`와 `b` 위에 키위 점 둘).
               대표가 준 이미지를 그대로 쓰는 게 요구사항이라 **모양을 손대지 않았다**(벡터로 다시
               그렸다가 되돌린 이력 있음, 08-16). 원본 = `assets/logo-wordmark-source.png` 581×130.
               배포본은 같은 크기에 64색 감량(5.2KB) — ⚠️**양자화가 키위를 #99FF5D로 1 밀길래**
               팔레트를 정확값(#98FF5C·#111111)으로 스냅했다. 다시 구울 땐 그 스냅을 꼭 같이.
            🔭 **여기엔 아톰 마크가 없다.** 마크는 탭 아이콘·빈 상태·카드·검색에 그대로 남아 있으니
               둘을 같이 갈아야 할 일이 생기면 `public/logo-mark.png` 쪽도 함께 본다.
            🪤 폭 예산 — 종횡비 **4.47**(락업은 6.17이었다). 360px 폰의 `/search` 헤더가 제일
               빡빡한데, 마크가 빠지면서 **로고 오른쪽 여유가 17 → 49.2px로 늘었다**(실측).
               로고 폭 89.4px. 더 키울 여지가 생겼지만 키우려면 그 화면부터 다시 재라.
            📐 높이 20/24는 **그대로 뒀다** — 락업과 글자 크기가 같아서다('5' 기준 1.01배 실측).
               락업의 높이는 마크가 정했고 글자는 그보다 작았는데, 지금은 높이가 곧 글자 크기다. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-wordmark.png" alt="" aria-hidden="true" className="h-[20px] w-auto sm:h-[24px]" />
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
