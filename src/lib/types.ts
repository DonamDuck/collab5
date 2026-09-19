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

/** 위 타입의 **런타임 목록**. `/search` 필터 칩과 `?type=` 검증이 같이 쓴다(08-16).
 *  🚨여기(서버·클라 공용 모듈)에 두는 게 핵심이다 — `"use client"` 파일에 두고 서버 컴포넌트가
 *    import하면 **값이 아니라 클라이언트 참조 프록시**가 넘어와 `.includes is not a function`으로 죽는다.
 *    실제로 08-16에 `SearchClient.tsx`에서 가져왔다가 `/search?type=`이 통째로 500이 났다. */
export const COLLAB_TYPES: readonly CollabType[] = [
  "제품콜라보",
  "팝업",
  "워크숍",
  "공동굿즈",
  "공동콘텐츠",
  "행사참여",
  "공간대여",
] as const;


/** 검증 가능한 신뢰 시그널 — 표시층(사람이 다각도 검토) */
export interface TrustSignals {
  homepage?: string;
  instagram?: string;
  address?: string;
  /** 지도 링크(네이버 지도·카카오맵 등). 홈페이지 없는 동네 가게의 사실상 대체 홈페이지 —
   *  주소·영업시간·전화·사진·후기가 한 번에 딸려온다. trust가 jsonb라 마이그레이션 불필요.
   *  ※ 자세히 소개(description)는 07-25에 최상위 컬럼으로 분리됨 — 여긴 채널·위치만. */
  mapUrl?: string;
  /** WGS84 좌표(07-31 지도 핀 UI). Static Map 렌더용 — mapUrl과 같은 지역검색 응답에서 함께 온다.
   *  trust가 jsonb라 마이그레이션 없이 추가됨. 기존 소개서는 없을 수 있다(백필 전까진 지도 카드 미노출). */
  lat?: number;
  lng?: number;
}

/** 함께한 콜라보 이력 — 자기보고(말랑한 층). ✓검증마크 X. 수신자 신뢰의 결정타. */
export interface CollabHistory {
  partner: string; // 함께한 곳
  types: string[]; // 콜라보 유형 (CollabType 또는 자유 입력)
  desc?: string; // 콜라보 내용 한 줄 소개
  year?: string; // 년도 (최신순 정렬용)
  photos: string[]; // 콜라보 사진 최대 5
  link?: string; // 관련 링크(블로그·후기 등, 선택) — press item.link과 동일 패턴
}

/** 대표 활동 — 제목·설명·사진(최대 5)·링크(선택) */
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
  ownerNote?: string; // 사장이 직접 쓴 특장점 한 문장(B35, 2026-08-06) — '다시 받기'가 재사용. 의미 반영 계약(verbatim 아님)
}

/** 소개서 상태 — active=정상 / inactive=소프트 삭제(비노출·DB 보관, 2026-07-22) */
export type MakerStatus = "active" | "inactive";

/** 업체 프로필 = 콜라보 카드의 '집' + 공개 상세페이지(검색 대상) */
export interface Maker {
  id: number; // 정수 시퀀스 PK (DB 자동)
  slug: string; // 공개 URL 용
  name: string;
  oneLiner: string; // 한 줄 정체성
  region?: string;
  offers: CollabType[]; // 제공 가능
  seeks: CollabType[]; // 희망
  targetAudience: string[];
  collabHistory: CollabHistory[]; // 함께한 콜라보 이력
  description: string;    // 자세히 소개 "우리는 이런 브랜드에요" (DB=description, 구 trust.description)
  story: string;          // 왜 시작했나
  activities: Activity[];  // 대표 활동 최대 5 (register 폼 상한. 콜라보 이력도 동일하게 5)
  offersDescription: string; // 협업 직접 설명 (DB=offers_description, 구 offers_note)
  seeksDescription: string;  // 파트너 직접 설명 (DB=seeks_description, 구 seeks_note)
  photos: string[]; // 브랜드 사진(카드·프로필 슬라이드용). MVP=리사이즈 data URL
  /** 사진별 출처 — **「사진 주소 → 출처 글자」 대조표**(DB=photo_sources jsonb, 기본 없음).
   *  ⭐**사진 배열 안에 넣지 않은 이유**(08-20 대표 지시): `photos: string[]`가 브랜드·활동·콜라보·
   *    선택블록·언론 **다섯 군데 넘게** 흩어져 있다. `{주소, 출처}` 묶음으로 바꾸면 그 전부를 고쳐야 하고
   *    **이미 발행된 소개서의 옛 저장본과 모양이 어긋난다.** 표 하나를 옆에 두면 배열은 그대로 두고
   *    칸 하나만 늘며, 옛 소개서는 이 값이 없어 **아무 일도 안 일어난다.**
   *  🔁곁따라오는 이득 — 같은 사진을 활동에도 콜라보에도 썼으면 **출처를 한 번만 적으면 둘 다 따라간다.**
   *  ⛔출처는 **전부 수기**다. 인스타에서 수확했다고 계정 주인이 그 사진의 권리자라는 보장이 없어
   *    자동 채움을 넣지 않기로 했다(대표 판단 08-20 — 지인이 찍어준 사진일 수 있다).
   *  ⚠️값이 빈 문자열인 항목은 저장 전에 버린다(빈 캡션이 자리만 차지하지 않게). */
  photoSources?: Record<string, string>;
  showcases: Block[]; // 선택 블록(순서 보존) (DB=showcases, 구 blocks)
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시 기록, 수정 시 보존). 없으면 undefined
  introFileUrl?: string; // 소개자료 PDF(코어 위계)
  keywords: string[]; // 브랜드를 표현하는 키워드 칩 (DB=keywords, 구 soul.values)
  /** 업종 소분류 코드 — 목록·검색·풀이는 `lib/industry.ts` (DB=industry_code, 08-26 신설).
   *  ⭐**키워드 칩과 다른 축이다.** 칩은 「이 브랜드를 표현하는 말」(자유·복수)이고,
   *    이건 **「무슨 업종인가」(정해진 목록에서 하나)** — 필터·지도·지원사업 자격 매칭이 쓸 축이다.
   *  📌값은 **정부 상권정보 업종코드**(KSIC 10차) 또는 **collab5 추가분(`X` 접두사)** 중 하나.
   *  ⛔자유 입력을 받지 않는다(대표 08-26) — 받으면 그 정리가 곧 사람 일이 된다.
   *  ⚠️옛 소개서는 이 값이 없다(`undefined`). 화면·필터는 없는 경우를 반드시 견뎌야 한다. */
  industryCode?: string;
  /** 손님을 맞는 공간이 있는가 (DB=has_space, 기본 false, 08-26 신설).
   *  ⭐업종과 **일부러 갈라 둔 축**이다 — 업종은 「무엇을 하나」이고 이건 「무엇을 가졌나」다.
   *    터·호락호락도서관처럼 **업종 칸 하나를 공간에 써버리면 정작 하는 일이 안 담긴다.**
   *  쓰임 = 콜라보「장소를 내줄 수 있나」 · 지원사업「임대료·시설 지원 대상인가」.
   *  ⚠️`industryCode`와 마찬가지로 **옛 소개서엔 없다** → optional. 읽을 땐 `!!m.hasSpace`로.
   *    (DB에서 읽어 올 때는 `rowToMaker`가 `?? false`로 채우므로 실제로는 늘 boolean이다.) */
  hasSpace?: boolean;
  trust: TrustSignals;
  searchVisible: boolean; // [콜라보 찾기에 보이기] — 홈·/search 목록 노출 (DB=search_visible, 기본 true). ⚠️웹 검색과 무관(08-07 개명)
  /** [콜라보 요청 잠시 안받기] — true면 `/m`의 제안 버튼이 잠기고 타이틀 옆에 안내 칩이 뜬다.
   *  ⚠️`searchVisible`과 **다른 축**이다: 목록엔 그대로 보이되 지금은 요청만 안 받는 상태.
   *  (07-31에 둘을 하나로 묶었다가 08-07에 그 전제가 깨져 08-12에 다시 분리 — DB=collab_paused, 기본 false) */
  collabPaused: boolean;
  status: MakerStatus; // active=정상 / inactive=소프트 삭제(전 노출면 비노출, DB 보관). DB=status, 기본 active
  ownerUserId?: number; // 소유 계정 = profiles.user_id(정수). 07-25 auth uuid→user_id 전환
  editPasswordHash?: string; // 수정 비밀번호 해시(비회원 생성 시). DB=edit_password_hash
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
  fromBrandId: number; // 보내는 브랜드 (DB=from_brand_id, 구 from_maker_id)
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

