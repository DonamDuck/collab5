// 하루 가게 — 공간 대여 데이터 계층 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// ⚠️`repo.ts`에 넣지 않고 별도 파일로 둔 이유 둘.
//   ①이 기능은 소개서와 **독립**이다(대표 09-13). `brands`를 한 줄도 안 읽는다.
//   ②`repo.ts`는 1팀·2팀이 동시에 만지는 뜨거운 파일이라, 새 기능 한 벌을 얹으면 충돌이 잦다.
//   같은 이유로 `profiles.ts`도 자기 클라이언트를 따로 들고 있다 — 그 패턴을 그대로 빌렸다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Space, SpacePublic, SpaceBooking, SpaceStatus, BookingStatus, OpenSlot,
  Payment, PaymentStatus, PayoutStatus, TossPayment, RepeatRule,
} from "./types";
import { bookingFinished, todayKst, expandRepeat, stripRepeat, pruneRepeat } from "./rent-time";

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

/** 🔁요일 규칙을 «모양을 확인하며» 읽는다(2026-09-17). ⚠️칸이 아직 없는 DB(SQL 전)에선 `undefined`라 빈 배열 —
 *  읽기가 죽으면 공간 화면 전체가 안 열린다. 같은 요일이 둘이면 앞의 것만 쓴다. */
function repeatRules(v: unknown): RepeatRule[] {
  if (!Array.isArray(v)) return [];
  const seen = new Set<number>();
  return v.flatMap((x) => {
    if (!x || typeof x !== "object") return [];
    const o = x as Record<string, unknown>;
    const dow = o.dow, start = s(o.start), end = s(o.end);
    if (typeof dow !== "number" || !Number.isInteger(dow) || dow < 0 || dow > 6 || seen.has(dow)) return [];
    if (!/^\d{2}:\d{2}/.test(start) || !/^\d{2}:\d{2}/.test(end)) return [];
    seen.add(dow);
    const skip = arr(o.skip).filter((d) => typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d));
    const rule: RepeatRule = { dow, start: start.slice(0, 5), end: end.slice(0, 5) };
    return [skip.length ? { ...rule, skip } : rule];
  });
}

function toSpace(r: Row): Space {
  // ⭐«읽을 때 펼친다» — 여기 한 곳에서. 목록 날짜 거르기·상세 달력·결제 전 `fitsOpenSlot`이 전부 이 값을 본다.
  const repeatWeekly = repeatRules(r.repeat_weekly);
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
    openSlots: expandRepeat(slots(r.open_slots), repeatWeekly),
    repeatWeekly,
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
    guestBrandSlug: s(r.guest_brand_slug), guestPhone: s(r.guest_phone),
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
    refundRequestedAt: r.refund_requested_at ? s(r.refund_requested_at) : undefined,
    refundRequestNote: s(r.refund_request_note),
    status: (s(r.status) || "paid") as BookingStatus,
    hostMessage: s(r.host_message),
    decidedAt: r.decided_at ? s(r.decided_at) : undefined,
    remindedAt: r.reminded_at ? s(r.reminded_at) : undefined,
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

/** 상세(공개). 09-16부터 주소·좌표는 공개다(대표: 공간 이름이 이미 보여 감추는 게 무의미). 빠지는 건 옛 「들어오는 법」과 약관 동의 시각뿐. */
export async function getSpacePublic(slug: string): Promise<SpacePublic | null> {
  const sp = await getSpaceFull(slug);
  return sp ? toPublic(sp) : null;
}

/** 🚨원본 — 옛 「들어오는 법」(`accessNote`, 출입 비밀번호가 남아 있을 수 있다)까지 든다. **호출 전에 권한을 확인할 것.**
 *  쓸 수 있는 곳: ①그 공간의 주인 ②결제를 마친 예약의 손님(`guestSeesHost`). 공개 화면은 `getSpacePublic`. */
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
  // 🔁펼친 날짜는 DB에 굳히지 않는다(2026-09-17). 규칙과 똑같은 칸은 빼고, 지난 쉬는 날도 턴다.
  //   ⚠️`repeat_weekly` 칸이 없는 DB(SQL 전)에선 이 저장이 통째로 실패한다 — SQL이 먼저다.
  const today = todayKst();
  const repeatWeekly = pruneRepeat(input.repeatWeekly ?? [], today);
  const openSlots = stripRepeat(input.openSlots, repeatWeekly, today);
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
    price_hour: input.priceHour, min_hours: input.minHours, open_slots: openSlots, repeat_weekly: repeatWeekly,
    coffee_chat: input.coffeeChat, coffee_chat_minutes: input.coffeeChatMinutes,
    coffee_chat_price: input.coffeeChatPrice, coffee_chat_topics: input.coffeeChatTopics,
    access_how: input.accessHow, contact_phone: input.contactPhone,
    host_terms_at: input.hostTermsAt ?? null,
  };
  let { data, error } = await c.from("spaces").upsert(row, { onConflict: "slug" }).select().maybeSingle();
  // 🧯SQL을 돌리기 전에 코드가 먼저 나가도 «규칙 없는» 저장은 살린다. 규칙이 있는데 칸이 없으면 그대로 실패시킨다 —
  //   조용히 빼고 저장하면 사장님은 켰다고 믿는데 아무 날도 안 열린다.
  if (error && repeatWeekly.length === 0 && /repeat_weekly/.test(error.message)) {
    const { repeat_weekly: _r, ...rest } = row;
    void _r;
    ({ data, error } = await c.from("spaces").upsert(rest, { onConflict: "slug" }).select().maybeSingle());
  }
  if (error) { console.error(`[spaces] save failed slug=${input.slug}: ${error.message}`); return null; }
  return data ? toSpace(data as Row) : null;
}

