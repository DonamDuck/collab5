"use client";

// ⚠️ 임시 미리보기 — '초본 완성 얼럿'만 실제 컴포넌트로 띄워 대표가 등록 과정 없이 확인용.
// 얼럿 마크업은 register/page.tsx의 showDraftDone 모달과 동일(복사본). 확인 끝나면 이 라우트 폴더 삭제 예정.
import { useState } from "react";
import { ScrollLock } from "@/components/ScrollLock";

export default function DraftDoneAlertPreview() {
  const [open, setOpen] = useState(true);

  return (
    <div className="min-h-screen bg-canvas px-4 py-6">
      {/* 뒤에 깔리는 더미 폼(맥락용 — 실제 폼 아님) */}
      <div className="mx-auto max-w-[640px] space-y-4" aria-hidden="true">
        <div className="h-7 w-48 rounded bg-surface-soft" />
        <div className="h-11 w-full rounded-md bg-surface-soft" />
        <div className="h-28 w-full rounded-md bg-surface-soft" />
        <div className="h-11 w-full rounded-md bg-surface-soft" />
        <div className="h-40 w-full rounded-md bg-surface-soft" />
      </div>

      {!open && (
        <div className="fixed inset-x-0 bottom-6 flex justify-center">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-on shadow-e2"
          >
            얼럿 다시 보기
          </button>
        </div>
      )}

      {/* ↓↓↓ register/page.tsx showDraftDone 모달과 동일 마크업 ↓↓↓ */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setOpen(false)}
        >
          <ScrollLock />
          <div
            className="relative w-full max-w-md rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-4xl leading-none" aria-hidden="true">🎉</div>
            <p className="mt-3 text-lg font-bold text-ink">소개서 초본이 준비됐어요!</p>
            <p className="mt-1.5 text-[15px] leading-relaxed text-body">
              이제 내용을 다듬어 완성해보세요.
            </p>
            <div className="mt-4 rounded-md bg-primary-pale px-4 py-3 text-left">
              <p className="text-[14px] leading-relaxed text-primary-on">
                💡 작성된 소개서에 사진을 더하면 훨씬 눈에 띄어요.
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-primary-on">
                지금 없어도, 나중에 언제든 추가할 수 있어요.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-on"
            >
              소개서 완성하러 가기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