/** Brand DNA — 소개서에서 뽑아낸 파생 해석층(사실 원본 아님), lazy 생성·캐싱.
 *  value는 반드시 dna-pool.ts의 Pool 어휘 안에서만. evidence=소개서 실제 문구 인용. 스펙 2026-07-25 */
export interface DnaItem {
  type: string;      // Pool의 축(philosophy·mood·collabMethod …)
  value: string;     // Pool 어휘만(서버 화이트리스트 검증)
  evidence: string;  // 소개서 원문 인용(10~30자) — 값의 발췌 그 자체라 별도 값 저장 안 함
  source: string[];  // 근거가 된 입력 필드명(실제 DB 컬럼명, 입력 라벨 화이트리스트 검증)
}
/** ⭐이 브랜드만의 것 — Pool 밖 자유 서술(고유성).
 *  Pool은 브랜드끼리 비교하려고 어휘를 통제하는 대신, "LP를 트는 카페"·"버려진 헌옷으로 만드는 워크숍"처럼
 *  **그 브랜드를 그 브랜드이게 하는 조각**을 통째로 잃는다(레이지오터도 캔버스가든도 space:"카페"·"공방"으로
 *  수렴). 그 손실을 메우는 필드라, 화이트리스트가 아니라 **원문 인용 검증**으로 사실을 막는다. */
export interface DnaSignature {
  text: string;      // 이 브랜드에만 해당하는 한 조각(15~40자)
  evidence: string;  // 소개서 원문 인용 — 서버가 다이제스트에 실제로 있는 문구인지 대조한다
  source: string[];  // 근거가 된 입력 필드명(입력 라벨 화이트리스트 검증)
}
export interface BrandDna {
  summary: string;
  items: DnaItem[];
  signature?: DnaSignature[]; // 0~3개. optional = 이 필드 도입 이전에 저장된 DNA가 있어서(재생성되면 채워짐)
  input_fields: string[]; // 이번 생성 때 입력으로 넣은 필드 라벨 목록 — 서버가 기록(AI 출력 아님)
  input_hash?: string;    // 이 DNA를 만든 소개서 다이제스트의 지문 — stale 판정 기준(시각 비교 대체). 없으면 구버전=1회 재생성
  created_at: string;
  updated_at: string;
}

/** AI 콜라보 분석 리포트 — 카드형 5조각(CTA는 UI 고정 문구라 데이터 없음).
 *  ⚠️ (은퇴 2026-08-01) oneLiner — 한줄 요약 폐지(대표 확정). ideas[0]의 축약이라 정보 0인 중복이었다.
 *     구 캐시(collab_reports.report jsonb)에는 oneLiner 키가 그대로 남아 있지만 아무도 읽지 않는다. */
export interface ReportMatchPoint { text: string; }           // ② 접점 (선발 통과분)
/** ③ method=collabMethod 어휘. gainA/gainB = 양쪽에 남는 것 2줄(08-08 대표 — 기발 카드에만 있던 걸 추천에도).
 *  ⚠️옵셔널인 이유는 **옛 저장본에는 없어서**다(08-08 이전 캐시). 화면은 빈 값이면 그 줄을 통째로 생략한다. */
export interface ReportIdea { title: string; desc: string; method: string; gainA?: string; gainB?: string; }

