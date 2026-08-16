"use client";

// 헤더의 이동 링크 — 경로에 따라 무엇을 보일지가 갈린다.
//   · 홈 밖  : 매거진 + 콜라보 찾기(칩)  ← 전역 보조 내비
//   · 홈     : **매거진만**              ← 08-16 대표 지시
//
// 🔻이력 — 08-14엔 홈에서 **통째로 숨겼다**(HomeMenuBar가 같은 두 링크를 들고 있어 중복이라서).
//   08-16에 대표가 메뉴바를 2칸(콜라보 찾기 · 아이디어 추천)으로 줄이면서 매거진이 갈 곳이 없어졌고,
//   *"콜라보 매거진을 헤더 상단바로 다시 올리자"*는 지시로 홈에서도 매거진만 되살렸다.
//   ⭐「콜라보 찾기」는 홈에서 여전히 숨긴다 — 그건 메뉴바에 남아 있어서 두 번 나오게 된다.
//
// 🚨**모바일에서는 이 매거진 링크가 안 보인다**(`hidden sm:flex`, 아래 주석의 07-29 사고 참조).
//   그래서 홈의 모바일 매거진 진입로는 이제 **최상단 매거진 배너**가 맡는다(HomeMagazineBanner).
//   → 배너를 지우면 폰에서 매거진에 닿는 길이 풋터 하나만 남는다. 둘 중 하나는 반드시 있어야 한다.
//
// ⚠️ 계정 영역(아바타/로그인)은 여기 없다 — 그건 서버에서 세션을 읽어 그리므로 SiteHeader에 남는다.
//    특히 **로그인 링크는 홈에서도 지우지 않는다.** 첫 방문자는 아바타가 없어서, 이것까지 빼면
//    헤더에 로고 하나만 남고 로그인할 자리가 사라진다.
//
// ⚠️ 이 컴포넌트가 client인 이유는 `usePathname` 하나뿐이다. 홈의 ISR 캐시와는 무관하다
//    (경로는 세션이 아니라서 캐시를 깨지 않는다).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function HeaderNavLinks() {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (
    <>
      {/* 매거진 — 🚨**데스크톱에서만 보인다(`hidden sm:flex`)**. 모바일에 넣지 말 것.
          07-29에 이 헤더가 정확히 그것 때문에 터졌다: 워드마크(123px) + 우측 메뉴(244px)가
          375px 폰의 가용폭을 넘겨 **전 페이지에 가로 스크롤**이 생겼고, 버튼 하나를 없애
          겨우 회수한 자리다. 모바일 진입은 풋터와 (홈에서는) HomeMenuBar가 맡는다.
          ⚠️`overflow-x-hidden`으로 덮는 우회는 금지 — 홈의 100vmax 풀블리드 밴드를 잘라먹는다. */}
      <Link
        href="/magazine"
        className="hidden h-[44px] shrink-0 items-center whitespace-nowrap rounded-md px-3 font-medium text-mute transition-colors hover:text-ink sm:flex"
      >
        콜라보 매거진
      </Link>
      {/* 📏 둘 다 **h-[44px]** — 터치 타깃 권장치(08-15 디자인팀).
          🪤`py-1.5`는 33.75px, `h-9`는 38.25px였다. 루트가 17px이라 rem 유틸이 6.25%씩 크지만
            44에는 못 미친다 — 절대 기준이 있는 값은 px로 박아야 한다.
          ⚠️매거진 링크는 배경이 없어 높이를 줘도 **보이는 모습이 안 바뀐다**(터치 영역만 커짐).
            반면 아래 칩은 pill 배경이 있어 높이가 곧 크기다 — 좌우 패딩도 반 단계 키워
            (pl-2.5→3 · pr-3.5→4) 세로만 늘어 납작해 보이는 걸 막았다. */}
      {/* 콜라보 찾기 — '미니 검색창' 형태의 링크(대표 지시 07-31).
          돋보기 아이콘 + '브랜드 소개서' 버튼 2개를 이걸로 통합했다.
          ⚠️ 진짜 input이 아니라 Link다 — 눌러서 /search로 보내는 게 목적이고,
             헤더에 실검색을 넣으면 페이지마다 상태를 들고 다녀야 한다.
             그래서 시각만 검색창(surface-soft 필·pill·좌측 돋보기)으로 빌려오고 동작은 이동.
          🚫**홈에서는 숨긴다**(08-16) — 홈 메뉴바 1번칸이 같은 「콜라보 찾기」다.
             같은 목적지가 한 화면에 두 번 나오면 어느 쪽이 진짜인지 고민하게 된다. */}
      {!isHome && (
        <Link
          href="/search"
          className="flex h-[44px] min-w-0 items-center gap-1.5 rounded-pill bg-surface-soft pl-3 pr-4 text-mute transition-colors hover:bg-primary-pale hover:text-primary-on"
        >
          <svg viewBox="0 0 20 20" className="h-[17px] w-[17px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
            <circle cx="8.5" cy="8.5" r="5.5" />
            <path d="m13 13 4 4" strokeLinecap="round" />
          </svg>
          <span className="truncate">콜라보 찾기</span>
        </Link>
      )}
    </>
  );
}
