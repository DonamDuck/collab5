import "server-only"; // 🔒서비스 롤 키로 결제 줄을 읽고 토스 시크릿 키로 조회하는 파일이다.
// 하루 팝업 — 하루 한 번 토스 장부와 우리 장부를 맞대 본다 (2026-09-27, 대표 결정 D6)
//
// 대표 원문: *「장부는 좋은 아이디어야 하루 한번」*.
// ⭐**알려 주기만 한다. 자동으로 고치지 않는다.** 즉시 처리는 정리 작업의 되묻기(`rent-recover.ts`, D4)가 맡고,
//   이 대조는 그 그물도 빠져나간 것을 다음 날 아침 사람 눈앞에 세운다. 둘의 역할을 섞지 않는다.
//
// 무엇을 맞대나
//   ① 토스 «거래 조회»(`GET /v1/transactions`)로 전날(KST) 일어난 승인·취소 거래를 읽는다.
//      시간대가 문서에 없어서 앞뒤로 넉넉히 받아 `transactionAt`(±hh:mm이 붙어 온다)으로 다시 거른다.
//   ② 그 거래가 걸린 결제 하나하나를 «지금» 토스에서 다시 읽는다(`GET /v1/payments/{paymentKey}`).
//      거래 줄만으로는 전날 이전의 환불을 모른다. 지금의 토스 장부와 지금의 우리 장부를 맞대야 셈이 맞는다.
//   ③ 우리 쪽은 그 주문들의 결제 줄 + 전날 승인·취소 시각이 찍힌 결제 줄(토스 거래 내역에 없는 것을 잡으려고).
//   🔎하루 팝업 주문(`rent-`로 시작)만 본다. 다른 제품이 같은 가맹점을 쓰기 시작해도 거짓 경보가 안 나게 따로 센다.
//   🧪모의 결제(`mock_` 키, 개발 서버가 같은 DB에 남긴 것)는 뺀다.
//
// 「못 셌다」를 0이라고 하지 않는다(아침 요약의 원칙). 토스·DB가 실패하면 `ok: false`로 돌려주고, 일부만 못 봤으면 그 수를 같이 싣는다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { listTransactions, lookupPayment, paymentsLive, type TossTransaction } from "./rent-payment";
import { addDaysIso } from "./rent-time";
import { notifyAdmin } from "./admin-notify";
import { buildLedgerNotice } from "./rent-notify";
import type { TossPayment } from "./types";

/** 우리 결제 줄 — 대조에 필요한 칸만. */
export interface LedgerOurs {
  orderId: string;
  paymentKey: string;
  status: string;
  amount: number;
  balanceAmount: number;
  approvedAt?: string;
  canceledAt?: string;
  bookingId?: number;
  bookingStatus?: string;
  buyingUserId?: number;
  sellingUserId?: number;
}

/** 어긋남의 갈래. 문장은 알림(`buildLedgerNotice`)이 붙인다. */
export type LedgerKind =
  | "missing"            // 토스엔 승인이 있는데 우리 장부엔 그 주문이 없다
  | "not-recorded"       // 토스는 승인, 우리는 대기·실패·만료(승인 응답이 끊긴 결제)
  | "ours-only"          // 우리는 승인으로 적었는데 토스엔 승인이 없다
  | "amount"             // 결제 금액이 다르다
  | "refund-unrecorded"  // 토스엔 환불이 더 됐는데 우리 장부엔 안 적혔다(예: 토스 취소, 우리 DONE)
  | "balance-left"       // 우리는 환불로 적었는데 토스엔 돈이 더 남아 있다
  | "closed-money-left"  // 두 장부가 같이 «돈 있음»인데 예약은 만료·환불로 끝났다
  | "other-attempt"      // 같은 주문에 우리 장부와 다른 결제가 살아 있다(두 번 결제됐을 수 있다)
  | "toss-missing";      // 우리 장부의 승인 결제를 토스가 모른다(다른 키·개발 서버의 결제일 수 있다)

export interface LedgerMismatch {
  kind: LedgerKind;
  orderId: string;
  paymentKey: string;
  bookingId?: number;
  guestUserId?: number;
  hostUserId?: number;
  ours?: { status: string; amount: number; balance: number; booking?: string };
  toss?: { status: string; total: number; balance: number };
}

