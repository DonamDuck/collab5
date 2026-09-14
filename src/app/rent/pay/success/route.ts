import { NextResponse, type NextRequest } from "next/server";
import { confirmBookingAction } from "@/lib/rent-actions";

// 하루 가게 — 토스 결제창이 돌아오는 자리 (2026-09-13)
//
// ⚠️**페이지가 아니라 라우트 핸들러다.** 승인은 화면을 그리는 일이 아니라 «쓰기»라서,
//   서버 컴포넌트 렌더 중에 하면 `revalidatePath`가 렌더 단계에서 터진다. 여기서 처리하고 보낸다.
//
// 🚨**주소창의 `amount`를 쓰지 않는다.** 토스가 붙여 보내지만 사용자가 고칠 수 있는 값이다.
//   실제 청구액은 `pending` 행에 서버가 적어 둔 값이고 `confirmBookingAction`이 그것만 본다.
//   그래서 이 파일은 `paymentKey`와 `orderId` 둘만 꺼낸다.
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const paymentKey = q.get("paymentKey") ?? "";
  const orderId = q.get("orderId") ?? "";

  const fail = (msg: string) =>
    NextResponse.redirect(new URL(`/rent/pay/fail?message=${encodeURIComponent(msg)}`, req.url));

  if (!orderId) return fail("주문 번호가 없어요. 결제가 끝나지 않았을 수 있습니다.");

  const r = await confirmBookingAction(paymentKey, orderId);
  if (!r.ok) return fail(r.message);

  // 🔑완료 화면(`/rent/done/{id}`)으로 — 방금 한 그 한 건만 보여 준다. 목록(`/rent/my`)으로 떨어뜨리면
  //   「내가 방금 한 게 뭐지」가 안 잡힌다(09-14). id를 못 받은 경우(이론상 없음)만 목록으로.
  return NextResponse.redirect(new URL(r.bookingId ? `/rent/done/${r.bookingId}` : "/rent/my", req.url));
}
