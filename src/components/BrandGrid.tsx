"use client";

// 홈 ②「콜라보 가능한 브랜드」 — **가로 캐러셀 6개 + 출구 둘** (대표 확정 2026-08-16, C1안).
//
// 📜왜 바뀌었나 — 07-31에는 "카드가 단조롭다"는 지적에 **정보량**으로 답해 가로형 정보 카드를
//   전량 나열했다. 그런데 브랜드가 늘면서 문제가 바뀌었다: **모바일에서 이 구좌만 1321px**,
//   화면 1.6개어치였다(대표: *"세로형으로 나열하다보니 스크롤도 좀 길어지는 감이 있다"*).
//   → 레퍼런스(팝플리·와사비) 형태인 캐러셀로 전환. 📏실측 1321 → **462px (-65%)**.
//   비교했던 5안·수치는 [[홈-개편-0816-쇼룸퍼스트]]에 남겼다.
//
// 🚪**출구가 둘인 게 핵심이다**(대표 지시).
//   · 레일 **끝 칸** = 끝까지 민 사람의 출구. 거기서 가장 가까운 다음 행동이다.
//   · **하단 버튼** = 안 민 사람의 출구. 캐러셀은 대다수가 안 밀기 때문에, 끝 칸만 두면
//     사실상 출구가 없는 것과 같다. 둘 중 어느 쪽이 먹히는지는 GA로 갈린다(이벤트가 다르다).
//
// ⏭️**다음 단계 = C2(유형 칩)**. 대표 확정 — *"나중에 업체가 많아지면 C2로 넘어가고 싶다"*.
//   켜는 법은 아래 `SHOW_TYPE_CHIPS` 주석에 통째로 적어뒀다. 지금 끈 이유는 **브랜드가 9곳뿐**이라
//   칩을 누르면 3~6곳이 나와서다 — 셸이 오히려 빈약함을 드러낸다.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { COLLAB_TYPES, type CollabType, type Maker } from "@/lib/types";
import { track } from "@/lib/track";

/** 캐러셀에 그릴 최대 개수. ~~6~~ → **7**(대표 지시 08-20). 뒤는 출구 둘이 받는다.
 *  ⭐올린 이유 — 홈 순서(`page.tsx` `HOME_ORDER`)에 전종원 작가를 넣자 6칸이 꽉 차서
 *    캔앤코르크가 레일 밖으로 밀렸다. 순서를 다투는 대신 **칸을 하나 늘렸다**(대표 판단).
 *  레일이 가로 스크롤이라 칸 수는 화면을 안 깨뜨린다 — 다만 무한정 늘릴 자리는 아니다
 *  (여기가 커지면 「모두 보기」 출구가 할 일이 없어진다). */
const CAROUSEL_LIMIT = 7;

/** ⏭️**C2 전환 스위치.** `true`로 바꾸면 레일 위에 콜라보 유형 칩이 붙는다.
 *  누르면 `/search?type=팝업` 꼴로 **그 유형으로 좁혀진 검색**이 열린다(서버가 파라미터를 읽는다 —
 *  `search/page.tsx`의 `parseTypes`). 실측 확인: 전체 9 → 팝업 6 / 공간대여 4 / 공동굿즈 3.
 *  🕐**켤 시점 = 브랜드가 20곳쯤 됐을 때**(대표 판단 몫). 그 전엔 칩이 빈약함을 드러낸다.
 *  ⚠️켤 때 `TypeChips`가 **실제 등록된 유형만** 그리는지 확인할 것 — 아무도 안 하는 유형을
 *    띄우면 눌렀을 때 빈 화면이 나오고, 그 순간 셸이 거짓말이 된다. */
const SHOW_TYPE_CHIPS = false;

/** 홈에 띄울 유형 순서(전체 7종 중 앞 5개). 어휘 정본은 `lib/types.ts`의 `COLLAB_TYPES`. */
const HOME_TYPES: CollabType[] = ["제품콜라보", "팝업", "워크숍", "공동굿즈", "공동콘텐츠"];

