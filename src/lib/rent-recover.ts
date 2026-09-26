import "server-only"; // 🔒토스 시크릿 키로 결제를 되묻고 환불하는 파일이다. 클라이언트가 가져가면 빌드가 멈춘다.
// 하루 팝업 — 결제 시간이 지난 신청을 닫기 «전»에 토스에 되묻는다 (2026-09-27, 대표 결정 D4)
//
// 🩸09-23 QA — 승인 응답이 끊기면 토스는 돈을 받았는데 우리 장부엔 «실패»(ABORTED)로 남고, 30분 뒤 정리 작업이
//   그 신청을 조용히 만료로 닫았다. 손님은 돈만 나가고 예약은 없다. 아침 요약의 어느 칸에도 안 잡혔다.
// 대표 원문: *「되물어 보는 코드 넣기」* · *「통신 오류로 인한 동적 매핑은 그때그때 알아채면 처리하고(통신오류 시 환불 등)」*.
//
// ⭐무엇을 하나
//   · 결제를 «시도한 흔적»이 없는 신청(결제 줄이 READY 그대로, 결제 키도 없음)은 전처럼 바로 만료로 닫는다.
//     결제창만 열고 떠난 신청이다. 토스 승인은 우리 승인 호출로만 일어나고, 그 호출은 실패하면 ABORTED를 남긴다.
//   · 흔적이 있는 신청은 토스에 주문번호로 묻는다(`GET /v1/payments/orders/{orderId}`).
//       - 토스엔 돈이 있다(DONE·부분 취소 뒤 잔액) → 들어온 돈을 장부에 먼저 적고 **전액 자동 환불** + 슬랙 거래 알림.
//         환불까지 실패하면 예약을 `rejected`로 둔다. 정산 화면 「손이 필요한 예약」에 뜨는 자리다(자동 환불 실패와 같은 길).
//       - 토스에 결제가 없거나(404) 돈이 안 움직였다 → 전처럼 만료로 닫는다.
//       - 토스가 답을 안 준다 → **아무것도 확정하지 않는다.** 다음 정리 때 다시 묻는다.
//   · 🔁무한 반복 막기: 신청이 만들어진 지 `GIVE_UP_HOURS`가 지났는데도 답을 못 받으면 더 묻지 않고,
//     예약만 만료로 닫은 뒤(결제 칸은 안 건드린다) 슬랙으로 알린다. 칸을 새로 만들지 않으려고 «시도 횟수» 대신 «나이»로 센다.
//
// ⏳결제 시간 30분이 막 지난 신청은 10분 더 기다린다(`RECHECK_AFTER_MINUTES`). 승인 호출은 30분 안에만 나가지만
//   토스 응답을 최대 60초 기다리고 되묻기까지 하므로, 그 사이에 여기서 환불을 걸면 막 성공한 결제와 부딪힌다.
// 🤝페이지 열 때와 크론이 같이 돌아도 돈은 한 번만 움직인다. 환불은 멱등키(결제 키·잔액·금액)로 나가서 토스가 두 번째를
//   처리하지 않고 첫 응답을 돌려준다. 겹치면 슬랙 알림만 두 번 갈 수 있다.
import { getBookingByOrderId, listSpacesByIds, rentSync } from "./spaces";
import {
  AUTO_CANCEL_WAITING_REASON, cancelPayment, LOOKUP_TIMEOUT_MS, lookupPaymentByOrderId, paymentsLive, RECOVER_REFUND_REASON,
} from "./rent-payment";
import { PAY_WINDOW_MINUTES } from "./rent-booking-rules";
import { notifyRecover, type RecoverKind } from "./rent-notify";

/** 결제 시간이 지난 `pending` 신청 한 건과 그 결제 줄. `sweepBookings`가 DB에서 읽어 넘긴다. */
export interface StalePending {
  bookingId: number;
  orderId: string;
  createdAt: string;
  /** 결제 줄의 상태(토스 이름 그대로). 결제 줄이 없으면 빈 글자. */
  payStatus: string;
  /** 결제 줄의 결제 키. 승인 전엔 빈 글자. */
  payKey: string;
  /** 결제 줄의 금액(처음 낼 돈). */
  amount: number;
}

/** 결제 시간(30분) + 승인 호출이 끝날 여유 10분. 이보다 어린 «흔적 있는» 신청은 건드리지 않는다. */
export const RECHECK_AFTER_MINUTES = PAY_WINDOW_MINUTES + 10;
/** 이만큼 지나도록 토스가 답을 안 주면 그만 묻는다(머리말). */
export const GIVE_UP_HOURS = 24;