export type LedgerRun =
  | {
    ok: true; day: string;
    /** 맞대 본 결제 수(토스에서 다시 읽은 것 + 토스가 모른다고 한 것). */
    checked: number;
    mismatches: LedgerMismatch[];
    /** 하루 팝업 밖 결제 수(대조 안 함). */
    outside: number;
    /** 토스가 답을 안 줘서 못 본 결제 수. */
    unchecked: number;
    /** 뺀 모의 결제 수. */
    mock: number;
    /** 거래가 너무 많아 앞쪽만 읽었다. */
    truncated: boolean;
  }
  | { ok: false; day: string; reason: "no-key" | "toss" | "db"; detail?: string };

const APPROVED = ["DONE", "PARTIAL_CANCELED", "CANCELED"];
const RENT_ORDER = /^rent-/;
const MOCK_KEY = /^mock_/;

/** KST 날짜의 00:00을 UTC 시각(ms)으로. */
function kstMidnightMs(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - 9 * 3_600_000;
}

const num = (v: unknown, dflt = 0) => (typeof v === "number" ? v : dflt);

/** 토스 결제가 승인된 적이 있나. CANCELED는 가상계좌 입금 전 취소일 수도 있어 승인 시각으로 가른다. */
function tossApproved(tp: TossPayment): boolean {
  return tp.status === "DONE" || tp.status === "PARTIAL_CANCELED" || (tp.status === "CANCELED" && !!tp.approvedAt);
}

/** 순수 셈 — 지금의 토스 결제들과 우리 결제 줄을 맞댄다. */
export function compareLedger(input: {
  /** 결제 키 → 지금 토스가 말하는 결제. */
  toss: Map<string, TossPayment>;
  /** 우리가 가진 키인데 토스가 404(`NOT_FOUND_PAYMENT`)라고 한 것. */
  notFound: Set<string>;
  ours: LedgerOurs[];
}): LedgerMismatch[] {
  const out: LedgerMismatch[] = [];
  const byOrder = new Map(input.ours.map((o) => [o.orderId, o]));
  const oursView = (o: LedgerOurs) => ({ status: o.status, amount: o.amount, balance: o.balanceAmount, booking: o.bookingStatus });
  const who = (o?: LedgerOurs) => ({ bookingId: o?.bookingId, guestUserId: o?.buyingUserId, hostUserId: o?.sellingUserId });

  for (const [key, tp] of input.toss) {
    const orderId = tp.orderId ?? "";
    const total = num(tp.totalAmount);
    const balance = num(tp.balanceAmount, total);
    const tossView = { status: tp.status, total, balance };
    const approved = tossApproved(tp);
    const held = (tp.status === "DONE" || tp.status === "PARTIAL_CANCELED") && balance > 0;
    const our = byOrder.get(orderId);
    const base = { orderId, paymentKey: key, toss: tossView };

    if (!our) {
      if (approved) out.push({ kind: "missing", ...base });
      continue;
    }
    const mine = { ...base, ...who(our), ours: oursView(our) };
    if (our.paymentKey && our.paymentKey !== key) {
      // 같은 주문의 다른 시도. 돈이 살아 있을 때만 문제다(끝난 시도·취소된 시도는 그냥 흔적).
      if (held) out.push({ kind: "other-attempt", ...mine });
      continue;
    }
    const oursApproved = APPROVED.includes(our.status);
    if (approved && !oursApproved) { out.push({ kind: "not-recorded", ...mine }); continue; }
    if (!approved && oursApproved) { out.push({ kind: "ours-only", ...mine }); continue; }
    if (!approved) continue;
    if (total !== our.amount) { out.push({ kind: "amount", ...mine }); continue; }
    if (balance < our.balanceAmount) { out.push({ kind: "refund-unrecorded", ...mine }); continue; }
    if (balance > our.balanceAmount) { out.push({ kind: "balance-left", ...mine }); continue; }
    if (held && (our.bookingStatus === "expired" || our.bookingStatus === "refunded")) {
      out.push({ kind: "closed-money-left", ...mine });
    }
  }

  for (const key of input.notFound) {
    const our = input.ours.find((o) => o.paymentKey === key);
    if (our && APPROVED.includes(our.status)) {
      out.push({ kind: "toss-missing", orderId: our.orderId, paymentKey: key, ...who(our), ours: oursView(our) });
    }
  }
  return out;
}

