import "server-only"; // 🔒클라이언트 컴포넌트가 import하면 빌드가 멈춘다. 서비스 롤 키로 DB를 읽는 파일이다(09-18 밤 QA SEC-09).
// 하루 팝업 — 공간 대여 데이터 계층 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// ⚠️`repo.ts`에 넣지 않고 별도 파일로 둔 이유 둘.
//   ①이 기능은 소개서와 **독립**이다(대표 09-13). `brands`를 한 줄도 안 읽는다.
//   ②`repo.ts`는 1팀·2팀이 동시에 만지는 뜨거운 파일이라, 새 기능 한 벌을 얹으면 충돌이 잦다.
//   같은 이유로 `profiles.ts`도 자기 클라이언트를 따로 들고 있다 — 그 패턴을 그대로 빌렸다.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type {
  Space, SpacePublic, SpaceBooking, SpaceStatus, BookingStatus, OpenSlot,
  Payment, PaymentStatus, PayoutStatus, TossPayment, RepeatRule, BizCheckStatus, BizCheckDetail,
} from "./types";
import { bookingFinished, todayKst, expandRepeat, stripRepeat, pruneRepeat, minutesBetween, RENT_MIN_MINUTES } from "./rent-time";
import { productsFromLegacy } from "./rent-products";
import { payoutAmount } from "./rent-money";
// 🚪09-19 오후 — 손님 앞에 세울지는 순수 규칙 한 벌(`bizcheck`). 목록·소개서 카드·공개 투영이 같이 쓴다.
import { bizOnFile, spaceListed, TEST_BIZ_NUMBER, testBizAllowed } from "./bizcheck";
// 🧪09-17 목 데이터 — 읽기 함수는 첫 줄에서 목 세계를 돌려주고, 쓰기 함수는 첫 줄에서 멈춘다. 개발 빌드 전용(`rent-mock.ts` 머리말).
import { getRentMock, rentMockOn } from "./rent-mock";

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

/** 게스트가 낸 돈에서 호스트 몫을 계산한다. 원 단위 내림 — 1원이 남으면 우리가 갖는다.
 *  🔢09-18 밤 QA(SEC-03) — 계산은 `rent-money.ts`의 정수 연산 한 벌이다(등록 폼·목 데이터와 같은 함수). */