/** /my 리포트 아카이브 목록 행 — 쌍별 최신 1건, 요청자 본인 것만(프라이버시 원칙).
 *  리포트 6조각에서 **각 축의 대표 1개씩만** 뽑는다(카드는 미리보기지 축약본이 아니다). */
export interface CollabReportListItem {
  fromSlug: string; fromName: string;   // 내 소개서(제안자)
  toSlug: string; toName: string;       // 상상해 본 상대
  toRegion?: string;                    // 상대 지역(상위 2토막) — 날짜보다 재인식에 쓸모 있는 축
  matchPoint?: string;                  // 잘 어울리는 점 1개(채점 1위)
  ideaTitles: string[];                 // ⭐카드의 주인공 — 추천 콜라보 제목 최대 3개(라벨 아래 칩으로 열거)
  effect?: string;                      // 기대 효과 1개
  createdAt: string;                    // 정렬용(카드에는 노출 안 함)
  /** 저장본 전문 — 카드를 누르면 **API를 다시 부르지 않고 이걸 그대로 그린다**(08-07).
   *  목록 쿼리가 이미 `report` jsonb를 통째로 읽어 미리보기 3조각을 뽑고 있었다 —
   *  본문은 손에 쥔 채로 버리고, 열 때 다시 왕복하며 "분석하고 있어요"를 띄우고 있었던 것.
   *  ⚠️ 이 필드가 /my의 RSC 페이로드를 키운다(리포트 1건 ≈ 2KB, 수십 건 규모라 감당 범위). */
  report: CollabReportData;
}
/** ④ 기발한 콜라보 아이디어(B36) — 기존 ideas 아래 붙는 별도 섹션. 스펙 = 2026-08-06-novel-collab-ideas-design.md
 *  ⚠️ideas와 형태가 비슷해 보이지만 **다른 것**이다: ideas는 각자의 경험·활동에서 출발한 안전한 제안이고,
 *  이쪽은 "해왔던 것에 얽매이지 않는" 제안이라 게이트·채점·겹침 제거를 따로 거친다. */
export interface NovelIdea {
  title: string;
  desc: string;
  method: string;  // collabMethod 어휘 — ideas와 **같은 섹션에 나란히 놓이므로** 아이브로 문법도 같아야 한다
  gainA: string;   // 우리에게 벌어지는 일 — 한쪽만 좋은 아이디어를 거르는 장치이자 화면에 나가는 문장
  gainB: string;   // 상대에게 벌어지는 일
}
export interface CollabReportData {
  matchPoints: ReportMatchPoint[];  // 2~4개
  ideas: ReportIdea[];              // 1~3개 — 리포트의 얼굴(첫 섹션)
  /** ⚰️(은퇴 2026-08-08) 기발 아이디어 별도 칸 — 추천·기발 칸막이를 없애고 `ideas` 하나로 합쳤다.
   *  **읽기는 계속 지원한다**: 08-06~08 사이에 저장된 리포트에는 이 필드가 있고, 화면은 그걸 그대로 그려야 한다
   *  (`lib/report-cards.ts`가 ideas 뒤에 이어 붙인다). 새로 만드는 리포트는 이 필드를 채우지 않는다. */
  novelIdeas?: NovelIdea[];
  steps: string[];                  // 최대 4
  effects: string[];                // 2~3개
}

// ── 성사된 콜라보 (collabs) — ⭐북극성을 실제로 세는 자리. 스펙 = Obsidian [[성사-기록-계측]] ──
// 왜 collab_requests의 컬럼이 아니라 별도 테이블인가:
//   ① **컨시어지 성사는 요청 행이 아예 없다**(대표가 직접 소개해서 성사) — 컬럼이면 담을 곳이 없다.
//      그리고 미션상 첫 1~3건은 대부분 이 경우다.
//   ② 요청 3번 끝에 성사되기도 한다 — 요청:성사가 1:1이 아니다.
export type CollabStatus = "agreed" | "done" | "cancelled";
/** ⭐지표 순도 규칙([[미션-문제정의]]) — 이 태그가 이 테이블의 존재 이유다.
 *  안 나누면 "성사 5건"이 전부 대표가 소개한 것이어도 제품이 해낸 것처럼 보인다. */
export type CollabOrigin = "product" | "concierge";

export interface Collab {
  id: number;
  brandAId: number; brandAName: string; brandASlug: string; // 먼저 제안한 쪽
  brandBId: number; brandBName: string; brandBSlug: string; // 받은 쪽
  status: CollabStatus;
  origin: CollabOrigin;
  // 아래 5개는 **소개서 "함께한 콜라보" 카드와 같은 모양**(대표 지시 07-29).
  // 같은 모양이어야 성사 기록이 그대로 소개서 이력으로 흘러간다(F5 → F6).
  title: string;
  year: string;          // 이력 카드와 동일하게 date가 아니라 연도 문자열
  description: string;
  photos: string[];      // 최대 5
  link: string;
  createdAt: string;
}

/** 기록 입력 — 이름·slug는 저장하지 않고 조회 시 brands에서 채운다(이름이 바뀌면 따라가야 하므로). */
export interface CollabInput {
  brandAId: number;
  brandBId: number;
  origin: CollabOrigin;
  status?: CollabStatus;
  title: string;
  year?: string;
  description?: string;
  photos?: string[];
  link?: string;
}

// ─────────────────────────────────────────────────────────────
// 📰 매거진 (2026-08-10) — 콜라보 성사 사례를 현장 기록으로 발행하는 코너
// 스펙 = Obsidian [[매거진-기능-개발지시]]
// ─────────────────────────────────────────────────────────────

/** 본문 저장 포맷 = **Tiptap JSON**(HTML 문자열이 아니다).
 *
 *  ⭐HTML로 저장하지 않는 이유 두 가지:
 *   ① 렌더링을 나중에 못 바꾼다 — 디자인이 바뀌면 저장된 글을 전부 다시 손봐야 한다.
 *   ② `dangerouslySetInnerHTML`이 필요해져 XSS 표면이 생긴다. JSON은 우리가 노드별로 그린다.
 *
 *  🚨**이 타입이 에디터(PR2)와 렌더러(PR1)의 계약이다.** 한쪽만 바꾸면 글이 조용히 안 보인다 —
 *    노드를 추가·개명할 땐 반드시 양쪽을 같이 고칠 것. (렌더러 = `app/magazine/[slug]/ArticleBody.tsx`)
 */
