// 하루 가게 — 공간 대여 데이터 계층 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// ⚠️`repo.ts`에 넣지 않고 별도 파일로 둔 이유 둘.
//   ①이 기능은 소개서와 **독립**이다(대표 09-13). `brands`를 한 줄도 안 읽는다.
//   ②`repo.ts`는 1팀·2팀이 동시에 만지는 뜨거운 파일이라, 새 기능 한 벌을 얹으면 충돌이 잦다.
//   같은 이유로 `profiles.ts`도 자기 클라이언트를 따로 들고 있다 — 그 패턴을 그대로 빌렸다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Space, SpacePublic, SpaceBooking, SpaceStatus, BookingStatus, OpenSlot } from "./types";

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

/** 우리 수수료율 — 대표 확정 09-13. 잠정값이고 거래가 쌓이면 다시 본다.
 *  ⚠️요율을 바꿔도 **이미 만들어진 예약 행은 안 바뀐다**(`fee_rate`를 행마다 박아 둔다).
 *     옛 거래를 새 요율로 정산하면 호스트에게 약속한 금액이 사후에 달라진다. */
export const FEE_RATE = 0.15;

/** 게스트가 낸 돈에서 호스트 몫을 계산한다. 원 단위 내림 — 1원이 남으면 우리가 갖는다. */
export function payout(total: number, rate: number = FEE_RATE): number {
  return Math.floor(total * (1 - rate));
}

// ─── 행 ↔ 타입 ───

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" ? v : 0);
const arr = (v: unknown) => (Array.isArray(v) ? (v as string[]) : []);
/** jsonb의 시간대 목록을 «모양을 확인하며» 읽는다. 한 칸이라도 깨져 있으면 그 칸만 버린다 —
 *  DB에 손으로 넣은 값이 들어올 수 있고, 하나 때문에 공간 전체가 안 열리면 안 된다. */
function slots(v: unknown): OpenSlot[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    const date = s(o.date), start = s(o.start), end = s(o.end);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) return [];
    return [{ date, start: start.slice(0, 5), end: end.slice(0, 5) }];
  });
}

function toSpace(r: Row): Space {
  return {
    id: n(r.id), slug: s(r.slug), ownerUserId: n(r.owner_user_id), brandSlug: s(r.brand_slug),
    name: s(r.name), tagline: s(r.tagline), body: s(r.body), photos: arr(r.photos),
    area: s(r.area), address: s(r.address),
    lat: typeof r.lat === "number" ? r.lat : undefined,
    lng: typeof r.lng === "number" ? r.lng : undefined,
    accessNote: s(r.access_note),
    useType: (s(r.use_type) || "both") as Space["useType"],
    facilities: arr(r.facilities), facilitiesNote: s(r.facilities_note),
    capacity: typeof r.capacity === "number" ? r.capacity : undefined,
    hours: s(r.hours), rules: s(r.rules),
    priceDay: n(r.price_day), mentorMinutes: n(r.mentor_minutes), mentorPrice: n(r.mentor_price),
    openDates: arr(r.open_dates),
    servesFood: r.serves_food === true, subleaseOk: r.sublease_ok === true,

    category: (s(r.category) || "") as Space["category"],
    scope: (s(r.scope) || "space_only") as Space["scope"],
    priceHour: n(r.price_hour), minHours: n(r.min_hours) || 1,
    openSlots: slots(r.open_slots),
    coffeeChat: r.coffee_chat === true,
    coffeeChatMinutes: n(r.coffee_chat_minutes), coffeeChatPrice: n(r.coffee_chat_price),
    coffeeChatTopics: s(r.coffee_chat_topics),
    accessHow: (s(r.access_how) || "sms") as Space["accessHow"],
    contactPhone: s(r.contact_phone),
    hostTermsAt: s(r.host_terms_at) || undefined,
    status: (s(r.status) || "draft") as SpaceStatus,
    createdAt: s(r.created_at), updatedAt: s(r.updated_at),
  };
}

