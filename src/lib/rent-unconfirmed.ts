import "server-only"; // 🔒토스 시크릿 키로 결제를 취소하는 파일이다. 클라이언트가 가져가면 빌드가 멈춘다.
// 하루 팝업 — 확정 기한이 지난 결제 완료를 전액 돌려준다 (2026-09-27, 대표 결정)
//
// 대표 원문: *「paid 상태에서 시간이 지나면 done 되는 게 문제 같아. 이거는 사장님이 done이나 confirmed를 안 한 거니,
//   refunded로 되어야 되는 거지.」* 그리고 같은 날 기한을 더했다. 환불(refunded)이 생기는 자리는 셋이다.
//   ⓐ 사장님이 거절한 경우(`decideBookingAction`, 원래 흐름) · ⓑ 결제 후 48시간 안에 확정하지 않은 경우 · ⓒ 이용 시작까지 확정하지 않은 경우.
//   이 파일은 ⓑ·ⓒ다. 기한은 둘 중 먼저 오는 쪽 하나(`confirmLapse`, `CONFIRM_DEADLINE_HOURS`).
// 🩸전엔 정리 작업 ②가 결제 완료(paid)도 확정처럼 봐서, 이용이 끝나면 done + 지급 대기로 넘겼다(09-16 phase 1).
//   사장님이 확정을 한 번도 안 눌러도 사장님께 정산됐다. 이제 확정 완료가 진짜 예약의 확정이다.
//
// ⭐무엇을 하나 — 정리 작업(`sweepBookings` ②')이 결제 완료 예약과 결제 줄을 읽어 넘긴다. 기한이 지난 것만, 기한이 먼저 온 것부터.
//   ① 예약을 «먼저 잡는다»(`claimUnconfirmedBooking`: paid → rejected, 사장님이 답한 시각은 비워 둔다).
//      사장님 확정(`decideBooking`)과 같은 조건(status = paid)을 건 한 문장이라 둘 중 먼저 닿은 쪽만 이긴다.
//      확정이 먼저였으면 여기서 떨어져 토스를 안 부른다. 잡은 뒤에 온 확정은 조건에 걸려 떨어진다.
//   ② 토스 전액 취소(`cancelPayment` — 멱등키 · D5 취소 응답 검사 그대로). 사유 글자는 `UNCONFIRMED_REFUND_REASON`.
//   ③ 성공 → `rent_sync`로 예약 refunded + 결제 CANCELED를 같이. 손님·사장님 메일 한 통씩(주문번호 멱등키) + 슬랙 거래 알림.
//      실패 → 예약은 ①의 rejected 그대로. 정산 화면 「손이 필요한 예약」에 뜬다(결제 직후 자동 환불 실패와 같은 무리).
//      답한 시각이 없어 화면은 «자동 취소»로 읽는다(`autoRejected`). 슬랙에 「손님 돈이 붙잡혀 있어요」 한 건. 메일은 안 보낸다(돈이 아직이다).
//
// 🤝페이지 열 때와 크론이 같이 돌아도 토스 취소는 한 번이다. 먼저 잡은 쪽만 토스를 부르고, 부르더라도 멱등키(결제 키·잔액·금액)가 같다.
// 🔒키가 없는 서버(개발 모의 모드)는 돌려주지 않는다. 모의 취소는 돈을 안 움직이는데 장부만 환불로 바뀐다(`rent-recover.ts`와 같은 울타리).
// ⚡토스 취소가 한 번 실패하면 이번 회차엔 더 부르지 않는다. 장애 중에 여러 건을 한꺼번에 「손이 필요한 예약」으로 떨어뜨리지 않게.
import { claimUnconfirmedBooking, getBookingByOrderId, getSpaceFull, listSpacesByIds, rentSync } from "./spaces";
import { cancelPayment, paymentsLive, UNCONFIRMED_REFUND_REASON } from "./rent-payment";
import { confirmDeadline, type ConfirmLapse } from "./rent-booking-rules";
import { notifyDeal, notifyUnconfirmedRefund, type DealKind } from "./rent-notify";
import { getProfileById } from "./profiles";

