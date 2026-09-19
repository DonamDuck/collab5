import { NextResponse, type NextRequest } from "next/server";
import { confirmBookingAction } from "@/lib/rent-actions";

// 하루 팝업 — 토스 결제창이 돌아오는 자리 (2026-09-13)
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

  // 🔒09-18 밤 QA(SEC-06) — 실패 화면엔 «글»이 아니라 «코드»를 넘긴다. 실패 화면이 주소의 글을 그대로 보여 주던 때는
  //   누구나 우리 화면에 문장을 띄우는 링크를 만들 수 있었다. 이제 그 화면은 코드로 우리 문장을 고른다.
  //   주문번호는 「다시 결제하기」 링크에 쓴다(실패 화면이 모양을 다시 본다). 이유 글은 서버 로그에만 남긴다.
  const fail = (code: string | undefined, why: string) => {
    if (why) console.warn(`[rent/pay/success] 결제 실패 order=${orderId} code=${code ?? "-"}: ${why}`);
    const q = new URLSearchParams();
    if (code) q.set("code", code);
    if (orderId) q.set("orderId", orderId);
    const qs = q.toString();
    return NextResponse.redirect(new URL(`/rent/pay/fail${qs ? `?${qs}` : ""}`, req.url));
  };

  if (!orderId) return fail(undefined, "주문 번호 없음");

  const r = await confirmBookingAction(paymentKey, orderId);
  if (!r.ok) return fail(r.code, r.message);

  // 🔑완료 화면(`/rent/done/{id}`)으로 — 방금 한 그 한 건만 보여 준다. 목록(`/rent/my`)으로 떨어뜨리면
  //   「내가 방금 한 게 뭐지」가 안 잡힌다(09-14). id를 못 받은 경우(이론상 없음)만 목록으로.
  return NextResponse.redirect(new URL(r.bookingId ? `/rent/done/${r.bookingId}` : "/rent/requests", req.url));
}