export function BrandGrid({ brands, showExits = true }: { brands: Maker[];
  /** 🆕출구(레일 끝 「더보기」 칸 + 하단 버튼)를 그릴지. **짧은 목록 전용 섹션에선 끈다** —
   *  3곳짜리 「새로 온 브랜드」에 「모두 보기」가 둘이나 붙으면 어디로 가라는 건지 흐려진다.
   *  ⭐출구가 둘인 건 원래 «다 못 본 사람»을 위한 설계다(레일 끝=민 사람 / 하단=안 민 사람).
   *    한 화면에 다 보이는 목록엔 그 전제가 없다. */
  showExits?: boolean;
}) {
  const shown = brands.slice(0, CAROUSEL_LIMIT);

  // 🖱️**데스크톱 화살표**(대표 지적 08-16: *"데스크탑에서 캐러셀 클릭해서 슬라이드가 안 돼"*).
  //   맞는 지적이다 — `overflow-x:auto`는 **터치·트랙패드·shift+휠**로만 움직인다. 마우스로
  //   끌어도 안 움직이는 게 브라우저 기본 동작이고, 그래서 데스크톱 사용자는 레일을 못 민다.
  //   ⭐원티드·와사비 둘 다 **화살표 버튼**으로 푼다. 드래그 스크롤을 JS로 흉내 낼 수도 있지만
  //     드래그는 보이지 않는 기능이라 아무도 시도하지 않는다 — 버튼은 보인다.
  //   📱모바일에는 안 그린다(`hidden sm:flex`) — 거기선 손가락이 이미 자연스러운 입력이고,
  //     좁은 화면에서 화살표가 카드를 덮는다.
  const railRef = useRef<HTMLDivElement>(null);
  // 양 끝에서는 그쪽 화살표를 숨긴다. 안 그러면 눌러도 아무 일이 없는 버튼이 남는다.
  const [edge, setEdge] = useState<{ start: boolean; end: boolean }>({ start: true, end: false });

  const syncEdge = useCallback(() => {
    const el = railRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // 🪤`>= max`로 비교하면 안 된다 — 브라우저가 소수점 스크롤을 남겨 끝에 닿아도 1px쯤 모자란다.
    setEdge({ start: el.scrollLeft <= 1, end: el.scrollLeft >= max - 1 });
  }, []);

  useEffect(() => {
    syncEdge();
    const el = railRef.current;
    if (!el) return;
    el.addEventListener("scroll", syncEdge, { passive: true });
    // 사진이 늦게 로드되면 scrollWidth가 바뀐다 → 창 크기 변화에도 다시 잰다.
    window.addEventListener("resize", syncEdge);
    return () => {
      el.removeEventListener("scroll", syncEdge);
      window.removeEventListener("resize", syncEdge);
    };
  }, [syncEdge]);

  // 🎞️**`scrollBy({behavior:"smooth"})` 대신 직접 트윈한다.**
  //   ⭐이유는 "smooth가 고장나서"가 아니라 **검증 가능성** 때문이다. 이 저장소에서 `smooth`가
  //     조용히 죽은 전례가 둘 있고(07-31 시트, 08-16 앵커 점프 — 그건 lazy 이미지가 문서 높이를
  //     바꿔 브라우저가 애니메이션을 취소한 진짜 사고였다), 브라우저 내부 구현에 맡기면 왜 안 되는지
  //     알 방법이 없다. 직접 트윈하면 목표값·클램프·종료를 전부 코드에서 확인할 수 있다.
  //   🪤**검증 함정** — 08-16에 자동화 브라우저에서 `smooth`가 안 먹는 걸 보고 "스냅과 충돌한다"고
  //     적었다가 정정했다. 진짜 원인은 **그 탭이 `document.hidden`이라 rAF가 한 프레임도 안 돈 것**
  //     이었다(실측: 500ms 동안 0프레임). 애니메이션은 숨은 탭에서 검증할 수 없다 —
  //     `requestAnimationFrame`을 스텁해 타임스탬프를 흘려 넣어야 로직을 확인할 수 있다.
  //   🚨🚨**트윈 중에는 스냅을 반드시 꺼야 한다**(대표 지적 08-17: *"뚝뚝 그냥 로드되는데?"*).
  //     ⛔예전 주석에 "트윈은 부작용이 없다"고 적었는데 **틀렸다.** 그때 잰 건 드래그였고(드래그는
  //       이미 스냅을 끄고 있다) 트윈은 잰 적이 없었다. 08-17 실측:
  //         `snap-x mandatory` + `scrollLeft = 40` → 읽으면 **0** (즉시도, 150ms 뒤에도)
  //         `snap: none`      + `scrollLeft = 40` → 40
  //     ⭐즉 스냅이 켜져 있으면 브라우저는 **스냅 지점이 아닌 중간값을 통째로 거부한다.** 트윈이
  //       60프레임을 넣어도 전부 제자리로 되돌려지다가, 절반을 넘는 순간 다음 칸으로 **한 번에** 튄다.
  //       애니메이션이 죽은 게 아니라 **중간 프레임이 화면에 존재할 수 없었던 것**이다.
  //     🪤이건 `behavior:"smooth"`로 바꿔도 안 낫는다 — 원인이 애니메이션 방식이 아니라 스냅이다.
  //       (끝값은 괜찮다. 실측: max=948을 넣으면 947.5로 수용된다 — 마지막은 스냅 지점 취급이라
  //        도착 후 스냅을 켜도 끌려가지 않는다.)
  const tween = useRef<number | null>(null);
  const slide = (dir: -1 | 1) => {
    const el = railRef.current;
    if (!el) return;
    // 📐**카드 1장씩** 민다(대표 지적 08-16: *"화살표 누르면 그냥 끝에서 끝으로 가는데?"*).
    //   원래 「보이는 폭의 80%」였는데, 1440에서 그 값이 1056인 반면 **총 스크롤 여유는 908뿐**이라
    //   한 번 누르면 끝까지 갔다. 화면이 넓을수록 한 걸음이 커져서 **넓은 화면일수록 캐러셀이
    //   무의미해지는** 식이었다 — 보이는 폭에 비례시킨 게 애초에 틀렸다.
    //   ⭐한 걸음은 **카드 폭**이어야 한다. 카드는 화면 폭과 무관하게 210/300px로 고정이라
    //     걸음도 고정된다. 스냅 단위와도 같아져 "한 칸 넘어갔다"가 눈에 그대로 보인다.
    //   🪤간격(gap)을 빼먹으면 매번 12.75px씩 어긋나 누적된다 — 실제 두 셀의 left 차이로 잰다.
    const cells = el.children;
    const cardStep =
      cells.length >= 2
        ? cells[1].getBoundingClientRect().left - cells[0].getBoundingClientRect().left
        : el.clientWidth * 0.8; // 카드가 하나뿐이면 잴 수 없다 — 옛 방식으로 떨어진다
    const max = el.scrollWidth - el.clientWidth;
    const from = el.scrollLeft;
    const to = Math.max(0, Math.min(max, from + dir * cardStep));
    if (to === from) return;

    if (tween.current !== null) cancelAnimationFrame(tween.current);
    // ♿모션을 줄이도록 설정한 사람에겐 애니메이션 없이 바로 옮긴다.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.scrollLeft = to;
      return;
    }
    const DUR = 380;
    const t0 = performance.now();
    el.style.scrollSnapType = "none"; // ← 이 줄이 없으면 트윈이 통째로 무시된다(위 주석 참조)
    const step = (now: number) => {
      const p = Math.min(1, (now - t0) / DUR);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      el.scrollLeft = from + (to - from) * eased;
      if (p < 1) {
        tween.current = requestAnimationFrame(step);
      } else {
        // 도착지는 정확히 스냅 지점(또는 끝)이라, 여기서 스냅을 되살려도 화면이 움직이지 않는다.
        el.scrollLeft = to;
        el.style.scrollSnapType = "";
        tween.current = null;
      }
    };
    tween.current = requestAnimationFrame(step);
  };

  // 트윈이 도는 중에 컴포넌트가 사라지면 프레임을 정리한다.
  useEffect(() => () => {
    if (tween.current !== null) cancelAnimationFrame(tween.current);
  }, []);

  // 🖐️**마우스 드래그로도 밀린다**(대표 지시 08-16). 화살표만으로는 부족하다 — 캐러셀을 보면
  //   손이 먼저 끌어보고, 안 끌리면 "고장났나"로 읽힌다.
  //   📱**마우스에만 건다**(`pointerType === "mouse"`). 터치·펜은 브라우저 기본 스크롤이 이미
  //     관성까지 붙어 훨씬 낫다 — 거기에 JS를 얹으면 오히려 뻑뻑해진다.
  //   🚨**스냅을 끄고 끌어야 한다.** `snap-mandatory`가 켜진 채로 `scrollLeft`를 매 프레임 넣으면
  //     아예 안 먹는다(위 트윈 주석의 실측과 같은 이유 — 중간값이 거부된다).
  //
  //   🚨🚨**진짜로 드래그를 막고 있던 건 브라우저의 네이티브 드래그였다**(대표 지적 08-17:
  //     *"클릭 후 드래그 아직 안 됨"*). 실측: 카드 안 `<img>`와 `<a>` 둘 다 `draggable === true`다.
  //     ⭐마우스를 누른 채 움직이면 브라우저가 **이미지/링크 끌기**를 시작하고, 그 순간
  //       **`pointercancel`이 날아와 우리 드래그가 그 자리에서 끝난다.** 고스트 이미지만 따라다니고
  //       레일은 1px도 안 움직인다 — 카드가 통째로 링크+이미지라 레일 어디를 잡아도 걸린다.
  //     🪤`pointermove`에서의 `preventDefault()`로는 못 막는다. 네이티브 드래그는 `dragstart`에서
  //       시작하므로 **`dragstart`를 막아야** 한다(레일에 걸면 자식에서 버블링돼 전부 덮인다).
  //     🚨🚨`setPointerCapture`는 **누를 때 걸면 안 된다 — 카드 링크가 죽는다**(대표 제보 08-17:
  //       *"캐러셀 브랜드 카드 클릭해도 안 가져"*). 포인터 캡처가 걸리면 이후 포인터 이벤트의
  //       타깃이 캡처 요소(=레일)로 바뀌고, `click`은 누른 곳과 뗀 곳의 **공통 조상**에 떨어진다.
  //       즉 `<a>`가 아니라 레일 `<div>`가 클릭을 받아 **내비게이션이 아예 일어나지 않는다.**
  //       📏prod 실측: `pointerdown → IMG` / `pointerup → DIV` / `click(막힘=false) → DIV`
  //         ⭐`막힘=false`가 핵심 단서였다 — 아래 `onClickCapture`가 막은 게 아니라
  //           **링크에 닿지도 못한 것**이다. 「클릭이 안 먹는다」의 원인이 둘로 갈리는 자리다.
  //     👉그래서 **움직인 게 확인된 뒤에** 건다(임계값 5px, 클릭 판정과 같은 값).
  //       단순 클릭은 캡처가 안 걸려 `<a>`가 정상 동작하고, 진짜 드래그일 때만 캡처가 붙어
  //       커서가 레일 밖으로 나가도 안 끊긴다. 두 목적이 같이 선다.
  //     🪤`user-select: none` — 안 걸면 끄는 동안 카드 글자가 파랗게 선택돼 고장난 것처럼 보인다.
  const drag = useRef({ on: false, startX: 0, startLeft: 0, moved: 0, id: -1 });

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== "mouse" || e.button !== 0) return;
    const el = railRef.current;
    if (!el) return;
    if (tween.current !== null) cancelAnimationFrame(tween.current); // 화살표 트윈 중이면 가로챈다
    // ⛔여기서 `setPointerCapture`를 부르지 마라(위 🚨 참조). `id: -1` = 아직 안 잡았다는 뜻이다.
    drag.current = { on: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0, id: -1 };
    el.style.scrollSnapType = "none";
    el.style.cursor = "grabbing";
    el.style.userSelect = "none";
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = railRef.current;
    if (!drag.current.on || !el) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    // 🖐️**여기서 처음 캡처한다** — 5px을 넘어야 「끌기」다. 그 전엔 클릭일 수 있으므로 안 잡는다.
    //    (임계값을 아래 `onClickCapture`와 같은 5로 맞춘다. 두 값이 갈리면 「캡처는 됐는데 클릭은
    //     안 막힌」 구간이 생겨 끌고 놓았는데 링크가 열린다.)
    if (drag.current.id < 0 && drag.current.moved > 5) {
      try {
        el.setPointerCapture(e.pointerId);
        drag.current.id = e.pointerId;
      } catch {
        // 캡처는 있으면 좋은 것일 뿐이다 — 실패해도 레일 안에서는 그대로 끌린다.
      }
    }
    el.scrollLeft = drag.current.startLeft - dx;
    e.preventDefault();
  };

  const endDrag = () => {
    const el = railRef.current;
    if (!el) return;
    if (drag.current.id >= 0) {
      try {
        el.releasePointerCapture(drag.current.id);
      } catch {
        // 이미 풀렸으면 그만이다.
      }
      drag.current.id = -1;
    }
    drag.current.on = false;
    // 스냅을 되살리는 순간 브라우저가 가장 가까운 카드 경계로 붙여 준다 — 손이 어중간한 데서
    // 놓아도 카드가 반쯤 잘린 채로 서지 않는다.
    el.style.scrollSnapType = "";
    el.style.cursor = "";
    el.style.userSelect = "";
  };

  // 🚫끌고 나서 손을 뗄 때 **카드 링크가 열리면 안 된다.** 캡처 단계에서 막는다 —
  //    `<a>`의 기본 동작보다 먼저 가로채야 해서 버블링으로는 늦다.
  //    📐임계 5px — 그 아래는 클릭으로 본다(사람 손은 클릭할 때도 1~2px은 움직인다).
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved > 5) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = 0;
    }
  };

  return (
    <div className="relative">
      {SHOW_TYPE_CHIPS && <TypeChips brands={brands} />}
      {/* ⚠️`-mx-4 px-4`가 핵심이다 — 레일이 **지면 끝까지 흐르게** 해야 마지막 카드가 잘려 보이고,
          그래야 "옆에 더 있다"가 손을 대기 전에 읽힌다. 가운데 정렬돼 끝이 딱 맞으면 아무도 안 민다.
          숫자는 부모(`page.tsx` main)의 좌우 패딩과 같아야 한다(`px-4 sm:px-6`).

          🚨**`scroll-pl-*`이 없으면 첫 카드가 화면에 쩍 붙는다**(대표 지적 08-16, 실측으로 확인).
            `snap-start`는 스냅 위치를 **스크롤 패딩 기준**으로 잡는데 그 값이 0이면 패딩을 무시하고
            정렬해 버린다 — 브라우저가 스스로 `scrollLeft`를 17px 밀어 `px-4`를 상쇄했다.
            (증상: 레일 `paddingLeft: 17px`인데 첫 카드 `left: 0`, `scrollLeft: 17`)
            → **`scroll-pl`을 `px`와 같은 값으로 맞춘다.** 둘은 항상 같이 움직여야 한다. */}
      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerLeave={endDrag}
        onPointerCancel={endDrag}
        // 🚨브라우저 기본 「이미지·링크 끌기」를 끈다. 이게 드래그가 안 되던 진짜 원인이다
        //    (자세한 실측은 위 `drag` 주석). 자식에서 버블링되므로 레일 한 곳이면 카드 전부 덮인다.
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={onClickCapture}
        // 🖐️`sm:cursor-grab` — 데스크톱에서만 "끌 수 있다"를 커서로 알린다. 드래그는 보이지 않는
        //    기능이라 커서가 유일한 힌트다(끄는 중 `grabbing`은 위 핸들러가 직접 넣는다).
        className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:cursor-grab sm:scroll-pl-6 sm:px-6"
        style={{ scrollbarWidth: "none" }}
      >
        {shown.map((m) => (
          <div key={m.id} className="w-[210px] shrink-0 snap-start sm:w-[300px]">
            <BrandCard m={m} />
          </div>
        ))}
        {showExits && (
          <div className="w-[210px] shrink-0 snap-start sm:w-[300px]">
            <EndCard />
          </div>
        )}
      </div>
      {/* 🖱️화살표 — 레일 **위에 겹쳐** 띄운다(와사비 방식). 위에 따로 줄을 만들면 세로를 먹는데,
          이 구좌는 애초에 "길이를 줄이려고" 캐러셀로 바꾼 자리라 그 비용을 다시 낼 이유가 없다.
          📐`top-[38%]` — 카드 세로 가운데가 아니라 **사진 영역 가운데**다. 카드 아래쪽엔 글자가 있어서
            정중앙에 두면 화살표가 이름·키워드를 덮는다.
          ⚠️`-mx-*`로 밖으로 흐르는 레일 위에 얹히므로 `left/right-0`은 **부모(`relative`) 기준**이다 —
            즉 콘텐츠 폭 안쪽에 붙는다. 화면 끝에 붙이면 잘린 카드 위에 떠서 뭘 가리키는지 모호해진다. */}
      <SlideButton dir={-1} onClick={() => slide(-1)} hidden={edge.start} />
      <SlideButton dir={1} onClick={() => slide(1)} hidden={edge.end} />
      {showExits && <BottomMore />}
    </div>
  );
}

