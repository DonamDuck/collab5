// 하루 가게 — 결제 얇은 층 (2026-09-13)
//
// ⭐**왜 여기서 결제를 직접 치나** — 1팀의 결제 모듈([[결제-모듈-토스]])이 정본이고, 이 파일은 그 모듈이
//   들어올 때까지의 **자리 표시**다. 모듈이 오면 이 파일의 두 함수 본문만 갈아 끼운다(호출부는 안 바뀐다).
//
// ⚠️키가 없으면 **모의 모드**로 떨어진다(notify.ts와 같은 규율 — 미설정 환경에서 흐름 검증이 막히면 안 된다).
//   모의 모드는 `TOSS_SECRET_KEY`가 비었을 때만 켜지고, 콘솔에 매번 그 사실을 찍는다.
//   🚨운영에서 이 모드로 돌면 **돈을 안 받고 예약이 확정된다.** 배포 전 키 유무를 반드시 확인할 것.

const TOSS_BASE = "https://api.tosspayments.com/v1/payments";

function secret(): string {
  return process.env.TOSS_SECRET_KEY || "";
}

export function paymentsLive(): boolean {
  return secret().length > 0;
}

/** Basic {base64(secretKey + ":")} — 토스 규약. 비밀번호 자리를 비우고 콜론만 붙인다. */
function authHeader(): string {
  return `Basic ${Buffer.from(`${secret()}:`).toString("base64")}`;
}

export interface ApproveResult {
  ok: boolean;
  paymentKey: string;
  /** 실패했을 때 사람이 읽을 이유. 화면에 그대로 보여도 되는 문장만 담는다. */
  message: string;
}

/** 결제 승인 — 결제창이 돌려준 `paymentKey`·`orderId`·`amount`를 서버에서 다시 확정한다.
 *  🚨**금액을 클라이언트가 준 값으로 믿지 마라.** 호출부가 공간 값에서 다시 계산한 금액을 넘겨야 한다. */
export async function approvePayment(
  paymentKey: string, orderId: string, amount: number
): Promise<ApproveResult> {
  if (!paymentsLive()) {
    console.warn(`[rent-payment] 모의 승인 — TOSS_SECRET_KEY 없음 (order=${orderId}, ${amount}원)`);
    return { ok: true, paymentKey: paymentKey || `mock_${orderId}`, message: "모의 승인" };
  }
  try {
    const res = await fetch(`${TOSS_BASE}/confirm`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify({ paymentKey, orderId, amount }),
    });
    const body = (await res.json()) as { message?: string; paymentKey?: string };
    if (!res.ok) return { ok: false, paymentKey, message: body.message || "결제 승인에 실패했어요." };
    return { ok: true, paymentKey: body.paymentKey || paymentKey, message: "" };
  } catch (e) {
    console.error(`[rent-payment] approve threw order=${orderId}: ${String(e)}`);
    return { ok: false, paymentKey, message: "결제 서버에 닿지 못했어요. 잠시 뒤 다시 시도해 주세요." };
  }
}

/** 결제 취소 — 호스트 거절과 게스트 취소가 둘 다 이리로 온다.
 *  ⚠️`amount`를 주면 부분 취소, 안 주면 전액이다. **호스트 거절은 언제나 전액**이다(대표 09-13). */
export async function cancelPayment(
  paymentKey: string, reason: string, amount?: number
): Promise<boolean> {
  if (!paymentsLive()) {
    console.warn(`[rent-payment] 모의 취소 — key=${paymentKey} (${reason})`);
    return true;
  }
  try {
    const res = await fetch(`${TOSS_BASE}/${encodeURIComponent(paymentKey)}/cancel`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/json" },
      body: JSON.stringify(amount ? { cancelReason: reason, cancelAmount: amount } : { cancelReason: reason }),
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string };
      console.error(`[rent-payment] cancel failed key=${paymentKey}: ${body.message ?? res.status}`);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[rent-payment] cancel threw key=${paymentKey}: ${String(e)}`);
    return false;
  }
}

/** ⏳**막 눌렀다면 되돌릴 수 있다** — 신청 후 1시간 안의 취소는 언제나 전액 (대표 09-16).
 *  스페이스클라우드가 「예약 직후 2시간 전액」을 두는 걸 보고 대표가 1시간으로 정했다.
 *  ⭐손 미끄러짐과 마음 바꿈은 다르다. 이 창이 없으면 잘못 누른 사람이 당일 예약에서 전액을 잃는다. */
export const GRACE_MINUTES = 60;

/** 취소 수수료 — 🚨**호스트가 아니라 우리가 정한다.**
 *  소비자분쟁해결기준에 공간 대여 항목이 없어서 우리가 규정을 만들어야 하는데,
 *  호스트 자율로 두면 전자상거래법 제35조로 무효가 될 수 있다(09-13 법규 조사).
 *  값은 공정위 지침 Ⅲ.1 라가 허용하는 **숙박업 공제율을 상한으로** 잡았다.
 *
 *  @param daysBefore 쓰기로 한 날까지 남은 일수
 *  @param minutesSinceBooked 신청한 지 지난 분. 넘기지 않으면 유예 창을 안 본다(옛 호출부 호환).
 */
export function guestCancelRefundRate(daysBefore: number, minutesSinceBooked?: number): number {
  if (typeof minutesSinceBooked === "number" && minutesSinceBooked <= GRACE_MINUTES) return 1;
  if (daysBefore >= 7) return 1;      // 7일 전까지 전액
  if (daysBefore >= 3) return 0.7;
  if (daysBefore >= 1) return 0.5;
  return 0;                            // 당일 취소는 환불 없음
}
