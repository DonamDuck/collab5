// 데이터 계층 인터페이스 + mock 구현.
// UI는 `repo`(인터페이스)에만 의존 → 나중에 Supabase 구현으로 교체 시 이 파일만 바꾼다.
// (DB는 '공유 → 타인 열람(view) 루프 = 배포 시점'에 투입 — masterbrain 2026-06-21 결정)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BrandDna, Collab, CollabCard, CollabInput, CollabOrigin, CollabReportData, CollabReportListItem, CollabStatus, CollabType, Maker, MakerStatus, Reaction, ViewEvent } from "./types";
import { kstIso } from "./time";
import { orderedIdeaTitles } from "./report-cards";
import { isDemoSlug } from "./demo";

export interface Repo {
  // 업체
  createMaker(input: Omit<Maker, "id" | "createdAt" | "status">): Promise<Maker>;
  getMakerBySlug(slug: string): Promise<Maker | null>;
  getMakerById(id: number): Promise<Maker | null>;
  updateMakerContent(slug: string, content: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash" | "status">): Promise<Maker | null>;
  /** ⚠️`searchVisible` = 화면상 **[콜라보 찾기에 보이기]**(홈·`/search` 목록). 08-07 개명 전 이름이
   *  「검색에 보이기」라 웹 검색으로 오해됐는데, **구글·네이버 노출과는 무관**하다(사이트맵은 전부 싣는다). */
  setMakerFlags(slug: string, flags: { searchVisible?: boolean }): Promise<Maker | null>;
  setMakerOwner(slug: string, ownerUserId: number): Promise<void>;
  setMakerPasswordHash(slug: string, hash: string): Promise<void>;
  /** enrichment 스냅샷 교체 — B35 특장점 [지우기] 전용. updateMakerContent는 enrichment를 의도적으로 보존한다. */
  setMakerEnrichment(slug: string, enrichment: Maker["enrichment"] | null): Promise<void>;
  deleteMaker(slug: string): Promise<void>;
  listMakersByOwner(ownerUserId: number): Promise<Maker[]>;
  searchMakers(q: string): Promise<Maker[]>;
  listHomeMakers(limit: number): Promise<Maker[]>; // 홈 그리드 — 검색 노출(=콜라보 가능) + active, ⭐최신순(07-31 반전: 오래된 순+상한이면 방금 소개서 만든 씨딩 사장님이 홈에서 자기 브랜드를 못 본다)
  /** 사이트맵(구글·네이버에 낼 주소 목록) 전용 — slug와 수정시각만. 08-07 신설.
   *  ⭐**소개서를 새로 만들면 자동으로 들어간다** — 사이트맵을 정적으로 적어두지 않고 매번 DB에서 뽑는 이유(대표 지시).
   *  ⚠️`listHomeMakers` 재사용을 일부러 피했다: 그건 카드용이라 사진·블록 jsonb까지 통째로 읽어오는데
   *     사이트맵엔 주소와 날짜뿐이다. 브랜드가 늘수록 이 차이가 커진다. */
  listSitemapBrands(): Promise<{ slug: string; updatedAt: string }[]>;
  // 카드
  createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard>;
  getCardBySlug(slug: string): Promise<CollabCard | null>;
  // 지표
  recordView(cardId: number, ref?: string): Promise<ViewEvent>;
  countViews(cardId: number): Promise<number>;
  recordReaction(cardId: number, type: Reaction["type"]): Promise<Reaction>;
  // 찜(저장) — 로그인 유저별. 소유권/게이트 검증은 actions에서.
  isMakerSaved(userId: number, makerId: number): Promise<boolean>;
  setMakerSaved(userId: number, makerId: number, saved: boolean): Promise<void>;
  listSavedMakers(userId: number): Promise<Maker[]>;
  // 콜라보 제안 인텐트(append-only) — "콜라보 시작하기" 계측
  recordCollabRequest(fromUserId: number | null, toBrandId: number, channel: string, fromBrandId?: number | null): Promise<void>;
  // Brand DNA(brands.dna, 파생 해석층) + 콜라보 리포트(collab_reports, append-only 쌍 캐시) — 스펙 2026-07-25
  getBrandDna(brandId: number): Promise<BrandDna | null>;
  setBrandDna(brandId: number, dna: BrandDna): Promise<void>;
  getLatestCollabReport(fromBrandId: number, toBrandId: number): Promise<{ report: CollabReportData; model: string; createdAt: string } | null>;
  /** 여러 from × 하나의 to를 **한 번에** — 소개서 페이지가 "로딩 없이 바로 열 쌍"을 고를 때 쓴다(08-09).
   *  ⚠️브랜드마다 `getLatestCollabReport`를 도는 대신 이걸 쓴다: 대표 계정은 소개서가 14개라
   *     낱개로 돌면 페이지 로드마다 DB 왕복이 수십 번 된다. 대부분의 쌍은 애초에 리포트가 없으니
   *     **먼저 이걸로 후보를 좁히고** 그 몇 건만 DNA 신선도를 확인하는 순서가 맞다. */
  listLatestCollabReportsTo(fromBrandIds: number[], toBrandId: number): Promise<Map<number, { report: CollabReportData; model: string; createdAt: string }>>;
  /** 이 쌍의 리포트를 이 사용자가 요청한 적이 있나 — 소유권을 넘긴 뒤에도 **읽기만** 열어주기 위한 확인(08-07).
   *  ⚠️소유 검사의 대체가 아니다. 생성(유료 콜)은 여전히 `from.ownerUserId === userId`만 통과한다. */
  wasCollabReportRequestedBy(fromBrandId: number, toBrandId: number, userId: number): Promise<boolean>;
  insertCollabReport(r: { fromBrandId: number; toBrandId: number; requestedBy: number | null; report: CollabReportData; model: string }): Promise<void>;
  listCollabReportsByUser(userId: number): Promise<CollabReportListItem[]>; // /my 아카이브 — 쌍별 최신 1건
  // ⭐성사된 콜라보 = 북극성. 스펙 = Obsidian [[성사-기록-계측]]
  recordCollab(input: CollabInput, recordedBy: number | null): Promise<void>;
  listCollabsForBrands(brandIds: number[]): Promise<Collab[]>; // /my — 내 소개서가 한쪽이라도 낀 성사
  /** 성사 기록을 소개서 "함께한 콜라보"에도 흘려보낸다(F5 → F6). 읽고-덧붙이고-쓴다. */
  appendCollabHistory(brandId: number, item: Maker["collabHistory"][number]): Promise<void>;
}

const now = () => kstIso(); // 시각 표기 = KST(+09:00), lib/time.ts

/** 소개서 "함께한 콜라보" 카드 상한 — register 폼(`collabHistory.length < 5`)과 같은 값이어야 한다. */
const HISTORY_MAX = 5;

/** 지역의 상위 2토막만 — "서울 마포구 연남동" → "서울 마포구". 카드 한 줄에 들어가는 식별 단위. */
const topRegion = (region?: string | null): string | undefined => {
  const t = (region ?? "").trim().split(/\s+/).filter(Boolean).slice(0, 2).join(" ");
  return t || undefined;
};

// ── 시드: 캔버스가든 = 1호 등록(테스트베드) ──
const seedMakers: Maker[] = [
  {
    id: 1,
    slug: "canvasgarden",
    name: "캔버스가든",
    oneLiner: "패브릭으로 짓는 친환경 가방과 조각 워크숍",
    region: "서울",
    offers: ["워크숍", "제품콜라보", "팝업"],
    seeks: ["공간대여", "행사참여", "공동콘텐츠"],
    targetAudience: ["20-30대 여성", "친환경 라이프스타일", "핸드메이드 애호가"],
    collabHistory: [
      {
        partner: "오월의숲",
        types: ["팝업", "워크숍"],
        desc: "연남 매장 한켠에서 한 달간 조각보 팝업과 원데이 워크숍을 함께 열었어요.",
        year: "2025",
        photos: [
          "https://picsum.photos/seed/cg-collab1/900/700",
          "https://picsum.photos/seed/cg-collab2/900/700",
        ],
      },
      { partner: "스톤브루", types: ["제품콜라보"], photos: [] },
    ],
    description: "버려지는 천에 새 이야기를 입히는 패브릭 브랜드.",
    story:
      "버려지는 원단이 아까워 시작한 취미가 브랜드가 됐어요.\n한 조각씩 이어 붙이다 보니, 사람들도 하나둘 모이더라고요.",
    activities: [
      {
        title: "조각보 가방 제작",
        desc: "폐원단을 이어 만든 시그니처 라인. 시즌마다 새 조합을 선보여요.",
        photos: [
          "https://picsum.photos/seed/cg-act1/900/700",
          "https://picsum.photos/seed/cg-act2/900/700",
        ],
      },
      {
        title: "패브릭 조각 워크숍",
        desc: "천 조각으로 나만의 소품을 만드는 2시간 클래스.",
        photos: [],
      },
    ],
    offersDescription: "저희 공간·재료·커리큘럼을 들고 어디든 갈 수 있어요. 브랜드 결이 맞다면 형태는 함께 정해요.",
    seeksDescription: "손으로 만드는 일의 가치를 아는 분들과 느슨하고 길게 협업하고 싶어요.",
    photos: [
      "https://picsum.photos/seed/canvasgarden1/900/700",
      "https://picsum.photos/seed/canvasgarden2/900/700",
      "https://picsum.photos/seed/canvasgarden3/900/700",
    ],
    showcases: [
      {
        type: "metrics",
        items: [
          { label: "인스타 팔로워", value: "8,200" },
          { label: "워크숍 누적 수강생", value: "640명" },
          { label: "재방문율", value: "38%" },
        ],
        photos: [],
        links: [],
      },
      {
        type: "reviews",
        items: [
          { quote: "천 조각이 이렇게 예쁜 가방이 될 줄 몰랐어요.", source: "워크숍 수강생" },
          { quote: "선물했는데 받은 분이 브랜드를 먼저 찾아봤대요." },
        ],
        photos: [],
        links: [],
      },
      {
        type: "team",
        intro: "디자이너 1명, 재봉 장인 1명. 작지만 손이 빠른 팀이에요.",
        photos: ["https://picsum.photos/seed/cg-team1/900/700"],
        links: [],
      },
      {
        type: "press",
        items: [
          { title: "버려진 천의 두 번째 삶 — 캔버스가든 인터뷰", year: "2025", desc: "폐원단을 가방으로 되살리는 작업 방식을 자세히 다뤄줬어요." },
          { title: "서울 업사이클 브랜드 5선", desc: "지속가능한 로컬 브랜드로 함께 소개됐어요." },
        ],
        photos: [],
        links: [{ label: "인터뷰 기사", url: "https://example.com/canvasgarden-interview" }],
      },
      {
        type: "space",
        desc: "성수동 작업실 겸 쇼룸. 12명까지 워크숍이 가능해요.",
        features: ["재봉틀 6대", "빔프로젝터", "주차 2대"],
        photos: ["https://picsum.photos/seed/cg-space1/900/700"],
        links: [],
      },
      {
        type: "custom",
        title: "지속가능성 약속",
        body: "모든 제품은 폐원단 70% 이상으로 만들어요.\n남는 자투리도 워크숍 재료로 다시 씁니다.",
        photos: [],
        links: [{ url: "https://example.com/canvasgarden-sustainability" }],
      },
    ],
    keywords: ["친환경", "손맛", "느린 호흡"],
    trust: {
      homepage: "https://www.canvasgarden.shop",
      instagram: "@canvasgarden",
      address: "서울 성동구 성수이로 88 2층 캔버스가든",
    },
    searchVisible: true,
    status: "active",
    createdAt: now(),
  },
  {
    id: 2,
    slug: "owolforest",
    name: "오월의숲",
    oneLiner: "계절을 담는 빈티지 편집숍 & 작은 전시 공간",
    region: "서울 연남",
    offers: ["공간대여", "팝업", "행사참여"],
    seeks: ["워크숍", "제품콜라보"],
    targetAudience: ["빈티지 애호가", "동네 단골", "감성 공간 탐방러"],
    collabHistory: [],
    description: "오래된 물건에 다시 온기를 더하는 편집숍.",
    story: "",
    activities: [],
    offersDescription: "",
    seeksDescription: "",
    photos: [],
    showcases: [],
    keywords: ["빈티지", "큐레이션", "계절감"],
    trust: {
      instagram: "@owol.forest",
      address: "서울 마포구 연남동",
    },
    searchVisible: true,
    status: "active",
    createdAt: now(),
  },
  {
    id: 3,
    slug: "stonebrew",
    name: "스톤브루",
    oneLiner: "직접 로스팅하는 동네 스페셜티 카페",
    region: "부산 영도",
    offers: ["공간대여", "공동콘텐츠", "공동굿즈"],
    seeks: ["제품콜라보", "팝업"],
    targetAudience: ["커피 애호가", "로컬 워커", "여행자"],
    collabHistory: [],
    description: "영도 바다를 닮은 깊고 진한 한 잔.",
    story: "",
    activities: [],
    offersDescription: "",
    seeksDescription: "",
    photos: [],
    showcases: [],
    keywords: ["로컬", "정성", "느긋함"],
    trust: {
      instagram: "@stonebrew.coffee",
      address: "부산 영도구",
    },
    searchVisible: true,
    status: "active",
    createdAt: now(),
  },
  {
    id: 4,
    slug: "hidanglib",
    name: "호락호락 도서관",
    oneLiner: "그림책과 손글씨가 머무는 작은 동네 책방",
    region: "제주",
    offers: ["워크숍", "행사참여", "공간대여"],
    seeks: ["공동콘텐츠", "공동굿즈"],
    targetAudience: ["그림책 애호가", "아이와 부모", "여행자"],
    collabHistory: [],
    description: "천천히 머물다 가는 그림책 책방.",
    story: "",
    activities: [],
    offersDescription: "",
    seeksDescription: "",
    photos: [],
    showcases: [],
    keywords: ["다정함", "느린 호흡", "손글씨"],
    trust: {
      instagram: "@horak.lib",
      address: "제주시",
    },
    searchVisible: true,
    status: "active",
    createdAt: now(),
  },
  // ── 데모 시드: /preview 로컬 검증용 고정본 2종 (검색 미노출·콜라보 닫힘) ──
  {
    id: 5,
    slug: "m-demo-photo",
    name: "모루초 스튜디오",
    oneLiner: "쌀로 굽는 비건 구움과자와 시골 부엌 클래스",
    region: "전주",
    offers: ["제품콜라보", "워크숍"],
    seeks: ["팝업", "공간대여"],
    targetAudience: ["비건 지향", "디저트 애호가"],
    collabHistory: [
      {
        partner: "동네정미소",
        types: ["제품콜라보"],
        desc: "햅쌀 출시에 맞춰 쌀 카스텔라를 함께 만들었어요.",
        year: "2025",
        photos: ["https://picsum.photos/seed/demo-p-collab1/900/700"],
      },
    ],
    description: "쌀과 계절 곡물로만 굽는 작은 비건 베이커리.",
    story: "할머니 부엌에서 배운 쌀 반죽이 시작이었어요.",
    activities: [
      {
        title: "쌀 구움과자 정기 굽기",
        desc: "매주 목요일, 그 주의 곡물로 굽는 스몰배치.",
        photos: [
          "https://picsum.photos/seed/demo-p-act1/900/700",
          "https://picsum.photos/seed/demo-p-act2/900/700",
        ],
      },
    ],
    offersDescription: "레시피 개발부터 소량 생산까지 같이 할 수 있어요.",
    seeksDescription: "로컬 재료를 쓰는 공간·브랜드를 만나고 싶어요.",
    photos: [
      "https://picsum.photos/seed/demo-photo1/900/700",
      "https://picsum.photos/seed/demo-photo2/900/700",
    ],
    showcases: [
      {
        type: "reviews",
        items: [{ quote: "쌀로 만든 게 맞나 싶게 촉촉해요.", source: "단골 손님" }],
        photos: ["https://picsum.photos/seed/demo-p-block1/900/700"],
        links: [],
      },
    ],
    keywords: ["비건", "로컬", "수작업"],
    trust: {
      instagram: "@morucho.studio",
      address: "전북 전주시 완산구 한옥마을길 12",
    },
    searchVisible: false,
    status: "active",
    createdAt: now(),
  },
  {
    id: 6,
    slug: "m-demo-none",
    name: "밑줄서점",
    oneLiner: "문장을 수집하는 심야 책방",
    region: "대구",
    offers: ["행사참여", "공동콘텐츠"],
    seeks: ["워크숍", "공동굿즈"],
    targetAudience: ["책 애호가", "글 쓰는 사람"],
    collabHistory: [
      {
        partner: "새벽라디오",
        types: ["공동콘텐츠"],
        desc: "매달 마지막 금요일, 낭독 방송을 함께 만들어요.",
        year: "2026",
        photos: [],
      },
    ],
    description: "밑줄 그은 문장을 매개로 사람을 잇는 책방.",
    story: "좋아하는 문장에 밑줄을 긋다가, 밑줄을 나누는 가게를 열었어요.",
    activities: [
      {
        title: "심야 낭독회",
        desc: "밤 10시, 조명 하나 켜고 서로의 밑줄을 읽는 모임.",
        photos: [],
      },
    ],
    offersDescription: "글과 목소리로 하는 협업이라면 무엇이든 열려 있어요.",
    seeksDescription: "책과 어울리는 물성을 만드는 분들을 찾고 있어요.",
    photos: [],
    showcases: [
      {
        type: "custom",
        title: "이달의 밑줄",
        body: "\"우리는 서로의 용기가 될 수 있다.\"\n— 이달의 수집 문장 중에서",
        photos: [],
        links: [],
      },
    ],
    keywords: ["문장", "밤", "다정함"],
    trust: {
      instagram: "@midnight.underline",
      address: "대구 중구 종로 24 1층",
    },
    searchVisible: false,
    status: "active",
    createdAt: now(),
  },
];

// ── 시드 카드: 카드 렌더 확인/데모용 (캔가 → 오월의숲) ──
const seedCards: CollabCard[] = [
  {
    id: 1,
    slug: "canvasgarden-demo",
    fromBrandId: 1,
    proposal: {
      toName: "오월의숲",
      why: "오월의숲의 빈티지 큐레이션이 저희 워크숍 무드와 정말 잘 맞아요. 결이 닿는 공간이라고 느꼈어요.",
      picture: "한 달간 매장 한켠에서 조각 워크숍을 함께 열어요.",
      expectedEffect: "서로의 단골을 자연스럽게 소개하게 돼요.",
    },
    createdAt: now(),
  },
];

class InMemoryRepo implements Repo {
  private makers: Maker[] = [...seedMakers];
  private cards: CollabCard[] = [...seedCards];
  private views: ViewEvent[] = [];
  private reactions: Reaction[] = [];
  private saved: { userId: number; makerId: number; createdAt: string }[] = [];
  private collabRequests: { fromUserId: number | null; toBrandId: number; channel: string; fromBrandId: number | null; createdAt: string }[] = [];
  // 정수 시퀀스 카운터 (DB의 identity 흉내)
  private nextMakerId = this.makers.length + 1;
  private nextCardId = this.cards.length + 1;
  private nextViewId = 1;
  private nextReactionId = 1;

