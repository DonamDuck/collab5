// 하루 팝업 — 돈을 나누는 계산은 «정수로» (2026-09-18 밤 QA SEC-03)
//
// 🩸`Math.floor(90000 * 0.7)`은 63,000이 아니라 62,999다. 0.7이 2진 소수로 딱 떨어지지 않아 곱이 63000보다 아주 조금 작게 나오고,
//   내림이 그 틈을 1원으로 만든다. 1만~200만 원을 1원 단위로 돌려 보니 70% 환불에서 37,300개 금액이 1원씩 적었다.
// ⭐비율을 먼저 «만분율 정수»로 바꾼 뒤 곱하고 나눈다. 가장 큰 곱이 200만 × 10000 = 2×10^10이라
//   JS 정수 한계(2^53) 안에서 한 자리도 안 틀린다.
// ⭐화면(등록 폼의 시간당 정산액)·서버(취소 환불·예약 행의 정산액)·목 데이터가 같은 함수를 부른다.
//   DB의 정산 스냅샷(`rent_sync`의 `floor(balance_amount * (1 - fee_rate))`)도 numeric이라 정확한 값이고, 이 함수와 같은 답이 나온다.
// 🚨훅도 DB도 안 부른다. 클라이언트·서버 어디서든 불린다.

/** 비율(0.15) → 만분율 정수(1500). DB `fee_rate`가 numeric(5,4)라 소수 넷째 자리까지가 전부다. */
function toBasisPoints(rate: number): number {
  return Math.round(rate * 10_000);
}

/** `total × bp / 10000`을 원 단위로 내린다. 나머지를 먼저 떼어 «정수 나눗셈»만 남긴다. */
function floorByBasisPoints(total: number, bp: number): number {
  const n = total * bp;
  return (n - (n % 10_000)) / 10_000;
}

/** 사장님 몫 — 결제액에서 수수료를 뺀 나머지, 원 단위 내림. 1원이 남으면 우리가 갖는다.
 *  @param feeRate 수수료율(0.15). 예약 행의 `fee_rate`를 그대로 넘겨도 된다. */
export function payoutAmount(total: number, feeRate: number): number {
  return floorByBasisPoints(total, 10_000 - toBasisPoints(feeRate));
}

/** 환불액 — 결제액 × 환불 퍼센트(100·70·50·0), 원 단위 내림. */
export function refundAmount(total: number, percent: number): number {
  return floorByBasisPoints(total, Math.round(percent) * 100);
}
