// 하루 팝업 — 결제 얇은 층 (2026-09-13)
//
// ⭐**왜 여기서 결제를 직접 치나** — 1팀의 결제 모듈([[결제-모듈-토스]])이 정본이고, 이 파일은 그 모듈이
//   들어올 때까지의 **자리 표시**다. 모듈이 오면 이 파일의 두 함수 본문만 갈아 끼운다(호출부는 안 바뀐다).
//
// ⚠️키가 없으면 **모의 모드**로 떨어진다(notify.ts와 같은 규율 — 미설정 환경에서 흐름 검증이 막히면 안 된다).
//   🔒단 **개발에서만이다**(2026-09-16). 전에는 키 유무만 봐서, 운영에 키를 안 넣으면
//     «돈을 안 받고 예약이 확정»됐다. 그 경고를 이 머리말에 적어 두고 사람 손에 맡겼는데,
//     ⭐배포 전에 사람이 확인해야 하는 것은 언젠가 한 번은 빠진다. 그래서 코드가 막는다.
//   운영에서 키가 비어 있으면 결제는 **실패로 떨어진다** — 조용히 통과하는 것보다 낫다.

import { createHash } from "node:crypto";
import type { SpaceBooking, TossPayment } from "./types";
import { kstDaysUntil } from "./rent-time";
import { refundAmount } from "./rent-money";

const TOSS_BASE = "https://api.tosspayments.com/v1/payments";

/** 🔁**멱등키** — 같은 요청이 두 번 가도 돈이 두 번 움직이지 않게 (2026-09-18 밤 QA SC-01·SC-02).
 *
 *  토스 문서(09-18 확인): 헤더 이름은 `Idempotency-Key`, 최대 300자, 첫 요청 날부터 15일 유효.
 *  토스는 «멱등키 + API 키 + API 주소 + HTTP 메서드»가 같은 요청이 있으면 **다시 처리하지 않고 첫 응답을 그대로** 준다.
 *  앞선 요청이 아직 처리 중이면 409 `IDEMPOTENT_REQUEST_PROCESSING`이다.
 *  ⚠️본문은 비교하지 않는다. 그래서 키에는 «무엇을 바꾸는 요청인지»를 통째로 넣는다 —
 *    다른 요청이 같은 키를 쓰면 엉뚱한 첫 응답을 받는다.
 *  ⭐문서는 UUID 같은 «무작위» 값을 권하지만 우리는 **주문에서 뽑은 값**을 쓴다. 무작위로 만들면
 *    겹쳐 들어온 두 요청의 키가 서로 달라져서 막으려던 중복이 그대로 지나간다.
 *  길이는 sha-256 16진수라 늘 70자 안쪽(상한 300 안). */
function idemKey(kind: string, ...parts: (string | number)[]): string {
  return `${kind}-${createHash("sha256").update(parts.join("|")).digest("hex")}`;
}

function secret(): string {
  return process.env.TOSS_SECRET_KEY || "";
}

export function paymentsLive(): boolean {
  return secret().length > 0;
}

/** 🔑**키가 「진짜 돈」인가.** 토스 키는 앞글자로 갈린다 — `test_sk_…` / `live_sk_…`.
 *
 *  🩸09-16까지 화면에 「지금은 시험 결제예요」가 **그냥 박혀 있었다.** 아무것도 안 보는 글자라
 *    라이브 키로 바꾼 뒤에도 그대로 남는다 — 진짜 돈을 낸 손님에게 시험이라고 말하게 된다.
 *  ⭐그리고 반대쪽이 더 위험하다. 가맹 «심사»를 받으려면 테스트 키를 단 채로 배포해야 하는데
 *    ([[결제-모듈-토스]] 순서), 그때 들어온 사람은 **공짜로 예약을 확정**할 수 있다.
 *    막을 수는 없다(막으면 심사가 안 된다). 대신 화면이 그 사실을 «스스로» 말하게 한다. */
export function paymentsTestMode(): boolean {
  return secret().startsWith("test_");
}

/** 모의 모드를 켜도 되는 자리인가. 🔒**운영에서는 절대 안 된다.**
 *  키가 없는 운영은 «설정 사고»지 «검증 환경»이 아니다. */
function mockAllowed(): boolean {
  return process.env.NODE_ENV !== "production";
}

