import "server-only"; // 🔒서비스 롤 키로 DB를 읽는 파일이다. 클라이언트 컴포넌트가 가져가면 빌드가 멈춘다(spaces.ts와 같은 울타리).
// 하루 팝업 — 대표에게 가는 아침 요약 (2026-09-19). 서버 전용. 부르는 곳은 `/api/cron/rent-remind`(보내기)와 미리보기(세기만)다.
//
// ⭐대표 09-19 — 대표 참조 메일을 끊는 대신, 매일 아침 리마인드 크론이 끝나면 슬랙으로 한 통.
//   숫자가 전부 0이어도 보낸다. 그 한 통이 «크론이 오늘도 돌았다»는 표시다. 안 오면 크론이 멈춘 것이다.
// 🔒대표만 보는 글이지만 손님 개인정보(성함·전화·이메일)는 싣지 않는다. 숫자와 공간 이름만.
//
// 세는 일(`summarizeDaily`)과 읽는 일(`loadDailyRows`)을 갈랐다. 세는 쪽은 순수 함수라
//   목 세계(`/dev/mail/admin-daily`)와 운영 DB가 같은 계산을 탄다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { notifyAdmin, type AdminNotifyResult } from "./admin-notify";
import { buildAdminDaily } from "./rent-notify";
import { isAutoCancelReason } from "./rent-payment";
import { addDaysIso, todayKst } from "./rent-time";
import { listSpacesForReview } from "./spaces";
import type { Payment, SpaceBooking } from "./types";
import type { LedgerRun } from "./rent-ledger";
import type { SweepRun } from "./spaces";

/** 요약이 읽는 예약 칸. 목 세계의 `SpaceBooking`이 그대로 들어온다.
 *  🆕09-19 저녁 `updatedAt` — 취소·환불된 예약이 «언제» 그 상태가 됐나. 예약 행은 상태가 바뀔 때 말고는 거의 안 고쳐진다(트리거가 적는다). */
export type DailyBooking = Pick<SpaceBooking, "id" | "spaceId" | "status" | "useDate" | "orderId" | "refundRequestedAt" | "createdAt" | "updatedAt">;
/** 요약이 읽는 결제 칸. 🆕09-19 저녁 남은 돈(환불액 = 낸 돈 − 남은 돈)과 «우리가 자동으로 되돌린 취소인가». */
export type DailyPayment = Pick<Payment, "orderId" | "amount" | "approvedAt"> & {
  balanceAmount?: number;
  /** 토스 취소 내역에 자동 취소 사유(`AUTO_REFUND_REASON` 등)가 있나. 손님 취소와 자동 환불이 둘 다 예약 `cancelled`라 이걸로 가른다. */
  autoCancel?: boolean;
};

/** 건수와 돌려준 돈. */
export interface CountRefund { count: number; refund: number }

/** 리마인드 크론이 이번에 한 일. 크론이 도중에 멈췄으면 null. */
export interface RemindRun {
  checked: number;
  sent: number;
  /** 보내려다 실패한 통수. 받는 사람이 없거나 키가 없어 건너뛴 건 세지 않는다. */
  failed: number;
  heldToday: number;
  /** `RESEND_API_KEY`가 없어 한 통도 못 보내는 날인가. */
  noMailKey: boolean;
}

/** 🆕09-27 크론이 요약 «전»에 돌린 일들의 결과. 안 돌렸으면 칸이 없고, 도중에 멈췄으면 null.
 *  · `ledger` 토스와 우리 장부 대조(D6, `rent-ledger.ts`)
 *  · `sweep` 정리 작업(D7, `sweepBookings`) — 만료·이용 완료·지급 대기와 끊긴 결제 되묻기(D4) */
export interface DailyRuns {
  ledger?: LedgerRun | null;
  sweep?: SweepRun | null;
}