/** 결제 완료 예약 한 건과 그 결제 줄. `sweepBookings`가 DB에서 읽어 넘긴다. */
export interface UnconfirmedPaid {
  bookingId: number;
  orderId: string;
  useDate: string;
  /** `HH:MM`. 비었으면 그날 0시로 본다. */
  startTime: string;
  /** 결제 줄의 승인 시각. 없으면 48시간 쪽은 안 재고 이용 시작만 본다. */
  approvedAt?: string;
  /** 결제 줄의 상태(토스 이름 그대로). 결제 줄이 없으면 빈 글자. */
  payStatus: string;
  payKey: string;
  amount: number;
  /** 결제 줄의 남은 돈 — 돌려줄 돈이다. */
  balance: number;
}

export interface UnconfirmedRun {
  /** 기한이 지난 결제 완료 수(이번에 본 것). */
  due: number;
  /** 전액 돌려주고 refunded로 옮긴 수. */
  refunded: number;
  /** 돌려주려다 실패해 자동 취소(rejected)로 둔 수(손이 필요한 예약). */
  refundFailed: number;
  /** 잡으려는 사이 상태가 바뀌어 손대지 않은 수(사장님 확정·거절, 손님 취소, 겹쳐 돈 다른 정리 작업). 토스를 안 불렀다. */
  skipped: number;
  /** 이번 회차 한도·토스 장애·키 없는 서버라 다음으로 미룬 수. */
  deferred: number;
}

/** 확정 기한이 지난 결제 완료를 돌려준다. 🚨throw하지 않는다 — 정리 작업의 나머지(③ 지급 대기)가 이어져야 한다.
 *  @param opts.refunds 이번 회차에 토스 취소를 부를 최대 수. 페이지 열 때는 작게, 크론은 크게.
 *  @param opts.now 기한 판정 시각(시험이 넘긴다). */
