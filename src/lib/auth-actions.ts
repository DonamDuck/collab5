"use server";

import { redirect } from "next/navigation";
import { authEnabled, createAuthClient, getSessionUser } from "./supabase/server";
import { upsertProfile, findDuplicates, getProfile, type DuplicateFlags } from "./profiles";
import { validatePassword } from "./validation";
import { notifySignup, type SignupOrigin } from "./notify";

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
  let userId: number | null = null;
  try {
    userId = await upsertProfile({
      uuid: data.user.id,
      brandName: input.brandName.trim(),
      phone: input.phone.trim(),
      email: input.email.trim(),
      profileImage: input.profileImage,
    });
  } catch {
    return { error: "프로필 저장에 실패했어요. 로그인 후 다시 시도해주세요." };
  }
  // 대표 알림 — 프로필 저장이 끝난 뒤에만. 실패해도 가입은 성공으로 둔다(notify가 스스로 삼킨다).
  await notifySignup({
    userId,
    brandName: input.brandName.trim(),
    email: input.email.trim(),
    origin: "email",
  });
  // 스펙: 자동 로그인 X → 세션 정리 후 /login으로 보냄(클라에서 이동)
  await supabase.auth.signOut();
  return {};
}

// ── 소셜 로그인 온보딩(/welcome) ─────────────────────────────────────────────
// 구글은 이름·이메일만 준다. 우리 계정은 **브랜드명·휴대폰번호가 필수**이고, 특히 브랜드명은
// 제안 시트의 인사말·발신자 표시에 그대로 쓰여서 비면 곧바로 화면에 티가 난다.
// 그래서 "일단 통과시키고 나중에 채우기"가 아니라 들어오는 길목에서 한 번 받는다.

export interface OnboardingState {
  /** 서버가 세션을 확인했나 (쿠키 미도달 시 false) */
  authed: boolean;
  /** 브랜드명·휴대폰번호가 둘 다 있음 = 온보딩 불필요 → 곧장 홈으로 */
  done: boolean;
  email: string;
  brandName: string;
  phone: string;
  /** 이미 저장된 로고/브랜드 사진 — 온보딩 화면의 미리보기 초기값. 없으면 "" */
  profileImage: string;
}

// 해요체 — 사용자에게 보이는 문구는 이 저장소 톤을 따른다(위 DUP_MSG는 기존 가입 흐름 전용).
const ONBOARD_DUP = {
  phone: "이미 이 번호로 가입한 계정이 있어요.",
  brandName: "이미 같은 이름으로 가입한 계정이 있어요.",
} as const;
const ONBOARD_EXPIRED = "로그인 정보를 확인하지 못했어요. 다시 로그인해주세요.";

/** /welcome 진입 판정 — 세션 여부 + 프로필이 이미 채워졌는지. */
export async function getOnboardingStateAction(): Promise<OnboardingState> {
  const blank: OnboardingState = {
    authed: false,
    done: false,
    email: "",
    brandName: "",
    phone: "",
    profileImage: "",
  };
  if (!authEnabled()) return blank;
  const user = await getSessionUser();
  if (!user) return blank;
  const profile = await getProfile(user.id);
  const brandName = profile?.brandName?.trim() ?? "";
  const phone = profile?.phone?.trim() ?? "";
  return {
    authed: true,
    // ⭐ 둘 다 있어야 done — 다시 로그인할 때마다 온보딩이 뜨면 안 된다.
    done: !!(brandName && phone),
    email: profile?.email || user.email || "",
    brandName,
    phone,
    profileImage: profile?.profileImage ?? "",
  };
}

