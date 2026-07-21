"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signUpAction, checkSignupDuplicatesAction } from "@/lib/auth-actions";
import { uploadPhoto } from "@/lib/upload";
import { Avatar } from "@/components/Avatar";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { PasswordInput } from "@/components/PasswordInput";
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
    if (!agree) return "개인정보 수집 및 이용에 동의해주세요.";
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
      <h1 className="text-2xl font-bold tracking-tight text-ink">회원가입</h1>
      <p className="mt-2 text-[15px] text-mute">브랜드 계정을 만들고 소개서를 관리해보세요.</p>

      <div className="mt-6 space-y-4">
        <Field label="이메일">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@brand.com"
            className={inputCls}
          />
          {dup.email && <p className="mt-1.5 text-sm text-red-600">{DUP_MSG.email}</p>}
        </Field>
        <Field label="비밀번호">
          <PasswordInput
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8자 이상, 특수문자 1개 이상"
            className={inputCls}
          />
        </Field>
        <Field label="비밀번호 확인">
          <PasswordInput
            value={password2}
            onChange={(e) => setPassword2(e.target.value)}
            placeholder="한 번 더 입력해주세요"
            className={inputCls}
          />
        </Field>
        <Field label="휴대폰번호">
          <input
            type="tel"
            inputMode="numeric"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            maxLength={13}
            className={inputCls}
          />
          {dup.phone && <p className="mt-1.5 text-sm text-red-600">{DUP_MSG.phone}</p>}
        </Field>
        <Field label="브랜드명">
          <input
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            placeholder="예: 캔버스가든"
            className={inputCls}
          />
          {dup.brandName && <p className="mt-1.5 text-sm text-red-600">{DUP_MSG.brandName}</p>}
        </Field>
        <Field label="로고 또는 브랜드 사진" optional>
          <div className="flex items-center gap-3">
            <Avatar image={image || undefined} name={brandName || "?"} size={48} />
            <label className="inline-flex h-9 cursor-pointer items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink">
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
                className="text-sm text-faint hover:text-ink"
              >
                지우기
              </button>
            )}
          </div>
        </Field>
        <label className="flex cursor-pointer items-start gap-2 text-sm text-body">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[var(--color-primary,theme(colors.lime.400))]"
          />
          <span>
            개인정보 수집 및 이용에 동의합니다. <span className="text-faint">(필수)</span>
          </span>
        </label>
      </div>

      {err && <p className="mt-3 text-sm text-red-600">{err}</p>}
      <button
        type="button"
        onClick={submit}
        disabled={pending || imgUploading || hasDup}
        className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
      >
        {pending ? "가입 중…" : "가입하기"}
      </button>
      <p className="mt-4 text-center text-sm text-mute">
        이미 계정이 있나요?{" "}
        <Link href="/login" className="font-medium text-primary-on underline-offset-2 hover:underline">
          로그인
        </Link>
      </p>

      {pending && <LoadingOverlay label="계정을 만들고 있어요…" />}
    </main>
  );
}

const inputCls =
  "h-11 w-full rounded-sm border border-hairline bg-surface px-3 text-base text-ink outline-none placeholder:text-faint focus:border-focus";

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-[15px] font-medium text-body">
        {label}
        {optional && <span className="ml-1 font-normal text-faint">· 선택</span>}
      </label>
      {children}
    </div>
  );
}
