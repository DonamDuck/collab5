"use client";
// 카카오 로그인 버튼 — /login·/signup 공용. **표준 리디렉션 방식(signInWithOAuth).**
//
// ⭐ 왜 구글처럼 토큰 방식으로 안 가는가
//    구글이 GIS 토큰 방식인 건 취향이 아니라 **동의 화면 문구** 때문이었다 —
//    구글은 동의 화면에 앱 이름이 아니라 **리디렉션 URI의 호스트**를 띄워서
//    "<ref>.supabase.co에 로그인"이라고 보였다(GoogleButton.tsx 머리말 참고).
//    카카오는 다르다. 동의 화면에 **카카오 개발자 콘솔에 등록한 앱 이름·아이콘**을 띄우고
//    리디렉션 호스트를 노출하지 않는다. 그래서 평범한 리디렉션으로 충분하다.
//    (주소창엔 왕복 중 supabase 주소가 잠깐 스친다 — 동의 화면 문구와는 별개다.)
//
// ⭐ 돌아오는 곳이 `/welcome`인 이유
//    카카오는 닉네임(설정에 따라 이메일)만 준다. 우리 계정은 **브랜드명·휴대폰번호가 필수**라
//    구글과 똑같이 온보딩 분기점으로 보낸다. `/welcome`은 이미 이 왕복을 전제로 짜여 있다 —
//    돌아온 순간 URL이 `?code=…`이고 세션 쿠키는 아직 없어서, 클라이언트 컴포넌트로
//    코드 교환(detectSessionInUrl)을 기다린다. 이미 프로필이 채워진 사람은 거기서 홈으로 넘어간다.
//    🚨 홈(`/`)으로 돌려보내면 안 된다 — 홈엔 그 교환을 기다리는 클라 코드가 없고,
//       온보딩을 건너뛰어 **브랜드명·휴대폰이 빈 계정**이 생긴다.
//
// ⚠️ 라벨이 "카카오로 계속하기"인 이유: 소셜 로그인은 **가입과 로그인이 한 버튼**이다.
//    "시작하기"라 쓰면 이미 가입한 사람에게 어색하다(구글 버튼의 continue_with와 같은 이유).
//
// ⚠️ 높이 h-12 = **51px**이다(이 저장소는 루트 폰트가 17px). GoogleButton의 겉박스(`[data-gsi]`)도
//    51px이라 둘이 나란히 서면 정확히 맞는다. 눈대중으로 48을 넣으면 어긋난다.
import { useState } from "react";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";

const KAKAO_ON = process.env.NEXT_PUBLIC_KAKAO_ENABLED === "1";

export function KakaoButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");

  // 플래그 off거나 auth 환경이 없으면 아무것도 그리지 않는다(기본 off 배포 — 구글과 같은 규칙)
  if (!KAKAO_ON || !authEnvReady) return null;

  const signIn = async () => {
    setErr("");
    setPending(true);
    try {
      const supabase = createBrowserAuthClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        options: { redirectTo: `${window.location.origin}/welcome` },
      });
      // 성공하면 브라우저가 카카오로 떠나므로 아래는 실행되지 않는다.
      // 여기 도달했다는 건 리디렉션을 시작조차 못 했다는 뜻이다.
      if (error) {
        setErr("카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
        setPending(false);
      }
    } catch {
      setErr("카카오 로그인에 실패했어요. 잠시 후 다시 시도해주세요.");
      setPending(false);
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={signIn}
        disabled={pending}
        // 색은 카카오 지정값(면 #FEE500 / 글자 #191919 85%) — 다크 모드에서도 그대로 둔다.
        // 브랜드 버튼은 어느 테마에서든 같은 색으로 보여야 사용자가 알아본다.
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-[#FEE500] text-[16px] font-medium text-[#191919] disabled:opacity-50"
      >
        {/* 말풍선 글리프. ⚠️ 카카오 브랜드 가이드를 엄격히 따르려면 카카오가 배포하는 공식
            버튼·심볼 에셋으로 교체한다 — 여기선 외부 이미지 의존 없이 형태만 맞춰 그렸다. */}
        <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
          <path d="M12 3.5c-5.11 0-9.25 3.23-9.25 7.21 0 2.55 1.71 4.79 4.29 6.06-.19.69-.68 2.48-.78 2.87-.12.48.18.47.37.34.15-.1 2.42-1.64 3.41-2.31.63.09 1.28.14 1.96.14 5.11 0 9.25-3.23 9.25-7.1S17.11 3.5 12 3.5z" />
        </svg>
        {pending ? "카카오로 이동 중…" : "카카오로 계속하기"}
      </button>
      {/* 에러는 라이브 리전으로 — role="alert"이 아니면 스크린리더가 아무 안내도 못 듣는다 */}
      {err && (
        <p role="alert" className="mt-1.5 text-sm text-red-600">
          {err}
        </p>
      )}
    </div>
  );
}
