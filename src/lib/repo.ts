// 데이터 계층 인터페이스 + mock 구현.
// UI는 `repo`(인터페이스)에만 의존 → 나중에 Supabase 구현으로 교체 시 이 파일만 바꾼다.
// (DB는 '공유 → 타인 열람(view) 루프 = 배포 시점'에 투입 — masterbrain 2026-06-21 결정)

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { BusinessSize, CollabCard, CollabType, Maker, Reaction, ViewEvent } from "./types";

export interface Repo {
  // 업체
  createMaker(input: Omit<Maker, "id" | "createdAt">): Promise<Maker>;
  getMakerBySlug(slug: string): Promise<Maker | null>;
  getMakerById(id: string): Promise<Maker | null>;
  updateMakerContent(slug: string, content: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null>;
  setMakerOwner(slug: string, ownerUserId: string): Promise<void>;
  setMakerPasswordHash(slug: string, hash: string): Promise<void>;
  listMakersByOwner(ownerUserId: string): Promise<Maker[]>;
  listMakers(): Promise<Maker[]>;
  searchMakers(q: string): Promise<Maker[]>;
  // 카드
  createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard>;
  getCardBySlug(slug: string): Promise<CollabCard | null>;
  // 지표
  recordView(cardId: string, ref?: string): Promise<ViewEvent>;
  countViews(cardId: string): Promise<number>;
  recordReaction(cardId: string, type: Reaction["type"]): Promise<Reaction>;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const now = () => new Date().toISOString();

// ── 시드: 캔버스가든 = 1호 등록(테스트베드) ──
const seedMakers: Maker[] = [
  {
    id: "maker-canvasgarden",
    slug: "canvasgarden",
    name: "캔버스가든",
    oneLiner: "패브릭으로 짓는 친환경 가방과 조각 워크숍",
    region: "서울",
    size: "소규모",
    offers: ["워크숍", "제품콜라보", "팝업"],
    seeks: ["공간대여", "행사참여", "공동콘텐츠"],
    targetAudience: ["20-30대 여성", "친환경 라이프스타일", "핸드메이드 애호가"],
    collabHistory: [
      { partner: "오월의숲", types: ["팝업", "워크숍"], year: "2025", photos: [] },
      { partner: "스톤브루", types: ["제품콜라보"], photos: [] },
    ],
    story: "",
    activities: [],
    offersNote: "",
    seeksNote: "",
    photos: [
      "https://picsum.photos/seed/canvasgarden1/900/700",
      "https://picsum.photos/seed/canvasgarden2/900/700",
      "https://picsum.photos/seed/canvasgarden3/900/700",
    ],
    soul: {
      values: ["친환경", "손맛", "느린 호흡"],
      tone: "단단하지만 다정한, 정성스러운",
      trajectory: "작은 가방에서 시작해 사람을 모으는 워크숍으로 자라는 중",
    },
    trust: {
      homepage: "https://www.canvasgarden.shop",
      instagram: "@canvasgarden",
      address: "서울특별시",
      description: "버려지는 천에 새 이야기를 입히는 패브릭 브랜드.",
    },
    collabOpen: true,
    createdAt: now(),
  },
  {
    id: "maker-owolforest",
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
    createdAt: now(),
  },
  {
    id: "maker-stonebrew",
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
    createdAt: now(),
  },
  {
    id: "maker-hidanglib",
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
    createdAt: now(),
  },
];

// ── 시드 카드: 카드 렌더 확인/데모용 (캔가 → 오월의숲) ──
const seedCards: CollabCard[] = [
  {
    id: "card-seed-1",
    slug: "canvasgarden-demo",
    fromMakerId: "maker-canvasgarden",
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

  async createMaker(input: Omit<Maker, "id" | "createdAt">): Promise<Maker> {
    const maker: Maker = { ...input, id: uid(), createdAt: now() };
    this.makers.push(maker);
    return maker;
  }
  async getMakerBySlug(slug: string) {
    return this.makers.find((m) => m.slug === slug) ?? null;
  }
  async getMakerById(id: string) {
    return this.makers.find((m) => m.id === id) ?? null;
  }
  async updateMakerContent(slug: string, c: Omit<Maker, "id" | "slug" | "createdAt" | "ownerUserId" | "editPasswordHash">): Promise<Maker | null> {
    const m = this.makers.find((x) => x.slug === slug);
    if (!m) return null;
    Object.assign(m, c);
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
  async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
    return this.makers.filter((x) => x.ownerUserId === ownerUserId);
  }
  async listMakers() {
    return [...this.makers];
  }
  async searchMakers(q: string) {
    const t = q.trim().toLowerCase();
    if (!t) return [...this.makers];
    return this.makers.filter((m) =>
      [m.name, m.oneLiner, ...m.soul.values, ...m.offers, ...m.seeks]
        .join(" ")
        .toLowerCase()
        .includes(t)
    );
  }

  async createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard> {
    const card: CollabCard = { ...input, id: uid(), createdAt: now() };
    this.cards.push(card);
    return card;
  }
  async getCardBySlug(slug: string) {
    return this.cards.find((c) => c.slug === slug) ?? null;
  }

  async recordView(cardId: string, ref?: string): Promise<ViewEvent> {
    const ev: ViewEvent = { id: uid(), cardId, at: now(), ref };
    this.views.push(ev);
    return ev;
  }
  async countViews(cardId: string) {
    return this.views.filter((v) => v.cardId === cardId).length;
  }
  async recordReaction(cardId: string, type: Reaction["type"]): Promise<Reaction> {
    const r: Reaction = { id: uid(), cardId, type, at: now() };
    this.reactions.push(r);
    return r;
  }
}

// ── Supabase DB row shapes (snake_case → camelCase 매핑용) ──
interface MakerRow {
  id: string; slug: string; name: string; one_liner: string;
  cover_image_url: string | null; logo_url: string | null;
  region: string | null; size: string | null;
  offers: string[]; seeks: string[]; target_audience: string[];
  collab_history: Maker["collabHistory"];
  story: string; activities: Maker["activities"]; offers_note: string; seeks_note: string;
  photos: string[] | null;
  soul: Maker["soul"]; trust: Maker["trust"];
  collab_open: boolean; created_at: string;
  owner_user_id: string | null; claim_token_hash: string | null;
}
interface CardRow {
  id: string; slug: string; from_maker_id: string;
  proposal: CollabCard["proposal"]; created_at: string;
}
interface ViewRow { id: string; card_id: string; at: string; ref: string | null; }
interface ReactionRow { id: string; card_id: string; type: string; at: string; }

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
    soul: r.soul, trust: r.trust,
    collabOpen: r.collab_open, createdAt: r.created_at,
    ownerUserId: r.owner_user_id ?? undefined,
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
    const row = {
      id: uid(), slug: input.slug, name: input.name, one_liner: input.oneLiner,
      cover_image_url: input.coverImageUrl ?? null, logo_url: input.logoUrl ?? null,
      region: input.region ?? null, size: input.size ?? null,
      offers: input.offers, seeks: input.seeks, target_audience: input.targetAudience,
      collab_history: input.collabHistory,
      story: input.story, activities: input.activities, offers_note: input.offersNote, seeks_note: input.seeksNote,
      photos: input.photos,
      soul: input.soul, trust: input.trust, collab_open: input.collabOpen, created_at: now(),
      owner_user_id: input.ownerUserId ?? null, claim_token_hash: input.editPasswordHash ?? null,
    };
    const { data, error } = await this.db.from("makers").insert(row).select().single();
    if (error) throw error;
    return rowToMaker(data as MakerRow);
  }
  async getMakerBySlug(slug: string) {
    const { data } = await this.db.from("makers").select().eq("slug", slug).maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async getMakerById(id: string) {
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
      photos: c.photos, soul: c.soul, trust: c.trust, collab_open: c.collabOpen,
    };
    const { data } = await this.db.from("makers").update(patch).eq("slug", slug).select().maybeSingle();
    return data ? rowToMaker(data as MakerRow) : null;
  }
  async setMakerOwner(slug: string, ownerUserId: string): Promise<void> {
    await this.db.from("makers").update({ owner_user_id: ownerUserId }).eq("slug", slug);
  }
  async setMakerPasswordHash(slug: string, hash: string): Promise<void> {
    await this.db.from("makers").update({ claim_token_hash: hash }).eq("slug", slug);
  }
  async listMakersByOwner(ownerUserId: string): Promise<Maker[]> {
    const { data } = await this.db.from("makers").select().eq("owner_user_id", ownerUserId).order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async listMakers() {
    const { data } = await this.db.from("makers").select().order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }
  async searchMakers(q: string) {
    const t = q.trim();
    if (!t) return this.listMakers();
    const { data } = await this.db
      .from("makers").select()
      .or(`name.ilike.%${t}%,one_liner.ilike.%${t}%,region.ilike.%${t}%`)
      .order("created_at", { ascending: false });
    return (data ?? []).map((r) => rowToMaker(r as MakerRow));
  }

  async createCard(input: Omit<CollabCard, "id" | "createdAt">): Promise<CollabCard> {
    const row = { id: uid(), slug: input.slug, from_maker_id: input.fromMakerId, proposal: input.proposal, created_at: now() };
    const { data, error } = await this.db.from("collab_cards").insert(row).select().single();
    if (error) throw error;
    return rowToCard(data as CardRow);
  }
  async getCardBySlug(slug: string) {
    const { data } = await this.db.from("collab_cards").select().eq("slug", slug).maybeSingle();
    return data ? rowToCard(data as CardRow) : null;
  }

  async recordView(cardId: string, ref?: string): Promise<ViewEvent> {
    const row = { id: uid(), card_id: cardId, at: now(), ref: ref ?? null };
    const { data, error } = await this.db.from("view_events").insert(row).select().single();
    if (error) throw error;
    const r = data as ViewRow;
    return { id: r.id, cardId: r.card_id, at: r.at, ref: r.ref ?? undefined };
  }
  async countViews(cardId: string) {
    const { count } = await this.db.from("view_events").select("*", { count: "exact", head: true }).eq("card_id", cardId);
    return count ?? 0;
  }
  async recordReaction(cardId: string, type: Reaction["type"]): Promise<Reaction> {
    const row = { id: uid(), card_id: cardId, type, at: now() };
    const { data, error } = await this.db.from("reactions").insert(row).select().single();
    if (error) throw error;
    const r = data as ReactionRow;
    return { id: r.id, cardId: r.card_id, type: r.type as Reaction["type"], at: r.at };
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
