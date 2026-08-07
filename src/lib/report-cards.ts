// 리포트 아이디어 카드 정렬 — **화면과 목록이 같은 순서를 봐야 한다**.
// 순수 함수만 둔다(서버 repo와 클라 ReportSheet가 함께 쓴다 — Gemini를 import하는 collab-report.ts는 클라에서 못 쓴다).
//
// 🪤 왜 파일을 따로 뺐나: 08-07에 정렬 규칙이 ReportSheet에만 있어서 `/my` 카드의 칩 순서가
//    시트 순서와 어긋났다(카드는 ideas 3개, 시트는 확장 2개가 위로 끼어듦 — 1팀 지적).
//    같은 규칙이 두 곳에 흩어지면 한쪽만 고쳐진다.
import type { CollabReportData } from "./types";

/** 카드 한 장이 화면에 필요로 하는 모든 것. tag가 붙은 카드가 위로 온다. */
export interface IdeaCard {
  title: string;
  desc: string;
  method?: string;
  /** 추천 = 기존 아이디어 1등 / 확장 = 기발 아이디어(B36). 없으면 태그 없는 나머지. */
  tag?: "추천" | "확장";
  /** 양쪽에 남는 것 — 주어 없는 불릿 문장들(기발 카드에만). 빈 값은 담지 않는다. */
  gains?: string[];
}

/** 리포트 → 화면에 놓을 순서대로. ①추천(기존 1등) ②확장(기발) ③나머지 기존.
 *  ⭐대표 확정(08-06): 기발 아이디어는 **별도 섹션이 아니라 같은 섹션**에 섞고 태그로 위계를 준다 —
 *  고객은 섹션이 왜 나뉘는지 모른다. */
export function orderIdeaCards(report: CollabReportData | null | undefined): IdeaCard[] {
  if (!report) return [];
  const ideas = report.ideas ?? [];
  return [
    ...ideas.slice(0, 1).map((i) => ({ ...i, tag: "추천" as const })),
    ...(report.novelIdeas ?? []).map((n) => ({
      title: n.title,
      desc: n.desc,
      method: n.method,
      tag: "확장" as const,
      gains: [n.gainA, n.gainB].map((s) => (s ?? "").trim()).filter(Boolean),
    })),
    ...ideas.slice(1),
  ];
}

/** `/my` 아카이브 카드에 열거할 제목들 — 시트와 **같은 순서**의 앞 n개. */
export function orderedIdeaTitles(report: CollabReportData | null | undefined, n = 3): string[] {
  return orderIdeaCards(report)
    .map((c) => c.title)
    .filter(Boolean)
    .slice(0, n);
}
