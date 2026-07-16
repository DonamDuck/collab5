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
 * 상투어 감지 regex — OPTIONS_SYSTEM(enrich.ts) 말미 '출력 직전 자기검열 게이트'의 단어와 동기화.
 * ⚠️게이트 단어를 고치면 여기도 같이 고쳐라(둘이 어긋나면 프롬프트로 막은 걸 정렬이 못 잡는다).
 * String.prototype.match 로만 쓴다(전역 플래그 lastIndex 무상태). .test/.exec 로 쓰지 말 것.
 */
export const CLICHE_RE =
  /믿습니다|응원(?:합니다|해요)?|빛나는|든든한|소중한|특별한|함께\s*성장|꿈을\s*(?:향해|펼치)|첫걸음|시작점|긍정적인\s*에너지|새로운\s*(?:내일|미래)/g;

/** 마무리가 추상 격려("~바랍니다"/"~응원합니다")로 끝나면 가점(마지막 문장 규칙과 동기화). */
const CLICHE_TAIL_RE = /(?:바랍니다|응원합니다)[.!\s]*$/;

/** 한 후보의 상투어 점수 = 본문 히트 수 + (마무리 격려 가점). 낮을수록 담백. */
export function clicheScore(s: string): number {
  const text = (s ?? "").trim();
  if (!text) return 0;
  const hits = (text.match(CLICHE_RE) ?? []).length;
  return hits + (CLICHE_TAIL_RE.test(text) ? 1 : 0);
}

/**
 * 상투어 히트 수가 적은 것부터(0개 먼저) 정렬.
 * ⭐안정 정렬 — 동점이면 원래 순서 유지(인덱스 tiebreaker로 명시적으로 보장).
 */
export function sortByCliche(list: string[]): string[] {
  return list
    .map((s, i) => ({ s, i, score: clicheScore(s) }))
    .sort((a, b) => a.score - b.score || a.i - b.i)
    .map((x) => x.s);
}

/**
 * 앵커 N개 + 자유 M개 블렌드.
 * - 앵커: 재생성 콜 결과(관통 주제·서로 다른 렌즈). 앞에서부터 DESC_ANCHOR_COUNT개.
 * - 자유: 사전 생성 원본 풀에서 앞에서부터 DESC_DIVERSE_COUNT개(앵커와 텍스트 중복은 제외, 풀보다 크면 우아하게 캡).
 * ⭐상투어 재정렬 = 앵커 그룹·자유 그룹에 각각 따로 sortByCliche 적용(그룹 내부에서만 뒤로 민다).
 *   ⚠️그룹 경계는 안 넘는다 — 앵커 블록은 항상 자유 블록보다 앞(깨끗한 자유가 상투어 앵커를 앞지르지 않음).
 * 최종 = [앵커…, 자유…]. UI는 이 배열을 그냥 N개 렌더하면 된다(개수 하드코딩 불필요).
 */
export function blendDescriptions(anchors: string[], pool: string[]): string[] {
  // ① 어떤 앵커/자유를 쓸지 먼저 확정(캡·중복제거) → ② 그룹 내부에서만 상투어 재정렬.
  const pickedAnchors = anchors
    .map((s) => s?.trim())
    .filter((s): s is string => !!s)
    .slice(0, DESC_ANCHOR_COUNT);
  const a = sortByCliche(pickedAnchors); // 앵커 그룹 내부만 재정렬
  const seen = new Set(a);
  const pickedDiverse = pool
    .map((s) => s?.trim())
    .filter((s): s is string => !!s && !seen.has(s))
    .slice(0, DESC_DIVERSE_COUNT);
  const diverse = sortByCliche(pickedDiverse); // 자유 그룹 내부만 재정렬
  return [...a, ...diverse];
}
