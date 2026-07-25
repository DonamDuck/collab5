// Brand DNA 어휘 정본 — **코드가 정본이다(테이블 아님)**.
// 프롬프트 생성부(Pool 목록을 모델에게 그대로 제시)와 서버 화이트리스트 검증부(filterPoolValid)가
// 여기 같은 상수를 읽는다 — 두 곳이 갈라지면 모델이 고른 값이 전부 탈락하거나 창작어가 통과한다.
// 그래서 어휘 추가·삭제·표기 변경은 단순 문자열 수정이 아니라 **제품 정책 변경이며 배포를 탄다**
// (이미 캐싱된 brands.dna의 옛 value는 다음 재생성까지 남는다는 점도 함께 고려).
// 스펙: docs/superpowers/specs/2026-07-25-collab-report-dna-design.md §2-3

import type { DnaItem } from "./types";

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

// 가벼움→무거움 순 강도(작게 시작 추천 근거). 여기 없는 method는 중간 취급.
export const LIGHT_METHODS = ["할인 코드 교환","링크 제휴 할인","제품 스팟 소개","SNS 이벤트"];
export const HEAVY_METHODS = ["공동 상품","공동 브랜딩","입점 판매"];

export const THIN_MIN_TYPES = 4;      // 서로 다른 type 수 미달 = thin
export const MIN_MATCH_SCORE = 7;     // 접점 채점 통과 하한(10점 만점 합산 기준, A/B로 튜닝)
export const DNA_REFRESH_BEFORE = "2026-07-25T00:00:00Z"; // 이 날짜 이전 dna는 stale 취급
// setBrandDna의 update가 brands.updated_at 트리거를 발화시켜 dna.updated_at보다 살짝 뒤가 된다 →
// stale 판정은 `brands.updated_at > dna.updated_at + SLACK` 으로 허용 오차를 둔다.
export const DNA_STALE_SLACK_MS = 5000;

/** 서버 화이트리스트 검증 — 근거 없는 항목·Pool 밖 창작어를 탈락시킨다(사실 게이트). */
export function filterPoolValid(items: DnaItem[]): DnaItem[] {
  return items.filter((it) => (DNA_POOL[it.type] ?? []).includes(it.value) && it.evidence?.trim());
}

export function distinctTypeCount(items: DnaItem[]): number { return new Set(items.map((i) => i.type)).size; }