function SlideButton({
  dir,
  onClick,
  hidden,
}: {
  dir: -1 | 1;
  onClick: () => void;
  hidden: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={dir === -1 ? "이전 브랜드 보기" : "다음 브랜드 보기"}
      // 🚫끝에 닿으면 **`hidden`이 아니라 투명 + 클릭 차단**으로 없앤다. 진짜로 지우면 버튼이
      //   나타났다 사라지며 레이아웃 밖에서 깜빡이는데, 투명하게 두면 자리만 비운다.
      //   ♿`aria-hidden`·`tabIndex=-1`을 같이 걸어 스크린리더·키보드에서도 함께 빠진다.
      aria-hidden={hidden}
      tabIndex={hidden ? -1 : undefined}
      className={`absolute top-[38%] z-[2] hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface text-ink shadow-e2 transition-opacity hover:bg-surface-soft sm:flex ${
        dir === -1 ? "-left-1" : "-right-1"
      } ${hidden ? "pointer-events-none opacity-0" : "opacity-100"}`}
    >
      <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path
          d={dir === -1 ? "M12.5 4.5 7 10l5.5 5.5" : "M7.5 4.5 13 10l-5.5 5.5"}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function BrandCard({ m }: { m: Maker }) {
  return (
    <Link
      href={`/m/${m.slug}`}
      onClick={() => track("home_grid_brand_click", { slug: m.slug })}
      className="block h-full overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:bg-surface-soft"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-surface-soft">
        {m.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-pale">
            {/* 🚨정사각 클래스(`w-9` 등) 금지 — 08-16 새 마크는 가로:세로 1.28이라 찌그러진다.
                높이만 주고 폭은 `w-auto`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="collab5" className="h-[30px] w-auto opacity-70" />
          </div>
        )}
      </div>
      <div className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-medium text-ink">{m.name}</span>
          {m.region && <span className="shrink-0 text-[12px] text-mute">· {m.region}</span>}
        </div>
        {m.oneLiner && <p className="mt-0.5 line-clamp-1 text-[13px] text-body">{m.oneLiner}</p>}
        {/* 🔒칩은 **한 줄 고정**(`h-[19px]` + `flex-nowrap`). 줄바꿈을 허용하면 카드마다 키가
            달라져 캐러셀 바닥선이 톱니처럼 어긋난다. 넘치는 칩은 잘린다 —
            성격은 한 줄로도 전달되고, 자세한 건 눌러서 본다. */}
        {m.keywords.length > 0 && (
          <div className="mt-2 flex h-[19px] flex-nowrap gap-1.5 overflow-hidden">
            {m.keywords.slice(0, 3).map((v) => (
              <span
                key={v}
                className="shrink-0 rounded-sm bg-mint-pale px-1.5 py-0.5 text-[11px] font-medium text-mint-on"
              >
                {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/** 레일 끝 칸 — 끝까지 민 사람의 출구. 개수 표기 없음, 흰 면 + 실선 hairline(점선 금지).
 *  이 원칙은 07-27 캐러셀 MoreCard에서 승계했다. */
function EndCard() {
  return (
    <Link
      href="/search"
      onClick={() => track("home_grid_more_click")}
      className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-hairline bg-surface transition-colors hover:bg-primary-pale"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-surface-soft">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {/* 🔻08-16 「N곳 모두 보기」에서 **「더보기」**로 줄였다(대표: *"N개가 나오는 게 지금 많지가 않아서"*).
          ⭐숫자는 **많을 때만 증거**가 된다. 9곳이면 "겨우 9곳"으로 읽혀 오히려 빈약함을 드러낸다.
            브랜드가 수십 곳이 되면 그때 다시 숫자를 넣는 게 맞다 — 같은 문구가 상황에 따라
            자랑이 되기도 하고 자백이 되기도 한다. */}
      <span className="text-[14px] font-medium text-ink">더보기</span>
    </Link>
  );
}

/** 하단 버튼 — 캐러셀을 **안 민 사람**의 출구(대표 지시 08-16). */
function BottomMore() {
  return (
    <div className="mt-5 text-center">
      <Link
        href="/search"
        onClick={() => track("home_grid_more_bottom_click")}
        className="inline-flex h-12 items-center rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
      >
        {/* ✂️08-16 대표 지시로 「콜라보 가능한 브랜드 N곳 모두 보기」(281px)에서 줄였다.
            개수는 레일 끝 칸으로 옮겼다 — 두 출구가 같은 말을 하면 하나가 군더더기가 된다. */}
        브랜드 더 보기
        <span className="ml-1.5 text-faint">→</span>
      </Link>
    </div>
  );
}

/** ⏭️C2용 — `SHOW_TYPE_CHIPS`가 `true`일 때만 그려진다. 위 스위치 주석 참조. */
function TypeChips({ brands }: { brands: Maker[] }) {
  // 등록된 브랜드가 실제로 제공하는 유형만 그린다(빈 결과로 보내지 않기 위해).
  const live = new Set(brands.flatMap((m) => [...m.offers, ...m.seeks]));
  const types = HOME_TYPES.filter((t) => COLLAB_TYPES.includes(t) && live.has(t));
  if (!types.length) return null;
  return (
    <div
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      style={{ scrollbarWidth: "none" }}
    >
      {types.map((t) => (
        <Link
          key={t}
          href={`/search?type=${encodeURIComponent(t)}`}
          onClick={() => track("home_grid_type_click", { type: t })}
          className="inline-flex h-9 shrink-0 items-center rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface px-3.5 text-[13px] font-medium text-body transition-colors hover:bg-surface-soft"
        >
          {t}
        </Link>
      ))}
    </div>
  );
}
