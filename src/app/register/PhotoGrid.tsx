"use client";

import { useState } from "react";

// 사진 업로드 그리드 — 업로드 + 삭제 + 드래그로 순서 변경. 브랜드·활동·콜라보 사진 공통.
export function PhotoGrid({
  urls,
  max,
  onAdd,
  onRemove,
  onReorder,
}: {
  urls: string[];
  max: number;
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  const [over, setOver] = useState<number | null>(null);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <div
            key={i}
            draggable
            onDragStart={() => setDrag(i)}
            onDragEnd={() => {
              setDrag(null);
              setOver(null);
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (over !== i) setOver(i);
            }}
            onDrop={(e) => {
              e.preventDefault();
              if (drag !== null && drag !== i) onReorder(drag, i);
              setDrag(null);
              setOver(null);
            }}
            className={`relative h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-md border transition-colors active:cursor-grabbing ${
              drag === i ? "opacity-40" : over === i ? "border-primary" : "border-hairline"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={u} alt="" className="pointer-events-none h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label="사진 삭제"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {urls.length < max && (
          <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
            <span className="text-xl leading-none">＋</span>
            <span className="mt-1 text-[11px]">사진</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => onAdd(e.target.files)}
            />
          </label>
        )}
      </div>
      {urls.length > 1 && (
        <p className="mt-1.5 text-[12px] text-faint">끌어서 순서를 바꿀 수 있어요.</p>
      )}
    </div>
  );
}