export async function refundUnconfirmedPaid(
  rows: UnconfirmedPaid[], opts: { refunds: number; now?: Date },
): Promise<UnconfirmedRun> {
  const run: UnconfirmedRun = { due: 0, refunded: 0, refundFailed: 0, skipped: 0, deferred: 0 };
  const now = opts.now ?? new Date();
  let budget = Math.max(0, opts.refunds);
  let tossDown = false;

  // 기한이 지난 것만, 기한이 먼저 온 것부터. 한도에 걸리면 가장 오래 기다린 손님이 늘 먼저 차례를 받는다.
  const due = rows
    .map((r) => ({ r, d: confirmDeadline(r, r.approvedAt) }))
    .filter((x): x is { r: UnconfirmedPaid; d: { at: number; by: ConfirmLapse } } => !!x.d && now.getTime() >= x.d.at)
    .sort((a, b) => a.d.at - b.d.at);
  run.due = due.length;

  for (const { r, d } of due) {
    if (!paymentsLive() || tossDown || budget <= 0) { run.deferred += 1; continue; }
    try {
      // ① 먼저 잡는다. 못 잡았으면 그 사이 누가 상태를 옮겼다 — 토스를 안 부른다.
      if (!(await claimUnconfirmedBooking(r.bookingId))) { run.skipped += 1; continue; }
      // 돌려줄 수 있는 결제인가 — 승인된 돈이 남아 있고 결제 키가 있어야 한다. 아니면 사람이 본다(잡은 채로 둔다).
      const held = (r.payStatus === "DONE" || r.payStatus === "PARTIAL_CANCELED") && r.balance > 0 && !!r.payKey;
      if (!held) {
        console.error(`[rent-unconfirmed] 🚨돌려줄 결제를 못 찾았다 — 손이 필요한 예약으로 둔다 order=${r.orderId} 결제 줄=${r.payStatus || "없음"} 남은 돈=${r.balance}`);
        run.refundFailed += 1;
        await tell("unconfirmed-refund-failed", r, 0, d.by);
        continue;
      }
      budget -= 1;
      // ② 토스 전액 취소. 멱등키가 (결제 키·잔액·금액)이라 거절·손님 취소가 같은 결제에 겹쳐도 돈은 한 번만 움직인다.
      const refund = await cancelPayment(r.payKey, UNCONFIRMED_REFUND_REASON, undefined, r.balance);
      if (!refund.ok) {
        tossDown = true;
        console.error(`[rent-unconfirmed] 🚨확정 기한이 지난 결제의 자동 환불 실패${refund.unconfirmed ? "(응답 확인 못 함)" : ""} — 수동 환불 필요 order=${r.orderId}`);
        run.refundFailed += 1;
        await tell("unconfirmed-refund-failed", r, 0, d.by);
        continue;
      }
      // ③ 예약 refunded + 결제 CANCELED를 같이. 기록이 한 번 실패하면 한 번 더 한다(손님 취소와 같다).
      //   두 번 다 실패하면 예약은 자동 취소(rejected)로 남아 「손이 필요한 예약」에 뜬다. [토스에서 다시 읽기]가 토스 값으로 맞춘다.
      let synced = await rentSync(r.orderId, { bookingStatus: "refunded", toss: refund.payment });
      if (!synced.ok) synced = await rentSync(r.orderId, { bookingStatus: "refunded", toss: refund.payment });
      if (!synced.ok) console.error(`[rent-unconfirmed] 🚨🚨환불은 됐는데 기록이 두 번 실패 — [토스에서 다시 읽기]로 맞춰야 한다 order=${r.orderId}`);
      run.refunded += 1;
      // 돈은 돌아갔다. 기록이 늦어도 손님이 알아야 한다(메일은 주문번호 멱등키라 나중에 다시 읽어 보내도 한 통이다).
      await tell(d.by === "48h" ? "unconfirmed-refund-48h" : "unconfirmed-refund-start", r, r.balance, d.by);
    } catch (e) {
      console.error(`[rent-unconfirmed] 처리 중 예외 order=${r.orderId}`, e);
      run.deferred += 1;
    }
  }
  if (run.due > 0) console.info(`[rent-unconfirmed] ${JSON.stringify(run)}`);
  return run;
}

/** 알림 — 성공이면 손님·사장님 메일과 슬랙 거래 알림, 실패면 슬랙만. 🚨알림이 본작업을 막지 않는다 — 조회가 던져도 삼킨다.
 *  🔒슬랙엔 예약·주문번호·금액·회원 번호만(`buildDealNotice`). 메일 키·수신자가 없으면 `rent-notify`가 조용히 건너뛴다. */
async function tell(kind: DealKind, r: UnconfirmedPaid, refund: number, lapse: ConfirmLapse): Promise<void> {
  try {
    const b = await getBookingByOrderId(r.orderId);
    const brief = b ? (await listSpacesByIds([b.spaceId])).get(b.spaceId) : undefined;
    const space = brief ? await getSpaceFull(brief.slug) : null;
    if (!b || !space) {
      console.error(`[rent-unconfirmed] 알림에 실을 예약·공간을 못 읽었다 order=${r.orderId}`);
      return;
    }
    const jobs: Promise<unknown>[] = [notifyDeal(kind, b, space, refund)];
    if (kind !== "unconfirmed-refund-failed") {
      const [host, guest] = await Promise.all([getProfileById(space.ownerUserId), getProfileById(b.guestUserId)]);
      jobs.push(notifyUnconfirmedRefund(b, space, host, guest, refund, lapse));
    }
    await Promise.all(jobs);
  } catch (e) {
    console.error("[rent-unconfirmed] 알림 실패(본작업은 정상)", e);
  }
}
