"use client";
// 크롤 결과 리빌 — "이런 이야기들을 찾았어요" 카드 스택.
// 카드별 [이 내용으로 담기]/[건너뛰기]. 빈손이면 부모가 아예 렌더 안 함.
// 처리된 카드는 내부 Set으로 렌더 제외 — 전 카드 처리 시 자동 onDone.
import { useState } from "react";

export interface RevealCard {
  key: string;            // "seeks" | "story" | "activity-0" | "collab-0" | "block-metrics" ...
  sectionLabel: string;   // 기존 질문 문장
  preview: string;        // 내용 프리뷰(최대 3줄 line-clamp)
  reason: string;         // "인스타그램에서 봤어요"
}

export function RevealStep({ cards, onAccept, onSkip, onDone }: {
  cards: RevealCard[];
  onAccept: (key: string) => void;
  onSkip: (key: string) => void;
  onDone: () => void;
}) {
  // 처리(담기/건너뛰기)된 카드 key — 렌더에서 제외.
  const [handled, setHandled] = useState<Set<string>>(new Set());
  const visible = cards.filter((c) => !handled.has(c.key));

  // 카드 처리 후 남은 카드가 없으면 자동 onDone.
  const handle = (key: string, action: (key: string) => void) => {
    action(key);
    const next = new Set(handled);
    next.add(key);
    setHandled(next);
    if (cards.every((c) => next.has(c.key))) onDone();
  };

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onDone} />
      <div className="absolute inset-x-0 bottom-0 mx-auto max-w-[640px] overflow-hidden rounded-t-2xl bg-surface shadow-xl">
        <div className="flex max-h-[82vh] flex-col">
          {/* ── 헤더 ── */}
          <div className="flex items-start justify-between p-4 pb-3">
            <div>
              <p className="text-[17px] font-bold text-ink">이런 이야기들을 찾았어요</p>
              <p className="mt-0.5 text-[13px] text-mute">웹에서 찾은 내용이에요. 확인하고 담아주세요.</p>
            </div>
            <button
              type="button"
              onClick={onDone}
              aria-label="닫기"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-mute hover:bg-surface-soft hover:text-ink"
            >
              ✕
            </button>
          </div>

          {/* ── 카드 스택(스크롤) ── */}
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-2">
            {visible.map((c) => (
              <div key={c.key} className="rounded-md border-2 border-primary p-4">
                <p className="text-[15px] font-bold text-ink">{c.sectionLabel}</p>
                <p className="mt-1.5 line-clamp-3 text-[14px] leading-relaxed text-mute">{c.preview}</p>
                <p className="mt-1.5 text-[13px] text-faint">{c.reason}</p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => handle(c.key, onAccept)}
                    className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-[14px] font-semibold text-primary-on"
                  >
                    이 내용으로 담기
                  </button>
                  <button
                    type="button"
                    onClick={() => handle(c.key, onSkip)}
                    className="inline-flex h-10 items-center px-2 text-[14px] text-faint hover:text-mute"
                  >
                    건너뛰기
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── 하단 고정 — 남은 카드 무시하고 폼으로 ── */}
          <div
            className="border-t border-hairline p-4"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={onDone}
              className="h-11 w-full rounded-md border border-hairline bg-surface text-[15px] font-semibold text-ink hover:bg-surface-soft"
            >
              소개서로 이동
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