  async createMaker(input: Omit<Maker, "id" | "createdAt" | "status">): Promise<Maker> {
    const maker: Maker = { status: "active", ...input, id: this.nextMakerId++, createdAt: now(), updatedAt: now() };
    this.makers.push(maker);
    return maker;
  }
  async getMakerBySlug(slug: string) {
    return this.makers.find((m) => m.slug === slug && m.status !== "inactive") ?? null;
  }
  async getMakerById(id: number) {
    return this.makers.find((m) => m.id === id && m.status !== "inactive") ?? null;
  }
  async updateMakerContent(slug: string, c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash" | "status">): Promise<Maker | null> {
    const m = this.makers.find((x) => x.slug === slug);
    if (!m) return null;
    Object.assign(m, c);
    return m;
  }
  async setMakerFlags(slug: string, flags: { searchVisible?: boolean }): Promise<Maker | null> {
    const m = this.makers.find((x) => x.slug === slug);
    if (!m) return null;
    if (flags.searchVisible !== undefined) m.searchVisible = flags.searchVisible;
    return m;
  }
  async setMakerOwner(slug: string, ownerUserId: number): Promise<void> {
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.ownerUserId = ownerUserId;
  }
  async setMakerEnrichment(slug: string, enrichment: Maker["enrichment"] | null): Promise<void> {
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.enrichment = enrichment ?? undefined;
  }
  async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.editPasswordHash = hash;
  }
  async deleteMaker(slug: string): Promise<void> {
    // 소프트 삭제(2026-07-22): 하드 splice 대신 status=inactive
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.status = "inactive";
  }
  async listMakersByOwner(ownerUserId: number): Promise<Maker[]> {
    return this.makers.filter((x) => x.ownerUserId === ownerUserId && x.status !== "inactive");
  }
  async searchMakers(q: string) {
    const t = q.trim().toLowerCase();
    const visible = this.makers.filter((m) => m.searchVisible && m.status !== "inactive");
    if (!t) return visible;
    return visible.filter((m) =>
      [m.name, m.oneLiner, ...m.keywords, ...m.offers, ...m.seeks]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }
  async listHomeMakers(limit: number): Promise<Maker[]> {
    return this.makers
      .filter((m) => m.searchVisible && m.status !== "inactive")
      .sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1)) // 최신순 — 인터페이스 주석 참조
      .slice(0, limit);
  }
  async listSitemapBrands(): Promise<{ slug: string; updatedAt: string }[]> {
    // ⚠️`searchVisible`로 거르지 않는다 — 사이트맵은 웹 검색용(Supabase 구현 주석 참조).
    return this.makers
      .filter((m) => m.status !== "inactive" && !isDemoSlug(m.slug))
      .map((m) => ({ slug: m.slug, updatedAt: m.updatedAt || m.createdAt }));
  }

  async createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard> {
    const card: CollabCard = { ...input, id: this.nextCardId++, createdAt: now() };
    this.cards.push(card);
    return card;
  }
  async getCardBySlug(slug: string) {
    return this.cards.find((c) => c.slug === slug) ?? null;
  }

  async recordView(cardId: number, ref?: string): Promise<ViewEvent> {
    const ev: ViewEvent = { id: this.nextViewId++, cardId, createdAt: now(), ref };
    this.views.push(ev);
    return ev;
  }
  async countViews(cardId: number) {
    return this.views.filter((v) => v.cardId === cardId).length;
  }
  async recordReaction(cardId: number, type: Reaction["type"]): Promise<Reaction> {
    const r: Reaction = { id: this.nextReactionId++, cardId, type, createdAt: now() };
    this.reactions.push(r);
    return r;
  }
  async isMakerSaved(userId: number, makerId: number): Promise<boolean> {
    return this.saved.some((s) => s.userId === userId && s.makerId === makerId);
  }
  async setMakerSaved(userId: number, makerId: number, saved: boolean): Promise<void> {
    const has = this.saved.some((s) => s.userId === userId && s.makerId === makerId);
    if (saved && !has) this.saved.push({ userId, makerId, createdAt: now() });
    else if (!saved) this.saved = this.saved.filter((s) => !(s.userId === userId && s.makerId === makerId));
  }
  async listSavedMakers(userId: number): Promise<Maker[]> {
    return this.saved
      .filter((s) => s.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)) // 최근 찜 먼저
      .map((s) => this.makers.find((m) => m.id === s.makerId && m.status !== "inactive"))
      .filter((m): m is Maker => !!m);
  }
  async recordCollabRequest(fromUserId: number | null, toBrandId: number, channel: string, fromBrandId: number | null = null): Promise<void> {
    this.collabRequests.push({ fromUserId, toBrandId, channel, fromBrandId, createdAt: now() });
  }
  // ── Brand DNA + 콜라보 리포트 (Map 기반 — Supabase와 동일 시그니처) ──
  private dnaByBrand = new Map<number, BrandDna>();
  // status는 Supabase 구현과 **같은 규칙**으로 들고 있는다(08-02). 여기선 마지막이 곧 최신이라
  // 없어도 동작은 같지만, 나중에 "이 리포트 폐기" 경로가 붙었을 때 로컬에서만 다르게 굴면
  // 그 차이를 prod에서 처음 발견하게 된다.
  private reportsByPair = new Map<
    string,
    { report: CollabReportData; model: string; createdAt: string; status: "active" | "inactive"; requestedBy?: number | null }[]
  >();
  async getBrandDna(brandId: number): Promise<BrandDna | null> {
    return this.dnaByBrand.get(brandId) ?? null;
  }
  async setBrandDna(brandId: number, dna: BrandDna): Promise<void> {
    this.dnaByBrand.set(brandId, dna);
  }
  async getLatestCollabReport(fromBrandId: number, toBrandId: number) {
    const list = (this.reportsByPair.get(`${fromBrandId}:${toBrandId}`) ?? []).filter((r) => r.status === "active");
    return list.length > 0 ? list[list.length - 1] : null; // append-only — 마지막 active = 최신
  }
  async listLatestCollabReportsTo(fromBrandIds: number[], toBrandId: number) {
    const out = new Map<number, { report: CollabReportData; model: string; createdAt: string }>();
    for (const fromId of fromBrandIds) {
      const latest = await this.getLatestCollabReport(fromId, toBrandId);
      if (latest) out.set(fromId, latest);
    }
    return out;
  }
  async wasCollabReportRequestedBy(fromBrandId: number, toBrandId: number, userId: number): Promise<boolean> {
    return (this.reportsByPair.get(`${fromBrandId}:${toBrandId}`) ?? []).some((r) => r.requestedBy === userId);
  }
  async insertCollabReport(r: { fromBrandId: number; toBrandId: number; requestedBy: number | null; report: CollabReportData; model: string }): Promise<void> {
    const key = `${r.fromBrandId}:${r.toBrandId}`;
    const list = this.reportsByPair.get(key) ?? [];
    for (const old of list) old.status = "inactive"; // 먼저 내리고 → 그 다음에 넣는다(Supabase와 동일 순서)
    list.push({ report: r.report, model: r.model, createdAt: now(), status: "active", requestedBy: r.requestedBy });
    this.reportsByPair.set(key, list);
  }
  async listCollabReportsByUser(): Promise<CollabReportListItem[]> {
    // mock은 requested_by를 저장하지 않으므로 전 쌍의 최신 1건씩 반환(로컬 UI 확인용으로 충분)
    const items: CollabReportListItem[] = [];
    for (const [key, list] of this.reportsByPair) {
      const latest = list[list.length - 1];
      const [fromId, toId] = key.split(":").map(Number);
      const from = this.makers.find((m) => m.id === fromId);
      const to = this.makers.find((m) => m.id === toId);
      if (!latest || !from || !to) continue;
      items.push({
        fromSlug: from.slug, fromName: from.name, toSlug: to.slug, toName: to.name,
        toRegion: topRegion(to.region),
        matchPoint: latest.report.matchPoints?.[0]?.text,
        ideaTitles: orderedIdeaTitles(latest.report),
        effect: latest.report.effects?.[0],
        createdAt: latest.createdAt,
        report: latest.report,
      });
    }
    return items.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  // ── 성사된 콜라보 ──
  private collabs: (Collab & { recordedBy: number | null })[] = [];
  async recordCollab(input: CollabInput, recordedBy: number | null): Promise<void> {
    const a = this.makers.find((m) => m.id === input.brandAId);
    const b = this.makers.find((m) => m.id === input.brandBId);
    if (!a || !b) throw new Error("brand-not-found");
    this.collabs.push({
      id: this.collabs.length + 1,
      brandAId: a.id, brandAName: a.name, brandASlug: a.slug,
      brandBId: b.id, brandBName: b.name, brandBSlug: b.slug,
      status: input.status ?? "agreed",
      origin: input.origin,
      title: input.title,
      year: input.year ?? "",
      description: input.description ?? "",
      photos: input.photos ?? [],
      link: input.link ?? "",
      createdAt: now(),
      recordedBy,
    });
  }
  async listCollabsForBrands(brandIds: number[]): Promise<Collab[]> {
    const set = new Set(brandIds);
    return this.collabs
      .filter((c) => set.has(c.brandAId) || set.has(c.brandBId))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
  async appendCollabHistory(brandId: number, item: Maker["collabHistory"][number]): Promise<void> {
    const m = this.makers.find((x) => x.id === brandId);
    if (!m || m.collabHistory.length >= HISTORY_MAX) return;
    m.collabHistory = [...m.collabHistory, item];
  }
}

// ── Supabase DB row shapes (snake_case → camelCase 매핑용) ──
// ⚠️ `?`가 붙은 필드 = 부분 select(SEARCH_CARD_COLS 등)에서 빠질 수 있는 컬럼.
//    rowToMaker가 전부 기본값으로 메우므로, 새 필드를 넣을 땐 여기 optional + rowToMaker 기본값을 같이 둘 것.
interface MakerRow {
  id: number; slug: string; name: string; one_liner: string;
  region?: string | null;
  offers?: string[]; seeks?: string[]; target_audience?: string[];
  collab_history?: Maker["collabHistory"];
  story?: string; activities?: Maker["activities"];
  photos?: string[] | null;
  intro_file_url?: string | null;
  trust?: Maker["trust"];
  keywords?: string[] | null; showcases?: Maker["showcases"] | null;
  offers_description?: string | null; seeks_description?: string | null;
  description?: string | null; // 자세히 소개(07-25 trust.description에서 분리 완료)
  search_visible: boolean | null; status: string | null; created_at: string; updated_at?: string | null;
  owner_user_id?: number | null;
  // 수정 비밀번호 해시 — 07-25 claim_token_hash → edit_password_hash 이사(옛 컬럼 폴백)
  edit_password_hash?: string | null; claim_token_hash?: string | null;
  enrichment?: Maker["enrichment"] | null;
  // Brand DNA — 파생 해석층(rowToMaker에 싣지 않음: 도메인 객체 비노출, API가 repo로 직접 읽음)
  dna?: BrandDna | null;
}
interface CardRow {
  id: number; slug: string;
  from_brand_id: number | null;
  proposal: CollabCard["proposal"]; created_at: string;
}
interface ViewRow { id: number; card_id: number; created_at: string; ref: string | null; }
interface ReactionRow { id: number; card_id: number; type: string; created_at: string; }

/** /search 카드가 실제로 읽는 컬럼만(썸네일=photos[0]·필터=offers/seeks). 나머지는 rowToMaker가 기본값으로 채운다. */
const SEARCH_CARD_COLS =
  "id, slug, name, one_liner, region, photos, keywords, offers, seeks, search_visible, status, created_at";

/** /my 목록(내 소개서·찜)과 /m 제안시트의 브랜드 칩이 읽는 컬럼만.
 *  카드가 쓰는 건 slug·name·oneLiner·searchVisible(+칩은 id)뿐인데 전체 select를 하면
 *  dna(브랜드당 수 KB)·showcases·activities·collab_history·enrichment·구 base64 photos까지 딸려온다.
 *  썸네일을 안 그리므로 photos·keywords·region도 제외. */
const LIST_CARD_COLS =
  "id, slug, name, one_liner, search_visible, status, created_at";

function rowToMaker(r: MakerRow): Maker {
  return {
    id: r.id, slug: r.slug, name: r.name, oneLiner: r.one_liner,
    region: r.region ?? undefined,
    offers: (r.offers ?? []) as CollabType[], seeks: (r.seeks ?? []) as CollabType[],
    targetAudience: r.target_audience ?? [],
    collabHistory: (r.collab_history ?? []).map((h) => ({ ...h, photos: h.photos ?? [] })),
    story: r.story ?? "",
    activities: r.activities ?? [],
    offersDescription: r.offers_description ?? "",
    seeksDescription: r.seeks_description ?? "",
    photos: r.photos ?? [],
    showcases: (r.showcases ?? []).map((b) => ({ ...b, photos: b.photos ?? [], links: b.links ?? [] })),
    introFileUrl: r.intro_file_url ?? undefined,
    keywords: r.keywords ?? [],
    description: r.description ?? "",
    trust: r.trust ?? {},
    searchVisible: r.search_visible ?? true,
    status: (r.status as MakerStatus) ?? "active",
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
    ownerUserId: r.owner_user_id ?? undefined,
    editPasswordHash: r.edit_password_hash ?? r.claim_token_hash ?? undefined,
    enrichment: r.enrichment ?? undefined,
  };
}
function rowToCard(r: CardRow): CollabCard {
  return { id: r.id, slug: r.slug, fromBrandId: r.from_brand_id ?? 0, proposal: r.proposal, createdAt: r.created_at };
}

class SupabaseRepo implements Repo {
  private db: SupabaseClient;
  constructor(url: string, key: string) { this.db = createClient(url, key); }

  async createMaker(input: Omit<Maker, "id" | "createdAt" | "status">): Promise<Maker> {
    // id·created_at·updated_at 은 DB가 자동 부여
    const row = {
      slug: input.slug, name: input.name, one_liner: input.oneLiner,
      region: input.region ?? null,
      offers: input.offers, seeks: input.seeks, target_audience: input.targetAudience,
      collab_history: input.collabHistory,
      description: input.description, story: input.story, activities: input.activities,
      offers_description: input.offersDescription, seeks_description: input.seeksDescription,
      photos: input.photos,
      showcases: input.showcases, intro_file_url: input.introFileUrl ?? null,
      keywords: input.keywords, trust: input.trust,
      search_visible: input.searchVisible,
      status: "active", // 생성 default = active (소프트 삭제 시에만 inactive)
      enrichment: input.enrichment ?? null,
      owner_user_id: input.ownerUserId ?? null, edit_password_hash: input.editPasswordHash ?? null,
    };
    const { data, error } = await this.db.from("brands").insert(row).select().single();
    if (error) throw error;
    return rowToMaker(data as MakerRow);
  }
  async getMakerBySlug(slug: string) {
    // status='active'만 — inactive(소프트 삭제)는 /m·수정·검증 전 경로에서 비노출(원천 차단)
    const { data } = await this.db.from("brands").select().eq("slug", slug).eq("status", "active").maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async getMakerById(id: number) {
    const { data } = await this.db.from("brands").select().eq("id", id).eq("status", "active").maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async updateMakerContent(
    slug: string,
    c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">
  ): Promise<Maker | null> {
    const patch = {
      name: c.name, one_liner: c.oneLiner,
      region: c.region ?? null, offers: c.offers, seeks: c.seeks,
      target_audience: c.targetAudience, collab_history: c.collabHistory,
      description: c.description, story: c.story, activities: c.activities,
      offers_description: c.offersDescription, seeks_description: c.seeksDescription,
      photos: c.photos, showcases: c.showcases, intro_file_url: c.introFileUrl ?? null,
      keywords: c.keywords, trust: c.trust,
      search_visible: c.searchVisible,
    };
    const { data } = await this.db.from("brands").update(patch).eq("slug", slug).select().maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async setMakerOwner(slug: string, ownerUserId: number): Promise<void> {
    await this.db.from("brands").update({ owner_user_id: ownerUserId }).eq("slug", slug);
  }
  async setMakerEnrichment(slug: string, enrichment: Maker["enrichment"] | null): Promise<void> {
    await this.db.from("brands").update({ enrichment: enrichment ?? null }).eq("slug", slug);
  }
  async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
    await this.db.from("brands").update({ edit_password_hash: hash }).eq("slug", slug);
  }
  async deleteMaker(slug: string): Promise<void> {
    // 소프트 삭제(2026-07-22): 하드 delete 대신 status=inactive. DB 행·카드·지표는 보관, 전 노출면에서만 사라짐.
    await this.db.from("brands").update({ status: "inactive" }).eq("slug", slug);
  }
  async listMakersByOwner(ownerUserId: number): Promise<Maker[]> {
    // /my — 소프트 삭제분은 목록에서 제외(status='active'만)
    const { data } = await this.db.from("brands").select(LIST_CARD_COLS).eq("owner_user_id", ownerUserId).eq("status", "active").order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async searchMakers(q: string) {
    const t = q.trim();
    // 검색은 search_visible=true + status='active' 만 노출(소유자의 /my 목록은 별도라 여기 필터 무관).
    // ⚡카드에 필요한 컬럼만 — select()는 곧 select('*')라 dna·showcases·activities·collab_history·
    //   enrichment·description·story까지 통째로 끌어왔다(카드는 하나도 안 쓴다). 목록 페이로드의 대부분.
    let query = this.db.from("brands").select(SEARCH_CARD_COLS).eq("search_visible", true).eq("status", "active");
    if (t) query = query.or(`name.ilike.%${t}%,one_liner.ilike.%${t}%,region.ilike.%${t}%`);
    const { data } = await query.order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  /** 홈 "콜라보 가능한 브랜드" 캐러셀 — 검색 노출(=콜라보 가능) + active, 최신순으로 limit개.
   *  07-31: collab_open 토글 폐지 — "검색에 노출 = 콜라보 가능"으로 단일화(지키지 못할 약속 제거). */
  async listHomeMakers(limit: number): Promise<Maker[]> {
    const { data } = await this.db
      .from("brands")
      .select(SEARCH_CARD_COLS)
      .eq("search_visible", true)
      .eq("status", "active")
      .order("created_at", { ascending: false }) // 최신순 — 인터페이스 주석 참조
      .limit(limit);
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async listSitemapBrands(): Promise<{ slug: string; updatedAt: string }[]> {
    // ⭐조건은 `status='active'` **하나뿐**이다(대표 확정 08-07 2차) — 사이트맵은 **웹 검색**용이라
    //   `search_visible` 토글과 무관하게 전부 싣는다. 그 토글은 이제 이름 그대로
    //   **`콜라보 찾기`(사이트 안 목록)에 보일지**만 정한다(홈 캐러셀·/search).
    //   근거: `/m/{slug}`는 원래 토글과 상관없이 **누구나 열리는 공개 페이지**다(링크 공유가 그 용도).
    //   이미 공개인 페이지를 구글에만 숨기는 건 사장님을 지켜주지 못하면서 유입만 깎는다.
    //   ⚠️`inactive`(삭제된 소개서)는 계속 뺀다 — 그건 열면 404다.
    // 상한 1000은 폭주 방지선이지 정책이 아니다(넘으면 분할 사이트맵을 쓴다).
    const { data, error } = await this.db
      .from("brands")
      .select("slug, updated_at, created_at")
      .eq("status", "active")
      .order("updated_at", { ascending: false })
      .limit(1000);
    if (error) {
      // 조용히 빈 사이트맵을 내면 "색인이 왜 안 되지"로 며칠을 날린다 — 로그로 남긴다.
      console.error(`[repo] listSitemapBrands failed: ${error.message}`);
      return [];
    }
    type Row = { slug: string; updated_at: string | null; created_at: string };
    return (data ?? [])
      .map((r) => {
        const row = r as Row;
        return { slug: row.slug, updatedAt: row.updated_at || row.created_at };
      })
      // ⛔데모 복제본만 예외 — `m-demo-*`는 캔버스가든 소개서를 **글자 그대로 복사**한 것이라
      //   색인되면 진짜 소개서와 똑같은 내용이 둘이 되고, 검색엔진이 둘 중 뭘 보여줄지 자기가 고른다
      //   (robots.ts가 `/preview`를 막는 것과 같은 이유 — 사장님 페이지의 힘을 데모가 나눠 갖는다).
      .filter((b) => !isDemoSlug(b.slug));
  }
  // /my 토글 — 소유자 검증은 actions에서. search_visible 만 부분 갱신.
  async setMakerFlags(
    slug: string,
    flags: { searchVisible?: boolean }
  ): Promise<Maker | null> {
    const patch: Record<string, boolean> = {};
    if (flags.searchVisible !== undefined) patch.search_visible = flags.searchVisible;
    if (Object.keys(patch).length === 0) return this.getMakerBySlug(slug);
    const { data } = await this.db.from("brands").update(patch).eq("slug", slug).select().maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }

  async createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard> {
    const row = { slug: input.slug, from_brand_id: input.fromBrandId, proposal: input.proposal };
    const { data, error } = await this.db.from("collab_cards").insert(row).select().single();
    if (error) throw error;
    return rowToCard(data as CardRow);
  }
  async getCardBySlug(slug: string) {
    const { data } = await this.db.from("collab_cards").select().eq("slug", slug).maybeSingle();
    return data ? rowToCard(data as CardRow) : null;
  }

  async recordView(cardId: number, ref?: string): Promise<ViewEvent> {
    const row = { card_id: cardId, ref: ref ?? null };
    const { data, error } = await this.db.from("card_view_events").insert(row).select().single();
    if (error) throw error;
    const r = data as ViewRow;
    return { id: r.id, cardId: r.card_id, createdAt: r.created_at, ref: r.ref ?? undefined };
  }
  async countViews(cardId: number) {
    const { count } = await this.db.from("card_view_events").select("*", { count: "exact", head: true }).eq("card_id", cardId);
    return count ?? 0;
  }
  async recordReaction(cardId: number, type: Reaction["type"]): Promise<Reaction> {
    const row = { card_id: cardId, type };
    const { data, error } = await this.db.from("reactions").insert(row).select().single();
    if (error) throw error;
    const r = data as ReactionRow;
    return { id: r.id, cardId: r.card_id, type: r.type as Reaction["type"], createdAt: r.created_at };
  }
  async isMakerSaved(userId: number, makerId: number): Promise<boolean> {
    const { data } = await this.db
      .from("saved_brands")
      .select("brand_id")
      .eq("user_id", userId)
      .eq("brand_id", makerId)
      .maybeSingle();
    return !!data;
  }
  async setMakerSaved(userId: number, makerId: number, saved: boolean): Promise<void> {
    if (saved) {
      // 복합 PK라 중복 저장은 무시(멱등)
      await this.db
        .from("saved_brands")
        .upsert({ user_id: userId, brand_id: makerId }, { onConflict: "user_id,brand_id", ignoreDuplicates: true });
    } else {
      await this.db.from("saved_brands").delete().eq("user_id", userId).eq("brand_id", makerId);
    }
  }
  async listSavedMakers(userId: number): Promise<Maker[]> {
    // 1) 찜 순서(최근 먼저)로 brand_id 수집 → 2) brands 일괄 조회 후 그 순서로 재정렬
    const { data: rows } = await this.db
      .from("saved_brands")
      .select("brand_id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    const ids = (rows ?? []).map((r) => (r as { brand_id: number }).brand_id);
    if (ids.length === 0) return [];
    const { data } = await this.db.from("brands").select(LIST_CARD_COLS).in("id", ids).eq("status", "active");
    const byId = new Map((data ?? []).map((r) => [(r as MakerRow).id, rowToMaker(r as MakerRow)]));
    return ids.map((id) => byId.get(id)).filter((m): m is Maker => !!m);
  }
  async recordCollabRequest(fromUserId: number | null, toBrandId: number, channel: string, fromBrandId: number | null = null): Promise<void> {
    await this.db.from("collab_requests").insert({ from_user_id: fromUserId, to_brand_id: toBrandId, channel, from_brand_id: fromBrandId });
  }
  // ── Brand DNA + 콜라보 리포트 ──
  async getBrandDna(brandId: number): Promise<BrandDna | null> {
    const { data } = await this.db.from("brands").select("dna").eq("id", brandId).maybeSingle();
    return (data?.dna as BrandDna) ?? null;
  }
  async setBrandDna(brandId: number, dna: BrandDna): Promise<void> {
    // ⚠️ 이 update는 brands의 updated_at 트리거를 발화시킨다 — 그래서 stale 판정은 시각이 아니라
    //    dna.input_hash(내용 지문)로 한다(collab-report.ts isDnaStale). 시각 비교는 영구 stale이 된다.
    // 쓰기 실패를 삼키면 "DNA가 매번 없음 → 매 요청 재생성 → 캐시 영구 미스"가 조용히 성립한다.
    const { error } = await this.db.from("brands").update({ dna }).eq("id", brandId);
    if (error) console.error(`[repo] setBrandDna failed brand=${brandId}: ${error.message}`);
  }
  // ⭐status='active'만 읽는다(2026-08-02). append-only + 최신순으로도 "최신만 보임"은 됐지만,
  //   그건 **새 리포트를 만들어야만** 옛 게 밀려난다는 뜻이었다. status가 있으면 새로 만들지 않고도
  //   특정 행을 폐기할 수 있다 — 사장님이 "이 리포트 다시 만들어주세요"라고 할 때(=제작자가 폐기를
  //   요청한 상황) 응할 수 있는 유일한 층. 전역 날짜 상수로는 남의 리포트까지 죽고, 행을 지우면
  //   이력·원가 기록이 사라진다. (대표 판단 08-02 — 위계상 개별 요청엔 개별 상태가 맞다)
  // 🎁 부작용이 곧 기능: **inactive로 두면 다음에 그 쌍을 여는 순간 캐시 미스 → 자동 재생성.**
  //   미리 돈 내고 갈아엎을 필요 없이, 실제로 열릴 때만 비용이 난다(안 열리면 0원).
  async getLatestCollabReport(fromBrandId: number, toBrandId: number) {
    const { data, error } = await this.db.from("collab_reports").select("report, model, created_at")
      .eq("from_brand_id", fromBrandId).eq("to_brand_id", toBrandId).eq("status", "active")
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) console.error(`[repo] getLatestCollabReport failed ${fromBrandId}→${toBrandId}: ${error.message}`);
    return data ? { report: data.report as CollabReportData, model: data.model as string, createdAt: data.created_at as string } : null;
  }
  // 여러 from × 하나의 to를 **쿼리 1번**으로(08-09). 낱개로 돌면 소개서 14개짜리 계정에선
  // /m 페이지 로드마다 왕복이 14번 붙는다 — 그중 리포트가 실제로 있는 건 보통 0~1개다.
  // 쌍당 여러 행이 남을 수 있으므로(2차 방어) 최신순으로 읽어 **쌍별 첫 행만** 취한다.
  async listLatestCollabReportsTo(fromBrandIds: number[], toBrandId: number) {
    const out = new Map<number, { report: CollabReportData; model: string; createdAt: string }>();
    if (fromBrandIds.length === 0) return out;
    const { data, error } = await this.db.from("collab_reports").select("from_brand_id, report, model, created_at")
      .in("from_brand_id", fromBrandIds).eq("to_brand_id", toBrandId).eq("status", "active")
      .order("created_at", { ascending: false });
    if (error) {
      console.error(`[repo] listLatestCollabReportsTo failed →${toBrandId}: ${error.message}`);
      return out; // 실패 시 빈 맵 — 화면은 "캐시 없음"으로 보고 평소대로 fetch한다(기능 정지 아님)
    }
    for (const row of data ?? []) {
      const fromId = row.from_brand_id as number;
      if (out.has(fromId)) continue; // 최신순이라 첫 행이 최신
      out.set(fromId, { report: row.report as CollabReportData, model: row.model as string, createdAt: row.created_at as string });
    }
    return out;
  }
  // 소유권이 떠난 뒤에도 **내가 만들었던** 리포트는 읽게 하려는 확인(08-07). status 무관 — 폐기된 행이라도
  // "내가 요청했다"는 사실은 남는다(읽기 대상은 getLatestCollabReport가 active만 고르므로 이중 방어).
  async wasCollabReportRequestedBy(fromBrandId: number, toBrandId: number, userId: number): Promise<boolean> {
    const { data, error } = await this.db.from("collab_reports").select("id")
      .eq("from_brand_id", fromBrandId).eq("to_brand_id", toBrandId).eq("requested_by", userId)
      .limit(1).maybeSingle();
    if (error) {
      console.error(`[repo] wasCollabReportRequestedBy failed ${fromBrandId}→${toBrandId}: ${error.message}`);
      return false; // 실패 시 안전한 쪽(닫힘)으로
    }
    return !!data;
  }
  async insertCollabReport(r: { fromBrandId: number; toBrandId: number; requestedBy: number | null; report: CollabReportData; model: string }): Promise<void> {
    // ⚠️**순서가 중요하다 — 먼저 기존 행을 내리고, 그 다음에 넣는다.** 반대로 하면 방금 넣은
    //   자기 행까지 inactive로 만들어 캐시가 영영 안 산다(= 열 때마다 재생성 = 돈).
    //   동시 요청이 겹쳐도 안전: 나중 것이 앞의 것까지 내리고 자기가 active가 되어 **항상 하나만 active**.
    const { error: deactErr } = await this.db.from("collab_reports")
      .update({ status: "inactive" })
      .eq("from_brand_id", r.fromBrandId).eq("to_brand_id", r.toBrandId).eq("status", "active");
    if (deactErr) console.error(`[repo] deactivate old reports failed ${r.fromBrandId}→${r.toBrandId}: ${deactErr.message}`);
    // 실패를 삼키면 캐시 행이 영영 안 쌓여 매 요청이 풀 생성이 된다(느림의 유력 원인).
    const { error } = await this.db.from("collab_reports").insert({ from_brand_id: r.fromBrandId, to_brand_id: r.toBrandId,
      requested_by: r.requestedBy, report: r.report, model: r.model });
    if (error) console.error(`[repo] insertCollabReport failed ${r.fromBrandId}→${r.toBrandId}: ${error.message}`);
  }
  async listCollabReportsByUser(userId: number): Promise<CollabReportListItem[]> {
    // 내가 요청한 것만(요청자 전용 원칙) + 브랜드명·slug를 FK 임베드로 한 방에.
    // append-only라 같은 쌍이 여러 행 — 최신순으로 읽어 JS에서 쌍별 첫 행만 취한다(수십 건 규모라 충분).
    // ⭐`status='active'`(08-02) — 폐기된 리포트는 아카이브에서도 사라진다. 쌍별 첫 행만 취하는
    //   기존 로직은 그대로 두는데, 그건 **혹시 남을 중복 active를 막는 2차 방어**다(정상이면 쌍당 1행).
    const { data, error } = await this.db
      .from("collab_reports")
      .select(
        "from_brand_id, to_brand_id, report, created_at, " +
          "from_brand:brands!collab_reports_from_brand_id_fkey(slug, name, status), " +
          "to_brand:brands!collab_reports_to_brand_id_fkey(slug, name, status, region)"
      )
      .eq("requested_by", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(`[repo] listCollabReportsByUser failed user=${userId}: ${error.message}`);
      return [];
    }
    type Row = {
      from_brand_id: number; to_brand_id: number; report: CollabReportData; created_at: string;
      from_brand: { slug: string; name: string; status: string | null } | null;
      to_brand: { slug: string; name: string; status: string | null; region: string | null } | null;
    };
    const seen = new Set<string>();
    const items: CollabReportListItem[] = [];
    for (const r of (data ?? []) as unknown as Row[]) {
      const key = `${r.from_brand_id}:${r.to_brand_id}`;
      if (seen.has(key)) continue; // 최신순이라 첫 행 = 그 쌍의 최신 리포트
      seen.add(key);
      // 어느 쪽이든 소프트 삭제(inactive)면 숨김 — 카드를 눌러도 /m이 404라 막다른 길
      if (!r.from_brand || !r.to_brand) continue;
      if (r.from_brand.status === "inactive" || r.to_brand.status === "inactive") continue;
      items.push({
        fromSlug: r.from_brand.slug, fromName: r.from_brand.name,
        toSlug: r.to_brand.slug, toName: r.to_brand.name,
        toRegion: topRegion(r.to_brand.region),
        // ⚠️ 구 캐시 행에는 report.oneLiner가 그대로 남아 있다(폐지 2026-08-01) — 읽지 않고 버린다.
        //    아래 접근은 전부 옵셔널 체이닝이라 필드 구성이 달라진 옛 행도 터지지 않는다.
        matchPoint: r.report?.matchPoints?.[0]?.text,
        ideaTitles: orderedIdeaTitles(r.report),
        effect: r.report?.effects?.[0],
        createdAt: r.created_at,
        report: r.report, // 시트가 이걸 바로 그린다 — 열 때 API 재왕복 없음(08-07)
      });
    }
    return items;
  }
  // ── 성사된 콜라보 ──
  async recordCollab(input: CollabInput, recordedBy: number | null): Promise<void> {
    // ⚠️ 여기서 실패를 삼키면 북극성이 조용히 유실된다 — 던져서 UI가 "기록 실패"를 말하게 한다.
    const { error } = await this.db.from("collabs").insert({
      brand_a_id: input.brandAId,
      brand_b_id: input.brandBId,
      status: input.status ?? "agreed",
      origin: input.origin,
      title: input.title,
      year: input.year ?? "",
      description: input.description ?? "",
      photos: input.photos ?? [],
      link: input.link ?? "",
      recorded_by: recordedBy,
    });
    if (error) {
      console.error(`[repo] recordCollab failed ${input.brandAId}↔${input.brandBId}: ${error.message}`);
      throw new Error(error.message);
    }
  }
  async listCollabsForBrands(brandIds: number[]): Promise<Collab[]> {
    if (brandIds.length === 0) return [];
    const ids = brandIds.join(",");
    const { data, error } = await this.db
      .from("collabs")
      .select(
        "id, brand_a_id, brand_b_id, status, origin, title, year, description, photos, link, created_at, " +
          "brand_a:brands!collabs_brand_a_id_fkey(slug, name), " +
          "brand_b:brands!collabs_brand_b_id_fkey(slug, name)"
      )
      .or(`brand_a_id.in.(${ids}),brand_b_id.in.(${ids})`)
      .order("created_at", { ascending: false })
      .limit(200);
    // 읽기는 **부드럽게 실패**한다 — 테이블이 아직 없어도(SQL 실행 전 배포) /my 전체가 깨지면 안 된다.
    if (error) {
      console.error(`[repo] listCollabsForBrands failed: ${error.message}`);
      return [];
    }
    type Row = {
      id: number; brand_a_id: number; brand_b_id: number; status: CollabStatus; origin: CollabOrigin;
      title: string; year: string | null; description: string | null; photos: string[] | null; link: string | null; created_at: string;
      brand_a: { slug: string; name: string } | null;
      brand_b: { slug: string; name: string } | null;
    };
    return ((data ?? []) as unknown as Row[])
      .filter((r) => r.brand_a && r.brand_b)
      .map((r) => ({
        id: r.id,
        brandAId: r.brand_a_id, brandAName: r.brand_a!.name, brandASlug: r.brand_a!.slug,
        brandBId: r.brand_b_id, brandBName: r.brand_b!.name, brandBSlug: r.brand_b!.slug,
        status: r.status, origin: r.origin, title: r.title,
        year: r.year ?? "",
        description: r.description ?? "",
        photos: Array.isArray(r.photos) ? r.photos : [],
        link: r.link ?? "",
        createdAt: r.created_at,
      }));
  }
  async appendCollabHistory(brandId: number, item: Maker["collabHistory"][number]): Promise<void> {
    // 읽고-덧붙이고-쓴다. jsonb 통짜 컬럼이라 부분 append가 없다.
    // ⚠️ 동시 편집과 겹치면 뒤 쓰기가 이긴다 — 대표 1인 운영 규모에선 감수(경합 확률 사실상 0).
    const { data, error } = await this.db.from("brands").select("collab_history").eq("id", brandId).maybeSingle();
    if (error || !data) {
      console.error(`[repo] appendCollabHistory read failed brand=${brandId}: ${error?.message}`);
      return;
    }
    const cur = Array.isArray(data.collab_history) ? (data.collab_history as unknown[]) : [];
    if (cur.length >= HISTORY_MAX) return; // 폼 상한과 같은 5 — 넘치면 조용히 넘어간다(성사 기록 자체는 이미 됨)
    const { error: wErr } = await this.db.from("brands").update({ collab_history: [...cur, item] }).eq("id", brandId);
    if (wErr) console.error(`[repo] appendCollabHistory write failed brand=${brandId}: ${wErr.message}`);
  }
}

// DB 접근은 전부 서버(server action/컴포넌트)에서만 일어남 → RLS를 켜고 서버는
// service_role 키로 접근(RLS 우회)하는 게 정석. service_role 키가 없으면 anon으로 폴백.
// ⚠️ service_role 키는 서버 전용 — 절대 NEXT_PUBLIC_로 노출 금지.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
export const repo: Repo =
  process.env.SUPABASE_URL && SUPABASE_KEY
    ? new SupabaseRepo(process.env.SUPABASE_URL, SUPABASE_KEY)
    : new InMemoryRepo();