export interface MagazineNode {
  type: string;
  /** heading은 `{level:3}`, image는 `{src, alt, caption}`, link 마크는 `{href}` */
  attrs?: Record<string, unknown>;
  content?: MagazineNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}
export interface MagazineDoc {
  type?: string; // "doc"
  content?: MagazineNode[];
}

/** 지원 노드 — **이 목록 밖은 만들지 않는다**(지시서 §8: 에디터 기능 확장 금지).
 *  `pullQuote`(강조 박스)와 image의 `caption`은 Tiptap 기본에 없어 PR2에서 커스텀 확장으로 만든다. */
export const MAGAZINE_NODES = [
  "doc", "paragraph", "text", "hardBreak",
  "heading",        // level 3만 — h1=제목, h2=섹션이라 본문은 h3부터
  "blockquote",     // 현장 발화·모집글 인용
  "pullQuote",      // 강조 박스(가운데 큰 글씨) — 커스텀
  "bulletList", "orderedList", "listItem",
  "horizontalRule",
  "image",          // attrs.caption 포함 — 커스텀
] as const;

/** 정보 카드 한 줄 — "함께한 곳 / 언제 / 누가 / 무엇을". **개수가 호마다 다르다**(가변) */
export interface MagazineFact { label: string; value: string }

/** 아티클 하단에서 소개서로 잇는 링크. 매거진↔소개서를 잇는 핵심 동선이다.
 *  ⚠️brands FK가 아니라 **slug 문자열**로 담는다 — 소개서가 삭제·개명돼도 발행된 기록은 남아야 한다.
 *  name·tagline을 같이 저장하는 것도 같은 이유(원본이 사라져도 카드가 빈칸이 되지 않게). */
export interface MagazineBrandLink { slug: string; name: string; tagline: string }

/** 매거진 댓글 한 줄.
 *  ⭐**작성자 이름·소개서 slug를 «쓸 때 스냅샷»한다** — `user_id`로 조인하면 브랜드명을 바꾸는 순간
 *    과거 댓글의 화자가 소급해서 바뀌고, 소유권을 이전하면 링크가 남의 페이지를 가리킨다.
 *    바로 위 `MagazineBrandLink`가 같은 이유로 FK 대신 스냅샷을 쓴다 — 같은 규칙을 따른다.
 *  ⚠️`authorSlug`는 없을 수 있다: 소개서를 아직 안 만들었거나(당연히 댓글은 쓸 수 있다),
 *    한 계정이 소개서를 여러 개 가져 어느 것을 걸지 정할 수 없을 때. 그땐 이름이 «평범한 글자»다. */
export interface ArticleComment {
  id: number;
  articleId: number;
  userId: number;      // 삭제 권한 판정용 — 화면 표시에는 쓰지 않는다
  authorName: string;  // 쓸 때의 브랜드명
  authorSlug?: string; // 쓸 때의 소개서 slug (없으면 링크 없음)
  authorImage?: string; // 쓸 때의 프로필 이미지
  body: string;
  createdAt: string;
}

export type MagazineStatus = "draft" | "published";

export interface MagazineArticle {
  id: number;
  slug: string;
  status: MagazineStatus;
  title: string;
  subtitle: string;
  editorName: string;
  location: string;
  coverImage: string;
  summary: string;
  factBox: MagazineFact[];
  brandLinks: MagazineBrandLink[];
  body: MagazineDoc;
  publishedAt?: string; // draft면 없다
  createdAt: string;
  updatedAt: string;
}

/** 목록 카드용 경량 투영 — 본문(body)을 빼고 읽는다.
 *  ⚠️본문 jsonb는 한 건이 수십 KB가 될 수 있어, 목록에서 통째로 끌어오면 글이 쌓일수록 페이로드가 커진다
 *  (소개서 목록에서 같은 실수를 한 적이 있다 — `SEARCH_CARD_COLS` 주석 참조). */
export type MagazineListItem = Omit<MagazineArticle, "body">;

/** 저장 입력 — id·created_at·updated_at은 DB가 채운다.
 *  ⚠️`publishedAt`을 클라가 정하지 않는다 — 서버가 "draft→published로 처음 바뀌는 순간"에만 찍는다
 *  (수정할 때마다 발행일이 오늘로 밀리면 아카이브 순서가 무너진다). */
export interface MagazineSaveInput {
  slug: string;
  /** 🔑수정 중 **주소를 바꿀 때**, 고치기 전의 주소. 없으면 새 글이다.
   *  ⚠️저장은 이 값으로 기존 행을 찾는다 — `slug`로 찾으면 바뀐 주소라 못 찾고,
   *  같은 글이 **두 개로 늘어난다**(발행일도 오늘로 새로 찍힌다). */
  prevSlug?: string;
  status: MagazineStatus;
  title: string;
  subtitle: string;
  editorName: string;
  location: string;
  coverImage: string;
  summary: string;
  factBox: MagazineFact[];
  brandLinks: MagazineBrandLink[];
  body: MagazineDoc;
}

// ─────────────────────────────────────────────────────────────
// 하루 가게 — 공간 대여 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
// DB   = supabase/migrations/2026-09-13-daily-shop.sql
// ─────────────────────────────────────────────────────────────

/** 공간을 어떻게 쓰게 할 것인가 — 대표가 09-13에 두 갈래로 나눴다.
 *  `as_is`  원래 목적대로 (요가원을 요가로, 공방을 공방으로). 고르는 축 = **설비**
 *  `open`   대관 (호스트 규칙 안에서 게스트가 용도를 정한다). 고르는 축 = **인원·시간**
 *  `both`   둘 다 */
