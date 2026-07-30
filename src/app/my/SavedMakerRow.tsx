"use client";

// 찜한 콜라보 목록 행 — 클릭 시 소개서로 이동, 하트 클릭 시 찜 해제(낙관적 제거).
import { useState, useTransition } from "react";
import Link from "next/link";
import { setMakerSavedAction } from "@/lib/actions";

export function SavedMakerRow({
  makerId,
  slug,
  name,
  oneLiner,
}: {
  makerId: number;
  slug: string;
  name: string;
  oneLiner?: string;
}) {
  const [removed, setRemoved] = useState(false);
  const [pending, start] = useTransition();

  const unsave = () => {
    setRemoved(true); // 낙관적 제거
    start(async () => {
      const r = await setMakerSavedAction(makerId, false);
      if (r.error) {
        setRemoved(false); // 롤백
        alert(r.error);
      }
    });
  };

  if (removed) return null;

  return (
    <div className="flex items-center gap-2 rounded-md border border-hairline bg-surface px-4 py-3">
      <Link href={`/m/${slug}`} className="min-w-0 flex-1 text-left">
        {/* MakerRow와 같은 사다리(제목 17 / 보조 14) — 두 탭의 행이 형제라 서로 달라지면 안 된다 */}
        <p className="truncate text-[17px] font-medium text-ink">{name}</p>
        {oneLiner && <p className="mt-0.5 truncate text-[14px] text-mute">{oneLiner}</p>}
      </Link>
      <button
        type="button"
        onClick={unsave}
        disabled={pending}
        aria-label="찜 해제"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-red-500 hover:bg-surface-soft disabled:opacity-50"
      >
        <svg viewBox="0 0 24 24" className="h-[22px] w-[22px]" fill="currentColor" stroke="currentColor" strokeWidth="1.8">
          <path d="M12 20.5l-7.19-7.12a4.6 4.6 0 0 1 6.5-6.5l.69.68.69-.68a4.6 4.6 0 1 1 6.5 6.5L12 20.5z" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}
