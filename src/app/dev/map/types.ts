// 화면 지도의 줄 모양 (2026-09-18). 페이지 파일은 정해진 이름만 내보낼 수 있어서 따로 둔다.
/** 한 줄 = 케이스 하나로 연 화면 하나. `c`는 `MOCK_CASES`의 id, `to`는 사이트 안 경로. */
export type Row = { desc: string; c: string; to: string };
export type Screen = { title: string; path: string; note?: string; rows: Row[] };
export type Group = { id: string; title: string; intro?: string; screens: Screen[] };
/** 팝업은 주소로 못 연다. 어느 화면에서 무엇을 누르면 뜨는지만 적는다. */
export type Popup = { where: Row; button: string; title: string };