export function payout(total: number, rate: number = FEE_RATE): number {
  return payoutAmount(total, rate);
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

/** ⏱최소 대여 시간 — 🔒09-19 대표 #88부터 모든 공간 1시간(`RENT_MIN_MINUTES`). 행에 2·3시간이 남아 있어도 1로 읽는다.
 *  🔁09-19 오전까지는 `min_minutes`(30분 눈금)와 옛 `min_hours`를 견줘 읽었다(`minHoursOf`, 지웠다). 칸은 DB에 남는다. */
const MIN_HOURS_FIXED = RENT_MIN_MINUTES / 60;

const BIZ_STATUSES: BizCheckStatus[] = ["none", "valid", "mismatch", "closed", "error"];
const bizStatus = (v: unknown): BizCheckStatus => (BIZ_STATUSES.includes(v as BizCheckStatus) ? (v as BizCheckStatus) : "none");

function toSpace(r: Row): Space {
  // ⭐«읽을 때 펼친다» — 여기 한 곳에서. 목록 날짜 거르기·상세 달력·결제 전 `fitsOpenSlot`이 전부 이 값을 본다.
  const repeatWeekly = repeatRules(r.repeat_weekly);
  const scope = (s(r.scope) || "space_only") as Space["scope"];
  // 🛍상품 셋(09-18). ⚠️SQL 전 DB엔 칸이 «없다»(undefined). 그땐 옛 범위·시간당 값에서 만든다 —
  //   빈 상품으로 읽으면 모든 공간이 「팔 것 없음」이 되어 신청이 통째로 막힌다.
  const products = r.rent_space_on === undefined && r.rent_full_on === undefined
    ? productsFromLegacy(scope, n(r.price_hour))
    : {
      rentSpaceOn: r.rent_space_on === true, rentSpacePrice: n(r.rent_space_price), rentSpaceNote: s(r.rent_space_note),
      rentFullOn: r.rent_full_on === true, rentFullPrice: n(r.rent_full_price), rentFullNote: s(r.rent_full_note),
    };
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
    scope,
    priceHour: n(r.price_hour), minHours: MIN_HOURS_FIXED,
    ...products,
    openSlots: expandRepeat(slots(r.open_slots), repeatWeekly),
    repeatWeekly,
    coffeeChat: r.coffee_chat === true,
    coffeeChatMinutes: n(r.coffee_chat_minutes), coffeeChatPrice: n(r.coffee_chat_price),
    coffeeChatTopics: s(r.coffee_chat_topics),
    accessHow: (s(r.access_how) || "sms") as Space["accessHow"],
    contactPhone: s(r.contact_phone),
    hostTermsAt: s(r.host_terms_at) || undefined,
    // 🧾09-18 사업자 확인 · 🏪네이버 상호. ⚠️SQL 전 DB엔 칸이 없어 전부 빈 값·`none`으로 읽힌다(화면은 «확인 전»으로 그린다).
    bizNumber: s(r.biz_number), bizOwnerName: s(r.biz_owner_name), bizOpenDate: s(r.biz_open_date),
    bizCertPath: s(r.biz_cert_path),
    // 🏷09-19 상호. SQL 전 DB엔 칸이 없어 빈 값 — 판매자 정보 화면이 공간 이름으로 물러선다.
    bizName: s(r.biz_name),
    bizCheckStatus: bizStatus(r.biz_check_status),
    bizCheckDetail: r.biz_check_detail && typeof r.biz_check_detail === "object" ? (r.biz_check_detail as BizCheckDetail) : undefined,
    bizCheckedAt: s(r.biz_checked_at) || undefined,
    bizApprovedAt: s(r.biz_approved_at) || undefined,
    placeName: s(r.place_name), placeAddress: s(r.place_address),
    placeLat: typeof r.place_lat === "number" ? r.place_lat : undefined,
    placeLng: typeof r.place_lng === "number" ? r.place_lng : undefined,
    placeMatchedAt: s(r.place_matched_at) || undefined,
    // 🔁09-19 저녁 보완 요청 · 바뀌기 전 이름·주소. ⚠️SQL(`2026-09-19-rent-review-reject.sql`) 전 DB엔 칸이 없어 빈 값이다.
    //   칸이 «있는지»를 따로 적어 둔다(`reviewReady`). 검토 화면이 [보완 요청]을 열지, 공개가 이 칸을 지울지 이걸로 정한다.
    reviewNote: s(r.review_note),
    reviewRejectedAt: s(r.review_rejected_at) || undefined,
    reviewPrevName: s(r.review_prev_name),
    reviewPrevAddress: s(r.review_prev_address),
    reviewReady: "review_note" in r,
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
  // 🔒09-18 사업자 번호·대표자 이름·개업일·등록증 경로·조회 원문도 여기서 지운다. 확인 표시는 상태·승인 시각 둘로 충분하다.
  // 🔒09-19 저녁 보완 사유·바뀌기 전 이름·주소도 지운다. 관리자와 그 사장님 사이의 말이다.
  const {
    accessNote: _n, hostTermsAt: _t,
    bizNumber: _b1, bizOwnerName: _b2, bizOpenDate: _b3, bizCertPath: _b4, bizCheckDetail: _b5,
    reviewNote: _r1, reviewRejectedAt: _r2, reviewPrevName: _r3, reviewPrevAddress: _r4, reviewReady: _r5,
    ...rest
  } = sp;
  void _n; void _t; void _b1; void _b2; void _b3; void _b4; void _b5;
  void _r1; void _r2; void _r3; void _r4; void _r5;
  // 🚪09-19 오후 — 번호는 지우고 «있나»만 남긴다. 상세가 이 값으로 남에게 보일지 가른다(`spaceListed`).
  return { ...rest, bizOnFile: bizOnFile(sp) };
}

function toBooking(r: Row): SpaceBooking {
  return {
    id: n(r.id), spaceId: n(r.space_id), guestUserId: n(r.guest_user_id),
    guestBrandSlug: s(r.guest_brand_slug), guestPhone: s(r.guest_phone),
    // 🪪09-18. SQL 전엔 칸이 없어 빈 값으로 읽힌다 — 화면·메일이 프로필 브랜드명으로 물러선다.
    guestName: s(r.guest_name),
    useDate: s(r.use_date), hours: s(r.hours), plan: s(r.plan),
    // ⚠️Postgres의 `time`은 "10:00:00"으로 온다. 화면·계산은 전부 "HH:MM"이라 여기서 잘라 맞춘다 —
    //   한 곳에서 안 자르면 "10:00:00"과 "10:00" 비교가 조용히 어긋난다.
    startTime: s(r.start_time).slice(0, 5), endTime: s(r.end_time).slice(0, 5),
    hoursCount: n(r.hours_count),
    // ⏱09-19 분 칸. ⚠️SQL 전 DB엔 칸이 없고, SQL 뒤에도 옛 코드가 만든 행은 0이다. 그땐 시각 차이로, 그것도 없으면 옛 시간 수로.
    minutesCount: n(r.minutes_count) > 0
      ? n(r.minutes_count)
      : minutesBetween(s(r.start_time).slice(0, 5), s(r.end_time).slice(0, 5)) || n(r.hours_count) * 60,
    // 🛍09-18. SQL 전엔 칸이 없어 «대관만»으로 읽힌다(SQL이 옛 예약을 공간의 옛 범위로 채운다).
    product: s(r.product) === "full" ? "full" : "space",
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
    // 🧾09-27 D5. SQL 전 DB엔 칸이 없어 undefined다(표시 없음으로 읽힌다).
    refundUnconfirmedAt: r.refund_unconfirmed_at ? s(r.refund_unconfirmed_at) : undefined,
    createdAt: s(r.created_at), updatedAt: s(r.updated_at),
  };
}

// ─── 공간 읽기 ───

export interface SpaceFilter {
  /** 찾기 낱말 — 동네·공간 이름·주소·설비 태그 부분일치(대소문자 무시). 칸 이름은 옛 「동네」 그대로다. */
  area?: string;
  /** 이 날짜에 열린 시간대가 있는 곳만. 화면엔 고르개가 없고 주소로만 들어온다(09-16 B84). */
  date?: string;
  /** 업종. 목록 거르개의 축이다(09-16 B84). */
  category?: Space["category"];
  useType?: Space["useType"];
  limit?: number;
}

/** 찾기 낱말이 이 공간에 걸리나 — 목 분기와 DB 분기가 같은 함수로 거른다. 둘이 따로 적히면 목 화면의 「0건」이 운영과 갈린다.
 *  🔎09-18 대표 — 동네·이름·주소에 **설비 태그**(「와이파이」·「에스프레소 머신」)까지. 소개 글(body)은 안 넣는다(대표 결정: 태그까지만).
 *  태그도 부분일치다. 「에스프레소」로 「에스프레소 머신」이 걸려야 한다. */
function matchesKeyword(sp: Pick<Space, "area" | "name" | "address" | "facilities">, kw: string): boolean {
  const k = kw.toLowerCase();
  return [sp.area, sp.name, sp.address, ...sp.facilities].some((v) => v.toLowerCase().includes(k));
}

/** 목록 — 공개된 것만. ⭐돌려주는 값에 주소가 없다(`toPublic`).
 *  🚪09-19 오후 대표 — 사업자등록번호가 빈 공간은 공개 중이어도 뺀다(`spaceListed`). 사이트맵도 이 함수를 읽는다. */
export async function listOpenSpaces(f: SpaceFilter = {}): Promise<SpacePublic[]> {
  const kw = f.area?.trim() ?? "";
  const limit = f.limit ?? 60;
  const m = await getRentMock();
  if (m) {
    // 아래 DB 질의와 같은 거르기를 코드로 한다. 목 화면의 「0건」도 실제 조건과 같은 이유로 나와야 한다.
    const out = m.data.spaces
      .filter((sp) => spaceListed(sp))
      .filter((sp) => !kw || matchesKeyword(sp, kw))
      .filter((sp) => !f.category || sp.category === f.category)
      .filter((sp) => !f.useType || f.useType === "both" || sp.useType === f.useType || sp.useType === "both")
      .filter((sp) => !f.date || sp.openSlots.some((sl) => sl.date === f.date));
    return out.slice(0, limit).map(toPublic);
  }
  const c = db();
  if (!c) return [];
  // 🚪번호가 빈 공간은 DB에서 거른다(`neq`는 NULL도 뺀다). 코드에서만 거르면 60개로 자른 «뒤»에 빠져 목록이 모자라진다.
  let q = c.from("spaces").select("*").eq("status", "open").neq("biz_number", "").order("created_at", { ascending: false });
  // 🧪운영 빌드에선 로컬 테스트 번호도 DB에서 거른다(`bizOnFile`과 같은 뜻). 로컬 3003이 운영 DB에 적은 번호가 운영 목록에 새지 않게.
  if (!testBizAllowed()) q = q.neq("biz_number", TEST_BIZ_NUMBER);
  // 🔎09-18 찾기 낱말은 **DB에서 거르지 않고 코드에서 네 칸을 한 번에 본다.**
  //   설비(`facilities`)가 jsonb 배열이라 PostgREST `or`에 부분일치로 못 넣는다. `cs`(포함)는 원소가 정확히 같아야 해서
  //   「에스프레소」로 「에스프레소 머신」을 못 찾고, jsonb를 글자로 바꿔 ilike 하는 필터는 PostgREST에 없다.
  //   DB에서 동네·이름·주소만 거르고 설비는 코드에서 «합치면» 설비로만 걸리는 공간이 DB 단계에서 이미 빠져 합칠 게 없다.
  //   그래서 낱말이 있으면 열린 공간을 다 받아 코드에서 거른다. 열린 공간이 수백 곳일 동안은 한 번 읽기로 충분하다.
  //   (천 단위가 되면 `facilities`를 글자로 굳힌 생성 칸 + trigram 색인으로 DB에 돌려보낸다.)
  // 🔁09-18 첫판은 `or(area.ilike…)`라 사용자 글자에서 PostgREST 구분자(쉼표·괄호)를 걷어 냈다. 코드에서 거르니 그 일도 없어졌다.
  if (f.category) q = q.eq("category", f.category);
  if (f.useType && f.useType !== "both") q = q.in("use_type", [f.useType, "both"]);
  // ⚠️코드에서 더 거를 게 있으면 DB에서 자르지 않는다. 먼저 60개로 자르고 거르면 61번째부터의 결과가 조용히 빠진다.
  const filterInCode = !!kw || !!f.date;
  if (!filterInCode) q = q.limit(limit);
  const { data, error } = await q;
  if (error) { console.error(`[spaces] list failed: ${error.message}`); return []; }
  // 같은 규칙을 코드에서 한 번 더(공백·하이픈만 든 번호처럼 DB의 «빈 글자» 비교를 빠져나오는 값).
  let out = (data ?? []).map((r) => toSpace(r as Row)).filter((sp) => spaceListed(sp));
  if (kw) out = out.filter((sp) => matchesKeyword(sp, kw));
  // 날짜 거르기는 jsonb 안을 봐야 해서 코드에서 한다 — 공간 수가 수백 단위일 동안은 이게 싸다.
  // 🩸09-16까지 여기가 옛 `open_dates`를 보고 있었다. 시간 단위로 바뀌면서 새 등록은 그 칸을 안 채우니
  //   날짜를 고르면 «항상 0건»이었다. 열린 시간대(`openSlots`)가 정본이다.
  if (f.date) out = out.filter((sp) => sp.openSlots.some((sl) => sl.date === f.date));
  return out.slice(0, limit).map(toPublic);
}

/** 🎫09-19 대표 [H] — 소개서(`/m/[slug]`)에 붙는 「○○가 빌려주는 공간」 카드의 재료. 공개 중인 것만, 한 번 읽는다.
 *  `brand_slug`는 사장님이 공간을 올릴 때 «내 소개서 보여주기»를 켠 경우에만 채워진다(저장 때 소개서 주인인지 본다).
 *  🔒그래도 공간 주인과 소개서 주인이 같은 것만 돌려준다. 소개서 소유권이 옮겨 가면 옛 주인의 공간이 새 주인 소개서에 붙어 남는다. */
export async function listOpenSpacesByBrand(brandSlug: string, ownerUserId: number | null | undefined): Promise<SpacePublic[]> {
  if (!brandSlug || !ownerUserId) return [];
  const m = await getRentMock();
  if (m) {
    return m.data.spaces
      .filter((sp) => spaceListed(sp) && sp.brandSlug === brandSlug && sp.ownerUserId === ownerUserId)
      .map(toPublic);
  }
  const c = db();
  if (!c) return [];
  let q = c.from("spaces").select("*")
    .eq("brand_slug", brandSlug).eq("owner_user_id", ownerUserId).eq("status", "open").neq("biz_number", "");
  if (!testBizAllowed()) q = q.neq("biz_number", TEST_BIZ_NUMBER);
  const { data, error } = await q.order("created_at", { ascending: false }).limit(12);
  if (error) { console.error(`[spaces] listByBrand failed: ${error.message}`); return []; }
  // 🚪09-19 오후 — 번호가 빈 공간은 소개서 카드에도 안 붙인다(목록과 같은 규칙).
  return (data ?? []).map((r) => toSpace(r as Row)).filter((sp) => spaceListed(sp)).map(toPublic);
}

/** 상세(공개). 09-16부터 주소·좌표는 공개다(대표: 공간 이름이 이미 보여 감추는 게 무의미). 빠지는 건 옛 「들어오는 법」과 약관 동의 시각뿐. */
export async function getSpacePublic(slug: string): Promise<SpacePublic | null> {
  const sp = await getSpaceFull(slug);
  return sp ? toPublic(sp) : null;
}

/** 🚨원본 — 옛 「들어오는 법」(`accessNote`, 출입 비밀번호가 남아 있을 수 있다)까지 든다. **호출 전에 권한을 확인할 것.**
 *  쓸 수 있는 곳: ①그 공간의 주인 ②결제를 마친 예약의 손님(`guestSeesHost`). 공개 화면은 `getSpacePublic`. */
export async function getSpaceFull(slug: string): Promise<Space | null> {
  const m = await getRentMock();
  if (m) return m.data.spaces.find((sp) => sp.slug === slug) ?? null;
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
  const m = await getRentMock();
  if (m) {
    for (const sp of m.data.spaces) {
      if (!ids.includes(sp.id)) continue;
      out.set(sp.id, {
        id: sp.id, slug: sp.slug, name: sp.name, area: sp.area, hours: sp.hours,
        ownerUserId: sp.ownerUserId, photo: sp.photos[0] ?? "", address: sp.address,
      });
    }
    return out;
  }
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
  const m = await getRentMock();
  if (m) return m.data.spaces.filter((sp) => sp.ownerUserId === ownerUserId);
  const c = db();
  if (!c) return [];
  const { data } = await c.from("spaces").select("*")
    .eq("owner_user_id", ownerUserId).order("created_at", { ascending: false });
  return (data ?? []).map((r) => toSpace(r as Row));
}

// ─── 공간 쓰기 ───

export type SpaceSaveInput = Omit<Space, "id" | "createdAt" | "updatedAt">;

/** 새 공간 저장에서 slug가 이미 있을 때 돌려주는 표시. 호출부가 꼬리를 다시 뽑아 한 번 더 부른다. */
export const SLUG_TAKEN = "slug-taken" as const;

/** 공간 저장. ⚠️권한 검사는 호출부(서버 액션)의 책임이다.
 *  - `isNew: true` — **insert만 한다.** slug가 이미 있으면 그 행을 건드리지 않고 `SLUG_TAKEN`을 돌려준다.
 *  - `isNew: false` — slug 기준 upsert. 호출부가 «그 slug의 주인»인지 확인을 마친 고치기에서만 쓴다.
 *  🩸09-18 밤 QA(SEC-02) — 전엔 새 공간도 upsert였다. slug 꼬리(`Date.now()` 36진수 끝 네 자리)가 약 28분마다 되돌아와서,
 *    같은 이름을 28분 간격으로 올리면 뒤에 올린 사람이 앞사람의 행을 «주인까지» 덮었다. 그래서 `isNew`를 필수로 받는다. */
export async function saveSpace(input: SpaceSaveInput, opts: { isNew: boolean }): Promise<Space | typeof SLUG_TAKEN | null> {
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  // 🔁펼친 날짜는 DB에 굳히지 않는다(2026-09-17). 규칙과 똑같은 칸은 빼고, 지난 쉬는 날도 턴다.
  //   ⚠️`repeat_weekly` 칸이 없는 DB(SQL 전)에선 이 저장이 통째로 실패한다 — SQL이 먼저다.
  const today = todayKst();
  const repeatWeekly = pruneRepeat(input.repeatWeekly ?? [], today);
  // 🗓09-18 밤 QA(SC-32) — 지난 날짜는 아예 저장하지 않는다. 아무도 못 빌리는 칸인데 행에 쌓여서
  //   「열어 둔 날 N일」을 부풀리고, 최소 대여 시간을 늘리면 그 지난 칸 때문에 저장이 막혔다(H-12).
  const openSlots = stripRepeat(input.openSlots, repeatWeekly, today).filter((sl) => sl.date >= today);
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
    // ⏱09-19 30분 단위 — 최소 시간은 분 칸(`min_minutes`)이 정본이다. 옛 칸 `min_hours`(integer)엔 «올림»한 시간을 같이 적는다.
    //   올림인 이유: 옛 코드로 되돌아가도 사장님이 정한 최소보다 짧은 예약은 안 받게(1시간 30분 → 2시간, 더 엄격한 쪽).
    price_hour: input.priceHour, min_hours: Math.ceil(input.minHours), min_minutes: Math.round(input.minHours * 60),
    open_slots: openSlots, repeat_weekly: repeatWeekly,
    // 🛍09-18 상품 셋. ⚠️이 칸들이 없는 DB(SQL 전)에선 저장이 통째로 실패한다 — `2026-09-18-rent-products.sql`이 먼저다.
    //   조용히 빼고 저장하는 길은 두지 않았다. 사장님이 적은 상품 설명이 말없이 사라진다.
    rent_space_on: input.rentSpaceOn, rent_space_price: input.rentSpacePrice, rent_space_note: input.rentSpaceNote,
    rent_full_on: input.rentFullOn, rent_full_price: input.rentFullPrice, rent_full_note: input.rentFullNote,
    coffee_chat: input.coffeeChat, coffee_chat_minutes: input.coffeeChatMinutes,
    coffee_chat_price: input.coffeeChatPrice, coffee_chat_topics: input.coffeeChatTopics,
    access_how: input.accessHow, contact_phone: input.contactPhone,
    host_terms_at: input.hostTermsAt ?? null,
    // 🧾🏪09-18. ⚠️칸이 없는 DB(SQL 전)에선 저장이 통째로 실패한다 — `2026-09-18-rent-bizcheck.sql`이 먼저다.
    //   조용히 빼는 길은 두지 않았다. 사장님이 올린 등록증 경로가 말없이 사라진다.
    biz_number: input.bizNumber, biz_owner_name: input.bizOwnerName, biz_open_date: input.bizOpenDate,
    biz_cert_path: input.bizCertPath, biz_check_status: input.bizCheckStatus,
    biz_check_detail: input.bizCheckDetail ? JSON.parse(JSON.stringify(input.bizCheckDetail)) : null,
    biz_checked_at: input.bizCheckedAt ?? null, biz_approved_at: input.bizApprovedAt ?? null,
    biz_name: input.bizName,
    place_name: input.placeName, place_address: input.placeAddress,
    place_lat: input.placeLat ?? null, place_lng: input.placeLng ?? null, place_matched_at: input.placeMatchedAt ?? null,
    // 🔁09-19 저녁 보완 요청 · 바뀌기 전 이름·주소 — «값을 준 칸만» 쓴다. 안 준 칸(undefined)은 upsert가 DB 값을 그대로 둔다.
    //   `reviewRejectedAt`의 빈 문자열은 «지운다»(null)는 뜻이다(사장님이 고쳐 다시 보낼 때).
    ...(input.reviewNote !== undefined ? { review_note: input.reviewNote } : {}),
    ...(input.reviewRejectedAt !== undefined ? { review_rejected_at: input.reviewRejectedAt || null } : {}),
    ...(input.reviewPrevName !== undefined ? { review_prev_name: input.reviewPrevName } : {}),
    ...(input.reviewPrevAddress !== undefined ? { review_prev_address: input.reviewPrevAddress } : {}),
  };
  const write = (r: Partial<typeof row>) =>
    opts.isNew
      ? c.from("spaces").insert(r).select().maybeSingle()
      : c.from("spaces").upsert(r, { onConflict: "slug" }).select().maybeSingle();
  let sent: Partial<typeof row> = row;
  let { data, error } = await write(sent);
  // 🧯SQL을 돌리기 전에 코드가 먼저 나가도 «빼도 잃는 게 없는» 저장은 살린다. 빼면 뜻이 사라지는 값이면 그대로 실패시킨다.
  //   · 규칙(`repeat_weekly`) — 규칙이 없을 때만 뺀다. 규칙이 있는데 빼면 사장님은 켰다고 믿는데 아무 날도 안 열린다.
  //   · 분 칸(`min_minutes`, 09-19) — 최소 시간이 정시일 때만 뺀다(옛 `min_hours`에 그대로 담긴다).
  //     1시간 30분 같은 반 시간은 옛 칸에 못 담아서, 빼면 2시간으로 조용히 바뀐다. 그땐 실패시킨다 — `2026-09-19-rent-half-hour.sql`이 먼저다.
  //   · 상호(`biz_name`, 09-19) — 칸이 없으면 뺀다. 판매자 정보 화면이 공간 이름으로 물러서서 화면이 비지 않는다.
  //     SQL(`2026-09-19-rent-biz-name.sql`)을 돌리면 다음 저장부터 들어간다. 그 사이 적은 상호는 다시 적어야 한다.
  //   · 🔁검토 칸 넷(`review_*`, 09-19 저녁) — 칸이 없으면 넷을 한꺼번에 뺀다. SQL 전엔 보완 요청이 생길 수 없어(버튼이 잠긴다)
  //     지울 반려 표시도 없다. 잃는 건 「바뀌기 전 주소」 한 줄뿐이다(검토 화면이 그 줄을 못 그린다).
  //   PostgREST는 없는 칸을 한 번에 하나씩 말하므로 네 번까지 돈다.
  const REVIEW_KEYS = ["review_note", "review_rejected_at", "review_prev_name", "review_prev_address"] as const;
  for (let i = 0; i < 4 && error; i++) {
    if (REVIEW_KEYS.some((k) => k in sent) && /review_/.test(error.message)) {
      const rest: Record<string, unknown> = { ...sent };
      for (const k of REVIEW_KEYS) delete rest[k];
      sent = rest as Partial<typeof row>;
    } else if ("biz_name" in sent && /biz_name/.test(error.message)) {
      const { biz_name: _bn, ...rest } = sent;
      void _bn;
      sent = rest;
    } else if (repeatWeekly.length === 0 && "repeat_weekly" in sent && /repeat_weekly/.test(error.message)) {
      const { repeat_weekly: _r, ...rest } = sent;
      void _r;
      sent = rest;
    } else if (Number.isInteger(input.minHours) && "min_minutes" in sent && /min_minutes/.test(error.message)) {
      const { min_minutes: _m, ...rest } = sent;
      void _m;
      sent = rest;
    } else break;
    ({ data, error } = await write(sent));
  }
  // 🔒새 공간인데 slug가 겹쳤다(유일 제약 23505). 아무 행도 안 바뀌었다 — 호출부가 다른 slug로 다시 부른다.
  //   spaces의 유일 제약은 slug 하나지만, 나중에 다른 유일 제약이 생겨도 그걸 slug 충돌로 착각하지 않게 글자까지 본다.
  if (error && opts.isNew && error.code === "23505" && /slug/.test(`${error.message} ${error.details ?? ""}`)) {
    return SLUG_TAKEN;
  }
  if (error) { console.error(`[spaces] save failed slug=${input.slug}: ${error.message}`); return null; }
  return data ? toSpace(data as Row) : null;
}