export type SpaceUseType = "as_is" | "open" | "both";

/** 📂업종 — 검색·목록 거르개가 보는 축 (대표 09-16). */
export type SpaceCategory = "" | "cafe" | "restaurant" | "workshop" | "studio" | "shop" | "lounge" | "etc";

/** 📂빌려드리는 범위 — 값의 근거가 되는 축 (대표 09-16).
 *  ⭐업종과 «두 축»으로 가른 이유: 한 목록으로 만들면 조합이 폭발한다.
 *    「카페 공간만」·「카페 + 머신」·「국밥집 화구까지」·「예쁜 식당을 라운지로」가 전부 다른 상품인데,
 *    업종 × 범위로 두면 `카페 × 공간+장비`, `음식점 × 공간만`처럼 두 칸으로 표현된다.
 *  ⚠️옛 `useType`(원래 목적대로 / 대관)은 이 축에 흡수됐다. */
export type SpaceScope = "space_only" | "with_gear" | "whole_shop";

/** 하루 중 «열어 두는 시간대». 날마다 다를 수 있어서 날짜와 한 벌이다. */
export interface OpenSlot {
  /** `YYYY-MM-DD` */
  date: string;
  /** `HH:MM` — 24시 눈금, 정시 단위 */
  start: string;
  end: string;
}

/** 🔁매주 계속 여는 요일 (2026-09-17). `spaces.repeat_weekly`에 저장하고 읽을 때 앞으로 12주를 펼친다
 *  (`rent-time`의 `expandRepeat`). ⭐`openSlots`엔 펼친 날짜가 «이미 들어 있다» — 화면·서버는 이 칸을 안 봐도 된다.
 *  `dow` 0=일 … 6=토. `skip`은 그 요일 중 하루만 쉬는 날(`YYYY-MM-DD`). 없으면 빈다. */
export interface RepeatRule {
  dow: number;
  start: string;
  end: string;
  skip?: string[];
}

/** 📨이용 안내를 어떻게 할지. 🚨비밀번호 같은 «내용»은 우리가 안 가진다 — 방식만 고른다. */
export type AccessHow = "sms" | "onsite" | "both";

/** 🛍손님이 고르는 공간 상품(09-18). `space` = 대관만, `full` = 공간 전체. 이름은 `rent-copy`의 `PRODUCT_LABEL`. */
export type RentProduct = "space" | "full";

export type SpaceStatus = "draft" | "pending" | "open" | "paused";

export interface Space {
  id: number;
  slug: string;
  ownerUserId: number;
  /** 연결된 소개서. ⚠️FK가 아니라 **문자열**이다 — 소개서가 지워지거나 개명돼도 거래 기록은 남아야 한다.
   *  ⭐빈 문자열이 정상값이다. 이 기능은 소개서 «없는» 사람도 쓴다(대표 09-13). */
  brandSlug: string;

  name: string;
  tagline: string;
  body: string;
  photos: string[];

  /** 동네까지만. 확정 전 화면에 나가는 유일한 위치 정보다. */
  area: string;
  /** 🚨전체 주소 — **확정된 예약의 당사자에게만** 준다. 목록·상세의 공개 투영에는 넣지 말 것. */
  address: string;
  lat?: number;
  lng?: number;
  /** 🚨「들어오는 법」 — 도어락·열쇠·스위치. 주소와 같은 급의 비밀이라 **확정 뒤에만** 연다. */
  accessNote: string;

  useType: SpaceUseType;
  facilities: string[];
  /** 시설 «줄글» 안내. 태그(`facilities`)는 고르는 것이고 이건 읽는 것이다 — 「빔프로젝터 있음」은
   *  태그로 되지만 「HDMI 케이블은 없어서 가져오셔야 해요」는 줄글이라야 한다(대표 09-14). */
  facilitiesNote: string;
  capacity?: number;
  hours: string;

  /** ⭐「우리 집 규칙」 — 이 기능에서 제일 중요한 칸이다. 열쇠를 넘기는 두려움이 여기서 풀린다. 빈칸 금지. */
  rules: string;
  priceDay: number;
  /** 사장님이 알려주는 시간(분). 0이면 그 상품을 안 판다. */
  mentorMinutes: number;
  mentorPrice: number;
  /** 비는 날 `YYYY-MM-DD`. ⭐실사에서 이 데이터를 가진 소개서가 23곳 중 0곳이었다. 폼의 필수 칸. */
  openDates: string[];

  /** 🚨1단계는 음식·음료를 안 받는다(무신고 영업 — 식품위생법 제37조 ④). true면 등록을 막는다. */
  servesFood: boolean;
  /** 임대인 동의를 받았거나 본인 소유인가. 등록 시 확인받는다. */
  subleaseOk: boolean;

  // ─── 09-16 개편: 시간 단위 · 커피챗 · 카테고리 두 축 ───
  // ⚠️위쪽 옛 칸들(tagline·hours·priceDay·openDates·mentor*·useType·accessNote·servesFood·subleaseOk)은
  //   **아직 안 지운다.** 화면이 다 옮겨간 뒤에 따로 내린다([[schema-rename-checklist]]: 축소는 맨 마지막).

  category: SpaceCategory;
  /** ⚠️옛 칸(09-18 상품 셋으로 바뀜). 읽는 곳이 남아 있어 저장 때 호환 값을 같이 쓴다 —
   *  공간 전체만 켜졌으면 `with_gear`, 아니면 `space_only`(`rent-products`의 `compatScopePrice`). */
  scope: SpaceScope;

  /** ⏱시간당 값. 🔁09-19 눈금이 30분이 됐다(대표) — 값은 시간당으로 적고 30분 단위로 나눠 받는다(`priceForMinutes`). */
  priceHour: number;
  /** 최소 대여 시간(시간). 🔁09-19부터 30분 눈금이라 `1.5`가 올 수 있다. 비교는 분으로 한다(`minHoursToMinutes`),
   *  보일 땐 `durationLabel`로 적는다(「1시간 30분」). DB는 `min_minutes`(09-19 SQL)가 있으면 그걸, 없으면 옛 `min_hours`를 읽는다. */
  minHours: number;

