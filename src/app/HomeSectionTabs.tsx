"use client";

// 홈 섹션 ③ 앵커 탭 — "3분 소개서 만들기" / "콜라보 아이디어 찾기" (대표 지시 2026-08-02).
// 섹션 ③은 제품의 두 얼굴(소개서 만들기 / 콜라보 분석)을 한 스크롤에 붙여 둔 곳이라
// 스크롤만으로는 "지금 뭘 보고 있는지"와 "다른 하나도 있다"가 안 읽힌다. 탭이 그 목차 노릇을 한다.
//
// ⚠️ 상시 두 번째 헤더를 만들지 않는다 — `position: sticky`라 **섹션 ③ 안에서만** 따라오고
//    섹션이 끝나면 스크롤 밖으로 자연히 빠진다. z는 헤더(z-10)보다 낮은 z-[5] — 헤더 밑으로 지나가야 한다.
// ⚠️ 조상(section)에 `home-rise` 애니메이션이 있다. 다행히 키프레임 끝값이 `transform: none`이라
//    (page.tsx의 `to`가 `translateY(0)`이 아닌 이유 참고) 애니메이션이 끝나면 변환이 남지 않는다.
//    sticky는 원래 조상 transform에 안 깨지지만, 이 조합은 브라우저에서 실제로 붙는 걸 확인했다(08-02).
import { useEffect, useState } from "react";

// 판정선 & 앵커 여백 — 브라우저 실측(375px, 08-02):
//   헤더 59.5 + 탭바 위 패딩 8.5 + 알약 48.75 + 아래 패딩 8.5 = 125.25 → 숨 쉴 틈 ~11px 더해 136.
// ⚠️ 이 저장소는 **루트 폰트가 17px**이다(SiteHeader 주석 참고). rem 유틸이 16px 기준이 아니다 —
//    `h-14`/`top-14`는 56이 아니라 59.5px, `scroll-mt-32`는 128이 아니라 136px. 눈대중으로 56을 넣으면
//    제목이 헤더 밑에 3.5px 깔린다. 값을 만질 땐 반드시 다시 실측할 것.
// ⚠️ page.tsx의 두 목적지 h2에 붙은 `scroll-mt-32`(=8rem=136px)와 **같은 값**이어야 한다.
//    한쪽만 바꾸면 "눌러서 간 자리"와 "활성 판정 자리"가 어긋난다. 바꾸면 둘 다.
const ANCHOR_LINE_PX = 136;
// 🚨 판정선은 앵커선보다 **조금 아래**여야 한다 — 둘을 같은 값으로 두면 탭을 누른 직후 제목이
//    정확히 경계 위에 선다(실측 135.9 vs 136 = 여유 0.1px). 폰트 로드·줌·기기 배율로 서브픽셀이
//    반대로 떨어지는 순간 **눌러놓고 활성이 안 붙는** 상태가 된다. 경계는 가장 불안정한 자리다.
//    +8px면 눌러 간 자리가 판정선 안쪽으로 확실히 들어오고, 스크롤 중 전환은 8px 일러질 뿐이라 체감 없다.
const SPY_LINE_PX = ANCHOR_LINE_PX + 8;

// ⚠️ id는 page.tsx의 목적지 h2와 짝. 바꾸면 둘 다.
const TABS = [
  { id: "home-brandpage", label: "3분 소개서 만들기" },
  { id: "home-collab-report", label: "콜라보 아이디어 찾기" },
] as const;