/** 확정 «전»에 화면으로 나가는 모양.
 *
 *  🔁**09-16에 방향이 뒤집혔다.** 09-13엔 주소·좌표를 떼어 냈다(이탈 방지). 09-16에 대표가
 *  *「이미 공간 이름이 있어서 무의미할 것 같아」*로 정리했고, 전자상거래법 제20조②는 오히려
 *  호스트의 주소·전화번호를 **청약 전에 보여 주도록** 요구한다. 그래서 주소·좌표·매장 전화는 나간다.
 *
 *  🚨**지금도 떼어 내는 것** — 「들어오는 법」(옛 `accessNote`)과 호스트 약관 동의 시각.
 *  ⚠️`Omit` 타입만 믿지 마라 — 타입은 컴파일 때만 있고 런타임 객체엔 그대로 실려 나간다. 여기서 실제로 지운다.
 *  📌목록·상세는 여전히 **반드시 이 함수를 거친 값**을 쓴다. 나중에 또 감출 것이 생기면 그 자리가 여기다. */
export function toPublic(sp: Space): SpacePublic {
  const { accessNote: _n, hostTermsAt: _t, ...rest } = sp;
  void _n; void _t;
  return rest;
}

function toBooking(r: Row): SpaceBooking {
  return {
    id: n(r.id), spaceId: n(r.space_id), guestUserId: n(r.guest_user_id),
    guestBrandSlug: s(r.guest_brand_slug),
    useDate: s(r.use_date), hours: s(r.hours), plan: s(r.plan),
    // ⚠️Postgres의 `time`은 "10:00:00"으로 온다. 화면·계산은 전부 "HH:MM"이라 여기서 잘라 맞춘다 —
    //   한 곳에서 안 자르면 "10:00:00"과 "10:00" 비교가 조용히 어긋난다.
    startTime: s(r.start_time).slice(0, 5), endTime: s(r.end_time).slice(0, 5),
    hoursCount: n(r.hours_count),
    withChat: r.with_chat === true, amountChat: n(r.amount_chat),
    headcount: typeof r.headcount === "number" ? r.headcount : undefined,
    withMentor: r.with_mentor === true,
    amountSpace: n(r.amount_space), amountMentor: n(r.amount_mentor), amountTotal: n(r.amount_total),
    feeRate: typeof r.fee_rate === "number" ? r.fee_rate : Number(r.fee_rate ?? FEE_RATE),
    amountPayout: n(r.amount_payout),
    paymentKey: s(r.payment_key), orderId: s(r.order_id),
    status: (s(r.status) || "paid") as BookingStatus,
    hostMessage: s(r.host_message),
    decidedAt: r.decided_at ? s(r.decided_at) : undefined,
    createdAt: s(r.created_at), updatedAt: s(r.updated_at),
  };
}

// ─── 공간 읽기 ───

export interface SpaceFilter {
  /** 동네 부분일치 */
  area?: string;
  /** 이 날짜에 열린 시간대가 있는 곳만. 화면엔 고르개가 없고 주소로만 들어온다(09-16 B84). */
  date?: string;
  /** 업종. 목록 거르개의 축이다(09-16 B84). */
  category?: Space["category"];
  useType?: Space["useType"];
  limit?: number;
}

/** 목록 — 공개된 것만. ⭐돌려주는 값에 주소가 없다(`toPublic`). */
export async function listOpenSpaces(f: SpaceFilter = {}): Promise<SpacePublic[]> {
  const c = db();
  if (!c) return [];
  let q = c.from("spaces").select("*").eq("status", "open").order("created_at", { ascending: false });
  if (f.area) q = q.ilike("area", `%${f.area}%`);
  if (f.category) q = q.eq("category", f.category);
  if (f.useType && f.useType !== "both") q = q.in("use_type", [f.useType, "both"]);
  q = q.limit(f.limit ?? 60);
  const { data, error } = await q;
  if (error) { console.error(`[spaces] list failed: ${error.message}`); return []; }
  let out = (data ?? []).map((r) => toSpace(r as Row));
  // 날짜 거르기는 jsonb 안을 봐야 해서 코드에서 한다 — 공간 수가 수백 단위일 동안은 이게 싸다.
  // 🩸09-16까지 여기가 옛 `open_dates`를 보고 있었다. 시간 단위로 바뀌면서 새 등록은 그 칸을 안 채우니
  //   날짜를 고르면 «항상 0건»이었다. 열린 시간대(`openSlots`)가 정본이다.
  if (f.date) out = out.filter((sp) => sp.openSlots.some((sl) => sl.date === f.date));
  return out.map(toPublic);
}

