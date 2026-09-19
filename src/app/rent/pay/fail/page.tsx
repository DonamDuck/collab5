import type { Metadata } from "next";
import Link from "next/link";
import {
  PAY_FAIL_METHOD_UNSUPPORTED, PAY_FAIL_NOT_AVAILABLE, PAY_FAIL_SLOT_TAKEN,
  PAY_FAIL_SLOT_TAKEN_REFUNDED, PAY_FAIL_SLOT_TAKEN_REFUND_PENDING,
  PAY_FAIL_USE_STARTED, PAY_FAIL_WINDOW_OVER,
} from "@/lib/rent-payment";
import { KAKAO_CHAT_URL } from "@/lib/site";
import { secondaryBtnCls } from "../../ui";

// 하루 팝업 — 결제가 안 끝났을 때 (2026-09-13)
//
// ⭐말투를 「실패」로 쓰지 않는다. 여기 닿는 사람의 대부분은 고장이 아니라 **마음이 바뀐 쪽**이고,
//   카드가 안 됐더라도 그건 본인 잘못이 아니다. 다시 돌아갈 길만 분명히 보이면 된다.
//
// 🎨09-13 재작업 — 크기만 사다리에 맞췄다(제목 22 · 본문 17 · 사유 15). 버튼은 전부 보조 —
//   돌아가는 길이 여럿인데 하나만 키위면 「그쪽으로 가라」가 된다. 사유의 회색 상자는 인용선으로.
//
// 🔒09-18 밤 QA(SEC-06) — **주소의 `message`를 화면에 쓰지 않는다.** 전엔 그 글을 그대로 보여 줬는데,
//   이 주소는 누구나 만들 수 있다. 「결제 점검 중이라 010-…로 계좌이체해 주세요」 같은 글을 우리 화면에 띄운 링크를
//   돌리면 손님은 우리 말로 읽는다. 이제 `code`만 보고 우리가 쓴 문장을 고른다. 모르는 코드는 기본 문장 하나.
//   코드는 둘에서 온다. ① 토스 결제창이 실패 주소로 보낼 때 붙이는 코드 ② 결제 승인 라우트(`pay/success`)가 붙이는 우리 코드.
export const metadata: Metadata = {
  title: "결제가 끝나지 않았어요 — collab5",
  robots: { index: false },
};

/** 코드별 사유 한 줄. ⚠️돈이 «안 나갔다»는 말은 결제창 단계에서 멈춘 코드에만 쓴다(승인 전이라 확실하다).
 *  승인 단계의 알 수 없는 실패는 확인할 수 없어서 기본 문장에 그 말을 넣지 않는다. */
const REASONS = new Map<string, string>([
  // 토스 결제창 — 손님이 창을 닫았다.
  ["PAY_PROCESS_CANCELED", "결제 창을 닫으셔서 결제는 되지 않았어요."],
  // 토스 결제창 — 인증이나 승인 요청 중에 멈췄다.
  ["PAY_PROCESS_ABORTED", "결제가 중간에 멈춰서 결제는 되지 않았어요."],
  // 카드사가 거절했다(결제창 단계 · 승인 단계). 한도·잔액이 가장 흔한 이유라 할 일을 같이 말한다.
  ["REJECT_CARD_COMPANY", "카드사에서 결제를 받지 않았어요. 한도나 잔액을 확인하시거나 다른 카드로 해 주세요."],
  ["REJECT_CARD_PAYMENT", "카드사에서 결제를 받지 않았어요. 한도나 잔액을 확인하시거나 다른 카드로 해 주세요."],
  // 우리 승인 라우트 — 돈은 승인됐는데 그 사이 시간이 찼다(`confirmBookingAction`).
  [PAY_FAIL_SLOT_TAKEN_REFUNDED, "그 사이 그 시간이 찼어요. 결제는 바로 취소해 드렸어요."],
  [PAY_FAIL_SLOT_TAKEN_REFUND_PENDING, "그 사이 그 시간이 찼어요. 환불을 처리하고 있으니 곧 연락드릴게요."],
  // 🛑승인 «전»에 우리가 막은 갈래 — 돈은 한 번도 움직이지 않았다(09-18 밤 QA).
  [PAY_FAIL_WINDOW_OVER, "결제 시간 30분이 지나서 이 신청은 닫혔어요. 공간에서 다시 골라 주세요."],
  [PAY_FAIL_USE_STARTED, "신청하신 시간이 이미 시작돼서 결제할 수 없어요."],
  [PAY_FAIL_SLOT_TAKEN, "그 사이 다른 분이 그 시간을 먼저 예약했어요. 돈은 움직이지 않았어요."],
  [PAY_FAIL_NOT_AVAILABLE, "그 사이 사장님이 이 시간이나 상품을 바꾸셨어요. 돈은 움직이지 않았어요."],
  [PAY_FAIL_METHOD_UNSUPPORTED, "이 결제 수단은 아직 받지 않아요. 카드나 간편결제로 다시 결제해 주세요."],
]);
const DEFAULT_REASON = "결제를 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.";

