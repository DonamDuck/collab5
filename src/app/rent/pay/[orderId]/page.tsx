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
      {/* 🛟**React 밖에 둔 구조선** (2026-09-15).
       *
       * 🩸이 화면은 «가끔» 통째로 안 살아난다. 서버가 보낸 HTML은 멀쩡히 그려지는데 브라우저에서
       *   이 페이지의 코드가 한 줄도 안 돈다 — 결제 칸이 비고 버튼이 「불러오는 중」에서 안 풀린다.
       *   에러도 없고 콘솔도 조용하다. 같은 코드가 어떤 판엔 되고 어떤 판엔 안 된다(09-15 실측,
       *   커밋을 되돌려 가며 열 번 가까이 대봤지만 **코드로는 갈리지 않았다**).
       * ⭐그래서 안전장치를 «React 안»에 두면 소용이 없다. 안 도는 게 바로 그 React다.
       *   이건 HTML에 박혀 오는 스크립트라 무슨 일이 있어도 돈다.
       * 🔁9초 뒤에 결제창이 안 떠 있으면 다시 연다. 최대 두 번까지만(고리를 막는다).
       * 🚨**같은 주소로 새로고침하면 안 살아난다** — 죽은 탭은 새로고침을 해도 계속 죽어 있다(09-15 실측).
       *   주소 뒤에 다른 값을 붙여 «다른 주소»로 열어야 살아난다. 그래서 `reload()`가 아니라
       *   `replace(경로+'?r=시각')`이다. 우리 화면은 이 값을 안 읽으니 해가 없다.
       *   그리고 `replace`라서 뒤로가기 기록에 이 시도가 안 쌓인다.
       * ⚠️운영에서는 거의 안 돈다(붙는 게 정상이라). 돌더라도 손님은 한 번 깜빡이는 것만 본다 —
       *   아무것도 못 하는 화면을 보고 있는 것보다 낫다. */}
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{var k='rent-pay-retry:'+location.pathname;var n=+(sessionStorage.getItem(k)||0);if(n>=2)return;setTimeout(function(){if(document.querySelector('#rent-pay-methods iframe'))return;sessionStorage.setItem(k,String(n+1));location.replace(location.pathname+'?r='+Date.now());},9000);}catch(e){}})();`,
        }}
      />
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