export function HomeSectionTabs() {
  // 기본값 = 첫 번째. 섹션에 아직 닿지 않았을 때(두 제목 모두 판정선 아래)도 이게 맞는 답이다.
  const [active, setActive] = useState(0);

  useEffect(() => {
    const targets = TABS.map((t) => document.getElementById(t.id));
    if (targets.some((el) => !el)) return;

    // 스크롤스파이 — "판정선(=화면 상단 ANCHOR_LINE_PX)을 이미 지난 **마지막** 제목"이 활성.
    // rootMargin으로 루트 상단을 판정선까지 끌어내려, 제목이 그 선을 넘는 순간이 곧 IO 이벤트가 되게 한다.
    // ⚠️ threshold에 1이 **반드시** 필요하다. 0만 두면 제목이 선에 걸쳐 있는 동안 계속 '교차 중'이라
    //    윗변이 선을 넘는 순간에 콜백이 안 온다 → 제목 높이만큼(≈40px) 전환이 늦는다(실측).
    // 판정 자체는 콜백 시점의 실제 좌표(boundingClientRect)로 하므로, rootMargin은 "언제 다시 계산할지"만 정한다.
    const passed = new Map<string, boolean>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) passed.set(e.target.id, e.boundingClientRect.top < SPY_LINE_PX);
        let next = 0;
        TABS.forEach((t, i) => {
          if (passed.get(t.id)) next = i;
        });
        setActive(next);
      },
      { rootMargin: `-${SPY_LINE_PX}px 0px 0px 0px`, threshold: [0, 1] }
    );
    for (const el of targets) io.observe(el!);
    return () => io.disconnect();
  }, []);

  // 목적지로 이동. 오프셋은 CSS(`scroll-mt-32`)가 정본이라 scrollIntoView가 그대로 존중한다 —
  // JS에서 좌표를 다시 계산하면 값이 두 군데로 갈라진다.
  // (MyTabs의 scrollIntoView 경고는 '조상에 가로 스크롤 레일이 있는' 경우다. 여기 조상은 main/section뿐.)
  const go = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    const el = document.getElementById(id);
    if (!el) return; // 못 찾으면 기본 동작(네이티브 해시 점프)에 맡긴다
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    // URL 해시는 일부러 안 건드린다 — 목차 클릭 두 번에 뒤로가기가 두 번 필요해지는 게 더 나쁘다.
  };

  return (
    // 🐛 배경 밴드 없이 알약만 띄웠더니 **제목이 알약 좌우로 비어져 나왔다**(08-02 실측: "3ᄇ…요." 가
    //    탭 양옆으로 삐져나옴). 알약 폭이 화면보다 좁으니 구조적으로 안 가려진다.
    //    → 캔버스색 밴드를 풀블리드로 깔아 **콘텐츠가 밴드 아래로 사라지게** 한다.
    // ⚠️ 밴드에 보더·그림자는 주지 않는다 — 그걸 얹는 순간 헤더가 두 겹으로 보인다.
    //    같은 배경색이라 "페이지가 탭 밑으로 흘러간다"로만 읽히고 바가 하나 더 생긴 느낌은 안 난다.
    // ⚠️ 풀블리드는 `100vw` 금지(가로 스크롤바 폭만큼 넘쳐 가로 스크롤이 생긴다) —
    //    브랜드 그리드와 같은 box-shadow+clip-path 기법을 쓴다(page.tsx §② 참고).
    <div className="sticky top-14 z-[5] flex justify-center bg-canvas py-2 [box-shadow:0_0_0_100vmax_var(--canvas)] [clip-path:inset(0_-100vmax)]">
      <nav
        aria-label="소개서·콜라보 추천 바로가기"
        // 트랙=surface-soft. 활성 썸은 아래 **"선택됨" 키위 조합**을 쓴다(대표 지시 08-02 "탭바에도 키위를").
        className="inline-flex gap-1 rounded-pill border border-hairline bg-surface-soft p-1 shadow-e1"
      >
        {TABS.map((t, i) => (
          // <button>이 아니라 <a href="#id"> — 목적지가 실제로 존재하는 문서 내 위치라
          // JS가 죽어도 네이티브 해시 점프가 대신 동작하고(그때도 scroll-mt-32가 먹는다),
          // 키보드·새 탭·링크 복사 같은 브라우저 기본 동작을 공짜로 얻는다.
          <a
            key={t.id}
            href={`#${t.id}`}
            onClick={(e) => go(e, t.id)}
            // aria-current="location" = "지금 이 집합 안에서 내가 있는 위치"(page가 아니다 — 같은 문서다)
            aria-current={active === i ? "location" : undefined}
            // ⭐활성 = 이 저장소가 이미 쓰는 **"선택됨" 어휘** 그대로: `border-primary bg-primary-tint
            //   text-primary-on` (/search 지역·업종 칩, register/BlockEditor 선택 칩과 동일 조합).
            //   탭 활성도 뜻이 "선택됨"이라 새 표현을 만들 이유가 없다 — 사용자는 이미 이 색을 배웠다.
            // ⚠️ 비비드 Kiwi(`bg-primary`)를 면으로 깔지 않는다 — 그 면색은 주 CTA 전용이고,
            //    목차가 CTA와 같은 무게로 보이면 "눌러야 할 것"이 둘이 된다. tint(#d6ffc0)는 한 단 아래다.
            // ⚠️ 비활성에도 `border`를 **투명으로** 둔다 — 활성에만 보더를 주면 전환 때 알약 폭이
            //    2px 뛰어 탭이 덜컹거린다.
            className={`flex h-9 shrink-0 items-center whitespace-nowrap rounded-pill border px-3.5 text-[13px] transition-colors sm:px-5 sm:text-[14px] ${
              active === i
                ? "border-primary bg-primary-tint font-bold text-primary-on"
                : "border-transparent font-medium text-mute"
            }`}
          >
            {t.label}
          </a>
        ))}
      </nav>
    </div>
  );
}