/** 상태 한 칸만 옮긴다 — «지금 `from`일 때만» `to`로(09-17 잠시 쉬기).
 *  ⭐행 전체를 다시 쓰는 `saveSpace`를 안 쓴다. 사장님이 옆 탭에서 고치는 중이면 그 내용을 옛 값으로 덮는다.
 *  참 = 이번에 바뀌었다. 거짓 = 이미 다른 상태였거나 실패. 권한은 호출부가 확인한다. */
export async function setSpaceStatus(slug: string, from: SpaceStatus, to: SpaceStatus): Promise<boolean> {
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("spaces").update({ status: to })
    .eq("slug", slug).eq("status", from).select("id");
  if (error) { console.error(`[spaces] setSpaceStatus failed slug=${slug}: ${error.message}`); return false; }
  return (data ?? []).length === 1;
}

// 🔻하루 단위로 「그날을 판매 목록에서 빼던」 함수는 09-16에 지웠다. 시간 단위로 바뀌면서 할 일이 사라졌다.
//   겹침은 DB의 배제 제약(`no_time_overlap`)이 판정하고, 호스트가 연 시간대(`openSlots`)는 예약이
//   들어와도 그대로 둔다 — 「이 시간에 열어 둔다」는 호스트의 선언이고 「그 안에 누가 들어왔다」는
//   예약 쪽 사실이라, 둘을 한 칸에 섞으면 예약이 취소됐을 때 호스트의 선언을 복원할 방법이 없어진다.

// ─── 예약 ───

export type BookingCreateInput = Omit<
  SpaceBooking,
  "id" | "status" | "hostMessage" | "decidedAt" | "createdAt" | "updatedAt" | "amountPayout" | "feeRate"
  | "refundRequestedAt" | "refundRequestNote"
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
    guest_phone: input.guestPhone,
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

// 🔻`markBookingPaid`는 09-16에 지웠다. 승인은 이제 `rentSync(orderId, "paid", 토스응답)` 한 번이다 —
//   예약을 paid로 올리는 것과 결제를 DONE으로 적는 것이 한 트랜잭션이라, 시간이 겹쳐 예약이 막히면
//   결제 기록도 같이 안 바뀐다(그때 호출부가 환불로 잇는다).

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
  // 🚨`pending`·`expired`를 뺀다. 결제 전 신청이 사장님께 보이면 거기서 바로 직거래로 샐 수 있다(대표 09-13).
  //   `expired`(09-16)는 결제창만 열고 떠난 신청이라 pending과 같은 이유로 안 보인다 — 빠뜨리면 그 구멍이 다시 열린다.
  const { data } = await c.from("space_bookings").select("*")
    .in("space_id", mine.map((sp) => sp.id)).not("status", "in", "(pending,expired)")
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

// ─── 이용 전날 리마인드 (2026-09-17) ───

/** 그날(대개 «내일») 이용하는 살아 있는 예약 중 아직 리마인드를 안 보낸 것.
 *  ⚠️`paid`도 넣는다 — phase 1은 결제가 곧 예약이라 사장님이 수락을 안 눌렀어도 손님은 온다.
 *  환불 신청이 걸린 예약도 뺀다. 우리가 전화로 확인하는 중이라 「내일 뵈어요」가 엇나갈 수 있다. */