export interface AdminDailySummary {
  /** 오늘(KST) `YYYY-MM-DD`. */
  today: string;
  /** 어제(KST 날짜) 승인된 결제. 뒤에 취소된 것도 센다. 「어제 들어온 돈」이라서. */
  paidYesterday: { count: number; amount: number };
  /** 결제는 끝났는데 사장님이 아직 수락·거절을 안 한 요청(`paid`). 이용일이 지난 것도 센다(정산 화면 「손이 필요한 예약」). */
  waiting: { count: number; oldest?: { spaceName: string; paidAt: string; useDate: string } };
  /** 사장님의 «관리자에게 환불 신청» 중 아직 처리 전. */
  refundRequests: number;
  /** 검토 대기 공간 · 열려 있는데 확인 표시 전인 공간(`/rent/review`의 두 무리). */
  reviewPending: number;
  reviewApproveOnly: number;
  /** 오늘·내일 쓰는 살아 있는 예약(결제 완료·확정). */
  useToday: number;
  useTomorrow: number;
  /** 🆕09-19 저녁 대표 [4] — 어제(KST) 돈이 돌아간 일. 예약 행이 그 상태로 바뀐 날로 센다.
   *  손님 취소(`cancelled`) · 사장님 거절(`refunded`, 환불 신청 없음) · 관리자 환불(`refunded`, 환불 신청 있음) · 자동 환불(`cancelled` + 자동 취소 사유). */
  moneyBack: { guestCancel: CountRefund; hostReject: CountRefund; adminRefund: CountRefund; autoRefund: CountRefund };
  /** 🚨환불이 실패해 손님 돈이 붙잡혀 있는 예약(`rejected`) — 날짜와 상관없이 지금 남은 것 전부. 금액은 결제 줄의 남은 돈. 있으면 요약 맨 위에 선다. */
  stuck: { count: number; amount: number };
  remind: RemindRun | null;
}

/** KST 날짜의 00:00을 UTC 시각(ms)으로. */
function kstMidnightMs(iso: string): number {
  return Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - 9 * 3_600_000;
}

