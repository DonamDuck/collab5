"use client";

// 하루 가게 상단 메뉴바 — 헤더 밑에 붙어 따라오는 **2칸** 바 (대표 지시 09-14).
//
// 대표 원문(코멘트 위젯 1호): *「버튼을 제거하고, 차라리 우리 홈화면에 있는 플로팅 헤더를 띄우고 메뉴를
// 하루 빌리기 | 내 공간 등록 이렇게 표현해주면 어떨까. 현재화면이 하루 빌리기이니깐 색이나 언더바나,
// 어떤 방식으로 현재 탭인걸 보여주고, 내 공간 등록 누르면 공간 등록 페이지로 넘어가고」*
//
// 🔻**헤더의 「안 쓰는 날 올리기」 키위 버튼을 이 바가 대신한다.** 버튼은 부르는 자리가 하나뿐이었는데,
//   바는 두 방향(빌리는 쪽·빌려주는 쪽)을 늘 같이 보여준다. 하루 가게는 양면 시장이라 그게 맞다.
//
// ⭐**여긴 활성 표시를 «쓴다» — 홈 메뉴바와 정반대다.** 그쪽(`HomeMenuBar`)은 두 칸 중 하나가 페이지 안
//   앵커라 「영원히 안 켜지는 칸」이 생겨서 일부러 뺐다(08-17 대표 확정). 여기는 **두 칸 다 페이지를
//   떠나는 링크**라 「지금 여기」가 언제나 정확히 한 칸이다. 같은 생김새라도 문법이 서 있는 조건이 다르다.
//
// 🎨활성 = `bg-primary-tint text-primary-on`. 이 저장소가 「선택됨」에 쓰는 값 그대로다(거르개 칩과 같다).
//   ⛔밑줄은 안 썼다 — 알약 안에 밑줄을 그으면 알약 모서리와 선이 부딪혀 둘 다 흐려진다.
//   ⚠️`/rent`에는 바로 아래에 거르개 칩이 있어 연두 알약이 화면에 둘이 된다. 층이 갈리는 건
//     **떠 있음**이다(이 바만 `shadow-e2`). 같은 색을 쓰되 높이로 가른다.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/rent", label: "하루 빌리기" },
  { href: "/rent/new", label: "내 공간 등록" },
] as const;

// 📏크기·높이는 `HomeMenuBar`의 `ITEM`과 **같은 값**이다(15px·h-44px·rounded-pill).
//   두 바가 같은 사이트의 같은 층이라 여기서 값을 새로 만들면 어휘가 갈린다.
const BASE =
  "flex h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-4 text-[15px] font-medium transition-colors sm:px-6";

export function RentMenuBar() {
  const pathname = usePathname();

  return (
    // 🚨`pointer-events-none` 필수 — 이 래퍼는 화면 폭을 다 차지하는 투명 띠다. 그냥 두면 알약 좌우의
    //   빈 곳이 뒤 콘텐츠의 클릭을 먹는다(보이지 않는 것이 막으니 원인을 못 찾는다). 알약만 되돌린다.
    // top-14 = 헤더 높이. ⚠️루트 폰트가 17px이라 실제 59.5px다(56 아님 — 눈대중 금지).
    <div className="pointer-events-none sticky top-14 z-[6] flex justify-center px-2 py-2">
      <nav
        aria-label="하루 가게 바로가기"
        // 🔒`border-[0.5px] border-[#DFDFE3]` + `shadow-e2` = 홈 메뉴바·브랜드 카드와 완전히 같은 값.
        className="no-scrollbar pointer-events-auto inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface p-1 shadow-e2"
      >
        {TABS.map((t) => {
          // ⚠️`startsWith`가 아니라 정확히 맞춘다 — `/rent/new`가 `/rent`로 시작해서 둘 다 켜진다.
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={active ? "page" : undefined}
              className={`${BASE} ${active ? "bg-primary-tint text-primary-on" : "text-mute hover:bg-primary-pale hover:text-primary-on"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