/** 상태 한 칸만 옮긴다 — «지금 `from`일 때만» `to`로(09-17 잠시 쉬기).
 *  ⭐행 전체를 다시 쓰는 `saveSpace`를 안 쓴다. 사장님이 옆 탭에서 고치는 중이면 그 내용을 옛 값으로 덮는다.
 *  참 = 이번에 바뀌었다. 거짓 = 이미 다른 상태였거나 실패. 권한은 호출부가 확인한다. */
export async function setSpaceStatus(slug: string, from: SpaceStatus, to: SpaceStatus): Promise<boolean> {
  if (await rentMockOn()) return false;
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("spaces").update({ status: to })
    .eq("slug", slug).eq("status", from).select("id");
  if (error) { console.error(`[spaces] setSpaceStatus failed slug=${slug}: ${error.message}`); return false; }
  return (data ?? []).length === 1;
}

/** 🧾관리자 승인(09-18) — 공개하고(검토 대기·초안이면) 승인 시각을 적는다. 쉬는 중·공개 중이면 상태는 그대로 두고 시각만.
 *  ⭐행 전체를 다시 쓰는 `saveSpace`를 안 쓴다(`setSpaceStatus`와 같은 이유 — 사장님이 옆 탭에서 고치는 중이면 옛 값으로 덮는다).
 *  🔒조건절에 «읽었을 때의 사업자 정보»를 건다. 관리자가 화면을 보는 사이 사장님이 번호를 바꿨으면 이 승인은 안 먹는다.
 *  참 = 이번에 바뀌었다. 권한은 호출부가 확인한다. */
