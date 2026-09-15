import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBookingByOrderId, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId } from "@/lib/profiles";
import { dateLabel, won } from "../../ui";
import { PayPanel } from "./PayPanel";

// 하루 가게 — 결제 화면 (2026-09-15)
//
// 대표 09-15: *「지금 결제 페이지는 별도 페이지로 구성해서 뒤로가기 버튼도 있는 페이지로 만들어야 할 거 같아.
// 결제 하려다가 날짜를 수정한다든지 등으로 뒤로 돌아오는 경우 있을 수 있음」*
//
// 🔻전엔 같은 화면에서 폼이 «사라지고» 결제 위젯이 그 자리에 들어왔다. 주소가 그대로라 브라우저 뒤로가기는
//   공간 상세가 아니라 **하루 가게 목록으로 나가 버렸고**, 고치러 돌아올 길이 화면 안 글자 링크 하나뿐이었다.
//   ⭐주소가 바뀌지 않는 단계 이동은 사용자가 아는 「뒤로」와 어긋난다. 단계가 화면을 갈아치울 만큼 크면 주소도 바뀌어야 한다.
//
// 🚨**로그인 + 그 주문의 본인 + 아직 «pending»인 것만.** 주문번호가 주소에 드러나니 문을 셋 다 잠근다.
//   이미 낸 주문(`paid` 이상)을 이 화면으로 열면 두 번 내게 된다 — 그건 완료 화면으로 보낸다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "결제 — collab5",
  robots: { index: false },
};

export default async function RentPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const uid = await getSessionUserId();
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/pay/${orderId}`)}`);

  const b = await getBookingByOrderId(orderId);
  // 남의 주문이면 404. 「있는데 못 본다」보다 「없다」가 새는 정보가 적다(`/rent/done`과 같은 규칙).
  if (!b || b.guestUserId !== uid) notFound();
  if (b.status !== "pending") redirect(`/rent/done/${b.id}`);

  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  if (!brief) notFound();

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
      <PayPanel
        orderId={b.orderId}
        amount={b.amountTotal}
        orderName={`${brief.name} · ${dateLabel(b.useDate)}`}
        backHref={`/rent/${brief.slug}`}
        placeLabel={brief.name}
        scheduleLabel={`${dateLabel(b.useDate)}${b.hours ? ` · ${b.hours}` : ""}`}
        amountLabel={won(b.amountTotal)}
        withMentor={b.amountMentor > 0}
      />
    </main>
  );
}