/** 순수 계산 — 읽어 온 행으로 요약 숫자를 만든다. */
export function summarizeDaily(input: {
  bookings: DailyBooking[];
  payments: DailyPayment[];
  spaceNames: Map<number, string>;
  reviewPending: number;
  reviewApproveOnly: number;
  remind: RemindRun | null;
}, today = todayKst()): AdminDailySummary {
  const yStart = kstMidnightMs(addDaysIso(today, -1));
  const tStart = kstMidnightMs(today);
  const tomorrow = addDaysIso(today, 1);
  const payByOrder = new Map(input.payments.map((p) => [p.orderId, p]));

  let paidCount = 0;
  let paidAmount = 0;
  for (const p of input.payments) {
    const at = p.approvedAt ? Date.parse(p.approvedAt) : NaN;
    if (Number.isFinite(at) && at >= yStart && at < tStart) {
      paidCount += 1;
      paidAmount += p.amount;
    }
  }

  const live = input.bookings.filter((b) => b.status === "paid" || b.status === "confirmed");
  const waitingList = live.filter((b) => b.status === "paid");
  // 가장 오래 기다린 요청 = 결제 승인이 가장 이른 것. 승인 시각이 없는 옛 줄은 예약 행이 생긴 시각으로.
  const paidAtOf = (b: DailyBooking) => payByOrder.get(b.orderId)?.approvedAt || b.createdAt;
  const oldest = waitingList.slice().sort((a, b) => (paidAtOf(a) < paidAtOf(b) ? -1 : 1))[0];

  // 💸어제 돈이 돌아간 일 — 예약이 그 상태가 된 날(`updatedAt`)이 어제인 것만. 환불액은 결제 줄의 «낸 돈 − 남은 돈».
  const zero = (): CountRefund => ({ count: 0, refund: 0 });
  const moneyBack = { guestCancel: zero(), hostReject: zero(), adminRefund: zero(), autoRefund: zero() };
  for (const b of input.bookings) {
    if (b.status !== "cancelled" && b.status !== "refunded") continue;
    const at = Date.parse(b.updatedAt);
    if (!(Number.isFinite(at) && at >= yStart && at < tStart)) continue;
    const pay = payByOrder.get(b.orderId);
    const back = pay ? Math.max(0, pay.amount - (pay.balanceAmount ?? pay.amount)) : 0;
    const box = b.status === "cancelled"
      ? pay?.autoCancel ? moneyBack.autoRefund : moneyBack.guestCancel
      // 관리자 환불은 사장님의 «환불 신청»을 거친다. 거절 환불은 수락 전(`paid`)에만 나서 신청이 붙을 수 없다(`requestRefundAction`).
      : b.refundRequestedAt ? moneyBack.adminRefund : moneyBack.hostReject;
    box.count += 1;
    box.refund += back;
  }
  // 🚨붙잡힌 돈 — 거절 환불이 실패했거나 결제 직후 자동 환불이 실패한 예약. 정산 화면 「손이 필요한 예약」과 같은 줄이다(`listStuckBookings`).
  const stuckList = input.bookings.filter((b) => b.status === "rejected");
  const stuck = {
    count: stuckList.length,
    amount: stuckList.reduce((sum, b) => {
      const pay = payByOrder.get(b.orderId);
      return sum + (pay ? pay.balanceAmount ?? pay.amount : 0);
    }, 0),
  };

  return {
    today,
    paidYesterday: { count: paidCount, amount: paidAmount },
    waiting: {
      count: waitingList.length,
      oldest: oldest
        ? { spaceName: input.spaceNames.get(oldest.spaceId) || "이름 없는 공간", paidAt: paidAtOf(oldest), useDate: oldest.useDate }
        : undefined,
    },
    refundRequests: live.filter((b) => !!b.refundRequestedAt).length,
    reviewPending: input.reviewPending,
    reviewApproveOnly: input.reviewApproveOnly,
    useToday: live.filter((b) => b.useDate === today).length,
    useTomorrow: live.filter((b) => b.useDate === tomorrow).length,
    moneyBack,
    stuck,
    remind: input.remind,
  };
}

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  // ⚠️anon 키로 물러서지 않는다. RLS에 막혀 «빈 결과»가 오면 「오늘은 0건」으로 거짓말을 한다.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");
const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0) || 0);

/** 결제 줄 → 요약 모양. 취소 내역(`toss_raw->cancels`)에 자동 취소 사유가 있으면 표시한다. */
function toDailyPayment(r: Row): DailyPayment {
  const cancels = Array.isArray(r.cancels) ? (r.cancels as Row[]) : [];
  return {
    orderId: s(r.order_id), amount: n(r.amount), approvedAt: r.approved_at ? s(r.approved_at) : undefined,
    balanceAmount: r.balance_amount === null || r.balance_amount === undefined ? undefined : n(r.balance_amount),
    autoCancel: cancels.some((c) => isAutoCancelReason(typeof c?.cancelReason === "string" ? c.cancelReason : "")),
  };
}

/** 요약이 읽는 결제 칸. 🔎취소 내역은 `toss_raw` 통째가 아니라 `cancels`만 꺼낸다(PostgREST JSON 경로). */
const PAY_COLS = "order_id,amount,balance_amount,approved_at,cancels:toss_raw->cancels";
const BOOKING_COLS = "id,space_id,status,use_date,order_id,refund_requested_at,created_at,updated_at";