  /** 🛍사장님이 파는 공간 상품 둘(대표 09-18: 「대관만, 공간 전체(대관·시설), 커피챗 이렇게 3개 상품」).
   *  대관만 = 자리만 쓴다. 공간 전체 = 자리에 시설·장비까지. 켠 것마다 시간당 값과 «무엇을 쓰고 할 수 있는지» 설명.
   *  ⭐최소 하나는 켜져 있어야 올릴 수 있다. 커피챗은 아래 옛 칸(`coffeeChat*`)이 셋째 상품이다.
   *  ⚠️`priceHour`는 이제 «켜진 상품 중 낮은 값»이다(목록 「N원부터」). 금액 계산은 이 칸들로 한다. */
  rentSpaceOn: boolean;
  rentSpacePrice: number;
  rentSpaceNote: string;
  rentFullOn: boolean;
  rentFullPrice: number;
  rentFullNote: string;
  /** 날짜별로 열어 두는 시간대. 비었으면 아무도 신청할 수 없다(폼에서 막는다). */
  openSlots: OpenSlot[];
  /** 🔁매주 계속 여는 요일 규칙. ⚠️`openSlots`는 이미 이 규칙을 펼친 값이다(`toSpace`). 저장할 때 펼친 칸은 도로 뺀다. */
  repeatWeekly: RepeatRule[];

  /** ☕커피챗 — 「선배에게 현업 이야기 듣기」(대표 09-16).
   *  ⭐파는 것은 «비법»이 아니다. 레시피를 한 줄도 안 주고도 하루가 어떻게 돌아가는지는 들려줄 수 있고,
   *    창업을 생각하는 사람에게 값어치가 있는 건 그쪽이다. */
  coffeeChat: boolean;
  coffeeChatMinutes: number;
  coffeeChatPrice: number;
  /** 들려줄 수 있는 내용(여러 줄). 호스트가 「비법을 팔라는 건가」 하고 겁내지 않게 범위를 스스로 적는다. */
  coffeeChatTopics: string;

  accessHow: AccessHow;

  /** ☎️**매장** 전화. 🚨청약 «전»에 보여야 한다 — 전자상거래법 제20조②(시행 2026-07-21 개정).
   *  통신판매중개자는 사업자 호스트의 성명·주소·전화번호를 확인해 청약 전 소비자에게 제공해야 하고,
   *  안 하면 제20조의2②로 **우리가 연대 책임**을 진다.
   *  ⭐호스트 «개인 휴대폰»은 여기가 아니다(프로필에 있고 확정 후에 열린다). */
  contactPhone: string;
  /** 📜호스트 약관에 동의한 시각. 약관규제법 제3조③④ — 중요 내용은 설명하고 동의받아야 계약 내용이 된다. */
  hostTermsAt?: string;

  // ─── 🧾09-18 사업자 확인(대표 09-17: 공간 등록에 사업자 확인 필수) ───
  //   «공간마다» 둔다. 사장님 한 분이 가게 둘을 올릴 수 있다. 규칙 = `lib/bizcheck.ts`, 국세청 조회 = `lib/nts-bizcheck.ts`.
  //   🔒번호·대표자·개업일·등록증 경로는 공개 투영(`SpacePublic`)에서 뺀다. 공개 화면이 쓰는 건 «확인됐나» 하나뿐이다.
  /** 🏷09-19 상호 — 사업자등록증에 적힌 이름. 판매자 정보 화면(`/rent/[slug]/seller`)에 그대로 나간다(공개 칸).
   *  새 공간은 필수, 옛 공간(09-19 전)은 빈 문자열이다. 빈 칸이면 그 화면이 공간 이름을 「(공간 이름)」 표시와 함께 대신 쓴다.
   *  ⚠️SQL(`2026-09-19-rent-biz-name.sql`) 전 DB엔 칸이 없어 빈 값으로 읽히고, 저장은 이 칸만 빼고 간다(`saveSpace`). */
  bizName: string;
  /** 숫자 10자리. 옛 공간(09-18 전)은 빈 문자열이다. */
  bizNumber: string;
  /** 대표자 이름 — 사업자등록증 그대로 */
  bizOwnerName: string;
  /** 개업일 `YYYYMMDD` */
  bizOpenDate: string;
  /** 🔒비공개 저장소 `host-docs`의 경로. URL이 아니다. 관리자만 서명 URL로 연다. */
  bizCertPath: string;
  bizCheckStatus: BizCheckStatus;
  bizCheckDetail?: BizCheckDetail;
  bizCheckedAt?: string;
  /** 관리자가 등록증을 보고 승인한 시각. 사업자 정보가 바뀌면 지운다. 「사업자 확인된 가게」 = 이 값 && valid(`bizVerified`). */
  bizApprovedAt?: string;

  // ─── 🏪09-18 네이버 상호 매칭(대표) — 이름 일치 AND 같은 건물일 때만 채운다(`lib/place-match.ts`) ───
  placeName: string;
  placeAddress: string;
  placeLat?: number;
  placeLng?: number;
  placeMatchedAt?: string;

  // ─── 🔁09-19 저녁 검토 «보완 요청»(반려) · 바뀌기 전 이름·주소 — SQL `2026-09-19-rent-review-reject.sql` ───
  //   «보완 필요» = `status: "pending"` + `reviewRejectedAt`. 상태 칸엔 값을 더하지 않았다(그 SQL 머리말). 판정은 `rent-review`의 `needsFix`.
  //   ⚠️넷 다 선택 칸이다. 저장(`saveSpace`)은 값이 «있을 때만» 이 칸들을 쓴다 — 안 준 칸은 DB 값을 그대로 둔다.
  /** 관리자가 사장님께 남긴 보완 사유. 다시 보내도 남는다(검토 화면 「지난 요청」). 공개하면 지운다. */
  reviewNote?: string;
  /** 보완을 요청한 시각. 사장님이 고쳐 저장하면 지운다. 저장 때 빈 문자열을 주면 «지운다»는 뜻이다(`saveSpace`). */
  reviewRejectedAt?: string;
  /** 이름·주소가 바뀌어 검토로 내려오기 «전» 값(관리자가 마지막으로 본 값). 공개하면 지운다(`rent-review`의 `reviewPrevFor`). */
  reviewPrevName?: string;
  reviewPrevAddress?: string;
  /** 위 칸이 있는 DB인가(SQL을 돌렸나). 읽을 때 채우고 저장하지 않는다. 검토 화면이 [보완 요청]을 열지 이걸로 정한다. */
  reviewReady?: boolean;

