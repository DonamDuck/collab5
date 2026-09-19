"use client";

import { Suspense, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAction } from "@/lib/auth-actions";
import { authEnvReady } from "@/lib/supabase/client";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Field, authInputCls } from "@/components/Field";
import { PasswordInput } from "@/components/PasswordInput";
import { GoogleButton } from "@/components/GoogleButton";
import { KakaoButton } from "@/components/KakaoButton";
import { SocialDivider } from "@/components/SocialDivider";
// 🔒돌아갈 주소 검사는 가입·소셜 온보딩과 한 벌이다(09-18 밤 QA SC-05). 검사 규칙과 그 이유는 그 파일 머리말에.
import { safeRedirect } from "@/lib/safe-redirect";

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6" />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [welcome, setWelcome] = useState(searchParams.get("welcome") === "1");
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  // 🔙가입으로 건너가도 돌아갈 곳을 들고 간다(09-18 밤 QA SC-05). 전엔 가입 링크가 `/signup`뿐이라
  //   하루 팝업 공간에서 「로그인하고 신청하기」를 누른 손님이 가입을 거치면 그 공간을 잃고 홈에 떨어졌다.
  const back = safeRedirect(searchParams.get("redirect"));

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
      // 로그인 후 복귀 경로 — 우리 사이트 안 주소만 허용(오픈 리다이렉트 방지). 없으면 홈.
      //   이동 직전이라 실제 origin으로 한 번 더 본다.
      const dest = safeRedirect(searchParams.get("redirect"), window.location.origin);
      router.replace(dest); // push+refresh 중복 제거 — 서버 렌더가 새 세션 헤더 반영
    });

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-[24px] font-bold leading-[1.25] tracking-[-0.025em] text-ink">로그인</h1>
      <p className="mt-2 text-[15px] text-mute">브랜드를 소개하고 새로운 콜라보를 시작해보세요.</p>
      {!authEnvReady && (
        <p className="mt-4 rounded-md bg-surface-soft px-3 py-2.5 text-[14px] text-mute">
          로그인 설정이 아직 준비되지 않았어요. (로컬 환경)
        </p>
      )}
      {/* ⭐<form>으로 감싸는 이유(07-29): ①Enter로 제출 ②비밀번호 매니저(1Password·iCloud·크롬)가
          '로그인 폼'으로 인식해 저장·자동입력이 뜬다 ③모바일 키보드에 '이동' 키가 생긴다.
          autoComplete 토큰이 없으면 매니저가 필드를 못 알아본다 — username/current-password가 그 계약이다.
          ⚠️form 안 <button>은 기본 type=submit이라, 제출이 아닌 버튼은 반드시 type="button"(아래 카카오). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit(); // 연타·IME 확정 Enter가 이중 제출로 새지 않게
        }}
      >
        {/* 라벨은 글자를 쳐도 남는다 — placeholder만 쓰면 입력 시작과 동시에 무슨 칸인지 사라진다(QA #19) */}
        <div className="mt-6 space-y-4">
          <Field label="이메일" htmlFor="login-email">
            <input
              id="login-email"
              // 🧪개발 빌드만 text — 로컬 테스트 로그인 아이디 `collab5`가 이메일 형식 검사에 걸리지 않게.
              //   NODE_ENV는 빌드 때 상수로 박히므로 운영 번들엔 "email"만 남는다(auth-actions §로컬 테스트 로그인).
              type={process.env.NODE_ENV === "development" ? "text" : "email"}
              name="email"
              autoComplete="username"
              // 📱아이폰 키보드가 첫 글자를 대문자로 올리고 철자를 고친다. 이메일 칸에서는 그게 전부 오타다.
              //   운영의 `type="email"`은 이 셋을 알아서 끄지만 개발 빌드의 `text`는 안 꺼서 명시한다(09-15 실측).
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="user@email.com"
              className={authInputCls}
            />
          </Field>
          <Field label="비밀번호" htmlFor="login-password">
            <PasswordInput
              id="login-password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해주세요"
              className={authInputCls}
            />
          </Field>
        </div>
        {err && <p className="mt-2 text-[14px] text-red-600">{err}</p>}
        <button
          type="submit"
          disabled={pending}
          className="mt-4 h-12 w-full rounded-md bg-primary text-[16px] font-medium text-primary-on disabled:opacity-50"
        >
          {pending ? "로그인 중…" : "로그인"}
        </button>
      </form>
      {/* ⭐회원가입·비밀번호 찾기를 **로그인 버튼 바로 아래**로 올린다(대표 지시 08-15).
          이메일 로그인에 딸린 보조 동선이라 그 옆에 붙어야 읽히고, 소셜 버튼과 섞이면
          "로그인 수단"이 넷처럼 보인다. */}
      <div className="mt-4 flex items-center justify-center gap-3 text-[14px]">
        <Link
          href={back === "/" ? "/signup" : `/signup?redirect=${encodeURIComponent(back)}`}
          className="font-medium text-primary-on underline-offset-2 hover:underline"
        >
          회원가입
        </Link>
        <span className="text-faint">·</span>
        <Link href="/reset-password" className="text-mute underline-offset-2 hover:underline">
          비밀번호 찾기
        </Link>
      </div>
      <SocialDivider />
      {/* 플래그 off면 아무것도 안 그린다(기본 off 배포) — 각 버튼 내부에서 판정.
          카카오를 위에 두는 건 국내 사용자 기준 인지도 순서다. */}
      <KakaoButton className="mt-4" />
      <GoogleButton className="mt-2" />

      {pending && <LoadingOverlay label="로그인 중이에요…" />}

      {welcome && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-[18px] font-bold text-ink">🎉 가입이 완료됐어요!</p>
            <p className="mt-2 text-[15px] text-body">이제 로그인하고 Collab5를 시작해보세요.</p>
            <button
              type="button"
              onClick={() => setWelcome(false)}
              className="mt-5 h-12 w-full rounded-md bg-primary text-[16px] font-medium text-primary-on"
            >
              로그인하기
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