export async function listBookingsToRemind(useDate: string): Promise<SpaceBooking[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("space_bookings").select("*")
    .eq("use_date", useDate).in("status", ["paid", "confirmed"])
    .is("reminded_at", null).is("refund_requested_at", null)
    .order("start_time", { ascending: true });
  if (error) { console.error(`[spaces] listBookingsToRemind failed date=${useDate}: ${error.message}`); return []; }
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 보냈다고 적는다. ⭐`reminded_at is null`인 행만 — 작업이 겹쳐 두 번 돌아도 먼저 적은 쪽만 참을 받는다.
 *  참 = 이번에 내가 적었다. 거짓 = 이미 적혀 있었거나 실패. */
export async function markReminded(bookingId: number): Promise<boolean> {
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("space_bookings")
    .update({ reminded_at: new Date().toISOString() })
    .eq("id", bookingId).is("reminded_at", null)
    .select("id");
  if (error) { console.error(`[spaces] markReminded failed id=${bookingId}: ${error.message}`); return false; }
  return (data ?? []).length === 1;
}

// ─── 결제 (2026-09-16) ───
// ⭐예약과 결제는 두 테이블이고, 두 상태를 바꾸는 문은 DB 함수 `rent_sync` 하나다(대표 09-16).
//   앱이 두 번 나눠 쓰면 가운데서 끊기는 날 「예약은 취소, 결제는 완료」가 생긴다. 함수 안은 한 트랜잭션이다.

function toPayment(r: Row): Payment {
  return {
    id: n(r.id), orderId: s(r.order_id), paymentKey: s(r.payment_key),
    purpose: "rent_booking",
    bookingId: typeof r.booking_id === "number" ? r.booking_id : undefined,
    buyingUserId: typeof r.buying_user_id === "number" ? r.buying_user_id : undefined,
    sellingUserId: typeof r.selling_user_id === "number" ? r.selling_user_id : undefined,
    amount: n(r.amount), balanceAmount: n(r.balance_amount), method: s(r.method),
    status: (s(r.status) || "READY") as PaymentStatus,
    approvedAt: r.approved_at ? s(r.approved_at) : undefined,
    canceledAt: r.canceled_at ? s(r.canceled_at) : undefined,
    feeRate: typeof r.fee_rate === "number" ? r.fee_rate : Number(r.fee_rate ?? FEE_RATE),
    payoutAmount: n(r.payout_amount),
    payoutStatus: (s(r.payout_status) || "NONE") as PayoutStatus,
    payoutRequestedAt: r.payout_requested_at ? s(r.payout_requested_at) : undefined,
    payoutDoneAt: r.payout_done_at ? s(r.payout_done_at) : undefined,
    createdAt: s(r.created_at), updatedAt: s(r.updated_at),
  };
}

/** 결제창을 열기 «직전»에 결제 줄을 만든다(READY). 예약 pending 줄과 같은 주문번호다.
 *  ⚠️판매자 칸은 하루 가게에선 반드시 채운다 — 지급대행이 돈을 보낼 상대가 이 사람이다. */
export async function createPayment(input: {
  orderId: string; bookingId: number; buyingUserId: number; sellingUserId: number; amount: number;
}): Promise<Payment | null> {
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("payments").insert({
    order_id: input.orderId, purpose: "rent_booking", booking_id: input.bookingId,
    buying_user_id: input.buyingUserId, selling_user_id: input.sellingUserId,
    amount: input.amount, balance_amount: input.amount, status: "READY", fee_rate: FEE_RATE,
  }).select().maybeSingle();
  if (error) { console.error(`[spaces] payment insert failed order=${input.orderId}: ${error.message}`); return null; }
  return data ? toPayment(data as Row) : null;
}

export async function getPaymentByOrderId(orderId: string): Promise<Payment | null> {
  const c = db();
  if (!c) return null;
  const { data } = await c.from("payments").select("*").eq("order_id", orderId).maybeSingle();
  return data ? toPayment(data as Row) : null;
}

/** 🔒예약·결제·지급 상태를 «같이» 옮기는 유일한 문. 셋 다 null이면 아무것도 안 바꾼다.
 *  - `bookingStatus` 예약을 무엇으로
 *  - `toss` 토스 Payment 응답(돈의 상태는 우리가 계산하지 않고 토스 말을 옮긴다)
 *  - `payoutStatus` 지급 상태를 무엇으로
 *  실패하면 둘 다 안 바뀐 것이다(DB 함수가 한 트랜잭션). 호출부가 그 뒤를 책임진다. */
export async function rentSync(
  orderId: string,
  change: { bookingStatus?: BookingStatus; toss?: TossPayment; payoutStatus?: PayoutStatus },
): Promise<{ ok: boolean; message: string }> {
  const c = db();
  if (!c) return { ok: false, message: "db 없음" };
  const { error } = await c.rpc("rent_sync", {
    p_order_id: orderId,
    p_booking_status: change.bookingStatus ?? null,
    // ⚠️토스 객체를 그대로 넘기면 안 된다 — 경계 너머로 보내기 전에 한 번 평범한 JSON으로 만든다
    //   ([[foreign-object-at-the-boundary]]). 날짜·undefined가 섞이면 jsonb 변환에서 조용히 빠진다.
    p_toss: change.toss ? JSON.parse(JSON.stringify(change.toss)) : null,
    p_payout_status: change.payoutStatus ?? null,
  });
  if (error) {
    console.error(`[spaces] rent_sync failed order=${orderId} ${JSON.stringify(change.bookingStatus ?? null)}: ${error.message}`);
    return { ok: false, message: error.message };
  }
  return { ok: true, message: "" };
}

/** 🧹시간이 흘러서 바뀌어야 하는 것들을 한 번에 옮긴다. 크론 없이 `/rent/my`·신청 내역·정산 화면이 열릴 때 부른다.
 *  셋 다 조건절이 «지금 상태»를 보므로 두 번 불려도 같은 결과다(멱등).
 *  ① 결제창만 열고 30분 지난 신청 → 예약 expired · 결제 EXPIRED (토스 결제 유효 시간이 30분)
 *  ② 끝난 확정 예약 → 예약 done · 지급 WAITING
 *  ③ 이용일이 지난 «취소» 예약인데 환불하고 남은 돈이 있는 것 → 지급 WAITING
 *     당일 취소(환불 0원)와 부분 환불이 여기 온다. 약관 제8조 「환불되지 않은 금액은 정산 시 지급」. */
export async function sweepBookings(): Promise<void> {
  const c = db();
  if (!c) return;
  const today = todayKst();

  // ①
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: stale } = await c.from("space_bookings").select("order_id")
    .eq("status", "pending").lt("created_at", cutoff);
  for (const r of stale ?? []) {
    await rentSync(s(r.order_id), { bookingStatus: "expired", toss: { status: "EXPIRED" } });
  }

  // ② 👀phase 1(대표 09-16) — 결제 완료(paid)도 확정처럼 본다. 손님은 결제하는 순간 「예약 완료」를 봤고
  //   사장님이 수락을 안 눌렀을 수 있다. 안 넘기면 다녀간 예약이 정산에 영영 안 올라간다.
  //   실제 지급은 아직 사람이 보고 보내므로(지급대행 계약 전) 잘못 나갈 일은 없다.
  //   🙋사장님이 «관리자에게 환불 신청»한 예약은 건너뛴다 — 우리가 전화로 확인하는 중이다.
  const { data: conf } = await c.from("space_bookings").select("order_id,use_date,end_time")
    .in("status", ["confirmed", "paid"]).is("refund_requested_at", null).lte("use_date", today);
  for (const r of conf ?? []) {
    if (!bookingFinished({ useDate: s(r.use_date), endTime: s(r.end_time).slice(0, 5) })) continue;
    await rentSync(s(r.order_id), { bookingStatus: "done", payoutStatus: "WAITING" });
  }

  // ③
  const { data: kept } = await c.from("payments")
    .select("order_id,balance_amount,booking:space_bookings!inner(status,use_date)")
    .eq("payout_status", "NONE").in("status", ["DONE", "PARTIAL_CANCELED"]).gt("balance_amount", 0);
  for (const r of kept ?? []) {
    const b = (r as Row).booking as Row | undefined;
    if (!b || s(b.status) !== "cancelled" || s(b.use_date) >= today) continue;
    await rentSync(s((r as Row).order_id), { payoutStatus: "WAITING" });
  }
}

