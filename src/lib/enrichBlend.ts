// 자세히 재생성 "앵커 N + 자유 M" 블렌드 설정 — 서버(enrich.ts)·클라(page.tsx·EnrichWizard.tsx) 공용.
// ⭐⭐여기 숫자 두 개만 바꾸면 비율이 전 구간(앵커 프롬프트·머지 로직·UI 렌더)에 반영된다.
//    예: 3/2 → 앵커3+자유2, 3/3 → 총6. 코드 다른 곳에 2·3을 하드코딩하지 말 것.
// ⚠️서버 전용 의존성 금지(클라 컴포넌트도 import 하므로 순수 상수·순수 함수만).

/** 앵커 개수 — 고른 한 줄을 '관통 주제'로 새로 생성(서로 다른 렌즈). 재생성 콜은 딱 이 개수만 만든다. */
export const DESC_ANCHOR_COUNT = 2;
/** 자유 개수 — 사전 생성돼 있던 자세히 후보 풀에서 그대로 유지(다양성 보장). */
export const DESC_DIVERSE_COUNT = 3;

/** 세션 전역 재생성 상한(모달·위저드 공유 카운터). 비용 가드. */
export const DESC_REGEN_CAP = 2;
// 모듈 싱글턴 = 한 페이지 세션 동안 공유(모달·위저드 어디서 소모하든 합산). 새로고침 시 리셋.
let _regenUsed = 0;
/** 아직 재생성 여력이 있나(세션 상한 미만). */
export function canRegenDesc(): boolean {
  return _regenUsed < DESC_REGEN_CAP;
}
/** 재생성 1회 성공 시 호출 — 세션 카운터 소모. */
export function noteRegenDesc(): void {
  _regenUsed += 1;
}

/**
 * 앵커 N개 + 자유 M개 블렌드.
 * - 앵커: 재생성 콜 결과(관통 주제·서로 다른 렌즈). 앞에서부터 DESC_ANCHOR_COUNT개.
 * - 자유: 사전 생성 원본 풀에서 앞에서부터 DESC_DIVERSE_COUNT개(앵커와 텍스트 중복은 제외, 풀보다 크면 우아하게 캡).
 * 최종 = [앵커…, 자유…]. UI는 이 배열을 그냥 N개 렌더하면 된다(개수 하드코딩 불필요).
 */
export function blendDescriptions(anchors: string[], pool: string[]): string[] {
  const a = anchors
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .slice(0, DESC_ANCHOR_COUNT);
  const seen = new Set(a);
  const diverse = pool
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && !seen.has(s))
    .slice(0, DESC_DIVERSE_COUNT);
  return [...a, ...diverse];
}
