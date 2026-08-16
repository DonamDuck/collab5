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
  showcases: Block[]; // 선택 블록(순서 보존) (DB=showcases, 구 blocks)
  enrichment?: Enrichment; // 크롤 스냅샷(생성 시 기록, 수정 시 보존). 없으면 undefined
  introFileUrl?: string; // 소개자료 PDF(코어 위계)
  keywords: string[]; // 브랜드를 표현하는 키워드 칩 (DB=keywords, 구 soul.values)
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