export async function approveSpace(
  slug: string,
  seen: { status: SpaceStatus; bizNumber: string; bizCertPath: string; reviewReady?: boolean },
): Promise<Space | null> {
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  const next = seen.status === "pending" || seen.status === "draft" ? "open" : seen.status;
  // 🔁09-19 저녁 — 검토를 마치면 보완 사유와 바뀌기 전 이름·주소를 지운다(다음 검토에 옛 말이 따라오지 않게).
  //   칸이 있는 DB에서만(`reviewReady`). SQL 전 DB에 이 칸을 보내면 승인이 통째로 실패한다.
  const clearReview = seen.reviewReady
    ? { review_note: "", review_rejected_at: null, review_prev_name: "", review_prev_address: "" }
    : {};
  const { data, error } = await c.from("spaces")
    .update({ status: next, biz_approved_at: new Date().toISOString(), ...clearReview })
    .eq("slug", slug).eq("status", seen.status)
    .eq("biz_number", seen.bizNumber).eq("biz_cert_path", seen.bizCertPath)
    .select().maybeSingle();
  if (error) { console.error(`[spaces] approveSpace failed slug=${slug}: ${error.message}`); return null; }
  return data ? toSpace(data as Row) : null;
}

/** 🔁09-19 저녁 보완 요청(반려) — 관리자만. 상태를 `pending`으로 내리고 사유와 시각을 적는다(«보완 필요»).
 *  ⭐행 전체를 다시 쓰지 않는다(`approveSpace`와 같은 이유). 🔒«읽었을 때의 상태»일 때만 바꾼다 — 관리자가 사유를 적는 사이
 *    다른 관리자가 공개했거나 사장님이 쉬게 했으면 이 요청은 안 먹는다.
 *  공개 중이던 공간은 이 순간 목록에서 내려간다(목록은 `open`만 읽는다). 이미 잡힌 예약은 예약 행이라 그대로다.
 *  @returns 바뀐 행 · 칸이 없는 DB(SQL 전)면 `REVIEW_COLUMNS_MISSING` · 조건이 안 맞거나 실패면 null. 권한은 호출부가 본다. */