export interface RecoverRun {
  /** 흔적 없이 만료로 닫은 수(결제창만 열고 떠난 신청). */
  expired: number;
  /** 흔적은 있는데 아직 여유 시간 안이라 이번엔 안 본 수. */
  waiting: number;
  /** 토스에 물어본 수. */
  asked: number;
  /** 토스엔 돈이 있어서 전액 돌려준 수. */
  refunded: number;
  /** 돌려주려다 실패해 `rejected`로 둔 수(손이 필요한 예약). */
  refundFailed: number;
  /** 물어보니 돈이 안 움직였거나 이미 돌아가 있어서 닫은 수. */
  closed: number;
  /** 답을 못 받았거나 이번 회차 한도에 걸려 다음으로 미룬 수. */
  deferred: number;
  /** `GIVE_UP_HOURS`가 지나 더 묻지 않고 닫은 수(슬랙 알림). */
  gaveUp: number;
}

/** 결제를 시도한 흔적 — 결제 줄이 READY가 아니거나(승인 실패 ABORTED 등) 결제 키가 적혀 있다. */
export function hasPayTrace(r: Pick<StalePending, "payStatus" | "payKey">): boolean {
  return (!!r.payStatus && r.payStatus !== "READY") || !!r.payKey;
}

const minutesSince = (iso: string, now: number) => (now - Date.parse(iso)) / 60_000;

/** 결제 시간이 지난 신청들을 처리한다. 🚨throw하지 않는다 — 정리 작업의 나머지(이용 완료·지급 대기)가 이어져야 한다.
 *  @param opts.lookups 이번 회차에 토스에 물어볼 최대 수. 페이지 열 때는 작게, 크론은 크게.
 *    ⚡토스가 한 번 답을 못 주면 이번 회차엔 더 묻지 않는다(다운된 토스를 페이지마다 붙잡고 있지 않게). */
export async function recoverStalePending(
  rows: StalePending[], opts: { lookups: number; now?: number; timeoutMs?: number },
): Promise<RecoverRun> {
  const run: RecoverRun = { expired: 0, waiting: 0, asked: 0, refunded: 0, refundFailed: 0, closed: 0, deferred: 0, gaveUp: 0 };
  const now = opts.now ?? Date.now();
  let budget = Math.max(0, opts.lookups);
  let tossDown = false;

  // ① 흔적 없는 신청 — 전과 같다. 결제 줄도 EXPIRED로.
  for (const r of rows.filter((x) => !hasPayTrace(x))) {
    try {
      if ((await rentSync(r.orderId, { bookingStatus: "expired", toss: { status: "EXPIRED" } })).ok) run.expired += 1;
    } catch (e) {
      console.error(`[rent-recover] 만료 실패 order=${r.orderId}`, e);
    }
  }

  // ② 흔적 있는 신청 — 오래된 것부터 묻는다. 한도에 걸리면 가장 오래된 것이 늘 먼저 차례를 받는다.
  const traced = rows.filter(hasPayTrace).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
  for (const r of traced) {
    if (minutesSince(r.createdAt, now) < RECHECK_AFTER_MINUTES) { run.waiting += 1; continue; }
    // 🔒키가 없는 서버(개발 모의 모드)는 판단하지 않는다. 같은 DB를 보는 운영 서버가 묻는다.
    if (!paymentsLive() || tossDown || budget <= 0) { run.deferred += 1; continue; }
    budget -= 1;
    run.asked += 1;
    try {
      await settleOne(r, now, run, opts.timeoutMs ?? LOOKUP_TIMEOUT_MS, () => { tossDown = true; });
    } catch (e) {
      console.error(`[rent-recover] 처리 중 예외 order=${r.orderId}`, e);
      run.deferred += 1;
    }
  }
  if (run.asked + run.refunded + run.refundFailed + run.gaveUp > 0) {
    console.info(`[rent-recover] ${JSON.stringify(run)}`);
  }
  return run;
}

