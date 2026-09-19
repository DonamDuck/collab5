import "server-only"; // 🔒서비스 롤 키로 DB를 읽는 파일이다. 클라이언트 컴포넌트가 가져가면 빌드가 멈춘다(spaces.ts와 같은 울타리).
// 하루 가게 — 대표에게 가는 아침 요약 (2026-09-19). 서버 전용. 부르는 곳은 `/api/cron/rent-remind`(보내기)와 미리보기(세기만)다.
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
import { addDaysIso, todayKst } from "./rent-time";
import { listSpacesForReview } from "./spaces";
import type { Payment, SpaceBooking } from "./types";

/** 요약이 읽는 예약 칸. 목 세계의 `SpaceBooking`이 그대로 들어온다. */
export type DailyBooking = Pick<SpaceBooking, "id" | "spaceId" | "status" | "useDate" | "orderId" | "refundRequestedAt" | "createdAt">;
/** 요약이 읽는 결제 칸. */
export type DailyPayment = Pick<Payment, "orderId" | "amount" | "approvedAt">;

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

/** 운영 DB에서 요약에 필요한 줄만 읽는다. 읽기가 실패하면 null — 요약은 「못 셌다」고 말한다(0이라고 하지 않는다). */
async function loadDailyRows(today: string): Promise<{
  bookings: DailyBooking[]; payments: DailyPayment[]; spaceNames: Map<number, string>;
} | null> {
  const c = db();
  if (!c) return null;
  const since = new Date(kstMidnightMs(addDaysIso(today, -1))).toISOString();
  const [bk, py] = await Promise.all([
    c.from("space_bookings")
      .select("id,space_id,status,use_date,order_id,refund_requested_at,created_at")
      .in("status", ["paid", "confirmed"]),
    c.from("payments").select("order_id,amount,approved_at").eq("purpose", "rent_booking").gte("approved_at", since),
  ]);
  if (bk.error || py.error) {
    console.error(`[rent-admin-daily] 읽기 실패: ${bk.error?.message ?? ""} ${py.error?.message ?? ""}`);
    return null;
  }
  const bookings: DailyBooking[] = (bk.data ?? []).map((r: Row) => ({
    id: n(r.id), spaceId: n(r.space_id), status: s(r.status) as SpaceBooking["status"], useDate: s(r.use_date),
    orderId: s(r.order_id), refundRequestedAt: r.refund_requested_at ? s(r.refund_requested_at) : undefined, createdAt: s(r.created_at),
  }));
  const payments: DailyPayment[] = (py.data ?? []).map((r: Row) => ({
    orderId: s(r.order_id), amount: n(r.amount), approvedAt: r.approved_at ? s(r.approved_at) : undefined,
  }));
  // 기다리는 요청의 승인 시각은 어제보다 이를 수 있다. 그 줄들만 한 번 더 읽는다(가장 오래 기다린 것을 고르려고).
  const waitingOrders = bookings.filter((b) => b.status === "paid").map((b) => b.orderId).filter((o) => !payments.some((p) => p.orderId === o));
  if (waitingOrders.length > 0) {
    const more = await c.from("payments").select("order_id,amount,approved_at").in("order_id", waitingOrders);
    // 여기서 가져온 줄은 어제 결제 수에 안 섞인다. 승인 시각으로 거르는 게 `summarizeDaily`다.
    for (const r of (more.data ?? []) as Row[]) {
      payments.push({ orderId: s(r.order_id), amount: n(r.amount), approvedAt: r.approved_at ? s(r.approved_at) : undefined });
    }
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
export async function sendAdminDaily(remind: RemindRun | null, today = todayKst()): Promise<AdminNotifyResult & { counted: boolean }> {
  try {
    const [rows, review] = await Promise.all([loadDailyRows(today), listSpacesForReview()]);
    const summary = rows
      ? summarizeDaily({ ...rows, reviewPending: review.pending.length, reviewApproveOnly: review.approveOnly.length, remind }, today)
      : null;
    const r = await notifyAdmin(buildAdminDaily(summary, today, remind));
    return { ...r, counted: !!summary };
  } catch (e) {
    console.error("[rent-admin-daily] 요약 실패", e);
    return { sent: false, channel: "none", counted: false };
  }
}