export const REVIEW_COLUMNS_MISSING = "review-columns-missing" as const;
export async function rejectSpace(
  slug: string, seen: { status: SpaceStatus }, note: string,
): Promise<Space | typeof REVIEW_COLUMNS_MISSING | null> {
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("spaces")
    .update({ status: "pending", review_note: note, review_rejected_at: new Date().toISOString() })
    .eq("slug", slug).eq("status", seen.status)
    .select().maybeSingle();
  if (error) {
    if (/review_/.test(error.message)) return REVIEW_COLUMNS_MISSING;
    console.error(`[spaces] rejectSpace failed slug=${slug}: ${error.message}`);
    return null;
  }
  return data ? toSpace(data as Row) : null;
}

/** 🧾관리자 검토 목록(09-18) — 셋을 한 번에.
 *  ① 검토 대기(`pending`) — 공개 여부를 정한다. 🔁09-19 저녁 보완을 요청해 둔 곳은 뺀다(③)
 *  ② 이미 열려 있거나 쉬는 공간 중 «등록증은 있는데 승인이 없는» 곳 — 사장님이 사업자 정보를 바꾼 곳이다.
 *     공개는 그대로 두고 확인 표시만 정한다. 이게 없으면 옛 공간은 확인 표시를 받을 길이 없다.
 *  ③ 🆕보완을 기다리는 곳(`pending` + 보완 요청 시각) — 사장님이 고쳐 다시 보내면 ①로 돌아온다.
 *  오래 기다린 것부터. */
export async function listSpacesForReview(): Promise<{ pending: Space[]; approveOnly: Space[]; waitingFix: Space[] }> {
  const byUpdated = (a: Space, b: Space) => (a.updatedAt < b.updatedAt ? -1 : a.updatedAt > b.updatedAt ? 1 : 0);
  const m = await getRentMock();
  if (m) {
    const pendingAll = m.data.spaces.filter((sp) => sp.status === "pending").sort(byUpdated);
    return {
      pending: pendingAll.filter((sp) => !sp.reviewRejectedAt),
      approveOnly: m.data.spaces
        .filter((sp) => (sp.status === "open" || sp.status === "paused") && !!sp.bizCertPath && !sp.bizApprovedAt)
        .sort(byUpdated),
      waitingFix: pendingAll.filter((sp) => !!sp.reviewRejectedAt),
    };
  }
  const c = db();
  if (!c) return { pending: [], approveOnly: [], waitingFix: [] };
  const [a, b] = await Promise.all([
    c.from("spaces").select("*").eq("status", "pending").order("updated_at", { ascending: true }),
    c.from("spaces").select("*").in("status", ["open", "paused"]).neq("biz_cert_path", "").is("biz_approved_at", null)
      .order("updated_at", { ascending: true }),
  ]);
  if (a.error) console.error(`[spaces] listSpacesForReview pending failed: ${a.error.message}`);
  // ⚠️SQL 전 DB엔 `biz_cert_path` 칸이 없어 ②가 실패한다. ①은 살린다.
  if (b.error) console.error(`[spaces] listSpacesForReview approveOnly failed: ${b.error.message}`);
  const pendingAll = (a.data ?? []).map((r) => toSpace(r as Row));
  return {
    pending: pendingAll.filter((sp) => !sp.reviewRejectedAt),
    approveOnly: (b.data ?? []).map((r) => toSpace(r as Row)),
    waitingFix: pendingAll.filter((sp) => !!sp.reviewRejectedAt),
  };
}

// 🔻하루 단위로 「그날을 판매 목록에서 빼던」 함수는 09-16에 지웠다. 시간 단위로 바뀌면서 할 일이 사라졌다.
//   겹침은 DB의 배제 제약(`no_time_overlap`)이 판정하고, 호스트가 연 시간대(`openSlots`)는 예약이
//   들어와도 그대로 둔다 — 「이 시간에 열어 둔다」는 호스트의 선언이고 「그 안에 누가 들어왔다」는
//   예약 쪽 사실이라, 둘을 한 칸에 섞으면 예약이 취소됐을 때 호스트의 선언을 복원할 방법이 없어진다.

