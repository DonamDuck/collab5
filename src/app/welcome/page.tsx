"use client";

// 소셜 로그인 온보딩 — 구글 인증 뒤 **부족한 프로필을 한 스텝으로** 채운다.
//
// ⭐ 왜 클라이언트 컴포넌트인가
//    구글에서 막 돌아온 순간의 URL은 `/welcome?code=…`이고, 세션 쿠키는 **아직 없다.**
//    코드를 세션으로 바꾸는 건 브라우저 Supabase 클라이언트다(`detectSessionInUrl`).
//    서버 컴포넌트로 게이트를 짜면 그 교환이 끝나기 전에 렌더돼서 **막 로그인한 사람을
//    /login으로 튕겨낸다.** 그래서 판정을 클라에서 시작한다 — `getSession()`이 내부 초기화
//    (=코드 교환)를 기다려주는 게 핵심이다.
//    단, 프로필 조회·저장은 서버액션으로만 한다(uuid는 세션에서, 클라 값 신뢰 금지).
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";
import { completeOnboardingAction, getOnboardingStateAction } from "@/lib/auth-actions";
import { Field, authInputCls } from "@/components/Field";
import { LoadingDots } from "@/components/LoadingDots";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { formatPhone } from "@/lib/validation";

type Phase = "checking" | "form" | "expired";

export default function WelcomePage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [brandName, setBrandName] = useState("");
  const [phone, setPhone] = useState("");
  const [err, setErr] = useState("");
  const brandRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // 진입 판정 ①세션 없음 → /login ②이미 채워짐 → / ③비었음 → 폼
  useEffect(() => {
    let alive = true;
    (async () => {
      // 로컬(auth env 없음)엔 세션 자체가 있을 수 없다 → 비로그인과 같은 처리
      if (!authEnvReady) {
        router.replace("/login");
        return;
      }
      let hasSession = false;
      try {
        const supabase = createBrowserAuthClient();
        const { data } = await supabase.auth.getSession(); // OAuth 코드 교환을 기다린다
        hasSession = !!data.session?.user;
      } catch {
        hasSession = false;
      }
      if (!alive) return;
      if (!hasSession) {
        router.replace("/login");
        return;
      }
      const st = await getOnboardingStateAction();
      if (!alive) return;
      if (!st.authed) {
        // 브라우저엔 세션이 있는데 서버가 못 봤다 = 쿠키가 안 실렸다. 조용히 튕기지 않고 말해준다.
        setPhase("expired");
        return;
      }
      if (st.done) {
        router.replace("/"); // 다시 로그인할 때마다 이 화면이 뜨면 안 된다
        return;
      }
      setEmail(st.email);
      setBrandName(st.brandName);
      setPhone(st.phone);
      setPhase("form");
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  const submit = () =>
    start(async () => {
      // ⚠️ 빈 칸이어도 버튼을 잠그지 않는다 — 눌렀을 때 **왜 안 되는지** 말해주고 커서를 보낸다.
      const b = brandName.trim();
      const p = phone.trim();
      if (!b || !p) {
        setErr(!b ? "브랜드명을 입력해주세요." : "휴대폰번호를 입력해주세요.");
        (!b ? brandRef : phoneRef).current?.focus();
        return;
      }
      setErr("");
      const r = await completeOnboardingAction({ brandName: b, phone: p });
      if (r.error) {
        setErr(r.error);
        if (/이름/.test(r.error)) brandRef.current?.focus();
        else if (/번호/.test(r.error)) phoneRef.current?.focus();
        return;
      }
      router.replace("/"); // 서버 렌더가 새 프로필을 반영
    });

  if (phase === "checking") {
    return (
      <main className="mx-auto flex w-full max-w-[400px] flex-col items-center px-4 py-24 sm:px-6">
        <LoadingDots />
        <p className="mt-5 text-[15px] text-mute">로그인 정보를 확인하고 있어요…</p>
      </main>
    );
  }

  if (phase === "expired") {
    return (
      <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink">다시 로그인해주세요</h1>
        <p role="alert" className="mt-2 text-[15px] text-mute">
          로그인 정보를 확인하지 못했어요. 한 번 더 시도하면 대부분 해결돼요.
        </p>
        <Link
          href="/login"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
        >
          로그인하러 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-ink">거의 다 왔어요</h1>
      <p className="mt-2 text-[15px] text-mute">
        소개서에 쓸 브랜드 이름과 연락받을 번호만 알려주세요.
      </p>

      {/* <form> — Enter로 제출되고, 비밀번호 매니저가 organization·tel을 알아본다 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit();
        }}
      >
        <div className="mt-6 space-y-4">
          {/* 구글에서 온 값 — 보여주기만 한다(여기서 바꾸면 로그인 계정과 어긋난다) */}
          <Field label="이메일" htmlFor="welcome-email">
            <input
              id="welcome-email"
              type="email"
              value={email}
              readOnly
              className={`${authInputCls} bg-surface-soft text-mute`}
            />
          </Field>
          <Field label="브랜드명" htmlFor="welcome-brand">
            <input
              id="welcome-brand"
              ref={brandRef}
              name="organization"
              autoComplete="organization"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              placeholder="예: 캔버스가든"
              className={authInputCls}
            />
            <p className="mt-1.5 text-[13px] text-faint">
              소개서와 콜라보 제안의 인사말에 이 이름이 그대로 나와요.
            </p>
          </Field>
          <Field label="휴대폰번호" htmlFor="welcome-phone">
            <input
              id="welcome-phone"
              ref={phoneRef}
              type="tel"
              name="phone"
              autoComplete="tel"
              inputMode="numeric"
              value={phone}
              onChange={(e) => setPhone(formatPhone(e.target.value))}
              placeholder="010-0000-0000"
              maxLength={13}
              className={authInputCls}
            />
          </Field>
        </div>

        {/* 라이브 리전 — 없으면 스크린리더는 왜 막혔는지 못 듣는다 */}
        {err && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {err}
          </p>
        )}
        <button
          type="submit"
          // disabled는 pending 계열만 — 빈 칸으로 눌러도 이유를 문구로 말해준다(확정 폴리시)
          disabled={pending}
          className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
        >
          {pending ? "저장 중…" : "시작하기"}
        </button>
      </form>

      {pending && <LoadingOverlay label="프로필을 저장하고 있어요…" />}
    </main>
  );
}
