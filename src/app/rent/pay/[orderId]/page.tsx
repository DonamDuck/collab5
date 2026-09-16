import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getBookingByOrderId, getSpaceFull, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId } from "@/lib/profiles";
import { GRACE_MINUTES, guestCancelRefundRate } from "@/lib/rent-payment";
import { kstDaysUntil } from "@/lib/rent-time";
import { bookingWhen, dateLabel, won } from "../../ui";
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

/** `YYYY-MM-DD`에서 n일 뺀 날. UTC 자정끼리 계산해 시간대가 끼어들지 않는다(`kstDaysUntil`과 같은 방식). */
function minusDays(iso: string, n: number): string {
  const d = new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - n * 86_400_000);
  return d.toISOString().slice(0, 10);
}

/** 💸**이 예약 기준** 취소 규정 한 줄 (09-17 QA).
 *  결제 직전에 망설이게 하는 건 「취소하면 얼마 돌아오나」인데, 규정표를 읽고 날짜를 셈하는 건 손님 몫이었다.
 *  ⭐비율은 `guestCancelRefundRate`에 날짜를 하나씩 넣어 «물어서» 얻는다. 구간표(7·3·1일)를 여기 다시 적지 않는다 —
 *    표가 바뀌는 날 이 문장만 뒤처진다(상세 「환불 규정」 절 주석과 같은 규율).
 *  지금 구간이 언제까지 이어지는지 찾고, 그 날짜와 다음 구간을 말한다. */
function cancelRuleLine(useDate: string): string {
  const pct = (r: number) => (r >= 1 ? "전액" : `${Math.round(r * 100)}%`);
  const days = kstDaysUntil(useDate);
  const now = guestCancelRefundRate(days);
  let d = days;
  while (d > 0 && guestCancelRefundRate(d - 1) === now) d -= 1;
  const until = dateLabel(minusDays(useDate, d));
  const next = d > 0 ? guestCancelRefundRate(d - 1) : null;
  const graceHours = GRACE_MINUTES / 60;
  if (now >= 1) {
    return next === null || next === now
      ? `${until}까지 취소하면 전액 돌려드려요.`
      : `${until}까지 취소하면 전액 돌려드리고, 그 뒤엔 ${next > 0 ? `${pct(next)}로 줄어요` : "돌려드릴 수 없어요"}.`;
  }
  const grace = `결제하고 ${graceHours}시간 안에 취소하면 전액이에요.`;
  if (now === 0) return `${grace} 그 뒤엔 오늘 쓰는 예약이라 돌려드릴 수 없어요.`;
  return `${grace} 그 뒤엔 ${until}까지 ${pct(now)}를 돌려드려요.`;
}

export default async function RentPayPage({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;

  const uid = await getSessionUserId();
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/pay/${orderId}`)}`);

  const b = await getBookingByOrderId(orderId);
  // 남의 주문이면 404. 「있는데 못 본다」보다 「없다」가 새는 정보가 적다(`/rent/done`과 같은 규칙).
  if (!b || b.guestUserId !== uid) notFound();
  // ⏳결제 시간이 지난 신청은 결제 화면을 다시 열지 않는다 — 토스 결제가 이미 EXPIRED라 눌러도 막힌다.
  if (b.status === "expired") redirect("/rent/requests");
  if (b.status !== "pending") redirect(`/rent/done/${b.id}`);

  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  if (!brief) notFound();

  // 💸09-17 QA — 금액 내역. 합계만 있으면 「왜 이 값인가」를 손님이 셈한다. 커피챗 분은 공간의 지금 값이다
  //   (예약 행엔 분이 안 남는다). ☕`amountMentor`는 옛 칸 — 둘 다 본다.
  const chat = b.amountChat || b.amountMentor;
  const chatMinutes = chat > 0 ? (await getSpaceFull(brief.slug))?.coffeeChatMinutes ?? 0 : 0;
  const hours = b.hoursCount % 1 === 0 ? b.hoursCount : b.hoursCount.toFixed(1);
  const breakdown = [
    b.amountSpace > 0 ? `대여 ${b.hoursCount > 0 ? `${hours}시간 ` : ""}${won(b.amountSpace)}` : "",
    chat > 0 ? `커피챗 ${chatMinutes > 0 ? `${chatMinutes}분 ` : ""}${won(chat)}` : "",
  ].filter(Boolean).join(" + ");

  // 📐09-15 위 여백을 줄였다(대표: 「결제 위에 마진이 너무 넓다」). 겸사겸사 **결제창이 화면에 들어올
  //   자리를 번다** — 이 창은 카드를 고르면 700px 가까이 자라는데, 위가 무거우면 화면 밖으로 밀려나고
  //   그 상태에서 창 «안»이 안 눌린다(09-15 실측). 아래 여백은 그대로 둔다.
  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-6 pb-14 sm:px-6">
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
        scheduleLabel={bookingWhen(b)}
        amountLabel={won(b.amountTotal)}
        breakdown={breakdown}
        cancelLine={cancelRuleLine(b.useDate)}
      />
    </main>
  );
}
