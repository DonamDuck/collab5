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

/** 리포트 → 화면에 놓을 순서대로. ①추천 전부 ②기발(확장) 전부.
 *  ⭐대표 확정(08-06): 기발 아이디어는 **별도 섹션이 아니라 같은 섹션**에 섞는다 — 고객은 섹션이 왜 나뉘는지 모른다.
 *  🔁대표 재확정(08-08): ~~1등만 위로 빼고 태그로 위계~~ → **추천 전부 → 기발 전부**로 단순 배열하고 태그는 뗀다.
 *    태그를 달았더니 **태그 없는 카드가 덜 중요해 보였다**(위계를 주려다 나머지를 깎았다).
 *    기발은 색다른 만큼 읽는 부담도 있어 뒤로 보내는 게 맞다. */
export function orderIdeaCards(report: CollabReportData | null | undefined): IdeaCard[] {
  if (!report) return [];
  return [
    ...(report.ideas ?? []).map((i) => ({
      title: i.title,
      desc: i.desc,
      method: i.method,
      gains: gainsOf(i.gainA, i.gainB), // 08-08 이전 저장본엔 없다 — 빈 배열이면 화면이 그 줄을 생략
    })),
    ...(report.novelIdeas ?? []).map((n) => ({
      title: n.title,
      desc: n.desc,
      method: n.method,
      gains: gainsOf(n.gainA, n.gainB),
    })),
  ];
}

/** `/my` 아카이브 카드에 열거할 제목들 — 시트와 **같은 순서**의 앞 n개. */
export function orderedIdeaTitles(report: CollabReportData | null | undefined, n = 3): string[] {
  return orderIdeaCards(report)
    .map((c) => c.title)
    .filter(Boolean)
    .slice(0, n);
}
