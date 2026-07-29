"use client";

import { useState } from "react";

// 사진 업로드 그리드 — 업로드 + 삭제 + 드래그로 순서 변경. 브랜드·활동·콜라보 사진 공통.
export function PhotoGrid({
  items,
  max,
  onAdd,
  onRemove,
  onReorder,
  onRetry,
}: {
  items: { url: string; uploading?: boolean; failed?: string }[];
  max: number;
  onAdd: (files: FileList | null) => void;
  onRemove: (i: number) => void;
  onReorder: (from: number, to: number) => void;
  /** 실패한 사진 다시 올리기 — 보관해둔 원본 파일로 재시도한다. */
  onRetry?: (i: number) => void;
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
              drag === i
                ? "border-primary opacity-40"
                : it.failed
                  ? "border-red-400"
                  : "border-hairline"
            }`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={it.url} alt="" className="pointer-events-none h-full w-full object-cover" />
            {/* 실패 타일 — 자리를 지키고 '다시 올리기'를 준다. 여러 장을 올렸을 때
                **어느 사진이 실패했는지**가 보이는 게 핵심(전엔 타일이 사라져 알 수 없었다). */}
            {it.failed && (
              <button
                type="button"
                onClick={() => onRetry?.(i)}
                className="absolute inset-0 flex flex-col items-center justify-center gap-0.5 bg-ink/65 px-1 text-center text-white"
              >
                <span className="text-[11px] font-semibold leading-tight">{it.failed}</span>
                <span className="text-[11px] underline underline-offset-2">다시 올리기</span>
              </button>
            )}
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
            {/* ⭐첫 장이 대표 사진 = 검색 결과 썸네일. 어느 게 대표인지 화면에 안 적혀 있어서
                순서를 바꿔야 할 이유조차 모르고 지나쳤다(QA #9). */}
            {i === 0 && items.length > 1 && (
              <span className="absolute left-1 top-1 z-10 rounded-pill bg-ink/60 px-1.5 text-[10px] font-medium text-white">
                대표
              </span>
            )}
            {/* ⭐순서 바꾸기 ← → — **HTML5 드래그는 터치에서 아예 안 먹는다.**
                모바일에선 전부 지우고 다시 올리는 것 말곤 방법이 없었다(QA #9).
                데스크탑에도 같이 둔다 — 드래그가 되더라도 한 칸씩 옮기는 건 버튼이 정확하다. */}
            {items.length > 1 && (
              <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-0.5 bg-ink/55 py-0.5">
                <button
                  type="button"
                  onClick={() => onReorder(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`${i + 1}번째 사진을 앞으로`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-[13px] leading-none text-white disabled:opacity-30"
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => onReorder(i, i + 1)}
                  disabled={i === items.length - 1}
                  aria-label={`${i + 1}번째 사진을 뒤로`}
                  className="flex h-7 w-7 items-center justify-center rounded-sm text-[13px] leading-none text-white disabled:opacity-30"
                >
                  →
                </button>
              </div>
            )}
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
      {/* ⚠️ 안내를 기기별로 가른다 — 전엔 "끌어서 순서를 바꿀 수 있어요"가 모바일에도 떠서
          **되지 않는 조작을 반복하게** 만들었다(QA #9). 드래그 안내는 데스크탑에만. */}
      {items.length > 1 && (
        <>
          <p className="mt-1.5 hidden text-[12px] text-faint sm:block">
            끌어서, 또는 ← → 버튼으로 순서를 바꿀 수 있어요. 첫 번째 사진이 대표로 보여요.
          </p>
          <p className="mt-1.5 text-[12px] text-faint sm:hidden">
            ← → 버튼으로 순서를 바꿀 수 있어요. 첫 번째 사진이 대표로 보여요.
          </p>
        </>
      )}
    </div>
  );
}
