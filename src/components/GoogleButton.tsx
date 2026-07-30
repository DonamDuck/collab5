"use client";
// 구글 OAuth 버튼 — /login·/signup 공용.
//
// ⚠️ 플래그가 꺼져 있으면 **아무것도 렌더하지 않는다**(기본 off로 배포).
//    NEXT_PUBLIC_* 은 빌드 타임에 값이 박히므로 런타임 토글이 아니다 — 켜려면 재배포가 필요하다.
//
// ⚠️ 라벨이 "Google로 계속하기"인 이유: 소셜 로그인은 **가입과 로그인이 한 버튼**이다.
//    "가입"이라 쓰면 기존 유저에게, "로그인"이라 쓰면 신규 유저에게 거짓말이 된다.
//
// ⚠️ 카카오는 origin으로 돌아오지만 **구글은 `/welcome`으로 보낸다.**
//    구글은 이름·이메일만 주는데 우리 계정은 브랜드명·휴대폰번호가 필수라서,
//    들어오는 길목에서 한 번 받아야 한다(`/welcome` = 온보딩 분기점).
import { useState, useTransition } from "react";
import { createBrowserAuthClient } from "@/lib/supabase/client";

const GOOGLE_ON = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === "1";

export function GoogleButton({ className = "" }: { className?: string }) {
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  if (!GOOGLE_ON) return null;

  const go = () =>
    start(async () => {
      setErr("");
      try {
        const supabase = createBrowserAuthClient();
        const { error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/welcome` },
        });
        // 성공하면 구글로 이동하므로 아래는 실패했을 때만 도달한다.
        if (error) setErr("구글 연결에 실패했어요. 잠시 후 다시 시도해주세요.");
      } catch {
        setErr("구글 연결에 실패했어요. 잠시 후 다시 시도해주세요.");
      }
    });

  return (
    <>
      {/* ⚠️ <form> 안에 놓일 수 있으니 type="button" 필수 — 안 붙이면 기본값이 submit이라 폼이 제출된다 */}
      <button
        type="button"
        onClick={go}
        disabled={pending}
        className={`flex h-12 w-full items-center justify-center gap-2.5 rounded-md border border-border-strong bg-surface text-base font-medium text-ink disabled:opacity-50 ${className}`}
      >
        <GoogleMark />
        Google로 계속하기
      </button>
      {/* 에러는 라이브 리전으로 — role="alert"이 아니면 스크린리더가 아무 안내도 못 듣는다 */}
      {err && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {err}
        </p>
      )}
    </>
  );
}

/** 구글 공식 4색 G 마크(인라인 SVG — 외부 요청 0) */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.79 2.72v2.26h2.9c1.7-1.57 2.69-3.88 2.69-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.46-.8 5.95-2.18l-2.9-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}
