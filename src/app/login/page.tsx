"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction } from "@/lib/auth-actions";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";

const KAKAO_ON = process.env.NEXT_PUBLIC_KAKAO_ENABLED === "1";

export default function LoginPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  const submit = () =>
    start(async () => {
      setErr("");
      if (!email.trim() || !password) {
        setErr("이메일과 비밀번호를 입력해주세요.");
        return;
      }
      const r = await signInAction(email, password);
      if (r.error) {
        setErr(r.error);
        return;
      }
      router.push("/");
      router.refresh(); // 헤더 세션 반영
    });

  const kakao = async () => {
    const supabase = createBrowserAuthClient();
    await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: window.location.origin },
    });
  };

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">로그인</h1>
      <p className="mt-2 text-[15px] text-mute">콜라보 카드를 계정으로 관리해보세요.</p>
      {!authEnvReady && (
        <p className="mt-4 rounded-md bg-surface-soft px-3 py-2.5 text-sm text-mute">
          로그인 설정이 아직 준비되지 않았어요. (로컬 환경)
        </p>
      )}
      <div className="mt-6 space-y-3">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="이메일"
          className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) submit();
          }}
          placeholder="비밀번호"
          className="h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus"
        />
      </div>
      {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="mt-4 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
      >
        {pending ? "로그인 중…" : "로그인"}
      </button>
      {KAKAO_ON && (
        <button
          type="button"
          onClick={kakao}
          className="mt-2 h-12 w-full rounded-md bg-[#FEE500] text-base font-medium text-[#191919]"
        >
          카카오로 시작하기
        </button>
      )}
      <div className="mt-5 flex items-center justify-center gap-3 text-sm">
        <a href="/signup" className="font-medium text-primary-on underline-offset-2 hover:underline">
          회원가입
        </a>
        <span className="text-faint">·</span>
        <a href="/reset-password" className="text-mute underline-offset-2 hover:underline">
          비밀번호 찾기
        </a>
      </div>
    </main>
  );
}
