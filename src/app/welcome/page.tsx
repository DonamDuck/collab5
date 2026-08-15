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
import { uploadPhoto } from "@/lib/upload";
import { Avatar } from "@/components/Avatar";
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
  // ⭐소셜이 이메일을 줬는지 — **줬으면 잠그고, 안 줬으면 직접 받는다**(08-15 카카오).
  //   구글은 항상 이메일을 준다. 카카오는 동의항목·검수 상태에 따라 안 줄 수 있고,
  //   선택 동의로 두면 사용자가 거부할 수도 있다(Supabase의 "Allow users without an email"이 켜져 있다).
  //   준 값을 고치게 두면 로그인 계정과 프로필이 어긋나므로, 잠금은 그대로 유지한다.
  const [emailLocked, setEmailLocked] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [phone, setPhone] = useState("");
  const [image, setImage] = useState(""); // 선택 — 로고/브랜드 사진(가입 폼과 같은 방식)
  const [imgUploading, setImgUploading] = useState(false);
  const [err, setErr] = useState("");
  const emailRef = useRef<HTMLInputElement>(null);
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
        // 다시 로그인할 때마다 이 화면이 뜨면 안 된다.
        // 🚨**하드 내비게이션이어야 한다**(08-15 카카오에서 재현 — 2회 연속).
        //    이 경로는 **소셜 로그인 직후**라 세션이 브라우저에서만 막 생겼고, Next의
        //    **클라이언트 라우터 캐시엔 로그인 전 홈 RSC**가 그대로 남아 있다. `router.replace`로 가면
        //    세션이 멀쩡한데도 홈이 **비로그인 상태로 그려진다**(사용자에겐 "로그인이 안 됐다"로 보인다.
        //    한 번 더 로그인하면 문서를 새로 받아 되는 것도 이 때문이다).
        //    ⭐GoogleButton이 `window.location.replace`를 쓰는 이유와 **같은 버그**다(07-31 기록).
        //      로그인은 세션 경계라 문서를 새로 받는 게 맞다.
        window.location.replace("/");
        return;
      }
      setEmail(st.email);
      setEmailLocked(!!st.email); // 빈 채로 왔다 = 소셜이 안 줬다 → 이 화면에서 받는다
      setBrandName(st.brandName);
      setPhone(st.phone);
      setImage(st.profileImage);
      setPhase("form");
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  // 가입 폼(`/signup`)과 같은 방식 — 브라우저에서 400px로 줄여 Storage에 올리고 URL만 상태에 둔다.
  const onImage = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f || !f.type.startsWith("image/")) return;
    setImgUploading(true);
    try {
      setImage(await uploadPhoto(f, 400));
    } catch {
      alert("이미지 업로드에 실패했어요. 다시 시도해주세요.");
    } finally {
      setImgUploading(false);
    }
  };

  const submit = () =>
    start(async () => {
      // ⚠️ 빈 칸이어도 버튼을 잠그지 않는다 — 눌렀을 때 **왜 안 되는지** 말해주고 커서를 보낸다.
      const b = brandName.trim();
      const p = phone.trim();
      const e = email.trim();
      // 이메일이 잠겨 있지 않다 = 소셜이 안 줘서 여기서 받는 중이다. 그때만 빈 칸을 잡는다.
      if (!emailLocked && !e) {
        setErr("이메일을 입력해주세요.");
        emailRef.current?.focus();
        return;
      }
      if (!b || !p) {
        setErr(!b ? "브랜드명을 입력해주세요." : "휴대폰번호를 입력해주세요.");
        (!b ? brandRef : phoneRef).current?.focus();
        return;
      }
      setErr("");
      const r = await completeOnboardingAction({
        brandName: b,
        phone: p,
        profileImage: image,
        // 잠겨 있으면 아예 안 넘긴다 — 서버도 기존 값을 우선하지만, 보낼 이유가 없는 값은 안 보낸다.
        email: emailLocked ? undefined : e,
      });
      if (r.error) {
        setErr(r.error);
        if (/이메일/.test(r.error)) emailRef.current?.focus();
        else if (/이름/.test(r.error)) brandRef.current?.focus();
        else if (/번호/.test(r.error)) phoneRef.current?.focus();
        return;
      }
      // 위 `st.done` 분기와 같은 이유로 **하드 내비게이션**. 여기는 서버액션(completeOnboardingAction)을
      // 거쳐서 Next가 캐시를 무를 여지가 있지만, 이 경로도 결국 **소셜 로그인 직후**라 라우터 캐시에
      // 로그인 전 홈이 남아 있을 수 있다. 방금 프로필까지 새로 채웠으니 문서를 새로 받는 게 확실하다.
      window.location.replace("/");
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
        <h1 className="text-[24px] font-bold leading-[1.25] tracking-[-0.025em] text-ink">다시 로그인해주세요</h1>
        <p role="alert" className="mt-2 text-[15px] text-mute">
          로그인 정보를 확인하지 못했어요. 한 번 더 시도하면 대부분 해결돼요.
        </p>
        <Link
          href="/login"
          className="mt-6 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[16px] font-medium text-primary-on"
        >
          로그인하러 가기
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-[24px] font-bold tracking-tight text-ink">거의 다 왔어요</h1>
      <p className="mt-2 text-[15px] text-mute">
        소개서에 쓸 브랜드 이름과 연락받을 번호를 알려주세요.
      </p>

      {/* <form> — Enter로 제출되고, 비밀번호 매니저가 organization·tel을 알아본다 */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending) submit();
        }}
      >
        <div className="mt-6 space-y-4">
          {/* 소셜에서 온 값이면 보여주기만 한다(여기서 바꾸면 로그인 계정과 어긋난다).
              안 왔으면(카카오 등) 직접 받는다 — 위 emailLocked 주석 참고. */}
          <Field label="이메일" htmlFor="welcome-email">
            <input
              id="welcome-email"
              ref={emailRef}
              type="email"
              name="email"
              autoComplete="email"
              value={email}
              readOnly={emailLocked}
              onChange={emailLocked ? undefined : (e) => setEmail(e.target.value)}
              placeholder={emailLocked ? undefined : "user@email.com"}
              className={emailLocked ? `${authInputCls} bg-surface-soft text-mute` : authInputCls}
            />
            {!emailLocked && (
              <p className="mt-1.5 text-[13px] text-faint">
                콜라보 제안이나 소식을 받을 주소예요. 카카오에서 이메일을 받지 못해 여쭤봐요.
              </p>
            )}
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
          {/* 선택 — 가입 폼(`/signup`)의 블록을 그대로 가져왔다(대표 지시 07-31).
              두 입구(이메일 가입 / 구글 로그인)가 같은 모습이어야 나중에 한쪽만 손보는 사고가 안 난다.
              ⚠️ 필수로 만들지 않는다 — 온보딩은 로그인 직후의 문턱이라, 여기서 사진을 찾느라
                 멈추면 그대로 이탈이다. 안 올리면 Avatar가 브랜드명 첫 글자로 대신한다. */}
          <Field label="로고 또는 브랜드 사진" optional>
            <div className="flex items-center gap-3">
              <Avatar image={image || undefined} name={brandName || "?"} size={48} />
              <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-[14px] font-medium text-ink">
                {imgUploading ? "업로드 중…" : "이미지 선택"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => onImage(e.target.files)}
                />
              </label>
              {image && (
                <button
                  type="button"
                  onClick={() => setImage("")}
                  className="text-[14px] text-faint hover:text-ink"
                >
                  지우기
                </button>
              )}
            </div>
          </Field>
        </div>

        {/* 라이브 리전 — 없으면 스크린리더는 왜 막혔는지 못 듣는다 */}
        {err && (
          <p role="alert" className="mt-3 text-[14px] text-red-600">
            {err}
          </p>
        )}
        <button
          type="submit"
          // disabled는 pending 계열만 — 빈 칸으로 눌러도 이유를 문구로 말해준다(확정 폴리시)
          disabled={pending}
          className="mt-5 h-12 w-full rounded-md bg-primary text-[16px] font-medium text-primary-on disabled:opacity-50"
        >
          {pending ? "저장 중…" : "시작하기"}
        </button>
      </form>

      {pending && <LoadingOverlay label="프로필을 저장하고 있어요…" />}
    </main>
  );
}
