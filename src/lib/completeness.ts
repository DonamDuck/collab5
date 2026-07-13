// 소개서 완성 기준(스펙 2026-07-14) — 폼 안내·넛지·리빌 우선순위 공용.
// 어드바이저리 전용: 제출·공개를 막는 데 쓰지 않는다.
export interface IntroPresence {
  required: boolean; // 상호 + 협업칩(offers) ≥1
  story: boolean;
  activities: boolean;
  collabs: boolean;
  keywords: boolean;
  customers: boolean;
  offersNote: boolean;
  seeks: boolean; // seeks 칩 또는 seeksNote
  blocks: number; // 내용 있는 블록 수
}
export function narrativeCount(p: IntroPresence): number {
  return [p.story, p.activities, p.collabs].filter(Boolean).length;
}
export function sectionCount(p: IntroPresence): number {
  return (
    narrativeCount(p) +
    [p.keywords, p.customers, p.offersNote, p.seeks].filter(Boolean).length +
    p.blocks
  );
}
/** 충분한 소개서 = 필수 + 섹션 2개 이상 + 서사(시작·활동·콜라보 경험) 1개 이상 */
export function isRichIntro(p: IntroPresence): boolean {
  return p.required && sectionCount(p) >= 2 && narrativeCount(p) >= 1;
}
