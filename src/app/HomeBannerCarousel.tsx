"use client";

// 홈 최상단 배너 캐러셀 — 슬라이드 여러 장을 **한 카본 면 위에서** 번갈아 보여준다(대표 지시 08-19).
//
// 📜이 자리는 처음부터 이렇게 될 예정이었다 — 08-16에 배경을 카본 단색(A안)으로 고른 이유가
//   대표 말 그대로 *"나중에 슬라이드로 업체 소개나 이벤트가 될 자리"*였다. 사진 배경(C안)을 안 고른 게
//   여기서 값을 한다: **배경이 안 바뀌니 슬라이드가 넘어가도 배너 띠 하나로 읽힌다.**
//
// ⚠️슬라이드는 `children`으로 받는다 — 서버 컴포넌트(매거진 배너)를 그대로 끼워 넣기 위해서다.
//   이 파일이 클라 컴포넌트라고 해서 슬라이드까지 클라가 되는 게 아니다(children은 서버에서 렌더된다).
//
// 🪤함정 셋, 전부 이 저장소에서 이미 당한 것들이다:
//   ① `<img>`·`<a>`는 기본 `draggable` — 끌면 브라우저 기본 드래그가 시작되며 `pointercancel`이 날아와
//      우리 드래그가 통째로 죽는다. → 트랙에 `onDragStart={preventDefault}`(버블링으로 다 잡힌다).
//   ② `setPointerCapture`를 **누를 때** 걸면 click이 공통 조상(트랙 div)으로 가서 **슬라이드 안의 링크가
//      죽는다**(08-17 사고, 이틀 살아 있었다). → **5px 넘게 움직인 뒤에** 건다.
//   ③ 숨은 탭은 rAF가 0프레임이라 자동 넘김이 밀린다. → `document.hidden`이면 넘기지 않는다.
import { useEffect, useRef, useState, type ReactNode } from "react";

const AUTO_MS = 6000;
const SWIPE_PX = 40; // 이만큼 끌면 넘어간다

