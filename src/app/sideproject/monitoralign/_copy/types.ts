// 언어별 문안의 모양. 화면(view.tsx)·그림(Illustrations.tsx)·구조화 데이터(JSON-LD)가 같은 문안을 읽는다.
//
// ⭐문장 안에서 화면 속 글자(메뉴·버튼 이름)는 `**이렇게**` 감싼다. 화면에선 굵게 그리고(UiLabel),
//   JSON-LD엔 별표만 벗겨 평문으로 넣는다. 그래서 화면과 구조화 데이터의 문장이 어긋날 수 없다.

/** 쓰는 법 한 단계. `shortcutLead`가 있으면 그 뒤에 맥·윈도우 단축키 칩이 붙고, `note`는 다음 줄 문단이 된다. */
export type Step = { text: string; shortcutLead?: string; note?: string };

/** 설명 그림 속 글자. 메뉴 이름은 앱 화면 그대로다(앱 UI는 한국어·영어뿐 → 다른 언어 페이지도 영어 메뉴). */
export type FigCopy = {
  desk: string;
  mem: string;
  whyLabel: string;
  menu: [string, string, string, string];
  menuLabel: string;
  firstLabel: string;
  secondLabel: string;
  /** 정렬 뒤 앱이 띄우는 알림(앱 UI라 한국어·영어뿐). */
  pill: string;
  pillWidth: number;
  doneLabel: string;
};

export type Copy = {
  title: string;
  description: string;
  ogTitle: string;
  /** meta keywords — 구글은 안 읽지만 다른 검색엔진용으로 둔다. 화면에는 안 나온다. */
  keywords: string[];
  back: string;
  lead: string;
  downloads: { mac: [string, string]; windows: [string, string]; soon: string };
  free: string;
  autoUpdate: string;
  whyTitle: string;
  why: string[];
  howTitle: string;
  /** HowTo 구조화 데이터의 이름 */
  howToName: string;
  steps: Step[];
  undo: { text: string; custom: string };
  featuresTitle: string;
  features: string[];
  firstTitle: string;
  firstIntro: string;
  firstMac: [string, string];
  firstWin: [string, string];
  faqTitle: string;
  faq: { q: string; a: string }[];
  supportTitle: string;
  supportText: string;
  supportAbroad?: string;
  footer: string;
  macLabel: string;
  winLabel: string;
  fig: FigCopy;
};
