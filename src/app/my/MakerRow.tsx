"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { deleteMakerAction, updateMakerFlagsAction } from "@/lib/actions";
import { isDemoSlug } from "@/lib/demo";

// /my 소개서 행 — 카드 클릭 시 소개서로 이동, 수정·삭제 + 검색노출·콜라보 토글(즉시 저장).
export function MakerRow({
  slug,
  name,
  oneLiner,
  collabOpen,
  searchVisible,
}: {
  slug: string;
  name: string;
  oneLiner?: string;
  collabOpen: boolean;
  searchVisible: boolean;
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
    <div className="rounded-md border border-hairline bg-surface">
      {/* 본문 + 수정·삭제 */}
      <div className="flex items-center gap-2 px-4 py-3">
        <Link href={`/m/${slug}`} className="min-w-0 flex-1 text-left">
          <p className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
            <span className="min-w-0 truncate">{name}</span>
            {isDemoSlug(slug) && (
              <span className="inline-flex h-6 shrink-0 items-center rounded-pill bg-surface-soft px-2 text-[12px] font-medium text-mute">
                🔒 미리보기 고정본
              </span>
            )}
          </p>
          {oneLiner && <p className="truncate text-sm text-mute">{oneLiner}</p>}
        </Link>

        <div className="flex shrink-0 items-center gap-1">
          <Link
            href={`/register?edit=${slug}`}
            className="rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm font-medium text-ink"
          >
            수정
          </Link>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            aria-label="삭제"
            className="flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-red-600"
          >
            <svg viewBox="0 0 20 20" className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6m2 0v9a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* 토글 행 — 클릭 즉시 저장(낙관적) */}
      <div className="flex items-center gap-5 border-t border-hairline px-4 py-2.5">
        <FlagToggle slug={slug} label="검색에 보이기" field="searchVisible" initial={searchVisible} />
        <FlagToggle slug={slug} label="콜라보 받는 중" field="collabOpen" initial={collabOpen} />
      </div>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
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

// 소형 스위치 + 라벨 — 낙관적 업데이트, 실패 시 되돌림.
function FlagToggle({
  slug,
  label,
  field,
  initial,
}: {
  slug: string;
  label: string;
  field: "collabOpen" | "searchVisible";
  initial: boolean;
}) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();

  const toggle = () => {
    const next = !on;
    setOn(next); // 낙관적
    start(async () => {
      const r = await updateMakerFlagsAction(slug, { [field]: next });
      if (r.error) {
        setOn(!next); // 롤백
        alert(r.error);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={pending}
      className="flex items-center gap-2 disabled:opacity-60"
    >
      <span
        className={`flex h-5 w-9 shrink-0 items-center rounded-pill p-[2px] transition-colors ${
          on ? "bg-primary" : "bg-border-strong"
        }`}
      >
        <span
          className={`h-4 w-4 rounded-pill bg-white transition-transform ${
            on ? "translate-x-4" : "translate-x-0"
          }`}
        />
      </span>
      <span className="text-[13px] font-medium text-body">{label}</span>
    </button>
  );
}