  status: SpaceStatus;
  createdAt: string;
  updatedAt: string;
}

/** 확정 «전» 화면에 나가는 투영.
 *
 *  🔁**09-16에 방향이 뒤집혔다.** 09-13엔 주소·좌표를 감췄다 — 대표: *「사장님과 연결을 미리 해버리면
 *  우리 결제 없이 그들끼리 거래로 해버릴 수도 있을 것 같아서」*. 그런데 09-16에 대표가 정확한 핀을 요청하며
 *  *「이미 공간 이름이 있어서 (감추는 게) 무의미할 것 같아」*라고 정리했다. 맞는 말이다 —
 *  가게 이름과 사진이 이미 그 가게를 특정한다.
 *
 *  ⚖️그리고 **법이 같은 방향으로 민다.** 전자상거래법 제20조②(시행 2026-07-21)는 통신판매중개자가
 *  사업자 호스트의 성명·주소·전화번호를 확인해 **청약 «전»에** 소비자에게 제공하도록 한다.
 *  감추는 쪽을 고집하면 제20조의2②로 우리가 연대 책임을 진다.
 *
 *  🚨**그래도 빠지는 것이 있다.** 「들어오는 법」(`accessNote`)은 안 나간다 —
 *  도어락 번호 같은 건 애초에 담지 않기로 했고(09-16 `accessHow`), 남아 있는 옛 값도 내보내지 않는다.
 *  호스트 «개인 휴대폰»은 여기 실리지 않는다(프로필에 있고 확정 후에만 열린다).
 *  📌이탈을 막는 건 이제 주소가 아니라 **결제가 먼저라는 순서**다. 그 설계는 그대로다. */
export type SpacePublic = Omit<Space, "accessNote" | "hostTermsAt" | SpaceBizPrivateKey | SpaceReviewPrivateKey> & {
  /** 🚪사업자등록번호가 적혀 있나(09-19 오후). 번호는 빼고 이 참거짓만 싣는다(`toPublic`). 상세가 `spaceListed`로 문을 가른다. */
  bizOnFile: boolean;
};

/** 🔒09-18 공개 화면에 안 나가는 사업자 칸. 상세가 쓰는 건 `bizCheckStatus`·`bizApprovedAt`(확인 표시)뿐이다.
 *  ⚖️09-19 대표 [J] — 상호·대표자·사업자번호·주소·가게 전화는 «판매자 정보» 화면 한 곳에서만 보인다(`/rent/[slug]/seller`).
 *    그 화면은 원본(`getSpaceFull`)을 읽어 필요한 칸만 꺼낸다. 목록·상세로 나가는 이 투영에서는 여전히 뺀다. */
export type SpaceBizPrivateKey = "bizNumber" | "bizOwnerName" | "bizOpenDate" | "bizCertPath" | "bizCheckDetail";

/** 🔒09-19 저녁 공개 화면에 안 나가는 검토 칸 — 보완 사유는 관리자와 그 사장님 사이의 말이다. */
export type SpaceReviewPrivateKey = "reviewNote" | "reviewRejectedAt" | "reviewPrevName" | "reviewPrevAddress" | "reviewReady";

/** 국세청 조회 상태. none = 아직 못 물어봄(키 없음 등) · valid · mismatch(기록과 다름) · closed(휴업·폐업) · error(조회 실패). */
export type BizCheckStatus = "none" | "valid" | "mismatch" | "closed" | "error";

/** 조회 결과 요약. 국세청 응답 통째가 아니라 판단에 쓴 코드만 남긴다. */
export interface BizCheckDetail {
  /** none·error의 사유 — no-key · mock · network · http-4xx · bad-response · unknown-status.
   *  🧪valid인데 `local-test`면 개발 서버의 테스트 번호라 국세청에 묻지 않은 것이다(`bizcheck` `localTestCheck`). */
  reason?: string;
  /** 진위확인 "01" 일치 / "02" 불일치 */
  valid?: string;
  validMsg?: string;
  /** 납세자 상태 "01" 계속 / "02" 휴업 / "03" 폐업 */
  bSttCd?: string;
  bStt?: string;
  endDt?: string;
  taxType?: string;
}

/** ⭐`pending`만 돈이 오기 «전»이다. 나머지는 전부 결제가 끝난 뒤의 이야기다.
 *  pending   결제창으로 보내기 직전에 잡아 둔 자리. 🚨**호스트에게는 안 보인다**
 *  paid      결제 완료, 호스트 답 기다리는 중
 *  confirmed 호스트 수락 → 주소·연락처·소개서 링크가 열린다
 *  rejected  호스트 거절 (→ refunded로 이어진다)
 *  refunded  환불 완료
 *  cancelled 게스트 취소. ⚠️환불률은 **우리가** 정한다 — 호스트 자율은 전자상거래법 제35조로 무효가 될 수 있다
 *  done      그날이 지났다 */
export type BookingStatus =
  | "pending" | "paid" | "confirmed" | "rejected" | "refunded" | "cancelled" | "done"
  // ⏳09-16 — 결제창만 열고 30분이 지난 신청. 토스 결제가 EXPIRED가 되는 것과 짝이다.
  | "expired";

