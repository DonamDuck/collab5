"use client";

import { useEffect, useRef, useState } from "react";

// 🧭공간 상세 알약 줄 — 절로 건너뛰는 길 (2026-09-18 대표 결정 B)
//
// 대표: *「섹션 항목이 많은데 뭔가 탭 같은 걸 넣어서 앵커로 사용하면 어떨까? … 너무 올드한 UI는 좀 아쉬울 거 같아」*.
// ⭐처음부터 박힌 탭 줄은 두지 않았다. 사진과 제목을 보는 동안엔 없고, **사진을 지나 스크롤하면** 헤더 바로 아래에 얇게 내려온다
//   (아워플레이스·에어비앤비 상세). 첫 화면은 공간이 먼저고, 길을 찾는 건 읽기 시작한 뒤의 일이다.
// ⭐절 목록을 여기 적지 않는다. 페이지에 실제로 그려진 `[data-nav-label]` 절을 DOM 순서대로 읽는다.
//   절은 공간마다 있다 없다 하고(커피챗·소개·시설), 이름도 바뀐다(「비용」은 상품 셋 작업이 고친다). 적어 두면 조용히 어긋난다.
// 📐붙는 높이 — 사이트 헤더(`SiteHeader`)가 `sticky top-0 h-14`이고 safe-area 여백을 안 더한다
//   (layout에 `viewport-fit=cover`가 없어 `env(safe-area-inset-top)`이 0이다). 헤더와 같은 `top-14`에 붙인다.
//   헤더가 inset을 더하게 되면 `top-14`도 같이 고친다.
// 🪤**px로 적지 않는다.** 루트 글자 크기가 넓은 화면에서 17px라 `h-14`가 56이 아니라 59.5px로 잰다(09-18 1710 폭 실측).
//   그래서 줄 높이도 rem(`h-[3.25rem]`)이고, 절의 `scroll-margin-top`(page.tsx `Section`)은 3.5 + 3.25 + 숨 0.5 = `7.25rem`이다.
//   코드 안의 계산은 숫자를 적지 않고 그려진 높이를 잰다.

type Item = { label: string; el: HTMLElement };

export function SectionNav({ afterId }: { afterId: string }) {
  const [items, setItems] = useState<Item[]>([]);
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const pillRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // 누른 직후 부드럽게 내려가는 동안엔 스크롤스파이가 중간 절을 차례로 켜서 알약이 깜빡인다. 그 사이엔 누른 것을 붙든다.
  const lockUntil = useRef(0);

  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>("[data-nav-label]"));
    setItems(els.map((el) => ({ label: el.dataset.navLabel ?? "", el })).filter((it) => it.label));
  }, []);

  useEffect(() => {
    if (items.length === 0) return;
    const after = document.getElementById(afterId);
    let timer = 0;
    const measure = () => {
      timer = 0;
      const headerH = wrapRef.current ? parseFloat(getComputedStyle(wrapRef.current).top) || 0 : 0;
      const barH = navRef.current?.offsetHeight ?? 0;
      // 사진(없으면 제목 머리)의 아랫변이 헤더 밑으로 들어가면 줄을 내린다.
      setShown(after ? after.getBoundingClientRect().bottom <= headerH : window.scrollY > 0);
      if (Date.now() < lockUntil.current) return;
      // 지금 읽는 절 = 윗변이 알약 줄 아래 선을 이미 넘은 절 중 마지막.
      const line = headerH + barH + 24;
      let idx = 0;
      items.forEach((it, i) => {
        if (it.el.getBoundingClientRect().top <= line) idx = i;
      });
      // 바닥까지 내렸으면 짧은 마지막 절은 윗변이 선에 못 닿는다. 그때는 마지막 절을 켠다.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) idx = items.length - 1;
      setActive(idx);
    };
    // ⚠️rAF로만 받으면 뒤에 깔린 탭에서 콜백이 멈춰 줄이 안 뜬 채 남는다. 스크롤 한 번에 한 번만 재도록 묶기만 한다.
    const onScroll = () => {
      if (!timer) timer = window.setTimeout(measure, 16);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [items, afterId]);

  // 켜진 알약을 줄 가운데로 민다. ⚠️`scrollIntoView`는 쓰지 않는다 — 페이지 세로 스크롤까지 같이 움직인다.
  useEffect(() => {
    const rail = railRef.current;
    const pill = pillRefs.current[active];
    if (!rail || !pill) return;
    const left = pill.offsetLeft - (rail.clientWidth - pill.offsetWidth) / 2;
    rail.scrollTo({ left: Math.max(0, left), behavior: reducedMotion() ? "auto" : "smooth" });
  }, [active, shown]);

  const go = (i: number) => {
    const it = items[i];
    if (!it) return;
    setActive(i);
    lockUntil.current = Date.now() + (reducedMotion() ? 0 : 700);
    // 비켜 설 거리는 절의 `scroll-margin-top`이 들고 있다.
    it.el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
  };

  if (items.length < 2) return null;

  return (
    // 높이 0짜리 sticky 자리 — 흐름에 자리를 안 차지하고, 왼쪽 기둥 폭을 그대로 물려받는다(넓은 화면에서 요약 카드와 안 겹친다).
    <div ref={wrapRef} className="sticky top-14 z-[9] h-0 print:hidden">
      <nav
        ref={navRef}
        aria-label="이 공간 안에서 건너뛰기"
        aria-hidden={!shown}
        className={`absolute inset-x-0 top-0 -mx-4 h-[3.25rem] border-b border-hairline bg-canvas/95 backdrop-blur transition-[opacity,transform] duration-200 motion-reduce:transition-none sm:mx-0 ${
          shown ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0"
        }`}
      >
        <div
          ref={railRef}
          className="flex h-full items-center gap-1.5 overflow-x-auto px-4 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          {items.map((it, i) => (
            <button
              key={`${i}-${it.label}`}
              ref={(el) => {
                pillRefs.current[i] = el;
              }}
              type="button"
              tabIndex={shown ? 0 : -1}
              aria-current={i === active ? "true" : undefined}
              onClick={() => go(i)}
              // 👆09-18 밤 QA(G-22) — 34px 알약이라 손끝 하한(44)에 못 미쳤다. 보이는 알약은 그대로 두고 위아래 5px씩만 넓힌다.
              className={`relative h-[34px] shrink-0 whitespace-nowrap rounded-pill px-3.5 text-[14px] transition-colors after:absolute after:-inset-y-[5px] after:content-[''] motion-reduce:transition-none ${
                i === active ? "bg-ink font-medium text-on-dark" : "text-body hover:bg-surface-soft"
              }`}
            >
              {it.label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}

function reducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
