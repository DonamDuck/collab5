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

const AUTO_MS = 3500;
const SWIPE_PX = 40; // 이만큼 끌면 넘어간다
const SLIDE_MS = 420; // 넘어가는 데 걸리는 시간(아래 transition과 같은 값이어야 한다)

export function HomeBannerCarousel({ children }: { children: ReactNode }) {
  // 🪤`{article && <Slide/>}`처럼 조건부로 넘어온 슬라이드는 글이 없을 때 `false`로 온다.
  //    거르지 않으면 **빈 슬라이드 한 장**이 생기고 점도 하나 더 찍힌다(매거진 글이 0편일 때).
  const slides = (Array.isArray(children) ? children : [children]).filter(Boolean);
  const n = slides.length;
  const loop = n > 1;

  // 🎠**무한 롤링**(대표 지시 08-25: *"오른쪽 슬라이드만으로도 계속 반복해서 볼 수 있게"*).
  //   ⭐한 벌만 늘어놓으면 마지막에서 처음으로 갈 때 트랙이 **왼쪽 끝까지 되감기며 역주행**한다.
  //     그래서 **같은 슬라이드를 3벌** 깔고 **가운데 벌에서만 논다** — 어느 쪽으로 계속 밀어도
  //     옆에 항상 다음 장이 준비돼 있다.
  //   🔁끝에 다다르면 애니메이션을 끈 채 가운데 벌의 같은 자리로 **순간 이동**한다.
  //     그림이 똑같은 자리라 사람 눈에는 아무 일도 안 일어난 것으로 보인다.
  const reel = loop ? [...slides, ...slides, ...slides] : slides;
  const [idx, setIdx] = useState(loop ? n : 0); // 가운데 벌의 첫 장에서 시작
  const [dx, setDx] = useState(0); // 끄는 중의 손가락 이동량(px)
  const [paused, setPaused] = useState(false);
  const [snap, setSnap] = useState(false); // 순간 이동 중(트랜지션 끔)
  const drag = useRef({ on: false, startX: 0, moved: 0, id: -1 });
  const active = loop ? ((idx % n) + n) % n : idx;

  // 🔁가운데 벌 밖으로 나가면 트랜지션이 끝난 뒤 같은 그림의 가운데 자리로 되돌린다.
  //   ⚠️`SLIDE_MS`보다 **조금 뒤**에 해야 한다 — 이동 중에 자리를 바꾸면 화면이 튄다.
  useEffect(() => {
    if (!loop || (idx >= n && idx < n * 2)) return;
    const t = setTimeout(() => {
      setSnap(true);
      setIdx((i) => (((i % n) + n) % n) + n);
    }, SLIDE_MS + 30);
    return () => clearTimeout(t);
  }, [idx, n, loop]);

  // 순간 이동은 **한 프레임만** 유지한다. 계속 켜 두면 다음 이동도 뚝 끊긴다.
  useEffect(() => {
    if (!snap) return;
    const r = requestAnimationFrame(() => setSnap(false));
    return () => cancelAnimationFrame(r);
  }, [snap]);

  // 자동 넘김 — 슬라이드가 하나면 돌지 않는다. 손을 올리거나 끄는 중이면 쉰다.
  // ♿`prefers-reduced-motion`이면 자동 넘김을 아예 끈다(스스로 움직이는 것이 그 설정의 핵심 대상이다).
  useEffect(() => {
    if (n < 2 || paused) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      if (document.hidden) return; // 🪤숨은 탭에서 눈치 없이 넘어가 있지 않게
      setIdx((i) => i + 1);
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
    // 🔁고무줄 저항을 뺐다 — 무한 롤링이라 **끝이 없다.** 저항을 두면 「여기가 마지막」이라고
    //    거짓말을 하는 셈이다.
    setDx(delta);
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
      // 🔁범위를 자르지 않는다 — 밖으로 나가면 위 훅이 같은 그림의 가운데 자리로 되돌린다.
      setIdx((i) => i + (delta < 0 ? 1 : -1));
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
          transition:
            drag.current.on || snap ? "none" : `transform ${SLIDE_MS}ms cubic-bezier(0.22,1,0.36,1)`,
        }}
        onDragStart={(e) => e.preventDefault()} // 🪤①
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        {reel.map((s, i) => (
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
                // 🔁가운데 벌의 같은 자리로 보낸다 — 점은 «몇 번째 슬라이드인가»를 말하지
                //    «트랙의 몇 칸째인가»를 말하지 않는다.
                onClick={() => setIdx(loop ? n + i : i)}
                aria-label={`${i + 1}번 배너 보기`}
                aria-current={i === active}
                // 📐점은 8px, 현재 것만 가로로 늘어난 알약(18px). 색만 바꾸면 어두운 면에서 잘 안 보인다.
                className={`h-2 rounded-pill transition-all duration-[var(--dur-base)] ${
                  i === active ? "w-[18px] bg-white" : "w-2 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
