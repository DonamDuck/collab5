// 후원 창구 한 곳 — 후원하기 페이지(/sideproject/support)가 이 파일만 읽는다. 앱 상세는 그 페이지로 링크만 건다.
// 앱마다 따로 두지 않는다. 창구가 바뀌면 여기 한 줄만 고친다.
//
// ⭐url은 대표가 계정을 만들면 채운다. 빈 문자열이면 그 버튼은 「준비 중」으로 잠긴다.
//   · toss = 토스 송금 링크 · kakaopay = 카카오페이 송금 링크 · buymeacoffee = Buy Me a Coffee 페이지(해외 카드)
// ⛔계좌번호는 어디에도 적지 않는다(대표 결정 보류, 권하지 않음). 링크형 창구만.
// ⛔version.json에 넣지 말 것 — 앱 업데이터가 그 파일을 엄격하게 읽어서 모양이 바뀌면 깨진다.
export type ChannelId = "toss" | "kakaopay" | "buymeacoffee";

export const SUPPORT_CHANNELS: Record<ChannelId, { url: string }> = {
  toss: { url: "" },
  kakaopay: { url: "" },
  buymeacoffee: { url: "" },
};
