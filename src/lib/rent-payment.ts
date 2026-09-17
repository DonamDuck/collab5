// 하루 가게 — 결제 얇은 층 (2026-09-13)
//
// ⭐**왜 여기서 결제를 직접 치나** — 1팀의 결제 모듈([[결제-모듈-토스]])이 정본이고, 이 파일은 그 모듈이
//   들어올 때까지의 **자리 표시**다. 모듈이 오면 이 파일의 두 함수 본문만 갈아 끼운다(호출부는 안 바뀐다).
//
// ⚠️키가 없으면 **모의 모드**로 떨어진다(notify.ts와 같은 규율 — 미설정 환경에서 흐름 검증이 막히면 안 된다).
//   🔒단 **개발에서만이다**(2026-09-16). 전에는 키 유무만 봐서, 운영에 키를 안 넣으면
//     «돈을 안 받고 예약이 확정»됐다. 그 경고를 이 머리말에 적어 두고 사람 손에 맡겼는데,
//     ⭐배포 전에 사람이 확인해야 하는 것은 언젠가 한 번은 빠진다. 그래서 코드가 막는다.
//   운영에서 키가 비어 있으면 결제는 **실패로 떨어진다** — 조용히 통과하는 것보다 낫다.

import type { TossPayment } from "./types";

const TOSS_BASE = "https://api.tosspayments.com/v1/payments";

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
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
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
 *  `balanceBefore`는 모의 모드에서 토스와 같은 모양의 응답을 만들 때만 쓴다(지금 남은 돈). */
export async function cancelPayment(
  paymentKey: string, reason: string, amount: number | undefined, balanceBefore: number,
): Promise<CancelResult> {
  if (!paymentsLive()) {
    // 🔁취소는 승인과 «반대로» 관대하게 둔다. 운영에 키가 없으면 애초에 승인이 안 되니
    //   취소할 실제 결제도 없다. 여기서 막으면 환불 흐름만 붙잡혀 예약이 취소 불가로 남는다.
    console.warn(`[rent-payment] 모의 취소 — key=${paymentKey} (${reason})`);
    const cancelAmount = amount ?? balanceBefore;
    const balance = Math.max(0, balanceBefore - cancelAmount);
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
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(amount ? { cancelReason: reason, cancelAmount: amount } : { cancelReason: reason }),
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

/** ⏳**막 눌렀다면 되돌릴 수 있다** — 결제 후 1시간 안의 취소는 언제나 전액 (대표 09-16, 09-17부터 결제 승인 시각 기준).
 *  스페이스클라우드가 「예약 직후 2시간 전액」을 두는 걸 보고 대표가 1시간으로 정했다.
 *  ⭐손 미끄러짐과 마음 바꿈은 다르다. 이 창이 없으면 잘못 누른 사람이 당일 예약에서 전액을 잃는다. */
export const GRACE_MINUTES = 60;

/** 취소 수수료 — 🚨**호스트가 아니라 우리가 정한다.**
 *  소비자분쟁해결기준에 공간 대여 항목이 없어서 우리가 규정을 만들어야 하는데,
 *  호스트 자율로 두면 전자상거래법 제35조로 무효가 될 수 있다(09-13 법규 조사).
 *  값은 공정위 지침 Ⅲ.1 라가 허용하는 **숙박업 공제율을 상한으로** 잡았다.
 *
 *  🔢09-18 밤 QA(SEC-03) — 표는 «정수 퍼센트»로 둔다. 돈 계산(`refundAmount`)이 이 정수를 받는다.
 *    소수 비율(0.7)을 금액에 바로 곱하면 90,000원의 70%가 62,999원이 됐다.
 *
 *  @param daysBefore 쓰기로 한 날까지 남은 일수
 *  @param minutesSinceBooked 신청한 지 지난 분. 넘기지 않으면 유예 창을 안 본다(옛 호출부 호환).
 */
export function guestCancelRefundPercent(daysBefore: number, minutesSinceBooked?: number): number {
  if (typeof minutesSinceBooked === "number" && minutesSinceBooked <= GRACE_MINUTES) return 100;
  if (daysBefore >= 7) return 100;    // 7일 전까지 전액
  if (daysBefore >= 3) return 70;
  if (daysBefore >= 1) return 50;
  return 0;                            // 당일 취소는 환불 없음
}

/** 같은 표를 비율(1·0.7·0.5·0)로. 화면 문장(「70%」·「전액」)을 만드는 곳이 쓴다. ⚠️금액 계산엔 쓰지 않는다 — `refundAmount`에 퍼센트를 넘긴다. */
export function guestCancelRefundRate(daysBefore: number, minutesSinceBooked?: number): number {
  return guestCancelRefundPercent(daysBefore, minutesSinceBooked) / 100;
}