/** 지급 목록 — 대기·요청·실패·완료. 정산 화면이 판매자별로 묶는다. 예약을 같이 읽어 온다. */
export async function listPayouts(): Promise<{ payment: Payment; booking: SpaceBooking | null }[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("payments")
    .select("*, booking:space_bookings(*)")
    .in("payout_status", ["WAITING", "REQUESTED", "FAILED", "DONE"])
    .order("created_at", { ascending: true });
  if (error) { console.error(`[spaces] listPayouts failed: ${error.message}`); return []; }
  return (data ?? []).map((r) => {
    const row = r as Row;
    return { payment: toPayment(row), booking: row.booking ? toBooking(row.booking as Row) : null };
  });
}

// ─── 사장님의 «관리자에게 환불 신청» (대표 09-16) ───

/** 신청을 적는다. 이미 신청돼 있으면 덮어쓰지 않는다(처음 시각이 남는다). 권한은 호출부가 확인한다. */
export async function requestRefund(bookingId: number, note: string): Promise<boolean> {
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("space_bookings")
    .update({ refund_requested_at: new Date().toISOString(), refund_request_note: note.slice(0, 500) })
    .eq("id", bookingId).is("refund_requested_at", null).in("status", ["paid", "confirmed"])
    .select("id");
  if (error) { console.error(`[spaces] requestRefund failed id=${bookingId}: ${error.message}`); return false; }
  return (data ?? []).length === 1;
}

