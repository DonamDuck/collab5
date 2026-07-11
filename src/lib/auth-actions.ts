"use server";

import { redirect } from "next/navigation";
import { authEnabled, createAuthClient } from "./supabase/server";
import { upsertProfile, findDuplicates, type DuplicateFlags } from "./profiles";
import { validatePassword } from "./validation";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://collab5.vercel.app";
const NO_AUTH_MSG = "로그인 설정이 아직 준비되지 않았어요. (환경변수 미설정)";

export interface SignUpInput {
  email: string;
  password: string;
  phone: string;
  brandName: string;
  profileImage: string; // base64 data URL 또는 ''
}

/** 가입 폼 실시간 중복검사(이메일·휴대폰·브랜드명). 비어있지 않은 필드만 검사. */
export async function checkSignupDuplicatesAction(p: {
  email?: string;
  phone?: string;
  brandName?: string;
}): Promise<DuplicateFlags> {
  if (!authEnabled()) return { email: false, phone: false, brandName: false };
  return findDuplicates(p);
}

// 중복검사 메시지(클라·서버 동일 문구)
const DUP_MSG = {
  email: "동일한 이메일로 가입된 계정이 있습니다.",
  phone: "같은 휴대폰 번호로 가입된 계정이 있습니다.",
  brandName: "동일한 이름으로 가입한 계정이 있습니다.",
} as const;

export async function signUpAction(input: SignUpInput): Promise<{ error?: string }> {
  if (!authEnabled()) return { error: NO_AUTH_MSG };
  const pwErr = validatePassword(input.password);
  if (pwErr) return { error: pwErr };
  // 서버측 방어: 클라 실시간 검사를 우회한 경우에도 중복 가입 차단
  const dup = await findDuplicates({
    email: input.email,
    phone: input.phone,
    brandName: input.brandName,
  });
  if (dup.email) return { error: DUP_MSG.email };
  if (dup.phone) return { error: DUP_MSG.phone };
  if (dup.brandName) return { error: DUP_MSG.brandName };
  const supabase = await createAuthClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
  });
  if (error || !data.user) return { error: friendly(error?.message) };
  try {
    await upsertProfile({
      uuid: data.user.id,
      brandName: input.brandName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      profileImage: input.profileImage,
    });
  } catch {
    return { error: "프로필 저장에 실패했어요. 로그인 후 다시 시도해주세요." };
  }
  // 스펙: 자동 로그인 X → 세션 정리 후 /login으로 보냄(클라에서 이동)
  await supabase.auth.signOut();
  return {};
}

export async function signInAction(
  email: string,
  password: string
): Promise<{ error?: string }> {
  if (!authEnabled()) return { error: NO_AUTH_MSG };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { error: "이메일 또는 비밀번호를 확인해주세요." };
  return {};
}

export async function signOutAction(): Promise<void> {
  if (authEnabled()) {
    const supabase = await createAuthClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}

export async function requestPasswordResetAction(email: string): Promise<{ error?: string }> {
  if (!authEnabled()) return { error: NO_AUTH_MSG };
  const supabase = await createAuthClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${SITE_URL}/reset-password/update`,
  });
  if (error) return { error: friendly(error.message) };
  return {};
}

function friendly(msg?: string): string {
  if (!msg) return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
  if (/already registered/i.test(msg)) return "이미 가입된 이메일이에요.";
  if (/at least 6/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
  if (/rate limit/i.test(msg)) return "요청이 많아요. 잠시 후 다시 시도해주세요.";
  return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
}
