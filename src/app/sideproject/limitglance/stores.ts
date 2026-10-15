// 브라우저 확장 스토어 주소. 빈 문자열이면 그 버튼은 「준비 중」으로 잠긴다.
// ⚠️version.json에 넣지 않는다 — 앱 업데이터가 그 파일을 엄격하게 읽어서 모양이 바뀌면 깨진다.
// 10-15 크롬 웹스토어 심사 통과. 엣지·웨일도 크롬 웹스토어에서 깔리므로 셋 다 같은 주소다(엣지는 「다른 스토어 허용」 한 번).
const CHROME_WEB_STORE = "https://chromewebstore.google.com/detail/limitglance/fdfmiecfifgcdhelepeclfkmknkhgdnc";
export const EXTENSION_STORES: { chrome: string; edge: string; whale: string } = {
  chrome: CHROME_WEB_STORE,
  edge: CHROME_WEB_STORE,
  whale: CHROME_WEB_STORE,
};
