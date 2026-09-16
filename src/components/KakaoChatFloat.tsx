// 홈 오른쪽 아래에 떠 있는 카카오톡 상담 버튼 (2026-09-16 대표)
//
// ⭐누르면 채널 홈이 아니라 «바로 1:1 채팅»이 열린다(`KAKAO_CHAT_URL`). 물어보려고 누른 사람에게
//   채널 소개 화면을 한 번 더 지나가게 하지 않는다.
// 📍홈에만 둔다(대표 지시). 하루 가게 상세처럼 «화면 아래 고정 바»가 있는 페이지에 같이 띄우면
//   폰에서 주 버튼을 덮는다 — 09-15에 우리 코멘트 위젯이 결제 버튼을 덮었던 것과 같은 병이다.
// 🛠개발 서버에선 코멘트 위젯이 같은 자리(오른쪽 아래)에 떠서, 로컬에서만 그 위로 올린다. 운영엔 위젯이 없다.
// 🎨카카오 노랑(#FEE500) 위에 검은 말풍선 — 카카오가 정한 얼굴이라 우리 키위로 바꾸지 않는다(`KakaoButton`과 같은 규율).
import { KAKAO_CHAT_URL } from "@/lib/site";

export function KakaoChatFloat() {
  const lifted = process.env.NODE_ENV === "development";
  return (
    <a
      href={KAKAO_CHAT_URL}
      target="_blank"
      rel="noreferrer"
      aria-label="카카오톡으로 문의하기"
      title="카카오톡으로 문의하기"
      className={`fixed right-4 z-40 flex size-[56px] items-center justify-center rounded-full bg-[#FEE500] shadow-[0_4px_14px_rgba(0,0,0,0.18)] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#191919] sm:right-6 print:hidden ${
        lifted ? "bottom-[84px]" : "bottom-5 sm:bottom-6"
      }`}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[28px]" fill="#191919">
        <path d="M12 3.5c-5.25 0-9.5 3.33-9.5 7.44 0 2.66 1.78 4.99 4.46 6.31l-.9 3.3c-.08.3.26.54.52.37l3.94-2.6c.48.06.97.09 1.48.09 5.25 0 9.5-3.33 9.5-7.47S17.25 3.5 12 3.5Z" />
      </svg>
    </a>
  );
}
