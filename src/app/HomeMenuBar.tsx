"use client";

// 홈 상단 메뉴바 — 헤더 바로 밑에 붙어 페이지 끝까지 따라오는 3칸 바(대표 지시 08-14, 레퍼런스 heytaby.com).
//
// 이 바가 푸는 문제는 하나다: **모바일에서 매거진·콜라보 찾기로 들어갈 길이 없었다.**
// 헤더의 「매거진」은 `hidden sm:flex`(데스크톱 전용 — 좁은 폰에서 가로 스크롤이 터졌던 자리)라
// 모바일 진입은 사실상 풋터뿐이었다. 그래서 홈에서는 그 두 링크를 **헤더에서 내려 이 바로 옮긴다**
// (헤더는 홈에서 로고+계정만 남는다 — `HeaderNavLinks`가 경로로 판정).
//
// ⚠️ **활성 표시(스크롤스파이·선택된 알약)를 일부러 안 쓴다.**
//    heytaby의 탭바는 네 칸이 전부 한 페이지 안의 앵커라 볼드가 「지금 여기」를 뜻한다. 여기는 세 칸 중
//    둘이 페이지를 떠나는 링크다 — 같은 생김새에 다른 뜻을 담으면 활성 표시가 무슨 말인지 무너진다.
//    생김새(둥근 트랙 + 알약)만 빌리고 「지금 여기」 문법은 안 빌린 이유다.
//    ※ 섹션 ③의 `HomeSectionTabs`는 반대다 — 거긴 두 칸 다 앵커라 스크롤스파이가 정직하다.
//
// ⚠️ 왜 클라 컴포넌트인가 — 홈은 ISR(revalidate 300)이다. 서버에서 세션을 읽는 순간 홈 전체가
//    매 요청 렌더로 바뀐다(=캐시 증발). 세 번째 칸만 클라에서 판정하면 홈 HTML은 계속 캐시된다.
//    첫 페인트는 「소개서 등록」으로 나가고(방문자 대다수가 그렇다) 판정 후 필요할 때만 바뀐다.
//    → 자리 폭이 흔들리지 않게 두 라벨을 **같은 4글자**로 맞춰뒀다(소개서 등록 / 콜라보 추천).
import { useEffect, useState } from "react";
import Link from "next/link";
import { hasOwnBrandAction } from "@/lib/actions";
import { track } from "@/lib/track";

// ⚠️ page.tsx의 목적지 h2(`scroll-mt-[152px]`)와 짝. HomeSectionTabs도 같은 id를 쓴다 — 바꾸면 셋 다.
const REPORT_ANCHOR = "home-collab-report";

// 세 칸 공통. 활성/비활성 구분이 없으므로 상태 클래스도 없다.
// 🔤 크기 — 대표 지적 08-14 *"메뉴 치고 폰트가 너무 작다"*. 13/14 → **양쪽 다 15**(디자인팀 확정).
//    ⚠️처음엔 모바일 15 / 데스크톱 15.5로 갈랐다가 되돌렸다. **1px 안팎의 차이는 위계로 안 읽히고
//      실수로 읽힌다**(디자인팀). 헤더 nav는 14로 두는데, 그 1px 차이가 위계를 만드는 게 아니라
//      **성격이 다른 두 바**(홈 주 내비 / 전역 보조 내비)라는 게 크기로 드러나는 것뿐이다.
//    ⚠️폭은 확인하고 올렸다 — 375px에서 바가 294.6px, 좌우 여유 80.4px.
// 📏 높이 **h-[44px]** — 터치 타깃 권장치를 정확히 맞춘 값이다.
//    🪤`h-10`으로 쓰면 40이 아니라 **42.5px**다. 이 저장소는 루트 폰트가 17px이라 rem 유틸이
//      전부 6.25%씩 크게 나온다(h-9=38.25 / h-10=42.5). 권장 44에 1.5px 모자라서 px로 박았다.
const ITEM =
  "flex h-[44px] shrink-0 items-center whitespace-nowrap rounded-pill px-3.5 text-[15px] font-medium text-mute transition-colors hover:bg-primary-pale hover:text-primary-on sm:px-5";