/** 상세(공개) — 주소 없음. 확정된 예약의 당사자에겐 `getSpaceFull`을 따로 쓴다. */
export async function getSpacePublic(slug: string): Promise<SpacePublic | null> {
  const sp = await getSpaceFull(slug);
  return sp ? toPublic(sp) : null;
}

/** 🚨주소까지 든 원본 — **호출 전에 권한을 반드시 확인할 것.**
 *  쓸 수 있는 곳은 둘뿐이다. ①그 공간의 주인 ②`confirmed` 예약의 게스트. */
export async function getSpaceFull(slug: string): Promise<Space | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("spaces").select("*").eq("slug", slug).maybeSingle();
  if (error || !data) return null;
  return toSpace(data as Row);
}

/** 요약본 — 「내가 빌린 곳」처럼 **남의 공간을 id로** 읽어야 할 때 쓴다.
 *  ⚠️`listOpenSpaces`로 대신하면 안 된다 — 그건 `open`만 주므로 호스트가 잠시 쉬는(paused) 공간이 빠져
 *  **내가 예약한 곳이 화면에서 사라진다.** slug를 모르니 `getSpaceFull`도 못 쓴다.
 *  🚨`address`를 담아 돌려준다. 호출부가 `isRevealed(booking)`으로 반드시 걸러라. */
export interface SpaceBrief {
  id: number; slug: string; name: string; area: string; hours: string;
  ownerUserId: number; photo: string; address: string;
}

export async function listSpacesByIds(ids: number[]): Promise<Map<number, SpaceBrief>> {
  const out = new Map<number, SpaceBrief>();
  if (ids.length === 0) return out;
  const c = db();
  if (!c) return out;
  // 필요한 칸만 고른다 — `select("*")`이면 본문·설비·비는 날까지 끌고 오는데 이 쓰임엔 한 줄도 안 쓴다.
  const { data, error } = await c.from("spaces")
    .select("id, slug, name, area, hours, address, owner_user_id, photos")
    .in("id", Array.from(new Set(ids)));
  if (error) { console.error(`[spaces] listByIds failed: ${error.message}`); return out; }
  for (const r of data ?? []) {
    const row = r as Row;
    out.set(n(row.id), {
      id: n(row.id), slug: s(row.slug), name: s(row.name), area: s(row.area),
      hours: s(row.hours), ownerUserId: n(row.owner_user_id),
      photo: arr(row.photos)[0] ?? "", address: s(row.address),
    });
  }
  return out;
}

export async function listSpacesByOwner(ownerUserId: number): Promise<Space[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("spaces").select("*")
    .eq("owner_user_id", ownerUserId).order("created_at", { ascending: false });
  return (data ?? []).map((r) => toSpace(r as Row));
}

// ─── 공간 쓰기 ───

export type SpaceSaveInput = Omit<Space, "id" | "createdAt" | "updatedAt">;

/** slug 기준 upsert. ⚠️권한 검사는 호출부(서버 액션)의 책임이다. */
export async function saveSpace(input: SpaceSaveInput): Promise<Space | null> {
  const c = db();
  if (!c) return null;
  const row = {
    slug: input.slug, owner_user_id: input.ownerUserId, brand_slug: input.brandSlug,
    name: input.name, tagline: input.tagline, body: input.body, photos: input.photos,
    area: input.area, address: input.address, lat: input.lat ?? null, lng: input.lng ?? null,
    access_note: input.accessNote,
    use_type: input.useType, facilities: input.facilities, facilities_note: input.facilitiesNote, capacity: input.capacity ?? null,
    hours: input.hours, rules: input.rules,
    price_day: input.priceDay, mentor_minutes: input.mentorMinutes, mentor_price: input.mentorPrice,
    open_dates: input.openDates,
    serves_food: input.servesFood, sublease_ok: input.subleaseOk, status: input.status,

    category: input.category, scope: input.scope,
    price_hour: input.priceHour, min_hours: input.minHours, open_slots: input.openSlots,
    coffee_chat: input.coffeeChat, coffee_chat_minutes: input.coffeeChatMinutes,
    coffee_chat_price: input.coffeeChatPrice, coffee_chat_topics: input.coffeeChatTopics,
    access_how: input.accessHow, contact_phone: input.contactPhone,
    host_terms_at: input.hostTermsAt ?? null,
  };
  const { data, error } = await c.from("spaces").upsert(row, { onConflict: "slug" }).select().maybeSingle();
  if (error) { console.error(`[spaces] save failed slug=${input.slug}: ${error.message}`); return null; }
  return data ? toSpace(data as Row) : null;
}

