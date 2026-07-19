"use client";

// 브랜드 사진 스와이프 슬라이드 — 자동재생 없음. 모바일=손가락 스와이프(스크롤스냅),
// 데스크탑=마우스 드래그(잡고 끌기) + 화살표. 인디케이터 점으로 위치 표시.
import { useRef, useState } from "react";

export function PhotoSlider({
  photos,
  rounded = "rounded-lg",
}: {
  photos: string[];
  rounded?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const drag = useRef({ active: false, startX: 0, startLeft: 0 });

  const onScroll = () => {
    const el = ref.current;
    if (!el) return;
    setIdx(Math.round(el.scrollLeft / el.clientWidth));
  };
  const goTo = (i: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  // 데스크탑 마우스 드래그(잡고 끌기). 터치는 네이티브 스크롤스냅에 맡김(pointerType 분기).
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (photos.length <= 1 || e.pointerType !== "mouse" || !el) return;
    drag.current = { active: true, startX: e.clientX, startLeft: el.scrollLeft };
    setDragging(true);
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active || !el) return;
    el.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
  };
  const onPointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!drag.current.active) return;
    drag.current.active = false;
    setDragging(false);
    if (!el) return;
    try {
      el.releasePointerCapture(e.pointerId);
    } catch {}
    // 살짝만 밀어도 넘어가게 — 시작 장 기준 이동량이 폭의 15% 넘으면 다음/이전 장으로.
    const width = el.clientWidth || 1;
    const startPage = Math.round(drag.current.startLeft / width);
    const moved = el.scrollLeft - drag.current.startLeft;
    const threshold = width * 0.15;
    let target = startPage;
    if (moved > threshold) target = startPage + 1;
    else if (moved < -threshold) target = startPage - 1;
    goTo(Math.max(0, Math.min(photos.length - 1, target)));
  };

  if (!photos.length) return null;
  const multi = photos.length > 1;

  return (
    <div className="select-none">
      <div className={`relative overflow-hidden ${rounded}`}>
        <div
          ref={ref}
          onScroll={onScroll}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          className={`no-scrollbar flex ${
            multi ? "overflow-x-auto" : "overflow-hidden"
          } ${multi && !dragging ? "snap-x snap-mandatory" : ""} ${
            multi ? (dragging ? "cursor-grabbing" : "cursor-grab") : ""
          }`}
        >
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-soft [&:not(:first-child)]:print:hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt={`브랜드 사진 ${i + 1}`}
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </div>
          ))}
        </div>

        {/* 장수 카운터 */}
        {multi && (
          <span className="pointer-events-none absolute right-2 top-2 rounded-pill bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white print:hidden">
            {idx + 1} / {photos.length}
          </span>
        )}

        {/* 데스크탑 화살표(모바일은 스와이프) */}
        {multi && idx > 0 && (
          <button
            type="button"
            onClick={() => goTo(idx - 1)}
            aria-label="이전 사진"
            className="absolute left-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill bg-surface/85 text-ink shadow-e1 hover:bg-surface sm:flex"
          >
            ‹
          </button>
        )}
        {multi && idx < photos.length - 1 && (
          <button
            type="button"
            onClick={() => goTo(idx + 1)}
            aria-label="다음 사진"
            className="absolute right-2 top-1/2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-pill bg-surface/85 text-ink shadow-e1 hover:bg-surface sm:flex"
          >
            ›
          </button>
        )}
      </div>

      {/* 인디케이터 점 */}
      {multi && (
        <div className="mt-2.5 flex items-center justify-center gap-1.5 print:hidden">
          {photos.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 사진`}
              className={`h-1.5 rounded-pill transition-all ${
                i === idx ? "w-4 bg-primary" : "w-1.5 bg-border-strong"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
