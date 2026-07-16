"use client";

// 순서 변경 가능한 카드 껍데기 — 헤더(드래그 핸들 ⠿ + ↑↓ + 삭제) + children.
// 데스크탑=핸들 드래그(HTML5 DnD, PhotoGrid와 동일 패턴), 모바일=↑↓ 버튼(터치엔 DnD 미동작).
import { useRef } from "react";

export type DndState = { drag: number | null; over: number | null };
export const emptyDnd: DndState = { drag: null, over: null };

// 배열 원소를 from→to로 이동(범위 밖·동일 위치는 원본 유지). 드래그·↑↓ 공용.
export function reorder<T>(arr: T[], from: number, to: number): T[] {
  if (to < 0 || to >= arr.length || from === to) return arr;
  const next = [...arr];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

export function SortableCard({
  index,
  count,
  label,
  onMove,
  onRemove,
  dnd,
  setDnd,
  className = "space-y-3",
  idBase,
  children,
}: {
  index: number;
  count: number;
  label: string;
  onMove: (from: number, to: number) => void;
  onRemove?: () => void; // 없으면 삭제 버튼 미표시(예: 첫 카드)
  dnd: DndState;
  setDnd: (s: DndState) => void;
  className?: string; // 카드 내부 세로 간격(활동=space-y-3, 콜라보=space-y-5 등)
  idBase?: string; // 위치 기반 DOM id 접두어(순서변경 후 스크롤 추적용) → id=`${idBase}-${index}`
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragging = dnd.drag === index;
  const isOver = dnd.over === index && dnd.drag !== null && dnd.drag !== index;
  const sortable = count > 1;

  return (
    <div
      ref={ref}
      id={idBase ? `${idBase}-${index}` : undefined}
      onDragOver={(e) => {
        if (dnd.drag === null) return;
        e.preventDefault();
        if (dnd.over !== index) setDnd({ drag: dnd.drag, over: index });
      }}
      onDrop={(e) => {
        e.preventDefault();
        if (dnd.drag !== null && dnd.drag !== index) onMove(dnd.drag, index);
        setDnd(emptyDnd);
      }}
      className={`scroll-mt-4 rounded-md border bg-surface p-3 transition-colors ${
        dragging ? "opacity-40" : isOver ? "border-primary" : "border-hairline"
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-1.5">
          {sortable && (
            <span
              draggable
              onDragStart={(e) => {
                setDnd({ drag: index, over: null });
                if (ref.current) e.dataTransfer.setDragImage(ref.current, 16, 16);
              }}
              onDragEnd={() => setDnd(emptyDnd)}
              role="button"
              aria-label="드래그로 순서 바꾸기"
              title="끌어서 순서 바꾸기"
              className="hidden shrink-0 cursor-grab select-none px-0.5 text-base leading-none text-faint hover:text-mute active:cursor-grabbing sm:inline"
            >
              ⠿
            </span>
          )}
          <span className="text-sm font-semibold text-body">{label}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {sortable && (
            <>
              <button
                type="button"
                onClick={() => onMove(index, index - 1)}
                disabled={index === 0}
                aria-label="위로"
                className="flex h-7 w-7 items-center justify-center rounded-sm text-mute hover:bg-surface-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => onMove(index, index + 1)}
                disabled={index === count - 1}
                aria-label="아래로"
                className="flex h-7 w-7 items-center justify-center rounded-sm text-mute hover:bg-surface-soft hover:text-ink disabled:opacity-30 disabled:hover:bg-transparent"
              >
                ↓
              </button>
            </>
          )}
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-1 text-sm text-faint hover:text-ink"
            >
              삭제
            </button>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}