/** 그 날짜를 비는 날 목록에서 뺀다 — 예약이 확정되면 다시 못 팔게.
 *  ⚠️거절·환불로 풀릴 땐 되돌려야 하므로 `add`도 같은 함수로 받는다.
 *  🔻**시간 단위로 바뀌면서 이 함수의 일이 사라진다**(09-16). 하루가 통째로 팔리는 게 아니라
 *    시간대가 겹치는지를 DB의 배제 제약이 판정한다. 호스트가 연 시간대(`openSlots`)는 건드리지 않는다 —
 *    「이 시간에 열어 둔다」는 호스트의 선언이고, 「그 안에 누가 들어왔다」는 예약 쪽 사실이다. 둘을 섞으면
 *    예약이 취소됐을 때 호스트의 선언을 복원할 방법이 없어진다. 옛 데이터용으로만 남겨 둔다. */
export async function setOpenDate(spaceId: number, date: string, open: boolean): Promise<void> {
  const c = db();
  if (!c) return;
  const { data } = await c.from("spaces").select("open_dates").eq("id", spaceId).maybeSingle();
  const cur = Array.isArray(data?.open_dates) ? (data!.open_dates as string[]) : [];
  const next = open ? Array.from(new Set([...cur, date])).sort() : cur.filter((d) => d !== date);
  await c.from("spaces").update({ open_dates: next }).eq("id", spaceId);
}

// ─── 예약 ───

export type BookingCreateInput = Omit<
  SpaceBooking, "id" | "status" | "hostMessage" | "decidedAt" | "createdAt" | "updatedAt" | "amountPayout" | "feeRate"
>;

/** 결제창으로 보내기 «직전»에 자리를 잡아 둔다.
 *
 *  ⭐토스 결제창은 사이트를 떠났다가 돌아오는 구조라, 돌아왔을 때 「누가 어느 날짜에 무엇을 하려 했는지」를
 *  되찾을 곳이 필요하다. 그 자리가 `pending` 행이다.
 *  🚨**이 행은 호스트에게 안 보인다**(`listBookingsForHost`가 걸러낸다). 대표 09-13이 막으려던
 *    「돈 내기 전에 사장님과 연결되는」 구멍은 그대로 닫혀 있다.
 *  ⚠️날짜도 «잠그지 않는다» — 결제창만 열어보고 닫은 사람이 남의 날짜를 막으면 안 된다.
 *    선점은 `markBookingPaid`에서 유니크 인덱스로 갈린다(먼저 결제한 사람이 이긴다). */
export async function createPendingBooking(input: BookingCreateInput): Promise<SpaceBooking | null> {
  const c = db();
  if (!c) return null;
  const row = {
    space_id: input.spaceId, guest_user_id: input.guestUserId, guest_brand_slug: input.guestBrandSlug,
    use_date: input.useDate, hours: input.hours, plan: input.plan, headcount: input.headcount ?? null,
    start_time: input.startTime, end_time: input.endTime, hours_count: input.hoursCount,
    with_chat: input.withChat, amount_chat: input.amountChat,
    with_mentor: input.withMentor,
    amount_space: input.amountSpace, amount_mentor: input.amountMentor, amount_total: input.amountTotal,
    fee_rate: FEE_RATE, amount_payout: payout(input.amountTotal),
    payment_key: "", order_id: input.orderId, status: "pending" as const,
  };
  const { data, error } = await c.from("space_bookings").insert(row).select().maybeSingle();
  if (error) { console.error(`[spaces] pending insert failed order=${input.orderId}: ${error.message}`); return null; }
  return data ? toBooking(data as Row) : null;
}

/** 그 공간 그 날짜에 «살아 있는» 예약들. 시간 겹침을 보려고 시각만 얇게 읽는다.
 *  ⭐`pending`은 뺀다 — 결제창만 열어 보고 닫은 사람이 남의 시간을 막으면 안 된다(설계 그대로). */
