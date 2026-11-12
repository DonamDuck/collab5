// 한국어 문안. 1팀이 쓴 문장 그대로다(10-15). 창구 칸은 11-05 산사 후원 창구 모양(계좌 · 카카오페이 · BMC)으로 바꿨다. ⛔영어판을 고치다가 여기 문장을 바꾸지 말 것.
// 풋터는 MonitorAlign 한국어 풋터를 그대로 옮겼다(사적인 프로젝트 페이지마다 같은 사실을 적는다).
import type { Copy } from "./types";

export const ko: Copy = {
  eyebrow: "딴짓",
  title: "후원하기",
  lead: "여기 있는 앱은 전부 무료예요. 가입도 광고도 없어요. 써 보시고 도움이 됐다면 커피 한 잔 값으로 응원해 주세요.",
  channelsTitle: "후원하는 방법",
  account: { copy: "복사", copied: "복사했어요" },
  rows: [
    {
      id: "kakaopay",
      label: "카카오페이",
      action: "후원하기",
      qr: { hint: "휴대폰 카메라로 찍으면 카카오페이가 열려요.", close: "닫기" },
    },
    { id: "buymeacoffee", label: "Buy Me a Coffee", action: "후원하기", sub: "해외 카드" },
  ],
  soon: "준비 중",
  note: "후원은 선택이에요. 안 하셔도 모든 기능을 그대로 쓰실 수 있어요.",
  appsTitle: "후원받는 앱",
  footer: "콜랩5를 만드는 메이커가 자기 필요로 만든 도구예요. 콜랩5 서비스와는 별개예요.",
};
