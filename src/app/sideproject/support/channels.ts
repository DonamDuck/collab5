// 후원 창구 한 곳 — 후원하기 페이지(/sideproject/support)가 이 파일만 읽는다. 앱 상세는 그 페이지로 링크만 건다.
// 앱마다 따로 두지 않는다. 창구가 바뀌면 여기 한 줄만 고친다.
//
// ⭐url은 대표가 계정을 만들면 채운다. 빈 문자열이면 그 줄은 화면에서 숨는다.
//   · kakaopay = 카카오페이 송금 링크(qr.kakaopay.com) · buymeacoffee = Buy Me a Coffee 페이지(해외 카드)
// ⭐계좌는 한국어 페이지에만 보인다(11-05 대표, 산사 후원 창구를 보고 결정). 그전 규칙은 「계좌번호는 어디에도 적지 않는다」였고,
//   「통장 묶기」 위험은 대표에게 말씀드린 뒤 대표가 공개를 골랐다. 복사 버튼은 숫자만 복사한다(은행 앱 칸에 그대로 붙게).
// ⛔version.json에 넣지 말 것 — 앱 업데이터가 그 파일을 엄격하게 읽어서 모양이 바뀌면 깨진다.
// 토스는 뺐다(10-19 대표): 토스아이디(toss.me)가 2024년에 종료돼 공개해 둘 받기 링크가 없다. 계좌가 그 자리를 맡는다.
export type ChannelId = "kakaopay" | "buymeacoffee";

export const SUPPORT_CHANNELS: Record<ChannelId, { url: string }> = {
  kakaopay: { url: "" },
  buymeacoffee: { url: "" },
};

export const SUPPORT_ACCOUNT = { bank: "하나은행", holder: "송영덕", number: "748-910659-67307" };
