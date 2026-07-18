// 데이터 계층 인터페이스 + mock 구현.
// UI는 `repo`(인터페이스)에만 의존 → 나중에 Supabase 구현으로 교체 시 이 파일만 바꾼다.
// (DB는 '공유 → 타인 열람(view) 루프 = 배포 시점'에 투입 — masterbrain 2026-06-21 결정)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSize, CollabCard, CollabType, Maker, Reaction, ViewEvent } from "./types";

export interface Repo {
  // 업체
  createMaker(input: Omit<Maker, "id" | "createdAt">): Promise<Maker>;
  getMakerBySlug(slug: string): Promise<Maker | null>;
  getMakerById(id: number): Promise<Maker | null>;
  updateMakerContent(slug: string, content: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null>;
  setMakerFlags(slug: string, flags: { collabOpen?: boolean; searchVisible?: boolean }): Promise<Maker | null>;
  setMakerOwner(slug: string, ownerUserId: string): Promise<void>;
  setMakerPasswordHash(slug: string, hash: string): Promise<void>;
  deleteMaker(slug: string): Promise<void>;
  listMakersByOwner(ownerUserId: string): Promise<Maker[]>;
  listMakers(): Promise<Maker[]>;
  searchMakers(q: string): Promise<Maker[]>;
  // 카드
  createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard>;
  getCardBySlug(slug: string): Promise<CollabCard | null>;
  // 지표
  recordView(cardId: number, ref?: string): Promise<ViewEvent>;
  countViews(cardId: number): Promise<number>;
  recordReaction(cardId: number, type: Reaction["type"]): Promise<Reaction>;
}

const now = () => new Date().toISOString();

// ── 시드: 캔버스가든 = 1호 등록(테스트베드) ──
const seedMakers: Maker[] = [
  {
    id: 1,
    slug: "canvasgarden",
    name: "캔버스가든",
    oneLiner: "패브릭으로 짓는 친환경 가방과 조각 워크숍",
    region: "서울",
    size: "소규모",
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
    offersNote: "저희 공간·재료·커리큘럼을 들고 어디든 갈 수 있어요. 브랜드 결이 맞다면 형태는 함께 정해요.",
    seeksNote: "손으로 만드는 일의 가치를 아는 분들과 느슨하고 길게 협업하고 싶어요.",
    photos: [
      "https://picsum.photos/seed/canvasgarden1/900/700",
      "https://picsum.photos/seed/canvasgarden2/900/700",
      "https://picsum.photos/seed/canvasgarden3/900/700",
    ],
    blocks: [
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
    soul: {
      values: ["친환경", "손맛", "느린 호흡"],
      tone: "단단하지만 다정한, 정성스러운",
      trajectory: "작은 가방에서 시작해 사람을 모으는 워크숍으로 자라는 중",
    },
    trust: {
      homepage: "https://www.canvasgarden.shop",
      instagram: "@canvasgarden",
      address: "서울 성동구 성수이로 88 2층 캔버스가든",
      description: "버려지는 천에 새 이야기를 입히는 패브릭 브랜드.",
    },
    collabOpen: true,
    searchVisible: true,
    createdAt: now(),
  },
  {
    id: 2,
    slug: "owolforest",
    name: "오월의숲",
    oneLiner: "계절을 담는 빈티지 편집숍 & 작은 전시 공간",
    region: "서울 연남",
    size: "소규모",
    offers: ["공간대여", "팝업", "행사참여"],
    seeks: ["워크숍", "제품콜라보"],
    targetAudience: ["빈티지 애호가", "동네 단골", "감성 공간 탐방러"],
    collabHistory: [],
    story: "",
    activities: [],
    offersNote: "",
    seeksNote: "",
    photos: [],
    blocks: [],
    soul: {
      values: ["빈티지", "큐레이션", "계절감"],
      tone: "조용하고 단정한, 취향이 또렷한",
      trajectory: "작은 편집숍에서 동네의 사랑방으로",
    },
    trust: {
      instagram: "@owol.forest",
      address: "서울 마포구 연남동",
      description: "오래된 물건에 다시 온기를 더하는 편집숍.",
    },
    collabOpen: true,
    searchVisible: true,
    createdAt: now(),
  },
  {
    id: 3,
    slug: "stonebrew",
    name: "스톤브루",
    oneLiner: "직접 로스팅하는 동네 스페셜티 카페",
    region: "부산 영도",
    size: "소규모",
    offers: ["공간대여", "공동콘텐츠", "공동굿즈"],
    seeks: ["제품콜라보", "팝업"],
    targetAudience: ["커피 애호가", "로컬 워커", "여행자"],
    collabHistory: [],
    story: "",
    activities: [],
    offersNote: "",
    seeksNote: "",
    photos: [],
    blocks: [],
    soul: {
      values: ["로컬", "정성", "느긋함"],
      tone: "투박하지만 따뜻한",
      trajectory: "영도 골목의 작은 로스터리에서 시작",
    },
    trust: {
      instagram: "@stonebrew.coffee",
      address: "부산 영도구",
      description: "영도 바다를 닮은 깊고 진한 한 잔.",
    },
    collabOpen: true,
    searchVisible: true,
    createdAt: now(),
  },
  {
    id: 4,
    slug: "hidanglib",
    name: "호락호락 도서관",
    oneLiner: "그림책과 손글씨가 머무는 작은 동네 책방",
    region: "제주",
    size: "1인",
    offers: ["워크숍", "행사참여", "공간대여"],
    seeks: ["공동콘텐츠", "공동굿즈"],
    targetAudience: ["그림책 애호가", "아이와 부모", "여행자"],
    collabHistory: [],
    story: "",
    activities: [],
    offersNote: "",
    seeksNote: "",
    photos: [],
    blocks: [],
    soul: {
      values: ["다정함", "느린 호흡", "손글씨"],
      tone: "포근하고 말랑한",
      trajectory: "혼자 꾸리는 책방에서 동네 아지트로",
    },
    trust: {
      instagram: "@horak.lib",
      address: "제주시",
      description: "천천히 머물다 가는 그림책 책방.",
    },
    collabOpen: false,
    searchVisible: true,
    createdAt: now(),
  },
  // ── 데모 시드: /preview 로컬 검증용 고정본 2종 (검색 미노출·콜라보 닫힘) ──
  {
    id: 5,
    slug: "m-demo-photo",
    name: "모루초 스튜디오",
    oneLiner: "쌀로 굽는 비건 구움과자와 시골 부엌 클래스",
    region: "전주",
    size: "1인",
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
    offersNote: "레시피 개발부터 소량 생산까지 같이 할 수 있어요.",
    seeksNote: "로컬 재료를 쓰는 공간·브랜드를 만나고 싶어요.",
    photos: [
      "https://picsum.photos/seed/demo-photo1/900/700",
      "https://picsum.photos/seed/demo-photo2/900/700",
    ],
    blocks: [
      {
        type: "reviews",
        items: [{ quote: "쌀로 만든 게 맞나 싶게 촉촉해요.", source: "단골 손님" }],
        photos: ["https://picsum.photos/seed/demo-p-block1/900/700"],
        links: [],
      },
    ],
    soul: {
      values: ["비건", "로컬", "수작업"],
      tone: "소박하고 정직한",
      trajectory: "시골 부엌에서 도시의 식탁으로",
    },
    trust: {
      instagram: "@morucho.studio",
      address: "전북 전주시 완산구 한옥마을길 12",
      description: "쌀과 계절 곡물로만 굽는 작은 비건 베이커리.",
    },
    collabOpen: false,
    searchVisible: false,
    createdAt: now(),
  },
  {
    id: 6,
    slug: "m-demo-none",
    name: "밑줄서점",
    oneLiner: "문장을 수집하는 심야 책방",
    region: "대구",
    size: "1인",
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
    story: "좋아하는 문장에 밑줄을 긋다가, 밑줄을 나누는 가게를 열었어요.",
    activities: [
      {
        title: "심야 낭독회",
        desc: "밤 10시, 조명 하나 켜고 서로의 밑줄을 읽는 모임.",
        photos: [],
      },
    ],
    offersNote: "글과 목소리로 하는 협업이라면 무엇이든 열려 있어요.",
    seeksNote: "책과 어울리는 물성을 만드는 분들을 찾고 있어요.",
    photos: [],
    blocks: [
      {
        type: "custom",
        title: "이달의 밑줄",
        body: "\"우리는 서로의 용기가 될 수 있다.\"\n— 이달의 수집 문장 중에서",
        photos: [],
        links: [],
      },
    ],
    soul: {
      values: ["문장", "밤", "다정함"],
      tone: "낮게 가라앉은, 그러나 따뜻한",
      trajectory: "혼자 읽던 밤에서 함께 읽는 밤으로",
    },
    trust: {
      instagram: "@midnight.underline",
      address: "대구 중구 종로 24 1층",
      description: "밑줄 그은 문장을 매개로 사람을 잇는 책방.",
    },
    collabOpen: false,
    searchVisible: false,
    createdAt: now(),
  },
];

// ── 시드 카드: 카드 렌더 확인/데모용 (캔가 → 오월의숲) ──
const seedCards: CollabCard[] = [
  {
    id: 1,
    slug: "canvasgarden-demo",
    fromMakerId: 1,
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
  // 정수 시퀀스 카운터 (DB의 identity 흉내)
  private nextMakerId = this.makers.length + 1;
  private nextCardId = this.cards.length + 1;
  private nextViewId = 1;
  private nextReactionId = 1;

  async createMaker(input: Omit<Maker, "id" | "createdAt">): Promise<Maker> {
    const maker: Maker = { ...input, id: this.nextMakerId++, createdAt: now(), updatedAt: now() };
    this.makers.push(maker);
    return maker;
  }
  async getMakerBySlug(slug: string) {
    return this.makers.find((m) => m.slug === slug) ?? null;
  }
  async getMakerById(id: number) {
    return this.makers.find((m) => m.id === id) ?? null;
  }
  async updateMakerContent(slug: string, c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null> {
    const m = this.makers.find((x) => x.slug === slug);
    if (!m) return null;
    Object.assign(m, c);
    return m;
  }
  async setMakerFlags(slug: string, flags: { collabOpen?: boolean; searchVisible?: boolean }): Promise<Maker | null> {
    const m = this.makers.find((x) => x.slug === slug);
    if (!m) return null;
    if (flags.collabOpen !== undefined) m.collabOpen = flags.collabOpen;
    if (flags.searchVisible !== undefined) m.searchVisible = flags.searchVisible;
    return m;
  }
  async setMakerOwner(slug: string, ownerUserId: string): Promise<void> {
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.ownerUserId = ownerUserId;
  }
  async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
    const m = this.makers.find((x) => x.slug === slug);
    if (m) m.editPasswordHash = hash;
  }
  async deleteMaker(slug: string): Promise<void> {
    const i = this.makers.findIndex((x) => x.slug === slug);
    if (i >= 0) this.makers.splice(i, 1);
  }
  async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
    return this.makers.filter((x) => x.ownerUserId === ownerUserId);
  }
  async listMakers() {
    return [...this.makers];
  }
  async searchMakers(q: string) {
    const t = q.trim().toLowerCase();
    const visible = this.makers.filter((m) => m.searchVisible);
    if (!t) return visible;
    return visible.filter((m) =>
      [m.name, m.oneLiner, ...m.soul.values, ...m.offers, ...m.seeks]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
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
}

// ── Supabase DB row shapes (snake_case → camelCase 매핑용) ──
interface MakerRow {
  id: number; slug: string; name: string; one_liner: string;
  cover_image_url: string | null; logo_url: string | null;
  region: string | null; size: string | null;
  offers: string[]; seeks: string[]; target_audience: string[];
  collab_history: Maker["collabHistory"];
  story: string; activities: Maker["activities"]; offers_note: string; seeks_note: string;
  photos: string[] | null;
  blocks: Maker["blocks"] | null; intro_file_url: string | null;
  soul: Maker["soul"]; trust: Maker["trust"];
  collab_open: boolean; search_visible: boolean | null; created_at: string; updated_at: string | null;
  owner_uuid: string | null; claim_token_hash: string | null;
}
interface CardRow {
  id: number; slug: string; from_maker_id: number;
  proposal: CollabCard["proposal"]; created_at: string;
}
interface ViewRow { id: number; card_id: number; created_at: string; ref: string | null; }
interface ReactionRow { id: number; card_id: number; type: string; created_at: string; }

function rowToMaker(r: MakerRow): Maker {
  return {
    id: r.id, slug: r.slug, name: r.name, oneLiner: r.one_liner,
    coverImageUrl: r.cover_image_url ?? undefined,
    logoUrl: r.logo_url ?? undefined,
    region: r.region ?? undefined,
    size: (r.size as BusinessSize) ?? undefined,
    offers: r.offers as CollabType[], seeks: r.seeks as CollabType[],
    targetAudience: r.target_audience,
    collabHistory: (r.collab_history ?? []).map((h) => ({ ...h, photos: h.photos ?? [] })),
    story: r.story ?? "",
    activities: r.activities ?? [],
    offersNote: r.offers_note ?? "",
    seeksNote: r.seeks_note ?? "",
    photos: r.photos ?? [],
    blocks: (r.blocks ?? []).map((b) => ({ ...b, photos: b.photos ?? [], links: b.links ?? [] })),
    introFileUrl: r.intro_file_url ?? undefined,
    soul: r.soul, trust: r.trust,
    collabOpen: r.collab_open, searchVisible: r.search_visible ?? true, createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
    ownerUserId: r.owner_uuid ?? undefined,
    editPasswordHash: r.claim_token_hash ?? undefined,
  };
}
function rowToCard(r: CardRow): CollabCard {
  return { id: r.id, slug: r.slug, fromMakerId: r.from_maker_id, proposal: r.proposal, createdAt: r.created_at };
}

class SupabaseRepo implements Repo {
  private db: SupabaseClient;
  constructor(url: string, key: string) { this.db = createClient(url, key); }

  async createMaker(input: Omit<Maker, "id" | "createdAt">): Promise<Maker> {
    // id·created_at·updated_at 은 DB가 자동 부여
    const row = {
      slug: input.slug, name: input.name, one_liner: input.oneLiner,
      cover_image_url: input.coverImageUrl ?? null, logo_url: input.logoUrl ?? null,
      region: input.region ?? null, size: input.size ?? null,
      offers: input.offers, seeks: input.seeks, target_audience: input.targetAudience,
      collab_history: input.collabHistory,
      story: input.story, activities: input.activities, offers_note: input.offersNote, seeks_note: input.seeksNote,
      photos: input.photos,
      blocks: input.blocks, intro_file_url: input.introFileUrl ?? null,
      soul: input.soul, trust: input.trust, collab_open: input.collabOpen,
      search_visible: input.searchVisible,
      owner_uuid: input.ownerUserId ?? null, claim_token_hash: input.editPasswordHash ?? null,
    };
    const { data, error } = await this.db.from("makers").insert(row).select().single();
    if (error) throw error;
    return rowToMaker(data as MakerRow);
  }
  async getMakerBySlug(slug: string) {
    const { data } = await this.db.from("makers").select().eq("slug", slug).maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async getMakerById(id: number) {
    const { data } = await this.db.from("makers").select().eq("id", id).maybeSingle();
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
      story: c.story, activities: c.activities, offers_note: c.offersNote, seeks_note: c.seeksNote,
      photos: c.photos, blocks: c.blocks, intro_file_url: c.introFileUrl ?? null,
      soul: c.soul, trust: c.trust, collab_open: c.collabOpen,
      search_visible: c.searchVisible,
    };
    const { data } = await this.db.from("makers").update(patch).eq("slug", slug).select().maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async setMakerOwner(slug: string, ownerUserId: string): Promise<void> {
    await this.db.from("makers").update({ owner_uuid: ownerUserId }).eq("slug", slug);
  }
  async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
    await this.db.from("makers").update({ claim_token_hash: hash }).eq("slug", slug);
  }
  async deleteMaker(slug: string): Promise<void> {
    // collab_cards·view_events·reactions는 FK ON DELETE CASCADE로 함께 삭제됨.
    await this.db.from("makers").delete().eq("slug", slug);
  }
  async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
    const { data } = await this.db.from("makers").select().eq("owner_uuid", ownerUserId).order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async listMakers() {
    const { data } = await this.db.from("makers").select().order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async searchMakers(q: string) {
    const t = q.trim();
    // 검색은 search_visible=true 만 노출(소유자의 /my 목록은 별도라 여기 필터 무관).
    let query = this.db.from("makers").select().eq("search_visible", true);
    if (t) query = query.or(`name.ilike.%${t}%,one_liner.ilike.%${t}%,region.ilike.%${t}%`);
    const { data } = await query.order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  // /my 토글 — 소유자 검증은 actions에서. collab_open·search_visible 만 부분 갱신.
  async setMakerFlags(
    slug: string,
    flags: { collabOpen?: boolean; searchVisible?: boolean }
  ): Promise<Maker | null> {
    const patch: Record<string, boolean> = {};
    if (flags.collabOpen !== undefined) patch.collab_open = flags.collabOpen;
    if (flags.searchVisible !== undefined) patch.search_visible = flags.searchVisible;
    if (Object.keys(patch).length === 0) return this.getMakerBySlug(slug);
    const { data } = await this.db.from("makers").update(patch).eq("slug", slug).select().maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }

  async createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard> {
    const row = { slug: input.slug, from_maker_id: input.fromMakerId, proposal: input.proposal };
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
    const { data, error } = await this.db.from("view_events").insert(row).select().single();
    if (error) throw error;
    const r = data as ViewRow;
    return { id: r.id, cardId: r.card_id, createdAt: r.created_at, ref: r.ref ?? undefined };
  }
  async countViews(cardId: number) {
    const { count } = await this.db.from("view_events").select("*", { count: "exact", head: true }).eq("card_id", cardId);
    return count ?? 0;
  }
  async recordReaction(cardId: number, type: Reaction["type"]): Promise<Reaction> {
    const row = { card_id: cardId, type };
    const { data, error } = await this.db.from("reactions").insert(row).select().single();
    if (error) throw error;
    const r = data as ReactionRow;
    return { id: r.id, cardId: r.card_id, type: r.type as Reaction["type"], createdAt: r.created_at };
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
