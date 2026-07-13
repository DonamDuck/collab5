"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteMakerAction } from "@/lib/actions";

// /my 소개서 행 — 카드 영역 클릭 시 소개서로 이동, 수정·삭제 버튼 분리.
export function MakerRow({
  slug,
  name,
  oneLiner,
}: {
  slug: string;
  name: string;
  oneLiner?: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const del = () =>
    start(async () => {
      const r = await deleteMakerAction(slug);
      if (r.error) {
        alert(r.error);
        return;
      }
      setConfirming(false);
      router.refresh();
    });

  return (
    <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-surface-soft">
      {/* 카드 본문 클릭 → 소개서 (Link=prefetch로 전환 빠름) */}
      <Link href={`/m/${slug}`} className="min-w-0 flex-1 text-left">
        <p className="truncate text-[15px] font-medium text-ink">{name}</p>
        {oneLiner && <p className="truncate text-sm text-mute">{oneLiner}</p>}
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href={`/register?edit=${slug}`}
          className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink"
        >
          수정
        </a>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          aria-label="삭제"
          className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface hover:text-red-600"
        >
          <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-lg font-bold text-ink">소개서를 삭제할까요?</p>
            <p className="mt-2 text-[15px] leading-relaxed text-body">
              ‘{name}’ 소개서가 영구히 삭제돼요. 되돌릴 수 없어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={pending}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={del}
                disabled={pending}
                className="h-11 flex-1 rounded-md bg-red-600 text-sm font-medium text-white disabled:opacity-50"
              >
                {pending ? "삭제 중…" : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
