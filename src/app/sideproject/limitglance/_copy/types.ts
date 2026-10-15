// 언어별 문안의 모양. 화면(view.tsx)·그림(Illustrations.tsx)·구조화 데이터(JSON-LD)가 같은 문안을 읽는다.
// ⭐문장 안에서 화면 속 글자(메뉴·버튼 이름)는 `**이렇게**` 감싼다. 화면에선 굵게, JSON-LD엔 별표만 벗긴 평문.

/** 설명 그림 속 글자. 메뉴 줄은 앱 화면 그대로다(앱 UI가 한국어·영어뿐). */
export type FigCopy = {
  /** 메뉴 막대 그림: 펼친 메뉴의 줄들 */
  rows: { label: string; value?: string; sub?: boolean }[];
  meta: string;
  items: string[];
  menuLabel: string;
  /** 흐름 그림: 브라우저 → 앱 */
  browser: string;
  browserSub: string;
  app: string;
  appSub: string;
  only: string;
  flowLabel: string;
  /** 윈도우 작업 표시줄 그림 */
  trayTip: string;
  trayLabel: string;
};

export type Copy = {
  title: string;
  description: string;
  ogTitle: string;
  keywords: string[];
  back: string;
  lead: string;
  downloads: { mac: [string, string]; windows: [string, string]; soon: string };
  /** `note`는 버튼 아래 작은 글씨(엣지의 「다른 스토어 허용」 안내). 비우면 안 그린다. */
  extension: { title: string; text: string; chrome: string; edge: string; whale: string; soon: string; note: string };
  free: string;
  autoUpdate: string;
  whyTitle: string;
  why: string[];
  howTitle: string;
  howToName: string;
  steps: string[];
  menuNote: string;
  firstTitle: string;
  firstIntro: string;
  firstMac: [string, string];
  firstWin: [string, string];
  faqTitle: string;
  faq: { q: string; a: string }[];
  footer: string;
  fig: FigCopy;
};