/** /welcome 제출 — 중복 확인 후 프로필 채우기. 소유자는 세션에서만 얻는다(클라 값 신뢰 금지). */
export async function completeOnboardingAction(input: {
  brandName: string;
  phone: string;
  /** 선택 — 로고/브랜드 사진. 안 올리면 undefined로 오고, 그때는 기존 값을 그대로 지킨다. */
  profileImage?: string;
  /**
   * 선택 — **소셜 쪽에서 이메일이 안 온 경우에만** 화면에서 받아 넘긴다.
   * ⚠️ 이미 이메일이 있으면 이 값은 무시한다 — 로그인 계정과 프로필이 어긋나면 안 된다.
   *    (카카오는 동의항목·검수 상태에 따라 이메일을 안 줄 수 있고, 사용자가 선택 동의를 거부해도 빈 값이 온다.)
   */
  email?: string;
}): Promise<{ error?: string }> {
  if (!authEnabled()) return { error: NO_AUTH_MSG };
  const user = await getSessionUser();
  if (!user) return { error: ONBOARD_EXPIRED };

  const brandName = input.brandName.trim();
  const phone = input.phone.trim();
  if (!brandName) return { error: "브랜드명을 입력해주세요." };
  if (!phone) return { error: "휴대폰번호를 입력해주세요." };

  // excludeUuid=본인 — 재시도로 다시 들어왔을 때 자기 값과 부딪히지 않게 한다.
  const dup = await findDuplicates({ phone, brandName, excludeUuid: user.id });
  if (dup.phone) return { error: ONBOARD_DUP.phone };
  if (dup.brandName) return { error: ONBOARD_DUP.brandName };

  // upsert라 email·profileImage를 안 넘기면 기존 값이 지워진다 — 있던 값을 그대로 다시 실어준다.
  const existing = await getProfile(user.id);
  // ⭐가입 알림은 **이번에 처음 온보딩을 마친 사람**에게만 보낸다.
  //   이 액션은 재시도·브랜드명 수정으로 여러 번 들어올 수 있어서(위 excludeUuid 주석 참고),
  //   그냥 걸면 같은 사람으로 알림이 반복된다. brandName이 비어 있었다 = 아직 온보딩 전이었다.
  const isNewSignup = !existing?.brandName;
  // 이메일 출처는 **기존 프로필 → 세션 → 화면 입력** 순. 앞의 둘이 있으면 화면 값은 쓰지 않는다
  // (읽기 전용으로 보여준 값이라 어차피 같아야 하고, 다르다면 그게 사고다).
  const known = existing?.email || user.email || "";
  const typed = input.email?.trim() ?? "";
  const email = known || typed;
  // 소셜이 이메일을 안 줬는데 화면에서도 안 받았다면 여기서 막는다 — 빈 이메일로 프로필이 굳으면
  // 알림 메일도, 나중에 계정을 찾는 길도 없어진다.
  if (!email) return { error: "이메일을 입력해주세요." };
  if (!known && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "이메일 형식을 확인해주세요." };
  }
  let userId: number | null = null;
  try {
    userId = await upsertProfile({
      uuid: user.id,
      brandName,
      phone,
      email,
      // ⚠️ `undefined`(안 넘김) 와 `""`(화면에서 '지우기'를 누름)는 다른 뜻이다.
      //    upsert라 안 실어주면 기존 값이 통째로 날아가므로, 안 넘긴 경우에만 기존 값을 되싣는다.
      profileImage:
        input.profileImage !== undefined ? input.profileImage.trim() : existing?.profileImage || "",
    });
  } catch {
    return { error: "저장에 실패했어요. 잠시 후 다시 시도해주세요." };
  }
  // ⭐가입 경로는 **세션의 provider**로 가른다(08-15 카카오 추가 때 배선). 예전엔 "google"이 박혀 있어서
  //   어떤 소셜로 들어와도 메일에 "구글 로그인"으로 찍혔다 — 그때 남긴 예고 주석을 여기서 갚는다.
  //   ⚠️ 모르는 provider가 오면 라벨이 깨지느니 "이메일 가입"으로 떨어뜨린다(알림은 어떻게든 나가야 한다).
  if (isNewSignup) {
    const provider = user.app_metadata?.provider;
    const origin: SignupOrigin = provider === "google" || provider === "kakao" ? provider : "email";
    await notifySignup({ userId, brandName, email, origin });
  }
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
  // 같은 이메일 재발송 쿨다운(보안) — "you can only request this after N seconds"
  if (/security purposes|only request this after|after \d+ seconds/i.test(msg)) {
    const m = msg.match(/after (\d+) seconds/i);
    return m
      ? `방금 메일을 보냈어요. 약 ${m[1]}초 뒤에 다시 시도할 수 있어요.`
      : "방금 메일을 보냈어요. 잠시 후 다시 시도할 수 있어요.";
  }
  if (/rate limit|too many/i.test(msg)) return "메일 발송이 잠시 제한됐어요. 잠시 후 다시 시도해주세요.";
  return "요청에 실패했어요. 잠시 후 다시 시도해주세요.";
}
