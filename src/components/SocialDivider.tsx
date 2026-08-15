"use client";
// 「간편 로그인」 구분선 — /login·/signup 공용. 이메일 로그인 영역과 소셜 버튼을 갈라준다.
//
// ⭐ 왜 필요한가 (대표 지시 08-15)
//    로그인 버튼 바로 아래에 소셜 버튼이 붙어 있으면 **버튼 세 개가 한 덩어리**로 보여서
//    "무엇을 눌러야 하는지"가 안 읽힌다. 선 하나로 "여기부터는 다른 방법"이라고 알려준다.
//
// 🚨 소셜 버튼이 하나도 안 켜져 있으면 **선만 덩그러니 남는다.**
//    그래서 각 버튼이 내보내는 enabled 플래그를 보고 스스로 사라진다 —
//    이 판정을 페이지에 복사해 두면 조건이 갈라져 언젠가 어긋난다(플래그는 한 곳에서만 읽는다).
import { kakaoButtonEnabled } from "./KakaoButton";
import { googleButtonEnabled } from "./GoogleButton";

export function SocialDivider({ label = "간편 로그인" }: { label?: string }) {
  if (!kakaoButtonEnabled && !googleButtonEnabled) return null;

  return (
    // aria-hidden — 스크린리더에는 장식선이 아니라 아래 버튼들이 그대로 읽히면 된다.
    // 시각적 구분이 목적이라 의미 계층(heading)을 만들지 않는다.
    <div aria-hidden="true" className="mt-7 flex items-center gap-3">
      <span className="h-px flex-1 bg-hairline" />
      <span className="text-[13px] text-faint">{label}</span>
      <span className="h-px flex-1 bg-hairline" />
    </div>
  );
}
