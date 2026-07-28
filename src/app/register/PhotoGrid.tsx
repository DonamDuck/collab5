"use client";

import { useState } from "react";

// 사진 업로드 그리드 — 업로드 + 삭제 + 드래그로 순서 변경. 브랜드·활동·콜라보 사진 공통.
export function PhotoGrid({
  items,
  max,
  onAdd,
  onRemove,
  onReorder,
}: {
  items: { url: string; uploading?: boolean }[];
  max: number;
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  onReorder: (from: number, to: number) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {items.map((it, i) => (
          <div
            key={i}
            draggable={!it.uploading}
            onDragStart={() => setDrag(i)}
            onDragEnd={() => setDrag(null)}
            onDragOver={(e) => e.preventDefault()}
            onDragEnter={() => {
              // 끌고 지나치는 즉시 자리 교체 — 맨 앞(1번) 자리까지 확실히 도달(드롭 정밀도 불필요)
              if (drag === null || drag === i) return;
              onReorder(drag, i);
              setDrag(i); // 끌고 있는 사진이 이제 i번
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(null);
            }}
            className={`relative h-20 w-20 shrink-0 cursor-grab overflow-hidden rounded-md border transition-colors active:cursor-grabbing ${
              drag === i ? "border-primary opacity-40" : "border-hairline"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt="" className="pointer-events-none h-full w-full object-cover" />
            {it.uploading && (
              // pointer-events-none — 이 덮개가 아래 ✕ 버튼의 클릭을 먹으면 안 된다
              <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-ink/30">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent" />
              </span>
            )}
            {/* ✕는 **업로드 중에도 보인다**(2026-07-29, 대표 지시).
                전엔 업로드 중이면 ✕를 안 그려서, 업로드가 멈추면 그 사진을 지울 방법이 없었다
                → 제출 버튼이 `some(p => p.uploading)`으로 잠긴 채 폼에서 못 빠져나갔다.
                지운 뒤 늦게 응답이 와도 안전하다: 완료 콜백은 url로 항목을 찾는데 이미 없어서 아무 일도 안 한다. */}
            <button
              type="button"
              onClick={() => onRemove(i)}
              aria-label={it.uploading ? "업로드 취소" : "사진 삭제"}
              className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-pill bg-ink/60 text-[11px] text-white"
            >
              ✕
            </button>
          </div>
        ))}
        {items.length < max && (
          <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-border-strong bg-surface text-mute">
            <span className="text-xl leading-none">＋</span>
            <span className="mt-1 text-[11px]">사진(선택)</span>
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
      {items.length > 1 && (
        <p className="mt-1.5 text-[12px] text-faint">끌어서 순서를 바꿀 수 있어요.</p>
      )}
    </div>
  );
}