// ─── 읽기 ───

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  // ⚠️anon 키로 물러서지 않는다. RLS에 막혀 빈 결과가 오면 「어긋남 없음」으로 거짓말을 한다(아침 요약과 같은 울타리).
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);
const LEDGER_COLS = "order_id,payment_key,status,amount,balance_amount,approved_at,canceled_at,booking_id,buying_user_id,selling_user_id,booking:space_bookings(status)";

function toOurs(r: Row): LedgerOurs {
  const b = r.booking as Row | null | undefined;
  return {
    orderId: s(r.order_id), paymentKey: s(r.payment_key), status: s(r.status),
    amount: n(r.amount), balanceAmount: n(r.balance_amount),
    approvedAt: r.approved_at ? s(r.approved_at) : undefined, canceledAt: r.canceled_at ? s(r.canceled_at) : undefined,
    bookingId: typeof r.booking_id === "number" ? r.booking_id : undefined,
    bookingStatus: b && typeof b === "object" ? s(b.status) : undefined,
    buyingUserId: typeof r.buying_user_id === "number" ? r.buying_user_id : undefined,
    sellingUserId: typeof r.selling_user_id === "number" ? r.selling_user_id : undefined,
  };
}

/** 우리 결제 줄 — 토스 거래에 나온 주문들 + 그날 승인·취소 시각이 찍힌 줄. 하나라도 실패하면 null(「못 셌다」). */
export async function loadOurs(q: { orderIds: string[]; sinceIso: string; untilIso: string }): Promise<LedgerOurs[] | null> {
  const c = db();
  if (!c) return null;
  const rows = new Map<string, LedgerOurs>();
  const add = (data: unknown[] | null) => { for (const r of data ?? []) { const o = toOurs(r as Row); rows.set(o.orderId, o); } };
  for (let i = 0; i < q.orderIds.length; i += 100) {
    const got = await c.from("payments").select(LEDGER_COLS).eq("purpose", "rent_booking").in("order_id", q.orderIds.slice(i, i + 100));
    if (got.error) { console.error(`[rent-ledger] 결제 줄 읽기 실패: ${got.error.message}`); return null; }
    add(got.data);
  }
  const [ap, cn] = await Promise.all([
    c.from("payments").select(LEDGER_COLS).eq("purpose", "rent_booking").gte("approved_at", q.sinceIso).lt("approved_at", q.untilIso),
    c.from("payments").select(LEDGER_COLS).eq("purpose", "rent_booking").gte("canceled_at", q.sinceIso).lt("canceled_at", q.untilIso),
  ]);
  if (ap.error || cn.error) {
    console.error(`[rent-ledger] 결제 줄 읽기 실패: ${[ap.error?.message, cn.error?.message].filter(Boolean).join(" · ")}`);
    return null;
  }
  add(ap.data);
  add(cn.data);
  return Array.from(rows.values());
}

// ─── 대조 ───

/** 한 번 대조에 토스에서 다시 읽는 결제 수의 상한 · 동시에 읽는 수. 넘치면 못 본 수로 센다. */
const MAX_LOOKUPS = 200;
const LOOKUP_CONCURRENCY = 4;
/** 대조 전체의 시간 한도. 크론 한 번이 300초라 리마인드·요약이 쓸 몫을 남긴다. */
const DEFAULT_BUDGET_MS = 120_000;

/** 전날(KST `day`) 거래를 맞댄다. 🚨throw하지 않는다.
 *  @param deps.loadOurs 우리 장부 읽기(하네스가 갈아 끼운다). @param deps.budgetMs 시간 한도. */