/** 다시 결제할 수 없는 사유 — 그 신청은 이미 닫혔다. */
const CLOSED = new Set([
  PAY_FAIL_SLOT_TAKEN_REFUNDED, PAY_FAIL_SLOT_TAKEN_REFUND_PENDING,
  // 이 넷은 신청 자체가 닫혔거나 조건이 바뀌었다. 같은 주문으로 다시 결제하면 또 막힌다.
  PAY_FAIL_WINDOW_OVER, PAY_FAIL_USE_STARTED, PAY_FAIL_SLOT_TAKEN, PAY_FAIL_NOT_AVAILABLE,
]);

/** 우리 주문번호 모양(`startBookingAction`: `rent-{공간}-{YYYYMMDD}-{난수}`)과 목 데이터 모양만 받는다. 링크에 그대로 넣기 때문이다. */
const ORDER_ID_RE = /^(rent-\d+-\d{8}-[a-z0-9]{1,16}|mock-order-\d+)$/;

export default async function RentPayFailPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[]; orderId?: string | string[] }>;
}) {
  const sp = await searchParams;
  const code = typeof sp.code === "string" ? sp.code : "";
  const reason = REASONS.get(code) ?? DEFAULT_REASON;
  const orderId = typeof sp.orderId === "string" && ORDER_ID_RE.test(sp.orderId) ? sp.orderId : "";
  // 🔁다시 결제하기 — 30분 안의 신청은 같은 주문으로 다시 결제할 수 있다. 결제 화면이 주인·상태를 다시 본다
  //   (남의 주문이면 404, 결제 시간이 지났으면 신청 목록, 이미 끝났으면 예약 화면으로 보낸다).
  const retryHref = orderId && !CLOSED.has(code) ? `/rent/pay/${orderId}` : "";

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">결제가 끝나지 않았어요</h1>
      <p className="mt-3 text-[17px] leading-relaxed break-keep text-body">
        신청은 아직 접수되지 않았어요. 사장님께도 아무 연락이 가지 않았어요.
      </p>
      <p className="mt-5 border-l-2 border-hairline pl-4 text-[15px] leading-relaxed break-keep text-mute">{reason}</p>
      <div className="mt-8 flex flex-wrap gap-2">
        {retryHref && (
          <Link href={retryHref} className={secondaryBtnCls}>
            다시 결제하기
          </Link>
        )}
        <Link href="/rent" className={secondaryBtnCls}>
          다른 공간 보기
        </Link>
        {/* 09-16 손님 전용 목록으로(B81). `/rent/my`는 사장님 화면이다. */}
        <Link href="/rent/requests" className={secondaryBtnCls}>
          내 예약 보기
        </Link>
      </div>
      {/* 💬막혔을 때 갈 곳. 버튼 무게를 늘리지 않으려고 글자 링크로 둔다(`/rent/done`과 같은 자리). */}
      <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
        계속 안 되면{" "}
        <a href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer" className="text-body underline underline-offset-2">
          카카오톡으로 알려 주세요
        </a>
        .
      </p>
    </main>
  );
}
