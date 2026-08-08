// 리포트 아이디어 카드 정렬 — **화면과 목록이 같은 순서를 봐야 한다**.
// 순수 함수만 둔다(서버 repo와 클라 ReportSheet가 함께 쓴다 — Gemini를 import하는 collab-report.ts는 클라에서 못 쓴다).
//
// 🪤 왜 파일을 따로 뺐나: 08-07에 정렬 규칙이 ReportSheet에만 있어서 `/my` 카드의 칩 순서가
//    시트 순서와 어긋났다(카드는 ideas 3개, 시트는 확장 2개가 위로 끼어듦 — 1팀 지적).
//    같은 규칙이 두 곳에 흩어지면 한쪽만 고쳐진다.
import type { CollabReportData } from "./types";

/** 카드 한 장이 화면에 필요로 하는 모든 것. */
export interface IdeaCard {
  title: string;
  desc: string;
  method?: string;
  /** 양쪽에 남는 것 — 주어 없는 불릿 문장들. 빈 값은 담지 않는다. */
  gains?: string[];
}

const gainsOf = (a?: string, b?: string) => [a, b].map((s) => (s ?? "").trim()).filter(Boolean);

/** 리포트 → 화면에 놓을 순서대로. **추천 2 → 기발 1 → 추천 1 → 기발 1** (+남으면 뒤에 이어붙임).
 *  ⭐대표 확정(08-06): 기발 아이디어는 **별도 섹션이 아니라 같은 섹션**에 섞는다 — 고객은 섹션이 왜 나뉘는지 모른다.
 *  🔁3차 확정(08-08): ~~태그로 위계~~ → 태그 철거(태그 없는 카드가 덜 중요해 보였다),
 *    ~~추천 전부→기발 전부~~ → **교차 배열**. 앞 2장으로 신뢰를 쌓고, 색다른 기발을 사이에 끼워
 *    리듬을 만들되 연속 2장으로 읽는 부담이 몰리지 않게 한다. */
export function orderIdeaCards(report: CollabReportData | null | undefined): IdeaCard[] {
  if (!report) return [];
  const recs: IdeaCard[] = (report.ideas ?? []).map((i) => ({
    title: i.title,
    desc: i.desc,
    method: i.method,
    gains: gainsOf(i.gainA, i.gainB), // 08-08 이전 저장본엔 없다 — 빈 배열이면 화면이 그 줄을 생략
  }));
  const novels: IdeaCard[] = (report.novelIdeas ?? []).map((n) => ({
    title: n.title,
    desc: n.desc,
    method: n.method,
    gains: gainsOf(n.gainA, n.gainB),
  }));
  // 한쪽이 모자라도 순서만 무너지고 카드는 안 사라진다(추천 2 + 기발 0 → 추천만 / 옛 저장본 등)
  return [
    ...recs.slice(0, 2),
    ...novels.slice(0, 1),
    ...recs.slice(2, 3),
    ...novels.slice(1),
    ...recs.slice(3),
  ];
}

/** `/my` 아카이브 카드에 열거할 제목들 — 시트와 **같은 순서**의 앞 n개. */
export function orderedIdeaTitles(report: CollabReportData | null | undefined, n = 3): string[] {
  return orderIdeaCards(report)
    .map((c) => c.title)
    .filter(Boolean)
    .slice(0, n);
}
