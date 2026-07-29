"use client";

// 재설정 메일 링크 랜딩 — 브라우저 클라이언트가 URL의 code를 세션으로 교환한 뒤 새 비번 저장.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createBrowserAuthClient } from "@/lib/supabase/client";
import { validatePassword } from "@/lib/validation";
import { PasswordInput } from "@/components/PasswordInput";
import { Field, authInputCls } from "@/components/Field";

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState("");

  const submit = () => {
    // 빈 칸으로 눌러도 **왜 안 되는지 말해준다** — disabled로 막으면 "왜 안 눌리지"만 남는다(QA #17)
    if (!pw || !pw2) {
      setErr("새 비밀번호를 두 칸 모두 입력해주세요.");
      return;
    }
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
  };

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">새 비밀번호 설정</h1>
      {/* <form> — Enter 제출 + 매니저의 '강력한 비번 제안'·저장 갱신이 동작(new-password 토큰) */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit();
        }}
      >
      {/* ⭐두 칸이 **똑같이 생겼다** — placeholder만 쓰면 글자를 치는 순간 어느 쪽이 '확인'인지 사라진다.
          네 화면 중 라벨이 가장 절실한 곳(QA #19). */}
      <div className="mt-5 space-y-4">
        <Field label="새 비밀번호" htmlFor="new-password">
          <PasswordInput
            id="new-password"
            name="new-password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            placeholder="8자 이상, 특수문자 포함"
            className={authInputCls}
          />
        </Field>
        <Field label="새 비밀번호 확인" htmlFor="new-password-confirm">
          <PasswordInput
            id="new-password-confirm"
            name="new-password-confirm"
            autoComplete="new-password"
            value={pw2}
            onChange={(e) => setPw2(e.target.value)}
            placeholder="한 번 더 입력해주세요"
            className={authInputCls}
          />
        </Field>
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        type="submit"
        disabled={pending}
        className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
      >
        {pending ? "저장 중…" : "비밀번호 변경"}
      </button>
      </form>
    </main>
  );
}
