"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction, checkSignupDuplicatesAction } from "@/lib/auth-actions";
import { uploadPhoto } from "@/lib/upload";
import { Avatar } from "@/components/Avatar";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { Field, authInputCls } from "@/components/Field";
import { PasswordInput } from "@/components/PasswordInput";
import { GoogleButton } from "@/components/GoogleButton";
import { validatePassword, formatPhone } from "@/lib/validation";

export default function SignupPage() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [phone, setPhone] = useState("");
  const [brandName, setBrandName] = useState("");
  const [image, setImage] = useState(""); // Storage 업로드 URL
  const [imgUploading, setImgUploading] = useState(false);
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState("");
  const [dup, setDup] = useState({ email: false, phone: false, brandName: false });

  // 입력 완료 ~1초 후 이메일·휴대폰·브랜드명 중복검사 (마지막 타이핑 기준 디바운스)
  useEffect(() => {
    const emailOk = /^\S+@\S+\.\S+$/.test(email.trim());
    const phoneReady = phone.replace(/\D/g, "").length >= 10;
    const brandReady = brandName.trim().length > 0;
    if (!emailOk && !phoneReady && !brandReady) {
      setDup({ email: false, phone: false, brandName: false });
      return;
    }
    const t = setTimeout(async () => {
      const r = await checkSignupDuplicatesAction({
        email: emailOk ? email.trim() : undefined,
        phone: phoneReady ? phone.trim() : undefined,
        brandName: brandReady ? brandName.trim() : undefined,
      });
      setDup(r);
    }, 500);
    return () => clearTimeout(t);
  }, [email, phone, brandName]);

  const DUP_MSG = {
    email: "이미 이 이메일로 가입한 계정이 있어요.",
    phone: "이미 이 번호로 가입한 계정이 있어요.",
    brandName: "이미 같은 이름으로 가입한 계정이 있어요.",
  };
  const hasDup = dup.email || dup.phone || dup.brandName;

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

  const validate = (): string => {
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return "이메일 형식을 확인해주세요.";
    const pwErr = validatePassword(password);
    if (pwErr) return pwErr;
    if (password !== password2) return "비밀번호가 서로 달라요.";
    if (!phone.trim()) return "휴대폰번호를 입력해주세요.";
    if (!brandName.trim()) return "브랜드명을 입력해주세요.";
    // 중복은 버튼을 잠그는 대신 여기서 잡는다 — 각 칸 옆 안내는 스크롤을 내리면 안 보인다(QA #17).
    // 에러 문구는 제출 버튼 바로 위에 뜨므로 "왜 안 되는지"가 누른 자리에서 보인다.
    if (dup.email) return DUP_MSG.email;
    if (dup.phone) return DUP_MSG.phone;
    if (dup.brandName) return DUP_MSG.brandName;
    if (!agree) return "서비스 이용약관에 동의해주세요.";
    return "";
  };

  const submit = () =>
    start(async () => {
      const v = validate();
      if (v) {
        setErr(v);
        return;
      }
      setErr("");
      const r = await signUpAction({
        email,
        password,
        phone,
        brandName,
        profileImage: image,
      });
      if (r.error) {
        setErr(r.error);
        return;
      }
      // 완료 얼럿은 로그인 페이지에서 표시(가입 페이지 모달은 서버액션 리렌더에 취약)
      router.replace("/login?welcome=1");
    });

  return (
    <main className="mx-auto w-full max-w-[400px] px-4 py-14 sm:px-6">
      <h1 className="text-[24px] font-bold leading-[1.25] tracking-[-0.025em] text-ink">회원가입</h1>
      <p className="mt-2 text-[15px] text-mute">브랜드 계정을 만들고 소개서를 관리해보세요.</p>

      {/* ⭐<form> — Enter 제출 + 비밀번호 매니저가 '가입 폼'으로 인식(new-password면 '강력한 비번 제안'이 뜬다).
          ⚠️form 안 <button>은 기본 submit이라 '지우기'·'보기' 같은 건 type="button"이어야 한다(확인 완료). */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!pending && !imgUploading) submit();
        }}
      >
      <div className="mt-6 space-y-4">
        <Field label="이메일" htmlFor="signup-email">
          <input
            id="signup-email"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@brand.com"
            className={authInputCls}
          />
          {dup.email && <p className="mt-1.5 text-[14px] text-red-600">{DUP_MSG.email}</p>}
        </Field>
        <Field label="비밀번호" htmlFor="signup-password">
          <PasswordInput
            id="signup-password"
            name="new-password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상, 특수문자 1개 이상"
            className={authInputCls}
          />
        </Field>
        <Field label="비밀번호 확인" htmlFor="signup-password2">
          {/* 확인칸도 new-password — 매니저가 '같은 새 비번'으로 인식해 양쪽에 함께 채워준다 */}
          <PasswordInput
            id="signup-password2"
            name="new-password-confirm"
            autoComplete="new-password"
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="한 번 더 입력해주세요"
            className={authInputCls}
          />
        </Field>
        <Field label="휴대폰번호" htmlFor="signup-phone">
          <input
            id="signup-phone"
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
          {dup.phone && <p className="mt-1.5 text-[14px] text-red-600">{DUP_MSG.phone}</p>}
        </Field>
        <Field label="브랜드명" htmlFor="signup-brand">
          <input
            id="signup-brand"
            name="organization"
            autoComplete="organization"
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="예: 캔버스가든"
            className={authInputCls}
          />
          {dup.brandName && <p className="mt-1.5 text-[14px] text-red-600">{DUP_MSG.brandName}</p>}
        </Field>
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
        <div className="flex items-center justify-between gap-2">
          <label className="flex cursor-pointer items-start gap-2 text-[14px] text-body">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--color-primary,theme(colors.lime.400))]"
            />
            <span>
              서비스 이용약관을 확인했고 동의합니다. <span className="text-faint">(필수)</span>
            </span>
          </label>
          {/* 약관 전문 — 새 탭으로 열어 폼 입력 보존 */}
          <Link
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded-md border border-hairline bg-surface px-2.5 py-1 text-[13px] font-medium text-mute hover:text-ink"
          >
            보기
          </Link>
        </div>
      </div>

      {err && <p className="mt-3 text-[14px] text-red-600">{err}</p>}
      <button
        type="submit"
        // disabled는 pending/업로드 계열만 — 중복(hasDup)으로 막으면 안내가 화면 위쪽이라
        // 스크롤을 내린 상태에선 "왜 안 눌리지"만 남는다. 제출 앞단에서 잡아 말해준다(QA #17).
        disabled={pending || imgUploading}
        className="mt-5 h-12 w-full rounded-md bg-primary text-[16px] font-medium text-primary-on disabled:opacity-50"
      >
        {pending ? "가입 중…" : "가입하기"}
      </button>
      </form>
      {/* 플래그 off면 아무것도 안 그린다(기본 off 배포). <form> 밖이라 제출과 섞이지 않는다 */}
      <GoogleButton className="mt-2" />
      <p className="mt-4 text-center text-[14px] text-mute">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-primary-on underline-offset-2 hover:underline">
          로그인
        </Link>
      </p>

      {pending && <LoadingOverlay label="계정을 만들고 있어요…" />}
    </main>
  );
}


