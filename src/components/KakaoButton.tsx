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
// ⚠️ 라벨은 **"카카오로 시작하기"** — 대표가 스크린샷으로 지정(08-15).
//    2팀이 구글 버튼의 `continue_with`("Google로 계속하기")와 맞추려고 "계속하기"로 바꿨었는데
//    되돌렸다. 카카오 쪽 관용 문구가 "시작하기"라 사용자가 그걸 더 알아본다.
//    → 두 버튼의 어미가 다른 건 **의도된 것**이다. 통일하겠다고 임의로 바꾸지 말 것.
//
// ⚠️ 높이 h-12 = **51px**이다(이 저장소는 루트 폰트가 17px). GoogleButton의 겉박스(`[data-gsi]`)도
//    51px이라 둘이 나란히 서면 정확히 맞는다. 눈대중으로 48을 넣으면 어긋난다.
import { useState } from "react";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";

const KAKAO_ON = process.env.NEXT_PUBLIC_KAKAO_ENABLED === "1";

/**
 * 이 버튼이 실제로 그려지는가 — **「간편 로그인」 구분선이 이걸 보고 뜬다.**
 * ⚠️ 아래 조기 return과 **같은 조건**이어야 한다. 어긋나면 버튼 없는 구분선만 남는다.
 */
export const kakaoButtonEnabled = KAKAO_ON && authEnvReady;

export function KakaoButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const [err, setErr] = useState("");

  // 플래그 off거나 auth 환경이 없으면 아무것도 그리지 않는다(기본 off 배포 — 구글과 같은 규칙)
  if (!kakaoButtonEnabled) return null;

  const signIn = async () => {
    setErr("");
    setPending(true);
    try {
      const supabase = createBrowserAuthClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "kakao",
        // 🚨🚨 **`scopes`로 요청 항목을 줄이려 하지 마라 — 안 줄어든다**(08-15 KOE205 사고에서 확인).
        //    Supabase(GoTrue)의 카카오 프로바이더는 기본 3종을 **항상** 넣고, 우리가 넘긴 scope는
        //    거기에 **더해질 뿐**이다(대체가 아니다). 소스 실측:
        //      oauthScopes := []string{"account_email", "profile_image", "profile_nickname"}
        //      if scopes != "" { oauthScopes = append(oauthScopes, ...) }
        //    → `scopes: "profile_nickname"`을 넣어도 account_email이 그대로 나가고, 카카오 콘솔의
        //      [동의항목]에 그게 「사용 안 함」이면 로그인 화면 대신 **KOE205**가 뜬다.
        //    ⭐그래서 해결은 코드가 아니라 **콘솔**이다 — 위 3종이 모두 「사용 안 함」이 아니어야 한다.
        //      그런데 `account_email`은 **비즈니스 앱 전환 뒤에야** 켤 수 있다(08-15 신청, 3일 소요).
        //      즉 **전환이 끝나기 전에는 카카오 로그인을 켤 수 없다.** 플래그를 내려두는 게 맞다.
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
        {/* 카카오톡 말풍선 심볼 — 가로로 넓은 타원 + 왼쪽 아래 꼬리(공식 심볼 비율).
            ⚠️ 인라인 SVG인 이유: 외부 이미지를 물면 로드 실패 시 노란 면에 글자만 남고,
               다크/고대비 모드에서 래스터 이미지가 겉돈다. currentColor라 글자색과 항상 같이 간다.
            ⚠️ 카카오 브랜드 가이드를 엄격히 적용해야 할 일이 생기면 카카오가 배포하는
               공식 버튼 에셋으로 교체한다(그때도 색·문구는 아래 그대로 쓰면 된다). */}
        <svg width="19" height="19" viewBox="0 0 18 18" aria-hidden="true" fill="currentColor">
          <path d="M9 1C4.03 1 0 4.13 0 8c0 2.5 1.67 4.7 4.18 5.94-.18.66-.67 2.47-.77 2.85-.12.48.18.47.37.34.15-.1 2.4-1.63 3.37-2.29.6.09 1.22.13 1.85.13 4.97 0 9-3.13 9-7S13.97 1 9 1z" />
        </svg>
        {pending ? "카카오로 이동 중…" : "카카오로 시작하기"}
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
