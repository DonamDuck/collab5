"use client";

// 재설정 메일 링크 랜딩 — 브라우저 클라이언트가 URL의 code를 세션으로 교환한 뒤 새 비번 저장.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validation";
import { PasswordInput } from "@/components/PasswordInput";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  const submit = () =>
    start(async () => {
      const pwErr = validatePassword(pw);
      if (pwErr) {
        setErr(pwErr);
        return;
      }
      if (pw !== pw2) {
        setErr("비밀번호가 서로 달라요.");
        return;
      }
      setErr("");
      const supabase = createBrowserAuthClient();
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) {
        setErr("재설정에 실패했어요. 메일의 링크로 다시 접속해주세요.");
        return;
      }
      await supabase.auth.signOut();
      router.push("/login");
    });

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">새 비밀번호 설정</h1>
      <div className="mt-5 space-y-3">
        <PasswordInput
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="새 비밀번호 (8자 이상, 특수문자 포함)"
          className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
        />
        <PasswordInput
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          placeholder="새 비밀번호 확인"
          className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || !pw || !pw2}
        className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
      >
        {pending ? "저장 중…" : "비밀번호 변경"}
      </button>
    </main>
  );
}
