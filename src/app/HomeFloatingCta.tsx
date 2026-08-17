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
// 🎨~~왜 검정인가~~ → **08-16 Kiwi로 전환**(대표 지시). 원래 논리는 이랬다:
//   *"주 CTA가 Kiwi인데 이 알약까지 Kiwi면 스크롤 내내 붙어 있는 형광이 되어 각 섹션의 진짜 CTA와
//   색이 겹쳐 위계가 무너진다"*. **그 걱정은 지금도 유효하다** — 특히 ③구좌의 「나도, 콜라보 아이디어
//   추천받기」와 이 알약이 **둘 다 Kiwi인데 목적지가 다르다**(여기는 `/register`, 저기는 분석 게이트).
//   ⭐그래도 바꾼 이유 = 같은 날 배너를 **카본(#0c0c0c)**으로 확정하면서 첫 화면의 검정 면적이 크게
//     늘었다. 검은 알약이 그 위에 얹히면 배너와 같은 덩어리로 읽혀 "떠 있는 버튼"이 아니게 된다.
//     Kiwi는 이 지면에서 유일하게 "누르는 것"을 뜻하는 색이라, 상시 버튼에는 그 뜻이 맞는다.
//   🔭GA로 갈린다 — `home_floating_cta_click`이 `home_idea_cta_click`을 잠식하면 위계가 무너진 것이니
//     그때 검정으로 되돌린다(`bg-ink text-on-dark`, 점은 `bg-primary`).
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
  //
  // 🔀**3상태다(`null` = 아직 모름).** 08-16에 초기값을 `false`(=없는 사람)로 뒀다가 대표가 잡아냈다 —
  //    *"지금은 잠깐 나왔다가 사라지거든"*. 소개서를 가진 사람에게 알약이 한 번 떴다가 판정이 도착하면
  //    사라졌다. **없어지는 UI는 있는 UI보다 눈에 띈다** — 뭘 놓쳤나 싶어 시선이 되돌아간다.
  //    → **모르는 동안에는 아예 안 그린다.** 늦게 뜨는 건 아무도 모르지만 사라지는 건 다 본다.
  //
  // ⚠️왜 서버에서 안 정하나 — 홈은 **정적 렌더(ISR 5분)**다. 서버에서 세션을 읽으면 그 순간
  //    동적 렌더로 내려앉아 **모든 방문자가 캐시를 잃는다.** 첫 화면이 제일 빨라야 하는 페이지라
  //    한 사람의 깜빡임을 없애려고 전체 속도를 내주는 건 맞바꿈이 안 맞는다.
  //
  // ⏱️늦게 떠도 손해가 없는 이유 = 이 알약은 **`scrollY > 320`을 지나야** 나타난다. 판정은 마운트
  //    직후 한 번 오가고, 사람이 320px을 스크롤하기 전에 끝난다. 즉 지연이 보이는 창 자체가 없다.
  //
  // 🛟`catch`에서 `false`로 떨어뜨리는 게 핵심이다. 판정이 실패하면 **보여주는 쪽**으로 간다 —
  //    안 그러면 서버 액션 한 번 실패에 홈의 주 전환 동선이 통째로 사라진다.
  const [hasBrand, setHasBrand] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    hasOwnBrandAction()
      .then((v) => {
        if (alive) setHasBrand(v);
      })
      .catch(() => {
        if (alive) setHasBrand(false);
      });
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
      // ③ 🛡️**다른 CTA가 화면에 있으면 숨는다**(08-17 대표 지적 — "스크롤하다 겹쳐 보인다").
      //    08-16에 알약을 Kiwi로 바꾸면서 ③구좌 CTA와 **같은 색·같은 알약 모양**이 됐고,
      //    스크롤 중 둘이 위아래로 포개졌다. **목적지가 달라서** 더 나쁘다(분석 게이트 vs `/register`).
      //    🪤`endVisible`처럼 "지나갔나"로 보면 안 된다 — 이건 **화면 안에 있나**를 물어야 한다.
      //      버튼은 높이가 있어서 위로 지나가는 동안에도 한참 보이기 때문이다.
      //    📐위아래 40px 여유 — 알약이 버튼 바로 위에 스칠 듯 붙는 순간에도 이미 겹쳐 보인다.
      const guardVisible = [...document.querySelectorAll("[data-cta-guard]")].some((el) => {
        const r = el.getBoundingClientRect();
        return r.bottom > -40 && r.top < window.innerHeight + 40;
      });
      setShown(past && !endVisible && !guardVisible);
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

  // 🚦**`false`일 때만 그린다.** `true`(소개서 보유)는 물론 `null`(아직 판정 전)에도 안 그린다 —
  //   이 한 줄이 "잠깐 떴다 사라짐"을 없앤다. `if (hasBrand)`로 쓰면 `null`이 falsy라 다시 깜빡인다.
  // ⚠️`shown`을 false로만 두지 않고 **아예 렌더를 뺀** 이유 — 화면 폭 전체를 차지하는 투명 래퍼가
  //   계속 남아 있으면 스크롤·리사이즈 리스너도 계속 돈다. 안 쓸 거면 통째로 빼는 게 맞다.
  if (hasBrand !== false) return null;

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
        className={`pointer-events-auto inline-flex h-[52px] items-center rounded-pill bg-primary px-7 text-[15px] font-medium text-primary-on shadow-e3 transition-all duration-[var(--dur-base)] ease-[var(--ease)] ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        }`}
      >
        {/* ⚫점 — 알약이 Kiwi가 되면서 **검정으로 뒤집었다**(08-16).
            🔬흰 점을 먼저 검토했다가 접었다: Kiwi(#98FF5C)는 상대휘도 0.77로 흰색(1.0)에 아주 가까워
              **대비가 1.28밖에 안 난다**(거의 안 보인다). 검정(#222)은 12.72로 또렷하다.
              색 선택은 취향이 아니라 **면색의 밝기**가 정한다 — Kiwi는 색이 강렬해서 어두운 면으로
              착각하기 쉽지만 실제로는 흰색에 가까운 밝기다.
            📐지름 6.4px = 라벨 15px의 약 40%. 글머리 점의 통상 비율이고, 더 키우면 배지로 읽힌다.
            📍**왼쪽**에 둔다 — 같은 홈 ②섹션의 「● 콜라보 ON」 칩이 이미 「점 + 라벨」이라 어휘가
              맞는다. 오른쪽에 붙이면 알림 배지(읽지 않음 표시)로 읽혀 뜻이 달라진다.
            ⚠️`shrink-0` 필수 — 없으면 좁은 화면에서 점이 타원으로 눌린다. */}
        <span aria-hidden="true" className="mr-2.5 h-1.5 w-1.5 shrink-0 rounded-pill bg-ink" />
        3분 만에 소개서 만들기
      </Link>
    </div>
  );
}
