"use client";

// 하루 가게 상단 메뉴바 — 헤더 밑에 붙어 따라오는 **2칸** 바 (대표 지시 09-14).
//
// 대표 원문(코멘트 위젯 1호): *「버튼을 제거하고, 차라리 우리 홈화면에 있는 플로팅 헤더를 띄우고 메뉴를
// 하루 빌리기 | 내 공간 등록 이렇게 표현해주면 어떨까. 현재화면이 하루 빌리기이니깐 색이나 언더바나,
// 어떤 방식으로 현재 탭인걸 보여주고, 내 공간 등록 누르면 공간 등록 페이지로 넘어가고」*
// 이어서(코멘트 1호): *「탭 누르면 부드럽게 초록 백그라운드가 옮겨 갔음 좋겠어」*
//
// 🔻헤더의 「안 쓰는 날 올리기」 키위 버튼을 이 바가 대신한다. 버튼은 부르는 자리가 하나뿐이었는데,
//   바는 두 방향(빌리는 쪽·빌려주는 쪽)을 늘 같이 보여준다. 하루 가게는 양면 시장이라 그게 맞다.
//
// ⭐**활성 표시를 «쓴다» — 홈 메뉴바와 정반대다.** 그쪽(`HomeMenuBar`)은 두 칸 중 하나가 페이지 안
//   앵커라 「영원히 안 켜지는 칸」이 생겨서 일부러 뺐다(08-17 대표 확정). 여기는 **두 칸 다 페이지를
//   떠나는 링크**라 「지금 여기」가 언제나 정확히 한 칸이다. 같은 생김새라도 문법이 서는 조건이 다르다.
//
// 🎚**초록은 «칸의 배경»이 아니라 뒤에서 미끄러지는 알약 한 장**이다. 칸마다 배경을 켜고 끄면
//   한쪽이 사라지고 다른 쪽이 나타날 뿐 «옮겨 가지» 않는다. 움직이려면 움직이는 물건이 하나여야 한다.
//   🔗그래서 이 컴포넌트는 `rent/layout.tsx`에 산다 — 페이지마다 그리면 탭을 누를 때 통째로 새로 태어나서
//     옮겨 갈 이전 자리가 없어진다. CSS 전환은 «같은 요소»가 움직일 때만 생긴다.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const TABS = [
  { href: "/rent", label: "하루 빌리기" },
  { href: "/rent/new", label: "내 공간 등록" },
] as const;

// 📏크기·높이는 `HomeMenuBar`의 `ITEM`과 **같은 값**이다(15px·h-44px·rounded-pill).
//   두 바가 같은 사이트의 같은 층이라 여기서 값을 새로 만들면 어휘가 갈린다.
// ⚠️`relative z-[1]` — 글자가 미끄러지는 알약 «위»에 있어야 한다. 안 그러면 알약이 글자를 덮는다.
const BASE =
  "relative z-[1] flex h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-4 text-[15px] font-medium transition-colors sm:px-6";

export function RentMenuBar() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; top: number; width: number; height: number } | null>(null);

  const activeIndex = TABS.findIndex((t) => t.href === pathname);

  /** 켜진 칸을 재서 알약을 그 자리에 놓는다. 좌표는 `nav` 기준(그래서 `nav`가 `relative`여야 한다). */
  const measure = useCallback(() => {
    const el = navRef.current?.querySelector<HTMLElement>('[data-on="1"]');
    setPill(el ? { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight } : null);
  }, []);

  // ⚠️`useLayoutEffect` — 페인트 «전»에 자리를 잡아야 한다. `useEffect`로 하면 알약이 왼쪽 끝에
  //   한 프레임 번쩍였다가 제자리로 미끄러진다(첫 진입마다 눈에 띈다).
  useLayoutEffect(measure, [measure, pathname]);

  // 글꼴이 늦게 오거나 화면 폭이 바뀌면 글자 폭이 달라져 알약이 어긋난다.
  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  // 🚪두 탭 화면이 아니면 바를 안 보인다(상세·내 하루 가게·결제 복귀는 각자 돌아갈 길이 따로 있다).
  //   ⭐판정을 레이아웃이 아니라 **여기서** 한다 — 화면이 늘 때 고칠 자리가 하나여야 어긋나지 않는다.
  if (activeIndex < 0) return null;

  return (
    // 🚨`pointer-events-none` 필수 — 이 래퍼는 화면 폭을 다 차지하는 투명 띠다. 그냥 두면 알약 좌우의
    //   빈 곳이 뒤 콘텐츠의 클릭을 먹는다(보이지 않는 것이 막으니 원인을 못 찾는다). 알약만 되돌린다.
    // top-14 = 헤더 높이. ⚠️루트 폰트가 17px이라 실제 59.5px다(56 아님 — 눈대중 금지).
    <div className="pointer-events-none sticky top-14 z-[6] flex justify-center px-2 py-2">
      <nav
        ref={navRef}
        aria-label="하루 가게 바로가기"
        // 🔒`border-[0.5px] border-[#DFDFE3]` + `shadow-e2` = 홈 메뉴바·브랜드 카드와 완전히 같은 값.
        className="no-scrollbar pointer-events-auto relative inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface p-1 shadow-e2"
      >
        {/* 🎚미끄러지는 초록. 첫 렌더엔 `pill`이 없어 아예 안 그린다 — 막 태어난 요소는 전환할 이전 값이
            없어서, 0에서 제자리로 날아오는 것처럼 보이는 걸 막는다.
            ⏱값은 우리 토큰(`--dur-base` 200ms · `--ease`)을 쓴다. 여기서 숫자를 새로 만들면
              사이트의 움직임 속도가 화면마다 달라진다.
            ♿`motion-reduce` — 움직임을 줄여 달라고 설정한 사람에겐 미끄러지지 않고 그냥 옮겨 간다. */}
        {pill && (
          <span
            aria-hidden="true"
            className="absolute rounded-pill bg-primary-tint motion-reduce:transition-none"
            style={{
              left: pill.left,
              top: pill.top,
              width: pill.width,
              height: pill.height,
              transition: "left var(--dur-base) var(--ease), width var(--dur-base) var(--ease)",
            }}
          />
        )}

        {TABS.map((t, i) => {
          const on = i === activeIndex;
          return (
            <Link
              key={t.href}
              href={t.href}
              data-on={on ? "1" : "0"}
              aria-current={on ? "page" : undefined}
              className={`${BASE} ${on ? "text-primary-on" : "text-mute hover:text-primary-on"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
