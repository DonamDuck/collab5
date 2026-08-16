"use client";

// 홈 상시 플로팅 CTA — 08-16 홈 개편(대표 지시, 레퍼런스 = 리틀리 start.litt.ly).
//
// ⭐**이 개편에서 제일 중요한 부품이다.** 히어로에서 「브랜드 소개서 등록하기(3분)」 버튼을 뺐는데,
//   그게 가능한 유일한 이유가 이 알약이다. 리틀리 실물이 정확히 그 구조다 — 히어로에는 버튼이
//   하나뿐이고, 스크롤을 아무리 내려도 하단에 검은 알약(「내 링크 바로 만들기 [무료]」)이 따라온다.
//   즉 **전환 동선을 첫 화면에서 상시 레이어로 옮긴 것**이지, 없앤 게 아니다.
//   🚨이 컴포넌트를 지우면 홈에 소개서 진입점이 하단 CTA 하나만 남는다. 지우려면 히어로 버튼을
//     되살리는 게 먼저다.
//
// 🎨왜 검정인가 — 사이트의 주 CTA는 Kiwi(--primary)다. 이 알약까지 Kiwi면 스크롤 내내 화면에
//   붙어 있는 형광 초록이 되어, 정작 각 섹션의 진짜 CTA와 색이 겹쳐 위계가 무너진다.
//   검정은 "언제나 여기 있는 것"이라 배경처럼 물러나 있다가 필요할 때 눈에 든다(리틀리도 검정).
//
// ⚠️`pointer-events-none` 필수 — 이 래퍼는 화면 폭 전체를 차지하는 투명 띠다. 그냥 두면
//   알약 좌우의 빈 곳이 뒤 콘텐츠의 클릭을 통째로 먹는다(HomeMenuBar가 같은 함정을 이미 겪었다).
//   알약에만 `pointer-events-auto`를 되돌린다.
//
// 🪤`env(safe-area-inset-bottom)`은 **`max()`로 감싼다**(`calc(P + env())` 아님).
//   더하면 홈버튼 없는 기기에서 여백이 두 배가 된다 — 이 저장소가 이미 정한 규칙이다.
import { useEffect, useState } from "react";
import Link from "next/link";
import { hasOwnBrandAction } from "@/lib/actions";
import { track } from "@/lib/track";

export function HomeFloatingCta() {
  // 🚫**소개서를 이미 가진 사람에게는 아예 안 뜬다**(대표 지시 08-16).
  //    이미 만든 사람에게 "3분 만에 소개서 만들기"가 화면 내내 따라다니는 건 잘못된 권유다 —
  //    그 사람의 다음 행동은 작성이 아니라 **상대를 고르는 것**이고, 그건 ③구좌 CTA가 맡는다.
  //    ⚠️초기값 `false`(=없는 사람)로 두고 판정 후에만 숨긴다. 대다수 방문자가 소개서가 없으므로
  //      첫 페인트가 맞는 쪽이고, 판정 실패 시에도 알약이 그대로 남는다(사라지는 것보다 안전).
  const [hasBrand, setHasBrand] = useState(false);
  useEffect(() => {
    let alive = true;
    hasOwnBrandAction()
      .then((v) => {
        if (alive) setHasBrand(v);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  // 🔻스크롤 0에서는 **안 뜬다.** 리틀리는 처음부터 띄우지만 우리는 사정이 다르다 —
  //   홈 최상단에 `HomeMenuBar`(sticky 알약)가 이미 떠 있어서, 스크롤 0에 알약이 위아래로
  //   둘이 되면 "이게 메뉴인가 버튼인가"가 무너진다(실측 후 판단).
  //   → 히어로를 지나면(=메뉴바와 시선이 안 겹치면) 올라온다.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      // ① 임계값 320px = 히어로 슬로건 덩어리 높이(모바일 실측 ~300px)를 막 지난 지점.
      //    ⚠️`window.innerHeight`로 잡지 않는다 — 히어로가 끝나는 지점은 콘텐츠가 정하지
      //      뷰포트가 정하는 게 아니다.
      const past = window.scrollY > 320;
      // ② 🚨마무리 CTA가 화면에 들어오면 **숨는다.** 안 그러면 「지금 시작하기」 위에 알약이 겹쳐
      //    앉는다 — 같은 목적지(/register)의 버튼 두 개가 포개지는 그림이라 둘 다 손해다(실측 확인).
      //    🪤처음엔 `scrollHeight - 600`으로 잡았다가 되돌렸다. 그 식은 **화면 높이에 따라 판정이
      //      달라진다** — innerHeight 720에선 페이지의 마지막 24%부터 숨었지만, 세로로 긴 화면에선
      //      훨씬 일찍(문서 절반부터) 숨어 알약이 사실상 안 보였다(실측: 1280×720에서 확인).
      //    → 상수 대신 **실제 요소가 보이는지**로 판정한다. 마크업이 바뀌어도 따라간다.
      //      (`data-home-end`는 page.tsx 마무리 CTA 섹션에 붙어 있다 — 지우면 이 가드가 죽는다)
      const end = document.querySelector("[data-home-end]");
      const endVisible = end ? end.getBoundingClientRect().top < window.innerHeight - 40 : false;
      setShown(past && !endVisible);
    };
    onScroll(); // 새로고침으로 중간에서 시작한 경우 대비
    window.addEventListener("scroll", onScroll, { passive: true });
    // 이미지·폰트가 늦게 로드되면 문서 높이가 바뀌어 ②의 판정이 틀어진다 → 리사이즈에도 다시 잰다.
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  // 소개서를 가진 사람에겐 이 레이어 자체를 렌더하지 않는다(위 주석 참조).
  // ⚠️`shown`을 false로만 두지 않고 **아예 null**인 이유 — 화면 폭 전체를 차지하는 투명 래퍼가
  //   계속 남아 있으면 스크롤·리사이즈 리스너도 계속 돈다. 안 쓸 거면 통째로 빼는 게 맞다.
  if (hasBrand) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[8] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] print:hidden"
      aria-hidden={!shown}
    >
      <Link
        href="/register"
        tabIndex={shown ? undefined : -1}
        onClick={() => track("home_floating_cta_click")}
        // 등장은 **아래에서 밀려 올라오게** — 페이드만 하면 화면 한가운데 갑자기 생긴 것처럼 보인다.
        // 위치가 바뀌면 "따라 올라온 것"으로 읽혀 상시 레이어라는 성격이 전달된다.
        // 🔻08-16 「무료」 배지 제거(대표 지시) → 좌우 패딩이 `pl-6 pr-3`(배지 자리를 비켜준 비대칭)
        //    이었는데 배지가 빠졌으니 **`px-7`로 대칭 복구**. 안 그러면 오른쪽만 좁아 글자가 치우친다.
        className={`pointer-events-auto inline-flex h-[52px] items-center rounded-pill bg-ink px-7 text-[15px] font-medium text-on-dark shadow-e3 transition-all duration-[var(--dur-base)] ease-[var(--ease)] ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        3분 만에 소개서 만들기
      </Link>
    </div>
  );
}
