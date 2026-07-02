"use client";

// 브랜드 사진 스와이프 슬라이드 — 자동재생 없음. 손가락 스와이프(스크롤스냅)로 한 장씩.
// 넘김 제스처를 유도: 인디케이터 점 + "밀어서 넘겨보세요" 힌트 + 데스크탑 화살표.
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
  if (!photos.length) return null;
  const multi = photos.length > 1;

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

  return (
    <div className="select-none">
      <div className={`relative overflow-hidden ${rounded}`}>
        <div
          ref={ref}
          onScroll={onScroll}
          className={`no-scrollbar flex ${
            multi ? "snap-x snap-mandatory overflow-x-auto" : "overflow-hidden"
          }`}
        >
          {photos.map((src, i) => (
            <div key={i} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-surface-soft">
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
          <span className="pointer-events-none absolute right-2 top-2 rounded-pill bg-ink/55 px-2 py-0.5 text-[11px] font-medium text-white">
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

      {/* 인디케이터 점 + 스와이프 힌트 */}
      {multi && (
        <>
          <div className="mt-2.5 flex items-center justify-center gap-1.5">
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
          <p className="mt-1.5 text-center text-[12px] text-faint">← 밀어서 넘겨보세요 →</p>
        </>
      )}
    </div>
  );
}