// ─── 예약 ───

export type BookingCreateInput = Omit<
  SpaceBooking,
  "id" | "status" | "hostMessage" | "decidedAt" | "createdAt" | "updatedAt" | "amountPayout" | "feeRate"
  | "refundRequestedAt" | "refundRequestNote" | "hoursCount"
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
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  const row = {
    space_id: input.spaceId, guest_user_id: input.guestUserId, guest_brand_slug: input.guestBrandSlug,
    guest_phone: input.guestPhone,
    // 🪪09-18 성함(실명). ⚠️칸이 없는 DB(SQL 전)에선 이 insert가 실패해 신청이 막힌다 — `2026-09-18-rent-guest-name.sql`이 먼저다.
    guest_name: input.guestName,
    use_date: input.useDate, hours: input.hours, plan: input.plan, headcount: input.headcount ?? null,
    // ⏱09-19 길이의 정본은 분 칸(`minutes_count`)이다. 옛 칸 `hours_count`(integer)는 반 시간을 못 담아 «꽉 찬 시간»(내림)을 적는다.
    start_time: input.startTime, end_time: input.endTime,
    hours_count: Math.floor(input.minutesCount / 60), minutes_count: input.minutesCount,
    // 🛍09-18. ⚠️칸이 없는 DB(SQL 전)에선 이 insert가 실패해 신청이 막힌다 — SQL이 먼저다.
    product: input.product,
    with_chat: input.withChat, amount_chat: input.amountChat,
    with_mentor: input.withMentor,
    amount_space: input.amountSpace, amount_mentor: input.amountMentor, amount_total: input.amountTotal,
    fee_rate: FEE_RATE, amount_payout: payout(input.amountTotal),
    payment_key: "", order_id: input.orderId, status: "pending" as const,
  };
  let { data, error } = await c.from("space_bookings").insert(row).select().maybeSingle();
  // 🧯09-19 분 칸이 없는 DB(SQL 전)면 그 칸만 빼고 다시 넣는다. 잃는 건 없다 — 길이는 시작·끝 시각에 그대로 있고,
  //   읽을 때(`toBooking`) 그 차이로 채운다. 값의 근거인 `amount_space`도 이미 행에 있다.
  if (error && /minutes_count/.test(error.message)) {
    const { minutes_count: _m, ...rest } = row;
    void _m;
    ({ data, error } = await c.from("space_bookings").insert(rest).select().maybeSingle());
  }
  if (error) { console.error(`[spaces] pending insert failed order=${input.orderId}: ${error.message}`); return null; }
  return data ? toBooking(data as Row) : null;
}

/** 그 공간 그 날짜에 «살아 있는» 예약들. 시간 겹침을 보려고 시각만 얇게 읽는다.
 *  ⭐`pending`은 뺀다 — 결제창만 열어 보고 닫은 사람이 남의 시간을 막으면 안 된다(설계 그대로). */
export async function listLiveBookings(spaceId: number, date: string): Promise<SpaceBooking[]> {
  const m = await getRentMock();
  if (m) return m.data.bookings.filter((b) => b.spaceId === spaceId && b.useDate === date && ["paid", "confirmed", "done"].includes(b.status));
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
  const m = await getRentMock();
  if (m) return m.data.bookings.filter((b) => b.spaceId === spaceId && dates.includes(b.useDate) && ["paid", "confirmed", "done"].includes(b.status));
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
  const m = await getRentMock();
  if (m) return m.data.bookings.find((b) => b.orderId === orderId) ?? null;
  const c = db();
  if (!c) return null;
  const { data } = await c.from("space_bookings").select("*").eq("order_id", orderId).maybeSingle();
  return data ? toBooking(data as Row) : null;
}

// 🔻`markBookingPaid`는 09-16에 지웠다. 승인은 이제 `rentSync(orderId, "paid", 토스응답)` 한 번이다 —
//   예약을 paid로 올리는 것과 결제를 DONE으로 적는 것이 한 트랜잭션이라, 시간이 겹쳐 예약이 막히면
//   결제 기록도 같이 안 바뀐다(그때 호출부가 환불로 잇는다).

export async function getBooking(id: number): Promise<SpaceBooking | null> {
  const m = await getRentMock();
  if (m) return m.data.bookings.find((b) => b.id === id) ?? null;
  const c = db();
  if (!c) return null;
  const { data } = await c.from("space_bookings").select("*").eq("id", id).maybeSingle();
  return data ? toBooking(data as Row) : null;
}

/** 호스트가 받은 신청 — 자기 공간 것만. */
export async function listBookingsForHost(ownerUserId: number): Promise<SpaceBooking[]> {
  const m = await getRentMock();
  if (m) {
    const ids = m.data.spaces.filter((sp) => sp.ownerUserId === ownerUserId).map((sp) => sp.id);
    return m.data.bookings
      .filter((b) => ids.includes(b.spaceId) && b.status !== "pending" && b.status !== "expired")
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }
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
  const m = await getRentMock();
  if (m) return m.data.bookings.filter((b) => b.guestUserId === guestUserId).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
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
  if (await rentMockOn()) return null;
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
  if (await rentMockOn()) return;
  const c = db();
  if (!c) return;
  await c.from("space_bookings").update({ status }).eq("id", id);
}

// ─── 이용 전날 리마인드 (2026-09-17) ───

/** 그날(대개 «내일») 이용하는 살아 있는 예약 중 아직 리마인드를 안 보낸 것.
 *  ⚠️`paid`도 넣는다 — phase 1은 결제가 곧 예약이라 사장님이 수락을 안 눌렀어도 손님은 온다.
 *  환불 신청이 걸린 예약도 뺀다. 우리가 전화로 확인하는 중이라 「내일 뵈어요」가 엇나갈 수 있다. */
