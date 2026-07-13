"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth-actions";

export default function ResetPasswordPage() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () =>
    start(async () => {
      setErr("");
      const r = await requestPasswordResetAction(email);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setSent(true);
    });

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">비밀번호 찾기</h1>
      {sent ? (
        <p className="mt-4 rounded-md bg-primary-pale px-3 py-3 text-[15px] leading-relaxed text-body">
          재설정 링크를 이메일로 보냈어요. 메일함을 확인해주세요.
        </p>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-mute">
            가입한 이메일을 입력하면 재설정 링크를 보내드려요.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
            }}
            placeholder="이메일"
            className="mt-5 h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
          />
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={pending || !email.trim()}
            className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
          >
            {pending ? "보내는 중…" : "재설정 링크 보내기"}
          </button>
        </>
      )}
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-mute underline-offset-2 hover:underline">
          로그인으로 돌아가기
        </Link>
      </p>
    </main>
  );
}
