"use client";

// 들어온 요청 카드 안의 「손님이 적은 계획」 인용 (2026-09-18)
//
// 🗣대표 코멘트 #63 — 「그냥 텍스트 나열처럼만 보인다」. 계획 글이 카드에서 가장 긴 글이라, 통째로 펼치면
//   날짜·상태·돈보다 먼저 눈에 걸리고 폰에선 한 건이 한 화면을 넘는다. 줄 수를 정해 자르고 「더 보기」로 연다.
// ⭐「더 보기」는 **실제로 잘렸을 때만** 띄운다. 글자 수로 짐작하면 넓은 화면에서 두 줄에 다 들어간 글에도
//   버튼이 붙어, 눌러도 아무것도 안 바뀌는 버튼이 생긴다. 그래서 그려진 높이를 잰다.
// 🔒보여 주는 칸 수만 바꾼다. 글은 서버가 이미 준 것 그대로다(수락 전에도 보이던 글).
import { useEffect, useRef, useState } from "react";

export function PlanQuote({ text, lines, quiet = false }: { text: string; lines: 2 | 3; quiet?: boolean }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [clipped, setClipped] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || open) return;
    const check = () => setClipped(el.scrollHeight > el.clientHeight + 1);
    check();
    // 폭이 바뀌면(회전·창 크기) 잘리는지도 바뀐다.
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [text, lines, open]);

  // ⚠️Tailwind는 글자 그대로의 클래스만 만든다 — `line-clamp-${lines}`처럼 조립하면 조용히 안 생긴다.
  const clamp = open ? "" : lines === 2 ? "line-clamp-2" : "line-clamp-3";
  return (
    <div className="mt-4 border-l-2 border-border-strong pl-3">
      <p
        ref={ref}
        className={`whitespace-pre-line text-[16px] leading-relaxed break-keep ${quiet ? "text-mute" : "text-body"} ${clamp}`}
      >
        {text}
      </p>
      {(clipped || open) && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          // 글자 버튼도 터치 타깃 44px(디자인-시스템). 아래 음수 여백으로 보이는 간격은 늘리지 않는다.
          className="-mb-[12px] py-[12px] text-[14px] text-mute underline underline-offset-2"
        >
          {open ? "접기" : "더 보기"}
        </button>
      )}
    </div>
  );
}
