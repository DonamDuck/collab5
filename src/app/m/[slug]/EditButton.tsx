"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyMakerPasswordAction } from "@/lib/actions";
import { ScrollLock } from "@/components/ScrollLock";

// 우상단 수정 버튼 — 소유자면 바로 / 비회원생성(비번 있음)이면 비번 모달 / 회원생성(비번 없음)이면 로그인 필요 얼럿.
export function EditButton({
  slug,
  isOwner,
  hasPassword,
}: {
  slug: string;
  isOwner: boolean;
  hasPassword: boolean; // 비회원이 관리비번으로 만든 카드 = true. 회원 계정으로 만든 카드 = false.
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loginNeeded, setLoginNeeded] = useState(false);
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
    if (hasPassword) {
      setOpen(true); // 비회원 관리비번 카드 → 비번 모달
      return;
    }
    setLoginNeeded(true); // 회원 계정으로 만든 카드 → 로그인 필요
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-xs font-medium text-mute hover:border-border-strong hover:text-ink print:hidden"
      >
        수정
      </button>
      {loginNeeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <ScrollLock />
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
            <p className="text-base font-bold text-ink">로그인이 필요해요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-mute">
              이 소개서는 회원 계정으로 만들어졌어요. 수정하려면 만든 계정으로 로그인해주세요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setLoginNeeded(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
              >
                취소
              </button>
              <button
                type="button"
                // 로그인 후 보던 소개서로 복귀 — 홈으로 떨어지면 다시 찾아와야 한다
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/m/${slug}`)}`)}
                className="h-11 flex-1 rounded-md bg-primary text-sm font-medium text-primary-on"
              >
                로그인하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <ScrollLock />
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