/** Basic {base64(secretKey + ":")} — 토스 규약. 비밀번호 자리를 비우고 콜론만 붙인다. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${secret()}:`).toString("base64")}`;
}

export interface ApproveResult {
  ok: boolean;
  /** 승인됐을 때 토스가 돌려준 Payment 객체 그대로. `rent_sync`에 그대로 넘긴다. */
  payment?: TossPayment;
  /** 실패했을 때 사람이 읽을 이유. 화면에 그대로 보여도 되는 문장만 담는다. */
  message: string;
  /** 토스가 준 실패 코드(`REJECT_CARD_PAYMENT` 등). 결제 실패 화면이 이 코드로 우리 문장을 고른다(09-18 밤 QA SEC-06). */
  code?: string;
}

/** 🧾결제 실패 화면(`/rent/pay/fail?code=`)이 알아듣는 «우리» 사유 코드. 토스 코드와 안 겹치게 `RENT_`로 시작한다.
 *  승인은 됐는데 그 사이 시간이 차서 예약을 못 올렸을 때 — 자동 환불이 됐는지에 따라 둘로 나뉜다(`confirmBookingAction`). */
export const PAY_FAIL_SLOT_TAKEN_REFUNDED = "RENT_SLOT_TAKEN_REFUNDED";
export const PAY_FAIL_SLOT_TAKEN_REFUND_PENDING = "RENT_SLOT_TAKEN_REFUND_PENDING";

/** 🆕09-18 밤 QA(G-01·SC-11·SC-30) — 승인을 «부르기 전에» 막은 넷. 돈은 한 푼도 안 움직인 상태다.
 *  · `WINDOW_OVER` 결제 시간 30분이 지났다 · `USE_STARTED` 이용 시각이 이미 시작했다
 *  · `SLOT_TAKEN` 그 사이 다른 분이 먼저 결제했다 · `NOT_AVAILABLE` 공간·상품·열린 시간이 바뀌었다 */
export const PAY_FAIL_WINDOW_OVER = "RENT_PAY_WINDOW_OVER";
export const PAY_FAIL_USE_STARTED = "RENT_USE_STARTED";
export const PAY_FAIL_SLOT_TAKEN = "RENT_SLOT_TAKEN";
export const PAY_FAIL_NOT_AVAILABLE = "RENT_NOT_AVAILABLE";

/** 🆕09-18 밤 QA(SC-12) — 승인은 됐는데 «아직 받지 않은» 결제(입금 대기 가상계좌 등). 그 자리에서 취소하고 돌려보낸다. */
export const PAY_FAIL_METHOD_UNSUPPORTED = "RENT_METHOD_UNSUPPORTED";

/** 🤖사람 손 없이 우리가 되돌리는 취소의 사유 둘(`confirmBookingAction`). 토스 취소 내역(`cancels[].cancelReason`)에 이 글자
 *  그대로 남는다. 아침 요약이 이 글자로 «자동 환불»을 손님 취소와 가른다(둘 다 예약은 `cancelled`라서). ⚠️글자를 바꾸면 옛 줄은 손님 취소로 세진다. */
export const AUTO_REFUND_REASON = "예약 확정 실패 — 자동 환불";
export const AUTO_CANCEL_WAITING_REASON = "입금 전 결제 수단이라 자동 취소";
export function isAutoCancelReason(reason: string | undefined | null): boolean {
  return reason === AUTO_REFUND_REASON || reason === AUTO_CANCEL_WAITING_REASON;
}

/** 🆕09-18 밤 QA(G-05) — 취소 팝업이 본 금액보다 실제 환불액이 «적어졌다». 돌려주지 않고 다시 확인받는다. */
export const PAY_FAIL_REFUND_CHANGED = "RENT_REFUND_CHANGED";

/** 결제 시간이 지난 신청에 손님께 하는 말. 결제 화면과 승인이 같은 문장을 쓴다. */
export const PAY_EXPIRED_LINE = "결제 시간 30분이 지나서 이 신청은 닫혔어요.";

/** 결제 승인 — 결제창이 돌려준 `paymentKey`·`orderId`·`amount`를 서버에서 다시 확정한다.
 *  🚨**금액을 클라이언트가 준 값으로 믿지 마라.** 호출부가 결제 줄에 적힌 금액을 넘겨야 한다.
 *  ⭐09-16부터 토스 응답(Payment)을 «그대로» 돌려준다. 돈의 상태는 우리가 계산하지 않고 토스 말을 옮긴다. */
