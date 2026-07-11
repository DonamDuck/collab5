"use client";

import { useFormStatus } from "react-dom";
import { signOutAction } from "@/lib/auth-actions";
import { LoadingOverlay } from "@/components/LoadingOverlay";

// 로그아웃 — 클릭 즉시 로딩 오버레이로 반응성 확보(서버 왕복 동안 멈춘 느낌 제거).
function Inner() {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hairline bg-surface px-3 text-sm font-medium text-mute hover:border-border-strong hover:text-ink disabled:opacity-50"
      >
        <svg viewBox="0 0 20 20" className="h-[16px] w-[16px]" fill="none" stroke="currentColor" strokeWidth="1.7">
          <path d="M8 4H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3" strokeLinecap="round" />
          <path d="M12 13.5 15.5 10 12 6.5M15 10H8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        로그아웃
      </button>
      {pending && <LoadingOverlay label="로그아웃 중이에요…" />}
    </>
  );
}

export function LogoutButton() {
  return (
    <form action={signOutAction} className="ml-auto shrink-0">
      <Inner />
    </form>
  );
}
