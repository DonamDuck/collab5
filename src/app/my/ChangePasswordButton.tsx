"use client";

import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/auth-actions";

// 비밀번호 변경 — 비밀번호 찾기와 동일하게 이메일로 변경 링크 발송.
export function ChangePasswordButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setErr("");
      const r = await requestPasswordResetAction(email);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setSent(true);
    });

  if (sent)
    return (
      <p className="text-sm text-mute">
        {email}로 비밀번호 변경 링크를 보냈어요. 메일함을 확인해주세요.
      </p>
    );

  return (
    <div>
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="text-sm text-mute underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
      >
        {pending ? "메일 보내는 중…" : "비밀번호 변경"}
      </button>
      {err && <p className="mt-1 text-sm text-red-600">{err}</p>}
    </div>
  );
}