export async function listLiveBookings(spaceId: number, date: string): Promise<SpaceBooking[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c
    .from("space_bookings")
    .select("*")
    .eq("space_id", spaceId)
    .eq("use_date", date)
    .in("status", ["paid", "confirmed", "done"]);
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 여러 날짜의 살아 있는 예약을 «한 번에». 상세 화면이 열린 날 수만큼 왕복하지 않게. */
export async function listLiveBookingsIn(spaceId: number, dates: string[]): Promise<SpaceBooking[]> {
  const c = db();
  if (!c || dates.length === 0) return [];
  const { data } = await c
    .from("space_bookings")
    .select("*")
    .eq("space_id", spaceId)
    .in("use_date", dates)
    .in("status", ["paid", "confirmed", "done"]);
  return (data ?? []).map((r) => toBooking(r as Row));
}

export async function getBookingByOrderId(orderId: string): Promise<SpaceBooking | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("space_bookings").select("*").eq("order_id", orderId).maybeSingle();
  return data ? toBooking(data as Row) : null;
}

/** 승인된 결제를 행에 못 박는다. `pending`일 때만 통과한다.
 *  🩸**여기서 유니크 인덱스에 걸릴 수 있다** — 같은 날짜를 누가 먼저 결제했다는 뜻이고,
 *    그때는 호출부가 **환불로 이어가야 한다.** 실패를 조용히 삼키면 돈만 받고 예약이 없는 상태가 된다. */
export async function markBookingPaid(orderId: string, paymentKey: string): Promise<SpaceBooking | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("space_bookings")
    .update({ status: "paid", payment_key: paymentKey })
    .eq("order_id", orderId).eq("status", "pending")
    .select().maybeSingle();
  if (error) { console.error(`[spaces] markPaid failed order=${orderId}: ${error.message}`); return null; }
  return data ? toBooking(data as Row) : null;
}

export async function getBooking(id: number): Promise<SpaceBooking | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("space_bookings").select("*").eq("id", id).maybeSingle();
  return data ? toBooking(data as Row) : null;
}

/** 호스트가 받은 신청 — 자기 공간 것만. */
export async function listBookingsForHost(ownerUserId: number): Promise<SpaceBooking[]> {
  const c = db();
  if (!c) return [];
  const mine = await listSpacesByOwner(ownerUserId);
  if (mine.length === 0) return [];
  // 🚨`pending`을 뺀다. 결제 전 신청이 사장님께 보이면 거기서 바로 직거래로 샐 수 있다(대표 09-13).
  const { data } = await c.from("space_bookings").select("*")
    .in("space_id", mine.map((sp) => sp.id)).neq("status", "pending")
    .order("created_at", { ascending: false });
  return (data ?? []).map((r) => toBooking(r as Row));
}

export async function listBookingsForGuest(guestUserId: number): Promise<SpaceBooking[]> {
  const c = db();
  if (!c) return [];
  const { data } = await c.from("space_bookings").select("*")
    .eq("guest_user_id", guestUserId).order("created_at", { ascending: false });
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 호스트의 수락·거절. ⚠️권한(이 사람이 그 공간 주인인가)은 호출부가 먼저 확인한다.
 *  거절은 여기서 `rejected`까지만 찍는다 — 실제 환불은 결제 모듈이 하고, 끝나면 `refunded`로 넘어간다. */
export async function decideBooking(
  id: number, accept: boolean, message: string
): Promise<SpaceBooking | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("space_bookings")
    .update({ status: accept ? "confirmed" : "rejected", host_message: message, decided_at: new Date().toISOString() })
    .eq("id", id).eq("status", "paid")     // ⭐이미 결정된 건을 다시 못 뒤집게 조건을 건다
    .select().maybeSingle();
  if (error) { console.error(`[spaces] decide failed id=${id}: ${error.message}`); return null; }
  return data ? toBooking(data as Row) : null;
}

export async function setBookingStatus(id: number, status: BookingStatus): Promise<void> {
  const c = db();
  if (!c) return;
  await c.from("space_bookings").update({ status }).eq("id", id);
}

/** ⭐확정된 예약에서만 참이다 — 주소·연락처를 열어도 되는가. */
export function isRevealed(b: SpaceBooking): boolean {
  return b.status === "confirmed" || b.status === "done";
}