export async function reconcileLedger(
  day: string,
  deps: { loadOurs?: typeof loadOurs; budgetMs?: number } = {},
): Promise<LedgerRun> {
  if (!paymentsLive()) return { ok: false, day, reason: "no-key" };
  const deadline = Date.now() + (deps.budgetMs ?? DEFAULT_BUDGET_MS);
  const from = kstMidnightMs(day);
  const to = kstMidnightMs(addDaysIso(day, 1));
  try {
    // ① 토스 거래 — 날짜 뜻이 KST든 UTC든 그날 하루(KST)를 덮게 앞을 9시간 당겨 받는다.
    const tx = await listTransactions(`${addDaysIso(day, -1)}T15:00:00`, `${day}T23:59:59`);
    if (!tx.ok) return { ok: false, day, reason: "toss", detail: tx.reason };
    const inDay = tx.rows.filter((t: TossTransaction) => {
      const at = Date.parse(t.transactionAt);
      return !Number.isFinite(at) || (at >= from && at < to);
    });
    const rentTx = inDay.filter((t) => RENT_ORDER.test(t.orderId));
    const outside = new Set(inDay.filter((t) => !RENT_ORDER.test(t.orderId)).map((t) => t.paymentKey || t.orderId)).size;

    // ② 우리 장부
    const orderIds = Array.from(new Set(rentTx.map((t) => t.orderId)));
    const ours = await (deps.loadOurs ?? loadOurs)({
      orderIds, sinceIso: new Date(from).toISOString(), untilIso: new Date(to).toISOString(),
    });
    if (!ours) return { ok: false, day, reason: "db" };

    // ③ 다시 읽을 결제 키 — 토스 거래의 키 + 우리 장부에서 그날 움직인 키(모의 결제는 뺀다)
    const inWindow = (iso?: string) => { const at = iso ? Date.parse(iso) : NaN; return Number.isFinite(at) && at >= from && at < to; };
    const keys = new Set(rentTx.map((t) => t.paymentKey).filter(Boolean));
    let mock = 0;
    for (const o of ours) {
      if (!o.paymentKey || !(inWindow(o.approvedAt) || inWindow(o.canceledAt))) continue;
      if (MOCK_KEY.test(o.paymentKey)) { mock += 1; continue; }
      keys.add(o.paymentKey);
    }

    const all = Array.from(keys);
    const todo = all.slice(0, MAX_LOOKUPS);
    let unchecked = all.length - todo.length;
    const tossNow = new Map<string, TossPayment>();
    const notFound = new Set<string>();
    let next = 0;
    const worker = async () => {
      while (next < todo.length) {
        const key = todo[next++];
        if (Date.now() > deadline) { unchecked += 1; continue; }
        const r = await lookupPayment(key);
        if (r.kind === "found") tossNow.set(key, r.payment);
        else if (r.kind === "not-found") notFound.add(key);
        else unchecked += 1;
      }
    };
    await Promise.all(Array.from({ length: LOOKUP_CONCURRENCY }, worker));

    // 거래 줄에 하루 팝업 밖 주문으로 다시 읽힌 결제는 대조에서 뺀다(주문번호는 토스 결제가 정본이다).
    for (const [key, tp] of tossNow) if (tp.orderId && !RENT_ORDER.test(tp.orderId)) tossNow.delete(key);
    const mismatches = compareLedger({ toss: tossNow, notFound, ours });
    if (mismatches.length > 0) {
      console.warn(`[rent-ledger] ${day} 어긋남 ${mismatches.length}건: ${JSON.stringify(mismatches.map((m) => ({ kind: m.kind, orderId: m.orderId, bookingId: m.bookingId })))}`);
    }
    return {
      ok: true, day, checked: tossNow.size + notFound.size, mismatches, outside, unchecked, mock, truncated: tx.truncated,
    };
  } catch (e) {
    console.error("[rent-ledger] 대조 실패", e);
    return { ok: false, day, reason: "toss", detail: String(e) };
  }
}

/** 어긋남이 있으면 대표 슬랙으로 한 통(거래 알림과 같은 규칙: 회원 번호만, 슬랙에만). 없으면 보내지 않는다(아침 요약 한 줄로 충분하다). */
export async function sendLedgerAlert(run: LedgerRun): Promise<void> {
  if (!run.ok || run.mismatches.length === 0) return;
  try {
    await notifyAdmin(buildLedgerNotice(run));
  } catch (e) {
    console.error("[rent-ledger] 알림 실패(대조는 정상)", e);
  }
}