export async function listBookingsToRemind(useDates: string[]): Promise<SpaceBooking[]> {
  // 🗓09-18 밤 QA(SC-09) — 날짜를 «여럿» 받는다. 크론이 빠진 날을 챙기려면 오늘 것도 같이 봐야 한다(고를지는 `rent-remind`가 정한다).
  if (useDates.length === 0) return [];
  const m = await getRentMock();
  if (m) return m.data.bookings.filter((b) => useDates.includes(b.useDate) && (b.status === "paid" || b.status === "confirmed") && !b.remindedAt && !b.refundRequestedAt);
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("space_bookings").select("*")
    .in("use_date", useDates).in("status", ["paid", "confirmed"])
    .is("reminded_at", null).is("refund_requested_at", null)
    .order("start_time", { ascending: true });
  if (error) { console.error(`[spaces] listBookingsToRemind failed dates=${useDates.join(",")}: ${error.message}`); return []; }
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 보냈다고 적는다. ⭐`reminded_at is null`인 행만 — 작업이 겹쳐 두 번 돌아도 먼저 적은 쪽만 참을 받는다.
 *  참 = 이번에 내가 적었다. 거짓 = 이미 적혀 있었거나 실패. */
export async function markReminded(bookingId: number): Promise<boolean> {
  if (await rentMockOn()) return false;
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
 *  ⚠️판매자 칸은 하루 팝업에선 반드시 채운다 — 지급대행이 돈을 보낼 상대가 이 사람이다. */
export async function createPayment(input: {
  orderId: string; bookingId: number; buyingUserId: number; sellingUserId: number; amount: number;
}): Promise<Payment | null> {
  if (await rentMockOn()) return null;
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
  const m = await getRentMock();
  if (m) return m.data.payments.find((p) => p.orderId === orderId) ?? null;
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
  if (await rentMockOn()) return { ok: false, message: "목 데이터 보기 중" };
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

/** 정리 작업 한 번이 한 일. 크론이 로그와 응답에 싣는다(페이지는 안 본다). */
export interface SweepRun {
  /** ① 결제 시간이 지난 신청 — 닫기 전에 토스에 되물어 본 결과(`rent-recover.ts`). 읽기가 실패했으면 null. */
  stale: import("./rent-recover").RecoverRun | null;
  /** ② 이용 완료로 넘긴 수 · ③ 지급 대기로 올린 취소 예약 수. */
  done: number;
  keptToPayout: number;
}

/** 페이지를 열 때 토스에 물어볼 최대 수. 크론은 더 크게 넘긴다(`/api/cron/rent-remind`). */
export const SWEEP_PAGE_TOSS_LOOKUPS = 3;

/** 🧹시간이 흘러서 바뀌어야 하는 것들을 한 번에 옮긴다. `/rent/my`·신청 내역·정산 화면이 열릴 때, 그리고
 *  🆕09-27 D7 매일 아침 크론이 요약을 세기 «전»에 부른다(전엔 사람이 화면을 열어야만 돌았다).
 *  셋 다 조건절이 «지금 상태»를 보므로 두 번 불려도 같은 결과다(멱등). 페이지와 크론이 겹쳐 돌아도 된다.
 *  ① 결제창만 열고 30분 지난 신청 → 예약 expired · 결제 EXPIRED (토스 결제 유효 시간이 30분)
 *     🆕09-27 D4 — 결제를 시도한 흔적이 있으면 닫기 전에 토스에 되묻는다. 돈이 빠져 있으면 전액 환불(`rent-recover.ts`).
 *  ② 끝난 확정 예약 → 예약 done · 지급 WAITING
 *  ③ 이용일이 지난 «취소» 예약인데 환불하고 남은 돈이 있는 것 → 지급 WAITING
 *     당일 취소(환불 0원)와 부분 환불이 여기 온다. 약관 제8조 「환불되지 않은 금액은 정산 시 지급」.
 *  @param opts.tossLookups ①에서 이번에 토스에 물어볼 최대 수(기본 = 페이지용 `SWEEP_PAGE_TOSS_LOOKUPS`). */
export async function sweepBookings(opts: { tossLookups?: number } = {}): Promise<SweepRun | null> {
  // 🧪목 모드에선 옮기지 않는다 — 이 함수는 «쓰기»다. 목 세계의 상태는 케이스가 정한 그대로 보여야 한다.
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  const today = todayKst();
  const run: SweepRun = { stale: null, done: 0, keptToPayout: 0 };

  // ①
  const cutoff = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: stale, error: staleError } = await c.from("space_bookings").select("id,order_id,created_at")
    .eq("status", "pending").lt("created_at", cutoff);
  if (staleError) console.error(`[spaces] sweep ① failed: ${staleError.message}`);
  const staleOrders = (stale ?? []).map((r) => s((r as Row).order_id)).filter(Boolean);
  if (staleOrders.length > 0) {
    // 결제 줄의 상태·키 = «결제를 시도한 흔적». ⚠️이걸 못 읽으면 흔적을 모르는 채로 닫게 되니 이번엔 ①을 통째로 건너뛴다.
    //   주소 길이 때문에 100건씩 끊어 읽는다(크론이 하루치를 한 번에 볼 수 있다).
    const pays: Row[] = [];
    let payError: { message: string } | null = null;
    for (let i = 0; i < staleOrders.length && !payError; i += 100) {
      const got = await c.from("payments").select("order_id,status,payment_key,amount").in("order_id", staleOrders.slice(i, i + 100));
      if (got.error) payError = got.error;
      else pays.push(...((got.data ?? []) as Row[]));
    }
    if (payError) {
      console.error(`[spaces] sweep ① 결제 줄 읽기 실패 — 이번엔 닫지 않는다: ${payError.message}`);
    } else {
      const byOrder = new Map(pays.map((p) => [s(p.order_id), p]));
      const rows = (stale ?? []).map((r) => {
        const row = r as Row;
        const p = byOrder.get(s(row.order_id));
        return {
          bookingId: n(row.id), orderId: s(row.order_id), createdAt: s(row.created_at),
          payStatus: p ? s(p.status) : "", payKey: p ? s(p.payment_key) : "", amount: p ? n(p.amount) : 0,
        };
      });
      // 🔁토스·알림을 부르는 층이라 파일을 따로 뒀다. 그 파일이 이 파일(`rentSync`)을 쓰므로 여기선 부를 때 가져온다.
      const { recoverStalePending } = await import("./rent-recover");
      run.stale = await recoverStalePending(rows, { lookups: opts.tossLookups ?? SWEEP_PAGE_TOSS_LOOKUPS });
    }
  }

  // ② 👀phase 1(대표 09-16) — 결제 완료(paid)도 확정처럼 본다. 손님은 결제하는 순간 「예약 완료」를 봤고
  //   사장님이 수락을 안 눌렀을 수 있다. 안 넘기면 다녀간 예약이 정산에 영영 안 올라간다.
  //   실제 지급은 아직 사람이 보고 보내므로(지급대행 계약 전) 잘못 나갈 일은 없다.
  //   🙋사장님이 «관리자에게 환불 신청»한 예약은 건너뛴다 — 우리가 전화로 확인하는 중이다.
  //   🧾09-27 D5 — 손님이 취소했는데 환불을 확인하지 못한 예약(`refund_unconfirmed_at`)도 건너뛴다. 돈이 돌아갔는지 모르는데
  //     이용 완료로 넘기면 그 돈이 사장님 지급 대기로 올라간다. ⚠️칸을 조건절에 안 쓰고 `*`로 읽어 코드에서 거른다 —
  //     SQL 전 DB엔 칸이 없어 조건절에 쓰면 조회가 통째로 실패한다(그땐 표시된 예약도 없다).
  const { data: conf } = await c.from("space_bookings").select("*")
    .in("status", ["confirmed", "paid"]).is("refund_requested_at", null).lte("use_date", today);
  for (const r of conf ?? []) {
    if ((r as Row).refund_unconfirmed_at) continue;
    if (!bookingFinished({ useDate: s(r.use_date), endTime: s(r.end_time).slice(0, 5) })) continue;
    if ((await rentSync(s(r.order_id), { bookingStatus: "done", payoutStatus: "WAITING" })).ok) run.done += 1;
  }

  // ③
  // 🔎09-18 밤 QA(SC-08) — **취소된 «지난» 예약만 DB에서 거른다.** 전엔 살아 있는 결제(앞으로 올 예약 포함)를 통째로 받아
  //   코드에서 걸렀다. 예약이 쌓일수록 이 화면 조회 하나가 사이트 전체의 결제를 훑는다.
  //   묻힌 자원은 «별칭»으로 거른다(PostgREST 문서: 별칭이 있으면 별칭 이름을 쓴다). `!inner`라 여기서 걸린 행은 아예 안 온다.
  const { data: kept, error: keptError } = await c.from("payments")
    .select("order_id,balance_amount,booking:space_bookings!inner(status,use_date)")
    .eq("payout_status", "NONE").in("status", ["DONE", "PARTIAL_CANCELED"]).gt("balance_amount", 0)
    .eq("booking.status", "cancelled").lt("booking.use_date", today);
  if (keptError) console.error(`[spaces] sweep ③ failed: ${keptError.message}`);
  for (const r of kept ?? []) {
    // ⚠️거르기는 DB가 한다. 이 줄은 «조회가 조용히 달라졌을 때»를 위한 울타리다 — 지급은 되돌리기 어렵다.
    const b = (r as Row).booking as Row | undefined;
    if (!b || s(b.status) !== "cancelled" || s(b.use_date) >= today) continue;
    if ((await rentSync(s((r as Row).order_id), { payoutStatus: "WAITING" })).ok) run.keptToPayout += 1;
  }
  return run;
}

/** 지급 목록 — 대기·요청·실패·완료. 정산 화면이 판매자별로 묶는다. 예약을 같이 읽어 온다. */
export async function listPayouts(): Promise<{ payment: Payment; booking: SpaceBooking | null }[]> {
  const m = await getRentMock();
  if (m) {
    return m.data.payments
      .filter((p) => ["WAITING", "REQUESTED", "FAILED", "DONE"].includes(p.payoutStatus))
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((p) => ({ payment: p, booking: m.data.bookings.find((b) => b.id === p.bookingId) ?? null }));
  }
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
  if (await rentMockOn()) return false;
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("space_bookings")
    .update({ refund_requested_at: new Date().toISOString(), refund_request_note: note.slice(0, 500) })
    .eq("id", bookingId).is("refund_requested_at", null).in("status", ["paid", "confirmed"])
    .select("id");
  if (error) { console.error(`[spaces] requestRefund failed id=${bookingId}: ${error.message}`); return false; }
  return (data ?? []).length === 1;
}

/** 🧾09-27 D5 — 손님 취소의 환불을 토스 응답으로 확인하지 못했다고 적는다. 예약 상태는 안 바꾼다.
 *  처음 적을 때만 참(겹쳐 눌려도 시각이 처음 것으로 남는다). ⚠️SQL 전 DB엔 칸이 없어 거짓이다(슬랙 알림만 남는다). */
export async function markRefundUnconfirmed(bookingId: number): Promise<boolean> {
  if (await rentMockOn()) return false;
  const c = db();
  if (!c) return false;
  const { data, error } = await c.from("space_bookings")
    .update({ refund_unconfirmed_at: new Date().toISOString() })
    .eq("id", bookingId).is("refund_unconfirmed_at", null)
    .select("id");
  if (error) {
    console.error(`[spaces] markRefundUnconfirmed failed id=${bookingId}${/refund_unconfirmed_at/.test(error.message) ? " (칸이 없다 — 2026-09-27-rent-refund-unconfirmed.sql 전)" : ""}: ${error.message}`);
    return false;
  }
  return (data ?? []).length === 1;
}

/** 관리자가 «신청을 닫는다» — 전화로 확인해 보니 환불할 일이 아니었을 때. 예약은 원래대로 살아 있다. */
export async function clearRefundRequest(bookingId: number): Promise<boolean> {
  if (await rentMockOn()) return false;
  const c = db();
  if (!c) return false;
  const { error } = await c.from("space_bookings")
    .update({ refund_requested_at: null, refund_request_note: "" }).eq("id", bookingId);
  if (error) { console.error(`[spaces] clearRefundRequest failed id=${bookingId}: ${error.message}`); return false; }
  return true;
}

/** 관리자가 처리할 환불 신청 — 아직 결제 완료·확정 상태로 살아 있는 것만. */
export async function listRefundRequests(): Promise<SpaceBooking[]> {
  const m = await getRentMock();
  if (m) {
    return m.data.bookings
      .filter((b) => b.refundRequestedAt && (b.status === "paid" || b.status === "confirmed"))
      .sort((a, b) => ((a.refundRequestedAt ?? "") < (b.refundRequestedAt ?? "") ? -1 : 1));
  }
  const c = db();
  if (!c) return [];
  const { data, error } = await c.from("space_bookings").select("*")
    .not("refund_requested_at", "is", null).in("status", ["paid", "confirmed"])
    .order("refund_requested_at", { ascending: true });
  if (error) { console.error(`[spaces] listRefundRequests failed: ${error.message}`); return []; }
  return (data ?? []).map((r) => toBooking(r as Row));
}

/** 🧾정산 화면이 따로 보여줄 «손이 필요한» 예약 셋.
 *  - `paid` 인데 이용일이 지남 — 사장님이 답을 안 한 채 날이 갔다. 손님 돈이 붙잡혀 있다
 *  - `rejected` — 거절했는데 환불이 실패했다. 손님께 돌려드려야 한다
 *  - 🆕09-27 D5 `refundUnconfirmed` — 손님이 취소했는데 토스 응답으로 환불을 확인하지 못했다. 예약은 결제 완료·확정 그대로다.
 *    같은 멱등키로 다시 불러도 같은 응답이 와서 손님 쪽에선 풀 수 없다. 관리자가 토스 관리자 화면에서 본다. */
export async function listStuckBookings(): Promise<{ unanswered: SpaceBooking[]; refundFailed: SpaceBooking[]; refundUnconfirmed: SpaceBooking[] }> {
  const m = await getRentMock();
  if (m) {
    const byDate = (a: SpaceBooking, b: SpaceBooking) => (a.useDate < b.useDate ? -1 : 1);
    return {
      unanswered: m.data.bookings.filter((b) => b.status === "paid" && b.useDate < todayKst()).sort(byDate),
      refundFailed: m.data.bookings.filter((b) => b.status === "rejected").sort(byDate),
      refundUnconfirmed: m.data.bookings.filter((b) => !!b.refundUnconfirmedAt && (b.status === "paid" || b.status === "confirmed")).sort(byDate),
    };
  }
  const c = db();
  if (!c) return { unanswered: [], refundFailed: [], refundUnconfirmed: [] };
  const [a, b, u] = await Promise.all([
    c.from("space_bookings").select("*").eq("status", "paid").lt("use_date", todayKst()).order("use_date"),
    c.from("space_bookings").select("*").eq("status", "rejected").order("use_date"),
    c.from("space_bookings").select("*").not("refund_unconfirmed_at", "is", null).in("status", ["paid", "confirmed"]).order("use_date"),
  ]);
  // ⚠️SQL 전 DB엔 칸이 없어 셋째 조회만 실패한다. 나머지 둘은 그대로 보여 준다.
  if (u.error) console.error(`[spaces] listStuckBookings refundUnconfirmed failed: ${u.error.message}`);
  return {
    unanswered: (a.data ?? []).map((r) => toBooking(r as Row)),
    refundFailed: (b.data ?? []).map((r) => toBooking(r as Row)),
    refundUnconfirmed: (u.data ?? []).map((r) => toBooking(r as Row)),
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