/** 운영 DB에서 요약에 필요한 줄만 읽는다. 읽기가 실패하면 null — 요약은 「못 셌다」고 말한다(0이라고 하지 않는다). */
async function loadDailyRows(today: string): Promise<{
  bookings: DailyBooking[]; payments: DailyPayment[]; spaceNames: Map<number, string>;
} | null> {
  const c = db();
  if (!c) return null;
  const since = new Date(kstMidnightMs(addDaysIso(today, -1))).toISOString();
  const until = new Date(kstMidnightMs(today)).toISOString();
  const [bk, py, back, stuck] = await Promise.all([
    c.from("space_bookings").select(BOOKING_COLS).in("status", ["paid", "confirmed"]),
    c.from("payments").select(PAY_COLS).eq("purpose", "rent_booking").gte("approved_at", since),
    // 🆕09-19 저녁 — 어제 취소·환불된 예약(상태가 바뀐 날로)과, 환불이 실패해 붙잡힌 예약(날짜 상관없이 전부).
    c.from("space_bookings").select(BOOKING_COLS).in("status", ["cancelled", "refunded"]).gte("updated_at", since).lt("updated_at", until),
    c.from("space_bookings").select(BOOKING_COLS).eq("status", "rejected"),
  ]);
  if (bk.error || py.error || back.error || stuck.error) {
    console.error(`[rent-admin-daily] 읽기 실패: ${[bk, py, back, stuck].map((x) => x.error?.message ?? "").filter(Boolean).join(" · ")}`);
    return null;
  }
  const bookings: DailyBooking[] = [...(bk.data ?? []), ...(back.data ?? []), ...(stuck.data ?? [])].map((r: Row) => ({
    id: n(r.id), spaceId: n(r.space_id), status: s(r.status) as SpaceBooking["status"], useDate: s(r.use_date),
    orderId: s(r.order_id), refundRequestedAt: r.refund_requested_at ? s(r.refund_requested_at) : undefined,
    createdAt: s(r.created_at), updatedAt: s(r.updated_at),
  }));
  const payments: DailyPayment[] = ((py.data ?? []) as Row[]).map(toDailyPayment);
  // 기다리는 요청의 승인 시각은 어제보다 이를 수 있다. 취소·환불·붙잡힌 예약의 결제도 마찬가지다. 그 줄들만 한 번 더 읽는다.
  const needOrders = bookings
    .filter((b) => b.status !== "confirmed")
    .map((b) => b.orderId)
    .filter((o, i, all) => !!o && all.indexOf(o) === i && !payments.some((p) => p.orderId === o));
  if (needOrders.length > 0) {
    const more = await c.from("payments").select(PAY_COLS).in("order_id", needOrders);
    // 여기서 가져온 줄은 어제 결제 수에 안 섞인다. 승인 시각으로 거르는 게 `summarizeDaily`다.
    for (const r of (more.data ?? []) as Row[]) payments.push(toDailyPayment(r));
  }
  const ids = Array.from(new Set(bookings.map((b) => b.spaceId)));
  const spaceNames = new Map<number, string>();
  if (ids.length > 0) {
    const sp = await c.from("spaces").select("id,name").in("id", ids);
    for (const r of (sp.data ?? []) as Row[]) spaceNames.set(n(r.id), s(r.name));
  }
  return { bookings, payments, spaceNames };
}

/** 크론 끝에 한 번 — 세고, 대표에게 보낸다. 🚨throw하지 않는다(크론 응답이 이 알림 때문에 실패하면 안 된다). */
export async function sendAdminDaily(
  remind: RemindRun | null, today = todayKst(), runs: DailyRuns = {},
): Promise<AdminNotifyResult & { counted: boolean }> {
  try {
    const [rows, review] = await Promise.all([loadDailyRows(today), listSpacesForReview()]);
    const summary = rows
      ? summarizeDaily({ ...rows, reviewPending: review.pending.length, reviewApproveOnly: review.approveOnly.length, remind }, today)
      : null;
    const r = await notifyAdmin(buildAdminDaily(summary, today, remind, Date.now(), runs));
    return { ...r, counted: !!summary };
  } catch (e) {
    console.error("[rent-admin-daily] 요약 실패", e);
    return { sent: false, channel: "none", counted: false };
  }
}
