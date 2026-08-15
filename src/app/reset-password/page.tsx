"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { requestPasswordResetAction } from "@/lib/auth-actions";
import { Field, authInputCls } from "@/components/Field";

export default function ResetPasswordPage() {
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState(false);

  const submit = () => {
    if (!email.trim()) {
      setErr("가입한 이메일을 입력해주세요.");
      return;
    }
    start(async () => {
      setErr("");
      const r = await requestPasswordResetAction(email);
      if (r.error) {
        setErr(r.error);
        return;
      }
      setSent(true);
    });
  };

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">비밀번호 찾기</h1>
      {sent ? (
        /* ⚠️ 전엔 여기서 입력칸·버튼이 통째로 사라져 **재시도 경로가 없었다**(QA #23) —
           주소를 잘못 적었거나 메일이 안 오면 새로고침 말곤 방법이 없었다.
           면색도 primary-pale(Kiwi)이었는데, 브랜드색이 '성공'을 뜻하게 되면 Kiwi 희소성이 무너진다. */
        <>
          <p className="mt-4 rounded-md bg-success-pale px-3 py-3 text-[15px] leading-relaxed text-body">
            <b className="font-medium text-ink">{email}</b>{"\u00a0"}로 재설정 링크를 보냈어요. 메일함을 확인해주세요.
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-3 h-11 w-full rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
          >
            다른 이메일로 다시 보내기
          </button>
        </>
      ) : (
        <>
          <p className="mt-2 text-[15px] text-mute">
            가입한 이메일을 입력하면 재설정 링크를 보내드려요.
          </p>
          {/* <form> — Enter 제출 + 매니저가 저장된 계정 이메일을 채워준다(username 토큰) */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!pending) submit();
            }}
          >
          <div className="mt-5">
            <Field label="이메일" htmlFor="reset-email">
              <input
                id="reset-email"
                type="email"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="collab@collab5.co.kr"
                className={authInputCls}
              />
            </Field>
          </div>
          {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
          {/* disabled는 pending에만 — 빈 칸으로 눌러도 **왜 안 되는지 말해준다**(확정 폴리시, QA #17) */}
          <button
            type="submit"
            disabled={pending}
            className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
          >
            {pending ? "보내는 중…" : "재설정 링크 보내기"}
          </button>
          </form>
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
