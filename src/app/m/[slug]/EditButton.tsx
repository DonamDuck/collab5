"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { verifyMakerPasswordAction } from "@/lib/actions";
import { useDismissable } from "@/components/useDismissable";
import { PasswordInput } from "@/components/PasswordInput";

// 우상단 수정 버튼 — 소유자면 바로 / 주인 있는 남의 카드면 로그인 얼럿 / 주인 없는 비번 카드면 비번 모달.
export function EditButton({
  slug,
  isOwner,
  hasOwner,
  hasPassword,
}: {
  slug: string;
  isOwner: boolean;
  hasOwner: boolean; // 어떤 계정에든 귀속된 카드 = true. 비번만 있는 미귀속 카드 = false.
  hasPassword: boolean; // 비회원이 관리비번으로 만든 카드 = true. 회원 계정으로 만든 카드 = false.
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loginNeeded, setLoginNeeded] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  // 얼럿·비번 확인창 — 딤 클릭으론 안 닫힘(대표 정책), ESC는 허용.
  // initialFocus: 열자마자 비번 칸에 커서가 들어간다(전엔 마우스로 칸을 한 번 눌러야 했다).
  const loginDialog = useDismissable(loginNeeded, { onClose: () => setLoginNeeded(false), overlayClose: false });
  const pwDialog = useDismissable(open, { onClose: () => setOpen(false), overlayClose: false, initialFocus: 'input[type="password"]' });
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
    // ⭐주인 판정이 비번보다 먼저다(08-06). 순서가 반대면 귀속된 카드에서도 옛 비번 모달이 떠서,
    //   남의 소개서를 비번으로 고칠 수 있는 것처럼 보인다(서버도 같이 막았다).
    if (hasOwner) {
      setLoginNeeded(true); // 이미 누군가의 카드 → 그 계정으로 로그인
      return;
    }
    if (hasPassword) {
      setOpen(true); // 주인 없는 비회원 관리비번 카드 → 비번 모달
      return;
    }
    setLoginNeeded(true); // 회원 계정으로 만든 카드 → 로그인 필요
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-mute hover:border-border-strong hover:text-ink print:hidden"
      >
        수정
      </button>
      {loginNeeded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...loginDialog.overlayProps}>
          <div {...loginDialog.panelProps} className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
            <p className="text-[16px] font-bold break-keep text-ink">로그인이 필요해요</p>
            <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-mute">
              이 소개서는 계정에 연결되어 있어요. 수정하려면 연결된 계정으로 로그인해주세요.
            </p>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setLoginNeeded(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
              >
                취소
              </button>
              <button
                type="button"
                // 로그인 후 보던 소개서로 복귀 — 홈으로 떨어지면 다시 찾아와야 한다
                onClick={() => router.push(`/login?redirect=${encodeURIComponent(`/m/${slug}`)}`)}
                className="h-11 flex-1 rounded-md bg-primary text-[14px] font-medium text-primary-on"
              >
                로그인하러 가기
              </button>
            </div>
          </div>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4" {...pwDialog.overlayProps}>
          <div {...pwDialog.panelProps} className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 shadow-e2">
            <p className="text-[16px] font-bold text-ink">소개서 수정</p>
            <p className="mt-1.5 text-[14px] text-mute">소개서 관리 비밀번호를 입력해주세요.</p>
            <PasswordInput
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.nativeEvent.isComposing) go();
              }}
              placeholder="비밀번호"
              wrapperClassName="mt-4"
              className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus"
            />
            {err && <p className="mt-2 text-[14px] text-red-600">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={go}
                disabled={pending || !pw.trim()}
                className="h-11 flex-1 rounded-md bg-primary text-[14px] font-medium text-primary-on disabled:opacity-50"
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
