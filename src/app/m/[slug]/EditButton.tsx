"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyMakerPasswordAction } from "@/lib/actions";

// 우상단 수정 버튼 — 소유자면 바로, 아니면 비번 모달. 검증 통과 시 edit 진입.
export function EditButton({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      setErr("");
      const r = await verifyMakerPasswordAction(slug, pw);
      if (!r.ok) {
        setErr("비밀번호가 일치하지 않아요.");
        return;
      }
      // 저장 시 재검증에 쓸 비번을 같은 탭에만 임시 보관(URL 노출 X)
      try {
        sessionStorage.setItem(`edit_pw_${slug}`, pw);
      } catch {}
      router.push(`/register?edit=${slug}`);
    });

  const onClick = () => {
    if (isOwner) {
      router.push(`/register?edit=${slug}`); // 소유자는 세션으로 저장 인증
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-9 items-center gap-1 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink hover:bg-surface-soft"
      >
        수정
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
            <p className="text-base font-bold text-ink">소개서 수정</p>
            <p className="mt-1.5 text-sm text-mute">소개서 관리 비밀번호를 입력해주세요.</p>
            <input
              type="password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) go();
              }}
              placeholder="비밀번호"
              className="mt-4 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={go}
                disabled={pending || !pw.trim()}
                className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on disabled:opacity-50"
              >
                {pending ? "확인 중…" : "수정하기"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
