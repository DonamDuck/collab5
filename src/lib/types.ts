// collab5 도메인 엔티티 — spec(Notion v1) 기준으로 한 번 확정.
// mock과 미래 Supabase 구현이 공유하는 단일 형태(shape). UI는 이 타입에만 의존.

/** 하드 축 (클릭=필터). design.md 등록폼 / Notion §6-1 */
export type CollabType =
  | "제품콜라보"
  | "팝업"
  | "워크숍"
  | "공동굿즈"
  | "공동콘텐츠"
  | "행사참여"
  | "공간대여";

export type BusinessSize = "1인" | "소규모" | "중간" | "대형";

/** AI distill 결(結) 층 — 보조, 사용자가 칩으로 교정 */
export interface SoulLayer {
  values: string[]; // 핵심 가치 (예: ["친환경", "손맛", "느린 호흡"])
  tone: string; // 톤·무드 한 줄
  trajectory: string; // 브랜드 행보 한 줄
}

/** 검증 가능한 신뢰 시그널 — 표시층(사람이 다각도 검토) */
export interface TrustSignals {
  homepage?: string;
  instagram?: string;
  address?: string;
  /** 지도 링크(네이버 지도·카카오맵 등). 홈페이지 없는 동네 가게의 사실상 대체 홈페이지 —
   *  주소·영업시간·전화·사진·후기가 한 번에 딸려온다. trust가 jsonb라 마이그레이션 불필요. */
  mapUrl?: string;
  description?: string; // 본인 작성(폴리셔 보정)
}

/** 함께한 콜라보 이력 — 자기보고(말랑한 층). ✓검증마크 X. 수신자 신뢰의 결정타. */
export interface CollabHistory {
  partner: string; // 함께한 곳
  types: string[]; // 콜라보 유형 (CollabType 또는 자유 입력)
  desc?: string; // 콜라보 내용 한 줄 소개
  year?: string; // 년도 (최신순 정렬용)
  photos: string[]; // 콜라보 사진 최대 3
  link?: string; // 관련 링크(블로그·후기 등, 선택) — press item.link과 동일 패턴
}

/** 대표 활동 — 제목·설명·사진(최대 3)·링크(선택) */
export interface Activity { title: string; desc: string; photos: string[]; link?: string; }

/** 선택 블록 — 공통 photos(최대3)·links(최대3) + 타입별 고유 필드. 배열 순서 = 소개서 노출 순서 */
export interface BlockLink { label?: string; url: string }
// uid = 편집기 전용 안정 키(재정렬·비동기 업로드 병합용). 저장 시 sanitizeBlocks가 제거.
interface BlockBase { uid?: string; photos: string[]; links: BlockLink[] }
export type Block = BlockBase & (
  | { type: "metrics"; items: { label: string; value: string }[] }
  | { type: "reviews"; items: { quote: string; source?: string }[] }
  | { type: "team"; intro: string }
  | { type: "press"; items: { title: string; year?: string; desc?: string; link?: string; photos?: string[] }[] }
  | { type: "space"; desc: string; features: string[] }
  | { type: "custom"; title: string; body: string }
);
export type BlockType = Block["type"];

/** 크롤 스냅샷 — 위저드에서 고객이 "선택한" 신호(picked-only). v1=저장만, 미래 검색·매칭 자산.
 *  jsonb 내부 키는 camelCase(관례: collab_cards.proposal.toName). 미저장: 조사메모·미선택·힌트·링크후보. */
export interface EnrichmentChip {
  text: string;       // 칩 제목
  section: string;    // 칩 섹션(키워드/정체/제품/…/직접)
  factual: boolean;   // 숫자·이력 등 사실성 칩
  starred: boolean;   // 고객 별표(우선순위)
  confirmed: boolean; // factual 칩 "맞아요" 확인
}
export interface Enrichment {
  createdAt: string;  // ISO — 스냅샷(크롤) 생성 시각
  tier: "rich" | "thin";
  seed: { region: string; businessType: string };
  chips: EnrichmentChip[]; // 선택 칩만
}

/** 소개서 상태 — active=정상 / inactive=소프트 삭제(비노출·DB 보관, 2026-07-22) */
export type MakerStatus = "active" | "inactive";

/** 업체 프로필 = 콜라보 카드의 '집' + 공개 상세페이지(검색 대상) */
export interface Maker {
  id: number; // 정수 시퀀스 PK (DB 자동)
  slug: string; // 공개 URL 용
  name: string;
  oneLiner: string; // 한 줄 정체성
  coverImageUrl?: string;
  logoUrl?: string;
  region?: string;
  size?: BusinessSize;
  offers: CollabType[]; // 제공 가능
  seeks: CollabType[]; // 희망
  targetAudience: string[];
  collabHistory: CollabHistory[]; // 함께한 콜라보 이력
  story: string;          // 왜 시작했나
  activities: Activity[];  // 대표 활동 최대 3
  offersNote: string;      // 협업 직접 설명
  seeksNote: string;       // 파트너 직접 설명
  photos: string[]; // 브랜드 사진(카드·프로필 슬라이드용). MVP=리사이즈 data URL
  blocks: Block[]; // 선택 블록(순서 보존)
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시 기록, 수정 시 보존). 없으면 undefined
  introFileUrl?: string; // 소개자료 PDF(코어 위계)
  soul: SoulLayer;
  trust: TrustSignals;
  collabOpen: boolean; // 콜라보 열림/닫힘 토글
  searchVisible: boolean; // 검색 결과 노출 on/off (DB=search_visible, 기본 true)
  status: MakerStatus; // active=정상 / inactive=소프트 삭제(전 노출면 비노출, DB 보관). DB=status, 기본 active
  ownerUserId?: string; // 소유 계정(로그인 생성/연결 시) — auth.users UUID
  editPasswordHash?: string; // 수정 비밀번호 해시(비회원 생성 시). DB=claim_token_hash
  createdAt: string; // ISO (DB timestamptz)
  updatedAt?: string; // ISO (수정 시 자동 갱신)
}

/** 상대별 맞춤 제안 본문 */
export interface Proposal {
  toName: string; // 받는 쪽 이름
  why: string; // 왜 당신과
  picture: string; // 어떤 그림(콜라보 형태)
  expectedEffect: string; // 기대 효과
}

/** 청첩장형 콜라보 요청 카드 — 히어로 아티팩트. North Star=view */
export interface CollabCard {
  id: number; // 정수 시퀀스 PK
  slug: string; // 공유 링크 경로
  fromMakerId: number;
  proposal: Proposal;
  createdAt: string;
}

/** North Star: 카드 view (외부 공유링크 → 우리 도메인 오픈) */
export interface ViewEvent {
  id: number;
  cardId: number;
  createdAt: string; // ISO (DB timestamptz)
  ref?: string; // 유입 출처 라벨
}

/** 보조 지표: 카드 내 RSVP 반응 */
export interface Reaction {
  id: number;
  cardId: number;
  type: "관심" | "패스";
  createdAt: string;
}