export function HomeBannerCarousel({ children }: { children: ReactNode }) {
  // 🪤`{article && <Slide/>}`처럼 조건부로 넘어온 슬라이드는 글이 없을 때 `false`로 온다.
  //    거르지 않으면 **빈 슬라이드 한 장**이 생기고 점도 하나 더 찍힌다(매거진 글이 0편일 때).
  const slides = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const n = slides.length;
  const [idx, setIdx] = useState(0);
  const [dx, setDx] = useState(0); // 끄는 중의 손가락 이동량(px)
  const [paused, setPaused] = useState(false);
  const drag = useRef({ on: false, startX: 0, moved: 0, id: -1 });

  // 자동 넘김 — 슬라이드가 하나면 돌지 않는다. 손을 올리거나 끄는 중이면 쉰다.
  // ♿`prefers-reduced-motion`이면 자동 넘김을 아예 끈다(스스로 움직이는 것이 그 설정의 핵심 대상이다).
  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.hidden) return; // 🪤숨은 탭에서 눈치 없이 넘어가 있지 않게
      setIdx((i) => (i + 1) % n);
    }, AUTO_MS);
    return () => clearInterval(t);
  }, [n, paused]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (n < 2) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    drag.current = { on: true, startX: e.clientX, moved: 0, id: -1 };
    setPaused(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    const delta = e.clientX - d.startX;
    d.moved = Math.max(d.moved, Math.abs(delta));
    // 🪤캡처는 «움직인 뒤»에만 — 누를 때 걸면 슬라이드 안의 링크가 죽는다.
    if (d.id < 0 && d.moved > 5) {
      try {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        d.id = e.pointerId;
      } catch {}
    }
    if (d.id < 0) return; // 아직 «클릭일지도 모르는» 단계 — 화면을 흔들지 않는다
    // 양 끝에서는 저항을 준다(고무줄) — 안 그러면 끝인지 모르고 계속 끈다.
    const atEdge = (idx === 0 && delta > 0) || (idx === n - 1 && delta < 0);
    setDx(atEdge ? delta * 0.35 : delta);
    e.preventDefault();
  };

  const endDrag = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d.on) return;
    const delta = e.clientX - d.startX;
    if (d.id >= 0) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(d.id);
      } catch {}
    }
    drag.current = { on: false, startX: 0, moved: 0, id: -1 };
    setDx(0);
    setPaused(false);
    if (Math.abs(delta) > SWIPE_PX) {
      setIdx((i) => Math.min(n - 1, Math.max(0, i + (delta < 0 ? 1 : -1))));
    }
  };

  return (
    // 🎨배경을 **여기** 깐다 — 슬라이드가 넘어가는 동안에도 면이 끊기지 않아야 한다.
    //   ⚠️`bg-[#0c0c0c]`는 리터럴이다(카본). `--ink`를 쓰면 안 된다 — 그건 본문 글자색이라
    //     건드리면 전 페이지 글자가 같이 움직인다(HomeMagazineBanner 주석 참조).
    <section
      className="relative overflow-hidden bg-[#0c0c0c]"
      aria-roledescription="carousel"
      aria-label="collab5 소식"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div
        // 🖐️`touch-pan-y` — 세로 스크롤은 브라우저에 맡기고 가로만 우리가 받는다.
        //   이게 없으면 폰에서 배너 위에 손이 닿는 순간 페이지가 안 내려간다.
        // 📐**`items-stretch`다**(08-25 정정). 슬라이드마다 내용 높이가 다른데, 이제 **각 슬라이드가
        //    자기 배경을 깔기 때문에** 칸을 꽉 채워야 한다.
        //    🔻08-19에는 `items-center`였다 — 그때는 배경이 캐러셀 것 하나뿐이라 짧은 슬라이드를
        //      가운데로 두는 게 맞았다. 2번이 자기 면색(뿌연 키위)을 갖게 되자 **전제가 뒤집혔다**:
        //      가운데로 두면 위아래로 **카본이 드러나 검은 띠**가 생긴다(모바일 실측 08-25).
        //    ⭐세로 중심잡기는 이제 **슬라이드 안에서** 한다(`h-full` + `items-center`).
        className="flex items-stretch touch-pan-y"
        style={{
          transform: `translateX(calc(${-idx * 100}% + ${dx}px))`,
          transition: drag.current.on ? "none" : "transform 420ms cubic-bezier(0.22,1,0.36,1)",
        }}
        onDragStart={(e) => e.preventDefault()} // 🪤①
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {slides.map((s, i) => (
          <div
            key={i}
            className="w-full shrink-0"
            aria-hidden={i !== idx}
            // 🪤보이지 않는 슬라이드는 **탭 이동에서도 빼야 한다.** 안 그러면 Tab을 눌렀을 때
            //   화면 밖 링크로 포커스가 가서 페이지가 옆으로 튄다.
            inert={i !== idx}
          >
            {s}
          </div>
        ))}
      </div>

      {n > 1 && (
        // ⚫점은 배너 **안쪽 오른쪽 아래**. 가운데 아래에 두면 1번 슬라이드의 「읽어보기」 알약과
        //   세로로 겹쳐 보인다(둘 다 왼쪽 아래 덩어리 근처다).
        <div className="pointer-events-none absolute inset-x-0 bottom-3 mx-auto flex max-w-[1320px] justify-end px-4 sm:bottom-5 sm:px-6">
          <div className="pointer-events-auto flex items-center gap-2 rounded-pill bg-white/10 px-2.5 py-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setIdx(i)}
                aria-label={`${i + 1}번 배너 보기`}
                aria-current={i === idx}
                // 📐점은 8px, 현재 것만 가로로 늘어난 알약(18px). 색만 바꾸면 어두운 면에서 잘 안 보인다.
                className={`h-2 rounded-pill transition-all duration-[var(--dur-base)] ${
                  i === idx ? "w-[18px] bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
