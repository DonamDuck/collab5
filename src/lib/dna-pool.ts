// Brand DNA 어휘 정본 — **코드가 정본이다(테이블 아님)**.
// 프롬프트 생성부(Pool 목록을 모델에게 그대로 제시)와 서버 화이트리스트 검증부(filterPoolValid)가
// 여기 같은 상수를 읽는다 — 두 곳이 갈라지면 모델이 고른 값이 전부 탈락하거나 창작어가 통과한다.
// 그래서 어휘 추가·삭제·표기 변경은 단순 문자열 수정이 아니라 **제품 정책 변경이며 배포를 탄다**
// (이미 캐싱된 brands.dna의 옛 value는 다음 재생성까지 남는다는 점도 함께 고려).
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §2-3

import type { DnaItem, DnaSignature } from "./types";

export const DNA_POOL: Record<string, readonly string[]> = {
  philosophy: ["지속가능성","자기표현","지역성","교육","사회적 가치","장인정신","취향 중심","경험 중심","사람 중심","커뮤니티"],
  mood: ["따뜻함","차분함","빈티지","미니멀","프리미엄","유쾌함","편안함","감성적","위트","자연 친화"],
  customer: ["20대","30대","40대","가족","직장인","창작자","관광객","지역 주민","취향 소비자","반려동물 보호자","운동인"],
  space: ["카페","공방","스튜디오","전시장","야외","팝업 가능","오프라인 매장","공유 공간"],
  content: ["사진","숏폼","릴스","브이로그","인터뷰","후기 콘텐츠","UGC","스토리텔링"],
  experience: ["체험","클래스","전시","공연","커뮤니티","정기 모임","시즌 이벤트","팝업"],
  operation: ["소규모","예약제","상시 운영","시즌 운영","정기 프로그램","1회성 이벤트","빠른 실행 가능"],
  collabMethod: ["입점 판매","프로젝트·프로그램 소속 팝업 참여","협동 워크숍","협동 프로그램 운영","제품 스팟 소개","링크 제휴 할인","할인 코드 교환","공동 상품","공동 브랜딩","콘텐츠 제작","SNS 이벤트","챌린지","굿즈","전시","지역 프로젝트","상호 고객 혜택 교환"],
  value: ["브랜드 인지도","신규 고객","팬덤 형성","지역 활성화","사회적 가치","경험 강화","재방문 유도"],
  locality: ["로컬 브랜드","지역 커뮤니티","관광지","지역 행사","골목 상권"],
  pricePosition: ["합리적","중간","프리미엄"],
  hours: ["아침","낮","저녁","심야","주말 중심"],
  salesChannel: ["오프라인 매장만","스마트스토어","자사몰","예약제 판매"],
  production: ["핸드메이드","소량 생산","주문 제작","친환경 소재","로컬 소싱"],
  audienceAsset: ["정기 모임 보유","단골 커뮤니티","뉴스레터","수강생 풀"],
  seasonality: ["사계절","특정 시즌 강세"],
};

/** 🏷 collabMethod **표시 전용** 축약 라벨 (대표 확정 07-31).
 *  Pool 값 자체는 절대 바꾸지 않는다 — 프롬프트 제시 목록·서버 화이트리스트(filterPoolValid)·
 *  이미 캐싱된 brands.dna / collab_reports가 전부 위 원문을 쓴다. 여기는 **UI가 그릴 때만** 갈아끼우는 층.
 *  이유: 아이디어 카드 칩이 `shrink-0`이라 긴 값("프로젝트·프로그램 소속 팝업 참여" 16자)이 가로를
 *  독차지하면 옆의 제목이 4줄로 쪼개진다(대표 제보). 매핑에 없는 값은 원문 그대로 노출한다. */
export const COLLAB_METHOD_LABEL: Record<string, string> = {
  "프로젝트·프로그램 소속 팝업 참여": "공동 팝업",
  "상호 고객 혜택 교환": "혜택 교환",
  "협동 프로그램 운영": "공동 프로그램",
  "제품 스팟 소개": "제품 소개",
  "링크 제휴 할인": "제휴 할인",
  "할인 코드 교환": "할인 코드",
  "협동 워크숍": "워크숍",
};

/** 칩에 그릴 짧은 라벨. 매핑 없으면 원문(= Pool 값)을 그대로 돌려준다. */
export function collabMethodLabel(method: string): string {
  return COLLAB_METHOD_LABEL[method] ?? method;
}

// 가벼움→무거움 순 강도(작게 시작 추천 근거). 여기 없는 method는 중간 취급.
export const LIGHT_METHODS = ["할인 코드 교환","링크 제휴 할인","제품 스팟 소개","SNS 이벤트"];
export const HEAVY_METHODS = ["공동 상품","공동 브랜딩","입점 판매"];

