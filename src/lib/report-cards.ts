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

/** 리포트 → 화면에 놓을 순서대로. **`ideas`를 저장된 순서 그대로**(= 서버가 점수순으로 고른 순서).
 *
 *  🔁순서 규칙의 역사(전부 대표 확정, 하루에 넷):
 *    ~~①1등만 위로 빼고 추천·확장 태그~~ → 태그 없는 카드가 덜 중요해 보였다
 *    ~~②추천 전부 → 기발 전부~~ → ~~③교차 배열(추천2·기발1·추천1·기발1)~~
 *    ④**칸막이 폐지(08-08)** — 두 씨앗을 한 풀에 합쳐 점수로만 고르니 배열 규칙 자체가 필요 없어졌다.
 *
 *  ⚠️`novelIdeas`는 **08-06~08 저장본에만** 있다. 새 리포트는 안 채우지만, 옛 저장본을 열면
 *    그 카드들이 사라지면 안 되므로 뒤에 이어 붙인다(옛 저장본은 그때의 배열 규칙을 잃을 뿐 내용은 온전하다). */
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
