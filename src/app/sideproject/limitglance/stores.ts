// 브라우저 확장 스토어 주소. 빈 문자열이면 그 버튼은 「준비 중」으로 잠긴다.
// ⚠️version.json에 넣지 않는다 — 앱 업데이터가 그 파일을 엄격하게 읽어서 모양이 바뀌면 깨진다.
export const EXTENSION_STORES: { chrome: string; edge: string; whale: string } = {
  chrome: "",
  edge: "",
  whale: "",
};