export const THIN_MIN_TYPES = 4;      // 서로 다른 type 수 미달 = thin
export const MIN_MATCH_SCORE = 7;     // 접점 채점 통과 하한(10점 만점 합산 기준, A/B로 튜닝)
export const SIGNATURE_MAX = 3;       // 이 브랜드만의 것 최대 개수(많아지면 '특별함'이 아니라 목록이 된다)
// 이 시각 이전 dna는 stale 취급 — **DNA 스키마·프롬프트를 바꾸면 여기를 올려야 실제로 재생성된다.**
// 지문(input_hash)은 '소개서가 바뀌었나'만 보므로, 소개서가 그대로면 새 필드가 영원히 빈 채로 캐시된다.
//  2026-07-25: Pool 대개정  /  2026-07-27: signature(이 브랜드만의 것) 신설
export const DNA_REFRESH_BEFORE = "2026-07-27T03:00:00Z";
// (은퇴 2026-07-26) DNA_STALE_SLACK_MS 삭제 — stale 판정을 시각 비교에서 내용 지문(input_hash)
// 비교로 바꿨다. setBrandDna가 brands.updated_at 트리거를 발화시켜 시각 비교는 구조적으로 성립하지
// 않았고(모든 DNA 영구 stale), 허용 오차로 막으려 해도 DNA 생성 10~20초가 오차를 넘겼다.

/** 서버 화이트리스트 검증 — 근거 없는 항목·Pool 밖 창작어·입력에 없던 source 필드명을 탈락시킨다(사실 게이트).
 *  allowedSources = 이번 생성 때 실제로 입력에 넣은 필드 라벨 목록(=BrandDna.input_fields).
 *  source는 필드명까지만 기록(테이블 단일이라 생략, 값은 evidence가 그 역할 — 대표 확정 07-26). */
export function filterPoolValid(items: DnaItem[], allowedSources: string[]): DnaItem[] {
  return items
    .map((it) => ({ ...it, source: (it.source ?? []).filter((s) => allowedSources.includes(s)) }))
    .filter(
      (it) => (DNA_POOL[it.type] ?? []).includes(it.value) && it.evidence?.trim() && it.source.length > 0
    );
}

export function distinctTypeCount(items: DnaItem[]): number { return new Set(items.map((i) => i.type)).size; }

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/** 인용문이 소개서에 실제로 있는가. 통째로 없으면 문장 단위로 쪼개 **조각 전부**가 있는지 본다.
 *  왜 쪼개나(실측 07-27, 스톤브루): 모델이 [one_liner]와 [description]에서 한 문장씩 가져와
 *  하나의 evidence로 이어 붙인다("…깊고 진한 한 잔. 직접 로스팅하는 …카페"). 통짜 대조만 하면
 *  **창작이 아닌데도 폐기**된다. 조각을 **전부** 요구하므로 "진짜 인용 + 지어낸 말" 조합은 여전히 걸린다. */
function quoted(evidence: string, hay: string): boolean {
  if (hay.includes(evidence)) return true;
  const parts = evidence.split(/[.·,;/]|\s—\s/).map(squash).filter((p) => p.length >= MIN_QUOTE_LEN);
  return parts.length > 0 && parts.every((p) => hay.includes(p));
}

const MIN_QUOTE_LEN = 6; // 이보다 짧은 인용은 아무 문장에나 걸려 근거 구실을 못 한다

/** signature(자유 서술) 사실 게이트 — Pool 화이트리스트를 쓸 수 없는 필드라 **원문 대조**로 막는다.
 *  ①source가 실제 입력 필드일 것 ②evidence가 다이제스트에 **문자 그대로 있을 것**(공백 정규화 후 부분일치)
 *  ③너무 짧은 인용은 아무 데나 걸리므로 6자 이상 ④최대 SIGNATURE_MAX개.
 *  ②가 이 필드의 핵심 방어선이다 — 여기가 없으면 "이 브랜드만의 것"은 창작 허가증이 된다.
 *  (DNA_SYSTEM이 원문 인용을 요구하고 실측 준수율도 높지만(evidence 일치 33/33), 프롬프트는 규칙이지 보장이 아니다.) */
export function filterSignatures(
  sigs: DnaSignature[],
  allowedSources: string[],
  digestText: string
): DnaSignature[] {
  const hay = squash(digestText);
  return sigs
    .map((s) => ({
      text: squash(String(s?.text ?? "")),
      evidence: squash(String(s?.evidence ?? "")),
      source: (s?.source ?? []).filter((f) => allowedSources.includes(f)),
    }))
    .filter((s) => {
      if (!s.text || s.source.length === 0) return false;
      if (s.evidence.length < MIN_QUOTE_LEN || !quoted(s.evidence, hay)) {
        console.warn(`[dna] signature 원문 대조 실패 → 폐기: "${s.text}" (evidence="${s.evidence}")`);
        return false;
      }
      return true;
    })
    .slice(0, SIGNATURE_MAX);
}