export async function approvePayment(
  paymentKey: string, orderId: string, amount: number
): Promise<ApproveResult> {
  if (!paymentsLive()) {
    if (!mockAllowed()) {
      console.error(`[rent-payment] 🚨운영에 TOSS_SECRET_KEY가 없다 — 승인을 거절한다 (order=${orderId})`);
      return { ok: false, message: "결제를 처리할 수 없어요. 잠시 뒤 다시 시도해 주세요." };
    }
    console.warn(`[rent-payment] 모의 승인 — TOSS_SECRET_KEY 없음 (order=${orderId}, ${amount}원)`);
    // 모의 응답도 토스와 «같은 모양»으로 만든다. 모양이 다르면 모의 모드에서만 도는 길이 생긴다.
    return {
      ok: true,
      message: "모의 승인",
      payment: {
        paymentKey: paymentKey || `mock_${orderId}`, orderId, status: "DONE",
        totalAmount: amount, balanceAmount: amount, method: "모의", approvedAt: new Date().toISOString(), cancels: [],
      },
    };
  }
  // 🧪가맹 심사 기간에는 «운영»에 테스트 키가 달려 있다([[결제-모듈-토스]] 순서).
  //   그 상태에서 들어온 신청은 돈이 안 움직이는데 예약은 확정된다. 막지는 않는다(막으면 심사가 안 된다).
  //   대신 로그에 남겨 둔다 — 나중에 「이 예약은 진짜였나」를 되짚을 유일한 단서다.
  if (paymentsTestMode() && process.env.NODE_ENV === "production") {
    console.warn(`[rent-payment] 🧪운영인데 «테스트» 키다 — 돈은 안 움직인다 (order=${orderId}, ${amount}원)`);
  }
  try {
    const res = await fetch(`${TOSS_BASE}/confirm`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        // 🔁09-18 밤 QA(SC-02) — 복귀 주소가 두 번 열려도 승인은 한 번만. 두 번째는 첫 응답을 그대로 받는다.
        //   ⭐키에 `paymentKey`를 같이 넣는다. 주문번호만으로 만들면, 카드가 거절돼 «다시 결제하기»로 새로 시도할 때
        //     같은 키가 돼서 토스가 첫 번째의 «실패»를 그대로 돌려준다 — 그 주문은 영영 결제가 안 된다.
        "Idempotency-Key": idemKey("rent-confirm", orderId, paymentKey),
      },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const body = (await res.json()) as TossPayment & { message?: string; code?: string };
    if (!res.ok) return { ok: false, message: body.message || "결제 승인에 실패했어요.", code: body.code };
    return { ok: true, message: "", payment: body };
  } catch (e) {
    console.error(`[rent-payment] approve threw order=${orderId}: ${String(e)}`);
    return { ok: false, message: "결제 서버에 닿지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
}

export interface CancelResult {
  ok: boolean;
  /** 환불이 됐을 때 토스가 돌려준 Payment 객체(남은 돈·환불 이력이 들어 있다). */
  payment?: TossPayment;
}

/** 결제 취소 — 호스트 거절과 게스트 취소가 둘 다 이리로 온다.
 *  ⚠️`amount`를 주면 부분 취소, 안 주면 전액이다. **호스트 거절은 언제나 전액**이다(대표 09-13).
 *
 *  🔁09-18 밤 QA(SC-01) — `refundableAmount`(호출부가 «취소 전»에 읽은 잔액)와 멱등키를 같이 보낸다.
 *    · 취소 버튼이 두 번 눌리거나 두 창에서 같이 눌리면 부분 환불이 두 번 나갔다(90,000원 예약에서 45,000원씩 두 번).
 *    · 멱등키가 같으면 토스는 두 번째를 처리하지 않고 첫 응답을 그대로 준다 — 돈은 한 번만 움직인다.
 *    · 그래도 금액이 달라져 키가 갈리는 경우(그 사이 경계 시각이 지남)가 남는데, 그건 `refundableAmount`가 잡는다.
 *      토스 문서: *「환불 가능한 잔액 정보가 refundableAmount의 값과 다르면 취소를 처리하지 않고 에러를 내보낸다」*
 *      (400 `NOT_MATCHES_REFUNDABLE_AMOUNT`). ⚠️문서에 «deprecated»로 적혀 있지만 동작은 그대로다.
 *      나중에 토스가 이 칸을 받지 않게 되면 멱등키만 남는다 — 그때도 겹친 같은 취소는 막힌다.
 *  모의 모드에서는 이 값으로 토스와 같은 모양의 응답을 만든다(지금 남은 돈). */
export async function cancelPayment(
  paymentKey: string, reason: string, amount: number | undefined, refundableAmount: number,
): Promise<CancelResult> {
  if (!paymentsLive()) {
    // 🔁취소는 승인과 «반대로» 관대하게 둔다. 운영에 키가 없으면 애초에 승인이 안 되니
    //   취소할 실제 결제도 없다. 여기서 막으면 환불 흐름만 붙잡혀 예약이 취소 불가로 남는다.
    console.warn(`[rent-payment] 모의 취소 — key=${paymentKey} (${reason})`);
    const cancelAmount = amount ?? refundableAmount;
    const balance = Math.max(0, refundableAmount - cancelAmount);
    return {
      ok: true,
      payment: {
        paymentKey, status: balance === 0 ? "CANCELED" : "PARTIAL_CANCELED", balanceAmount: balance,
        cancels: [{ cancelAmount, cancelReason: reason, canceledAt: new Date().toISOString() }],
      },
    };
  }
  try {
    const res = await fetch(`${TOSS_BASE}/${encodeURIComponent(paymentKey)}/cancel`, {
      method: "POST",
      headers: {
        Authorization: authHeader(),
        "Content-Type": "application/json",
        // 같은 결제·같은 잔액·같은 금액이면 한 번만 나간다. 겹쳐 눌린 두 번째는 첫 응답을 그대로 받는다.
        "Idempotency-Key": idemKey("rent-cancel", paymentKey, refundableAmount, amount ?? refundableAmount),
      },
      body: JSON.stringify({
        cancelReason: reason,
        ...(amount ? { cancelAmount: amount } : {}),
        ...(refundableAmount > 0 ? { refundableAmount } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as TossPayment & { message?: string };
    if (!res.ok) {
      console.error(`[rent-payment] cancel failed key=${paymentKey}: ${body.message ?? res.status}`);
      return { ok: false };
    }
    return { ok: true, payment: body };
  } catch (e) {
    console.error(`[rent-payment] cancel threw key=${paymentKey}: ${String(e)}`);
    return { ok: false };
  }
}

/** ⏳**수락 뒤 1시간은 되돌릴 수 있다** — 사장님이 수락(확정)한 뒤 1시간 안에 손님이 취소하면 남은 날과 상관없이 전액 (대표 09-19).
 *
 *  🔁09-16~09-18엔 «결제하고 1시간»이었다. 대표 09-19: *「결제하고 1시간을 애당초 잘못 넣은 거 같아. 당연히 사장님의
 *    예약 확정 이후에 1시간 취소로 해야 할 거 같아. 결제만 하고 1시간 취소는 정책을 아예 그냥 빼자.」*
 *    그래서 결제 기준 창은 없앴다.
 *  기준 시각은 수락을 누른 때(`decidedAt`)다. 거절한 예약엔 창이 없다. 거절이 곧 전액 환불이라서다.
 *  경계는 «분»을 내림해서 센다. 수락하고 60분 59초까지가 창 안이다(09-17부터 쓰던 셈 그대로). */
export const GRACE_MINUTES = 60;

/** 취소하는 때가 «수락 전»인가 «수락 뒤»인가. 환불률이 여기서 먼저 갈린다.
 *  · `{ accepted: false }` 결제는 끝났고 사장님이 아직 수락하지 않았다(`paid`) → 날짜와 상관없이 전액
 *  · `{ accepted: true, minutesSinceConfirmed }` 수락한 뒤(`confirmed`) → 1시간 안이면 전액, 그 뒤는 표
 *  ⚠️넘기지 않으면 **표만** 본다. 결제 화면이 「날짜별로 몇 %인가」를 물을 때 쓰는 길이다. 예약 한 건의 환불액은
 *    늘 `guestCancelQuote`로 구한다(상태를 보고 이 값을 채운다). */
export type CancelStage = { accepted: false } | { accepted: true; minutesSinceConfirmed?: number };

/** 취소 수수료 — 🚨**호스트가 아니라 우리가 정한다.**
 *  소비자분쟁해결기준에 공간 대여 항목이 없어서 우리가 규정을 만들어야 하는데,
 *  호스트 자율로 두면 전자상거래법 제35조로 무효가 될 수 있다(09-13 법규 조사).
 *  값은 공정위 지침 Ⅲ.1 라가 허용하는 **숙박업 공제율을 상한으로** 잡았다.
 *
 *  🆕09-19 대표 — *「수락 전 취소는 당연히 전액 취소」*. 사장님이 아직 받겠다고 하지 않은 예약이라 깎을 근거가 없다.
 *    09-19 오전 판(수락 전엔 표대로)은 결제 기준 창을 뺄 때 수락 전 취소까지 표로 떨어뜨렸다. 그 칸을 전액으로 되돌렸다.
 *
 *  🔢09-18 밤 QA(SEC-03) — 표는 «정수 퍼센트»로 둔다. 돈 계산(`refundAmount`)이 이 정수를 받는다.
 *    소수 비율(0.7)을 금액에 바로 곱하면 90,000원의 70%가 62,999원이 됐다.
 *
 *  @param daysBefore 쓰기로 한 날까지 남은 일수
 *  @param stage 수락 전인지 뒤인지(`CancelStage`). 안 넘기면 표만 본다.
 */
export function guestCancelRefundPercent(daysBefore: number, stage?: CancelStage): number {
  if (stage && !stage.accepted) return 100;   // 수락 전 취소는 전액
  if (stage?.accepted && typeof stage.minutesSinceConfirmed === "number" && stage.minutesSinceConfirmed <= GRACE_MINUTES) return 100;
  if (daysBefore >= 7) return 100;    // 7일 전까지 전액
  if (daysBefore >= 3) return 70;
  if (daysBefore >= 1) return 50;
  return 0;                            // 당일 취소는 환불 없음
}

/** 같은 표를 비율(1·0.7·0.5·0)로. 화면 문장(「70%」·「전액」)을 만드는 곳이 쓴다. ⚠️금액 계산엔 쓰지 않는다 — `refundAmount`에 퍼센트를 넘긴다. */
export function guestCancelRefundRate(daysBefore: number, stage?: CancelStage): number {
  return guestCancelRefundPercent(daysBefore, stage) / 100;
}

/** 사장님이 수락한 지 몇 분 됐나. 확정 예약이 아니거나 수락 시각이 없으면 undefined다(창이 없다).
 *  ⚠️상태까지 같이 본다. `decidedAt`은 거절할 때도 찍히는 칸이라, 시각만 보면 거절된 예약에 창이 열린 것처럼 읽힌다. */
export function minutesSinceConfirmed(b: Pick<SpaceBooking, "status" | "decidedAt">, now = Date.now()): number | undefined {
  if (b.status !== "confirmed" || !b.decidedAt) return undefined;
  const at = Date.parse(b.decidedAt);
  if (!Number.isFinite(at)) return undefined;
  return Math.floor((now - at) / 60_000);
}

/** 💸손님 취소 견적 — **취소 팝업(`quoteCancelAction`)과 실제 취소(`cancelBookingAction`)가 이 한 함수만 부른다.**
 *  둘이 따로 계산하면 팝업엔 70%라 적고 50%만 돌려주는 날이 온다.
 *  「이용일 N일 전」은 한국 달력의 날짜 차이다(`kstDaysUntil`, 09-16 UTC 자정 사고 뒤로).
 *  `beforeAccept`·`grace`는 팝업이 «왜 전액인지»를 말할 때만 쓴다. 비율은 `percent` 하나가 정한다.
 *   · `beforeAccept` 결제 완료·수락 전(`paid`)이라 전액
 *   · `grace` 수락하고 1시간 안이라 전액
 *  순수 함수라 시각을 넘겨 경계값을 잴 수 있다(`now`·`today`). */
export function guestCancelQuote(
  b: Pick<SpaceBooking, "status" | "decidedAt" | "useDate" | "amountTotal">, now = Date.now(), today?: string,
): { percent: number; rate: number; refund: number; daysBefore: number; beforeAccept: boolean; grace: boolean } {
  const daysBefore = kstDaysUntil(b.useDate, today);
  const beforeAccept = b.status === "paid";
  const mins = minutesSinceConfirmed(b, now);
  const grace = !beforeAccept && typeof mins === "number" && mins <= GRACE_MINUTES;
  const stage: CancelStage = beforeAccept ? { accepted: false } : { accepted: true, minutesSinceConfirmed: mins };
  const percent = guestCancelRefundPercent(daysBefore, stage);
  return { percent, rate: percent / 100, refund: refundAmount(b.amountTotal, percent), daysBefore, beforeAccept, grace };
}