async function settleOne(r: StalePending, now: number, run: RecoverRun, timeoutMs: number, markDown: () => void): Promise<void> {
  const ans = await lookupPaymentByOrderId(r.orderId, timeoutMs);

  if (ans.kind === "error") {
    markDown();
    if (minutesSince(r.createdAt, now) >= GIVE_UP_HOURS * 60) {
      // 🛑그만 묻는다. 예약만 닫고 결제 칸은 모르는 채로 둔다(«실패»로 덮어쓰지 않는다).
      const moved = await rentSync(r.orderId, { bookingStatus: "expired" });
      if (moved.ok) {
        run.gaveUp += 1;
        await tell("gave-up", r, r.amount, 0, ans.reason);
      } else run.deferred += 1;
      return;
    }
    console.warn(`[rent-recover] 토스가 답을 안 줬다 — 다음 정리 때 다시 묻는다 order=${r.orderId}: ${ans.reason}`);
    run.deferred += 1;
    return;
  }

  if (ans.kind === "not-found") {
    // 토스에 결제 자체가 없다. 돈은 안 움직였다.
    if ((await rentSync(r.orderId, { bookingStatus: "expired", toss: { status: "EXPIRED" } })).ok) run.closed += 1;
    return;
  }

  const tp = ans.payment;
  const balance = typeof tp.balanceAmount === "number" ? tp.balanceAmount : typeof tp.totalAmount === "number" ? tp.totalAmount : r.amount;
  const key = tp.paymentKey || r.payKey;
  const held = (tp.status === "DONE" || tp.status === "PARTIAL_CANCELED") && balance > 0;

  if (held && !key) {
    // 돈은 있다는데 환불할 열쇠가 없다. 닫지도 돌려주지도 못하니 미룬다(대조가 다시 본다).
    console.error(`[rent-recover] 토스 응답에 결제 키가 없다 — 미룬다 order=${r.orderId}`);
    run.deferred += 1;
    return;
  }
  if (held) {
    // 🩸돈만 나간 결제. 들어온 돈부터 장부에 적는다(환불이 실패해도 결제 줄이 돈을 가리키게).
    await rentSync(r.orderId, { toss: tp });
    const refund = await cancelPayment(key, RECOVER_REFUND_REASON, undefined, balance);
    if (refund.ok) {
      await rentSync(r.orderId, { bookingStatus: "cancelled", toss: refund.payment });
      run.refunded += 1;
      await tell("refunded", r, tp.totalAmount ?? r.amount, balance);
    } else {
      // 손님 돈이 붙잡혀 있다. 「손이 필요한 예약」에 뜨게 rejected로 둔다(결제 직후 자동 환불 실패와 같은 자리).
      console.error(`[rent-recover] 🚨승인 응답 유실 결제의 자동 환불 실패 — 수동 환불 필요 order=${r.orderId}`);
      await rentSync(r.orderId, { bookingStatus: "rejected" });
      run.refundFailed += 1;
      await tell("refund-failed", r, tp.totalAmount ?? r.amount, 0);
    }
    return;
  }

  if (tp.status === "WAITING_FOR_DEPOSIT" && key) {
    // 입금 전 가상계좌 — 받지 않는 수단이다. 입금이 들어오기 전에 닫는다(`confirmBookingAction`의 같은 갈래).
    const undo = await cancelPayment(key, AUTO_CANCEL_WAITING_REASON, undefined, balance);
    if (undo.ok) {
      if ((await rentSync(r.orderId, { bookingStatus: "expired", toss: undo.payment })).ok) run.closed += 1;
    } else run.deferred += 1;
    return;
  }

  if (tp.status === "CANCELED" || tp.status === "PARTIAL_CANCELED") {
    // 이미 다 돌아가 있다(앞선 회차가 환불하고 기록만 못 했거나, 관리자 화면에서 취소). 토스 말대로 적고 닫는다.
    const moved = await rentSync(r.orderId, { bookingStatus: tp.approvedAt ? "cancelled" : "expired", toss: tp });
    if (moved.ok) run.closed += 1;
    return;
  }

  // READY·IN_PROGRESS·ABORTED·EXPIRED — 돈이 안 움직였다.
  if ((await rentSync(r.orderId, { bookingStatus: "expired", toss: { status: "EXPIRED" } })).ok) run.closed += 1;
}

/** 슬랙 거래 알림 한 건. 🔒예약·주문번호·금액·회원 번호만(이름·연락처 없음, `buildRecoverNotice`). 🚨알림이 본작업을 막지 않는다. */
async function tell(kind: RecoverKind, r: StalePending, paid: number, refund: number, why = ""): Promise<void> {
  try {
    const b = await getBookingByOrderId(r.orderId);
    const brief = b ? (await listSpacesByIds([b.spaceId])).get(b.spaceId) ?? null : null;
    await notifyRecover(kind, {
      orderId: r.orderId, bookingId: b?.id ?? r.bookingId, paid, refund,
      useDate: b?.useDate, startTime: b?.startTime, endTime: b?.endTime,
      guestUserId: b?.guestUserId, space: brief ? { id: brief.id, name: brief.name, ownerUserId: brief.ownerUserId } : null,
      why,
    });
  } catch (e) {
    console.error("[rent-recover] 알림 실패(본작업은 정상)", e);
  }
}