/** 관리자가 «신청을 닫는다» — 전화로 확인해 보니 환불할 일이 아니었을 때. 예약은 원래대로 살아 있다. */
export async function clearRefundRequest(bookingId: number): Promise<boolean> {
  const c = db();
  if (!c) return false;
  const { error } = await c.from("space_bookings")
    .update({ refund_requested_at: null, refund_request_note: "" }).eq("id", bookingId);
  if (error) { console.error(`[spaces] clearRefundRequest failed id=${bookingId}: ${error.message}`); return false; }
  return true;
}

/** 관리자가 처리할 환불 신청 — 아직 결제 완료·확정 상태로 살아 있는 것만. */
export async function listRefundRequests(): Promise<SpaceBooking[]> {
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("space_bookings").select("*")
    .not("refund_requested_at", "is", null).in("status", ["paid", "confirmed"])
    .order("refund_requested_at", { ascending: true });
  if (error) { console.error(`[spaces] listRefundRequests failed: ${error.message}`); return []; }
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 🧾정산 화면이 따로 보여줄 «손이 필요한» 예약 둘.
 *  - `paid` 인데 이용일이 지남 — 사장님이 답을 안 한 채 날이 갔다. 손님 돈이 붙잡혀 있다
 *  - `rejected` — 거절했는데 환불이 실패했다. 손님께 돌려드려야 한다 */
export async function listStuckBookings(): Promise<{ unanswered: SpaceBooking[]; refundFailed: SpaceBooking[] }> {
  const c = db();
  if (!c) return { unanswered: [], refundFailed: [] };
  const [a, b] = await Promise.all([
    c.from("space_bookings").select("*").eq("status", "paid").lt("use_date", todayKst()).order("use_date"),
    c.from("space_bookings").select("*").eq("status", "rejected").order("use_date"),
  ]);
  return {
    unanswered: (a.data ?? []).map((r) => toBooking(r as Row)),
    refundFailed: (b.data ?? []).map((r) => toBooking(r as Row)),
  };
}

/** 👀손님이 사장님 연락처를 볼 수 있는가 — **결제를 마친 순간부터**(대표 09-16, phase 1).
 *
 *  채팅이 없는 지금은 「사장님 답 기다리는 중」으로 손님을 세워 두지 않는다. 결제가 끝나면 곧 예약 완료고,
 *  사장님 전화번호를 바로 보여 준다. 사장님이 답을 안 하는 일은 우리가 상담(카카오 채널)으로 받아 직접 처리한다.
 *  ⏭나중에 채팅이 붙으면 「채팅으로 메시지를 보낸 이력이 있으면 규정 위반이 아니다」 같은 규정을 그 위에 얹는다.
 *  ⚠️사장님 쪽에서 «손님» 연락처를 여는 문은 여전히 `isRevealed`(수락 뒤)다. 둘을 섞지 마라. */
export function guestSeesHost(b: SpaceBooking): boolean {
  return b.status === "paid" || b.status === "confirmed" || b.status === "done";
}

/** ⭐사장님이 손님 연락처를 볼 수 있는가 — 수락(확정)한 예약에서만 참이다. */
export function isRevealed(b: SpaceBooking): boolean {
  return b.status === "confirmed" || b.status === "done";
}