/** 칸 사이 세로 구분선(대표 제안 08-14 — "메뉴바처럼 보이게").
 *  ⚠️`aria-hidden` + 빈 요소다 — 스크린리더에는 링크 3개만 들려야 한다.
 *  ⚠️색은 `border-strong`(#d7d7db). `hairline`(#eaeaec)은 트랙 면(#f5f5f6)과 밝기차가 4%뿐이라
 *     1px 선으로는 사실상 안 보인다. 면 위에 선을 얹을 땐 면색 기준으로 다시 골라야 한다.
 *  ⚠️높이는 칸 전체가 아니라 **안쪽으로 인셋**(h-4 = 17px, 알약 42.5px의 40%). 꽉 채우면
 *     알약의 둥근 모서리와 부딪혀 바가 '표(table)'처럼 읽힌다. */
function Divider() {
  return <span aria-hidden="true" className="h-4 w-px shrink-0 bg-border-strong" />;
}

export function HomeMenuBar() {
  const [hasBrand, setHasBrand] = useState(false);

  useEffect(() => {
    let alive = true;
    hasOwnBrandAction()
      .then((v) => {
        if (alive) setHasBrand(v);
      })
      .catch(() => {}); // 실패해도 「소개서 등록」이 그대로 — 바가 사라지진 않는다
    return () => {
      alive = false;
    };
  }, []);

  // 앵커 이동 — 오프셋은 CSS(`scroll-mt-[152px]`)가 정본이라 scrollIntoView가 그대로 존중한다.
  // JS에서 좌표를 다시 계산하면 값이 두 군데로 갈라진다(HomeSectionTabs와 같은 규칙).
  const goReport = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(REPORT_ANCHOR);
    if (!el) return; // 못 찾으면 네이티브 해시 점프에 맡긴다
    e.preventDefault();
    track("home_menubar_report_click");
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    // 캔버스색 밴드를 풀블리드로 깔아 **본문이 바 밑으로 사라지게** 한다 — 알약만 띄우면 알약 폭이
    // 화면보다 좁아 제목이 좌우로 삐져나온다(HomeSectionTabs가 08-02에 실제로 당한 버그).
    // ⚠️ 풀블리드에 `100vw` 금지(스크롤바 폭만큼 넘쳐 가로 스크롤이 생긴다) → box-shadow+clip-path.
    // ⚠️ 밴드에 보더·그림자를 주지 않는다 — 그 순간 헤더가 두 겹으로 보인다. 같은 배경색이라
    //    "페이지가 바 밑으로 흘러간다"로만 읽힌다.
    // z-[6] = 헤더(z-10) 아래, HomeSectionTabs(z-[5]) 위.
    // top-14 = 헤더 높이. ⚠️루트 폰트가 17px이라 실제 59.5px다(56 아님 — 눈대중 금지).
    <div className="sticky top-14 z-[6] flex justify-center bg-canvas py-2 [box-shadow:0_0_0_100vmax_var(--canvas)] [clip-path:inset(0_-100vmax)]">
      <nav
        aria-label="홈 바로가기"
        className="inline-flex items-center gap-1 rounded-pill border border-hairline bg-surface-soft p-1 shadow-e1"
      >
        <Link href="/magazine" onClick={() => track("home_menubar_magazine_click")} className={ITEM}>
          매거진
        </Link>
        <Divider />
        <Link href="/search" onClick={() => track("home_menubar_search_click")} className={ITEM}>
          콜라보 찾기
        </Link>
        <Divider />
        {hasBrand ? (
          // 소개서를 이미 가진 사람 — 등록으로 보낼 이유가 없다. 홈 안의 콜라보 추천 구간으로 내린다.
          // <button>이 아니라 <a href="#id">인 이유: JS가 죽어도 네이티브 해시 점프가 대신 동작하고
          // 키보드·새 탭·링크 복사를 공짜로 얻는다.
          <a href={`#${REPORT_ANCHOR}`} onClick={goReport} className={ITEM}>
            콜라보 추천
          </a>
        ) : (
          <Link href="/register" onClick={() => track("home_menubar_register_click")} className={ITEM}>
            소개서 등록
          </Link>
        )}
      </nav>
    </div>
  );
}