export interface SpaceBooking {
  id: number;
  spaceId: number;
  guestUserId: number;
  guestBrandSlug: string;
  /** ☎️신청 때 받은 손님 번호(대표 09-17). 프로필 번호보다 이쪽이 먼저다 — 그 예약에 쓰라고 적은 번호라서.
   *  빈 문자열이면 옛 예약이다. 그땐 프로필 번호로 물러선다. */
  guestPhone: string;
  /** 🪪신청 때 받은 이용자 성함(실명, 대표 09-18). 이용 당일 사장님이 신분을 확인하는 이름이다.
   *  빈 문자열이면 옛 예약(칸이 생기기 전)이다. 그땐 화면·메일이 프로필 브랜드명으로 물러선다. */
  guestName: string;

  useDate: string;
  /** ⚠️옛 칸. 새 코드는 `startTime`/`endTime`을 쓴다. */
  hours: string;
  /** `HH:MM`. 시간 단위 전환(09-16)으로 생긴 칸 — 하루 통째가 아니라 「오후 세 시간」을 판다. */
  startTime: string;
  endTime: string;
  /** ⚠️옛 칸 — 끝 − 시작(«꽉 찬» 시간, 정수). 09-19에 30분 단위가 되면서 반 시간을 못 담아 `minutesCount`로 넘어갔다.
   *  DB 칸(`hours_count integer`)이 남아 있어 저장 때 내림 값을 같이 적는다. 새 코드는 읽지 않는다. */
  hoursCount: number;
  /** 끝 − 시작(분). ⭐**금액의 근거를 행에 박아 둔다** — 나중에 공간의 시간당 값이 바뀌어도
   *  이 거래가 얼마짜리였는지는 이 숫자와 `amountSpace`로 되짚을 수 있다(`feeRate`를 박아 두는 것과 같은 이유).
   *  🔁09-19 신설(`2026-09-19-rent-half-hour.sql`). 칸이 없는 DB에선 시작·끝 시각의 차이로 채워 읽는다. */
  minutesCount: number;
  /** 🛍고른 공간 상품(09-18). 옛 예약은 SQL이 그 공간의 옛 범위로 채웠다. `amountSpace`는 이 상품 값 × 시간이다. */
  product: RentProduct;
  /** ⭐게스트가 쓴 「그날 무엇을 할 건지」. 호스트가 수락을 결정하는 근거이자,
   *  나중에 이 사람 소개서의 첫 활동 기록이 되는 문장이다. */
  plan: string;
  headcount?: number;

  /** ⚠️옛 칸 둘. 새 코드는 `withChat`/`amountChat`을 쓴다. */
  withMentor: boolean;
  amountMentor: number;
  /** ☕커피챗을 같이 샀는가 (09-16). */
  withChat: boolean;
  amountChat: number;
  amountSpace: number;
  amountTotal: number;
  /** ⚠️행마다 박아 둔다 — 요율이 바뀌어도 옛 거래는 **그때 값**으로 정산해야 한다. */
  feeRate: number;
  amountPayout: number;

  paymentKey: string;
  orderId: string;
  status: BookingStatus;
  /** 🙋사장님이 «관리자에게 환불 신청»한 시각(대표 09-16). 비어 있으면 신청 없음.
   *  신청 중에도 예약 상태는 그대로다 — 관리자가 전화로 확인하고 승인해야 환불(refunded)로 넘어간다. */
  refundRequestedAt?: string;
  refundRequestNote: string;
  hostMessage: string;
  decidedAt?: string;
  /** ⏰이용 전날 리마인드를 보낸 시각(09-17). 비어 있으면 아직 안 보냈다 — 하루 한 번 도는 작업이 두 번 안 보내게. */
  remindedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── 결제 (2026-09-16) ───
// ⭐예약(`SpaceBooking`)은 «무슨 일이 있었나», 결제(`Payment`)는 «돈이 어디 있나»다. 테이블도 둘이다.
//   두 상태를 바꾸는 문은 DB 함수 `rent_sync` 하나다(`lib/spaces.ts`의 `rentSync`) — 한 트랜잭션에서 같이 움직인다.

/** 토스 Payment.status 이름 그대로(토스 문서 대조, 09-16). 번역표를 두지 않는다. */
export type PaymentStatus =
  | "READY" | "IN_PROGRESS" | "WAITING_FOR_DEPOSIT" | "DONE"
  | "CANCELED" | "PARTIAL_CANCELED" | "ABORTED" | "EXPIRED";

/** 사장님께 보내는 돈(토스 지급대행)의 상태. 결제 줄 하나에 붙는다. */
export type PayoutStatus = "NONE" | "WAITING" | "REQUESTED" | "DONE" | "FAILED";

export interface Payment {
  id: number;
  orderId: string;
  /** 승인 전엔 빈 문자열. 토스 환불 API는 이 키로만 부를 수 있다. */
  paymentKey: string;
  purpose: "rent_booking";
  bookingId?: number;
  buyingUserId?: number;
  /** 돈을 받을 사람. 판매자가 «우리»인 결제(리포트 유료화)엔 비어 있다. */
  sellingUserId?: number;
  /** 처음 낸 돈(토스 totalAmount). 환불해도 안 바뀐다. */
  amount: number;
  /** 환불하고 «남은» 돈(토스 balanceAmount). 사장님 몫은 여기서 계산한다(호스트 약관 제8조). */
  balanceAmount: number;
  method: string;
  status: PaymentStatus;
  approvedAt?: string;
  canceledAt?: string;
  feeRate: number;
  payoutAmount: number;
  payoutStatus: PayoutStatus;
  payoutRequestedAt?: string;
  payoutDoneAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** 토스가 돌려주는 Payment 객체. 우리가 읽는 칸만 적고 나머지는 그대로 DB `toss_raw`에 담는다. */
export interface TossPayment {
  paymentKey?: string;
  orderId?: string;
  status: PaymentStatus;
  totalAmount?: number;
  balanceAmount?: number;
  method?: string;
  approvedAt?: string;
  cancels?: { cancelAmount: number; cancelReason?: string; canceledAt: string }[];
  [k: string]: unknown;
}
