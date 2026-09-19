import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBooking, getPaymentByOrderId, getSpaceFull, guestSeesHost, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId, getProfileById } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { ContactBlock } from "../../ContactBlock";
import { KAKAO_CHAT_URL } from "@/lib/site";
import { bookingFinished, bookingStarted } from "@/lib/rent-time";
import { BOOKING_HEADLINE, COFFEE_CHAT_WHEN_GUEST, CONTACT_RULE_GUEST, CONTACT_RULE_GUEST_DONE, PRODUCT_LABEL, REFUND_TIMING_LINE } from "@/lib/rent-copy";
import { bookingHasChat } from "@/lib/rent-products";
import type { BookingStatus } from "@/lib/types";
import { GuestCancel } from "../../my/Actions";
import { bookingWhen, InfoPanel, InfoRow, primaryBtnCls, secondaryBtnCls, won } from "../../ui";

// 하루 가게 — 신청 완료 화면 (2026-09-14)
//
// 결제창에서 돌아온 사람이 처음 보는 화면이다. 전엔 `/rent/my`로 떨어졌는데, 거기는 목록이라 「내가 방금
// 한 게 뭐지」가 한눈에 안 잡혔다. 여기는 그 한 건만 보여 준다.
//
// 🚨**로그인 + 그 예약의 손님 본인만.** 주소가 `/rent/done/4`라 숫자를 바꿔 남의 것을 볼 수 있는 구조다.
//   남의 것이면 404 — 「있는데 못 본다」보다 「없다」가 새는 정보가 적다.
// 🔑연락처·주소는 `guestSeesHost`가 참일 때만 읽는다. 화면에서 가리는 게 아니라 «읽지를 않는다».
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  // 확정·완료 어느 쪽이든 열리는 화면이라 탭 제목은 중립으로 둔다(본문 제목이 상태를 말한다).
  title: "내 예약 — collab5",
  robots: { index: false },
};

/** 📛제목 — 결제 완료·확정은 `BOOKING_HEADLINE`(대표 09-17). 나머지는 이 화면에서만 쓰는 상태 문장이다.
 *  🩸09-16까지 만료·취소·거절이 전부 「이 신청은 끝났어요」 하나였다. 왜 끝났는지가 제목에 없었다.
 *  ⭐결제 전에 끝난 건 「신청」, 결제 뒤는 「예약」(대표 09-17 낱말 규칙). */
const TITLE: Record<BookingStatus, string> = {
  pending: "결제가 안 끝난 신청이에요",
  paid: BOOKING_HEADLINE.guestPaid,
  confirmed: BOOKING_HEADLINE.guestConfirmed,
  done: "다녀온 하루 가게예요",
  rejected: "사장님이 이번엔 어렵대요",
  refunded: "돈을 돌려드린 예약이에요",
  cancelled: "취소한 예약이에요",
  expired: "결제 시간이 지난 신청이에요",
};

export default async function RentDonePage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const uid = await getSessionUserId();
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/done/${id}`)}`);

  const b = await getBooking(id);
  if (!b || b.guestUserId !== uid) notFound();
  // 결제창만 열고 안 낸 자리는 「완료」가 아니다. 보낸 신청 목록으로 보내 상태를 그대로 보게 한다.
  if (b.status === "pending") redirect("/rent/requests");

  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  // 👀09-16 phase 1 — 결제를 마치면 사장님 연락처가 바로 열린다(`guestSeesHost`). 원본(주소·안내)도 그때 읽는다.
  const open = guestSeesHost(b);
  const space = open && brief ? await getSpaceFull(brief.slug) : null;
  const host = open && brief ? await getProfileById(brief.ownerUserId) : null;
  // 📎사장님이 「내 소개서 보여주기」를 켠 공간이면 소개서 링크도 같이 연다(대표 09-16).
  const maker = space?.brandSlug ? await repo.getMakerBySlug(space.brandSlug) : null;
  const hostBrand = maker && space ? { name: maker.name, slug: space.brandSlug } : null;

  // 🔁09-15 대표 — *「예약을 완료했어요」*·*「예약이 확정됐어요!」*. 「신청했어요」는 우리가 받은 일을 말하고
  //   「예약을 완료했어요」는 «그분이 해낸 일»을 말한다. 끝나는 화면에서 주어는 손님이어야 한다.
  // 🎉이모지는 제목 «오른쪽»에(대표: *「타이틀 우측이나 좀 뭐 재밌게」*). 왼쪽에 두면 글머리표처럼 읽혀서
  //   제목이 목록의 한 줄로 내려앉는다. 오른쪽은 문장이 끝난 뒤라 축하가 된다.
  //   ⚠️`aria-hidden` — 화면 낭독기가 「파티 크래커」를 읽으면 제목이 길어지기만 한다.
  // 🔁09-17 제목은 위 `TITLE`로(대표: 상태 이름에 하루 가게 맥락). 이모지 자리 규칙은 그대로다.
  const title = TITLE[b.status];
  const emoji = b.status === "paid" ? "✨" : b.status === "confirmed" ? "🎉" : "";
  const spaceName = brief?.name ?? "공간";
  // ☕09-19 무료 커피챗(값 0)까지 보는 한 벌.
  const withChat = bookingHasChat(b);
  // 💸09-17 QA — 만료된 신청에도 「결제 금액 80,000원」이 서서 「내가 8만원을 냈나?」로 읽혔다.
  //   돈 줄은 상태가 정한다: 안 냈으면 «낸 돈 없음», 돌려준 게 있으면 «돌려드린 돈». 돌려준 돈은 토스가 알려 준
  //   남은 돈(`balanceAmount`)에서 거꾸로 낸다 — 우리가 비율로 다시 계산하지 않는다.
  const moneyBack = b.status === "cancelled" || b.status === "refunded" || b.status === "rejected";
  const pay = moneyBack ? await getPaymentByOrderId(b.orderId) : null;
  const refunded = pay ? Math.max(0, pay.amount - pay.balanceAmount) : null;
  // 💸09-18 밤 QA(G-07) — 거절됐는데 환불이 아직 안 끝난 예약이 **「돌려드린 돈 0원」**만 보여 줬다.
  //   손님은 그 화면을 「한 푼도 못 받는다」로 읽는다. 거절은 규정상 전액이라(상세 §환불 규정) 아직 안 돈 건
  //   «돌려드릴 돈»으로 부르고 처리 중이라는 것을 같이 말한다.
  //   ⚠️취소(`cancelled`)엔 이 처리를 안 한다 — 당일 취소는 0원이 «정답»이라 「돌려드릴 돈 0원」이 거짓말이 된다.
  const refundPending = b.status === "rejected" && (refunded === null || refunded === 0);

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
      <h1 className="flex items-center gap-2 text-[22px] font-bold leading-tight tracking-tight text-ink">
        {title}
        {emoji && (
          <span aria-hidden="true" className="text-[20px]">
            {emoji}
          </span>
        )}
      </h1>

      {/* 📋신청 확인 팝업·결제 화면과 «같은» 항목 문법이다. 여기까지 세 화면에서 같은 것을 세 번 보게 되는데,
          그게 번거로움이 아니라 확인이다 — 셋이 다르게 생기면 대조가 안 된다. */}
      <div className="mt-6">
        <InfoPanel>
          {/* 🔗09-17 QA — 장소 이름이 글자뿐이라 유의 사항·사진을 다시 보러 갈 수 없었다. */}
          <InfoRow
            label="장소"
            value={
              brief ? (
                <Link href={`/rent/${brief.slug}`} className="font-medium text-ink underline underline-offset-2">
                  {spaceName}
                </Link>
              ) : (
                <span className="font-medium text-ink">{spaceName}</span>
              )
            }
          />
          {/* 🛍09-18 고른 상품. 확인 팝업·결제 화면과 같은 줄 순서(장소 → 상품 → 일정). */}
          <InfoRow label="상품" value={PRODUCT_LABEL[b.product]} />
          <InfoRow label="일정" value={bookingWhen(b)} />
          {b.status === "expired" ? (
            <InfoRow label="결제" value="결제하지 않아서 낸 돈은 없어요" />
          ) : (
            <InfoRow
              label="결제 금액"
              value={
                <>
                  <span className="font-medium text-ink">{won(b.amountTotal)}</span>
                  {withChat && <span className="text-mute"> · 커피챗 포함</span>}
                </>
              }
            />
          )}
          {moneyBack && (
            <InfoRow
              label={refundPending ? "돌려드릴 돈" : "돌려드린 돈"}
              value={
                refundPending ? (
                  <>
                    <span className="font-medium text-ink">{won(b.amountTotal)}</span>
                    <span className="block text-[15px] text-mute">지금 돌려드리는 중이에요</span>
                  </>
                ) : refunded === null ? (
                  <span className="text-mute">내 예약에서 확인해 주세요</span>
                ) : (
                  <span className="font-medium text-ink">{won(refunded)}</span>
                )
              }
            />
          )}
        </InfoPanel>
      </div>

      {open ? (
        <>
          {/* 🔁09-18 밤 QA(G-25) — 이 절을 결제 완료(`paid`)에만 그려서 상태마다 말이 어긋났다.
              ①확정(`confirmed`)엔 연락 기한도 커피챗 조율 안내도 아예 없었다(4만원짜리 옵션을 산 손님이 언제 하는지 못 봤다).
              ②이용이 끝난 예약엔 「연락처를 아래에 적어 두었어요」가 서 있는데 바로 아래 연락처는 가려져 있었다.
              ⭐그래서 조건을 «살아 있고 아직 안 끝난 예약»으로 넓히고, 줄은 상태가 고르게 한다. */}
          {(b.status === "paid" || b.status === "confirmed") && !bookingFinished(b) && (
            <section className="mt-8 border-t border-hairline pt-7">
              <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">예약 안내 사항</h2>
              <ul className="mt-4 space-y-3">
                {[
                  // ⏱09-17 대표 — 확정 뒤 2일 안 연락 규칙. 이미 수락된 건은 조건형(「확정하면」) 대신 지난 일로 말한다.
                  b.status === "confirmed" ? CONTACT_RULE_GUEST_DONE : CONTACT_RULE_GUEST,
                  // 🆕09-19 오후 대표 — 수락 전 취소는 전액(`CancelStage`). 수락을 기다리는 동안만 참인 말이라 그때만 선다.
                  ...(b.status === "paid" ? ["사장님이 아직 수락하기 전이라, 지금 취소하시면 날짜와 상관없이 전액 돌려드려요."] : []),
                  // 💳09-18 환불 시점은 메일과 한 줄(`REFUND_TIMING_LINE`). 약관 제10조의 「3~5영업일」에 맞췄다.
                  `사장님 사정으로 어려워지면 전액 돌려드려요. ${REFUND_TIMING_LINE}`,
                  // ☕09-17 커피챗을 담았으면 «언제»를 여기서도 말한다. 문장은 한 벌(`rent-copy`)이다.
                  ...(withChat ? [COFFEE_CHAT_WHEN_GUEST] : []),
                  // 🔁09-18 대표 코멘트 — 연락처 안내는 맨 마지막으로. 바로 아래 가게 정보로 이어진다.
                  "사장님 연락처를 아래에 적어 두었어요. 이용 전에 궁금한 게 있으면 편하게 연락해 보세요.",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-[16px] leading-relaxed break-keep text-body">
                    <span aria-hidden="true" className="text-mute">
                      ·
                    </span>
                    <span className="min-w-0 flex-1">{t}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ContactBlock
            who="사장님"
            title="가게 정보"
            profile={host}
            address={space?.address}
            accessNote={space?.accessNote}
            shopPhone={space?.contactPhone}
            accessHow={space?.accessHow}
            brand={hostBrand}
            // 🙈이용일이 지난 예약은 연락처를 가린다(대표 09-16)
            masked={b.status === "done" || bookingFinished(b)}
          />
        </>
      ) : (
        b.status === "expired" && (
          <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
            결제 시간이 지나 사장님께 전달되지 않았어요.
          </p>
        )
      )}

      {/* 💳09-18 밤 QA(G-25) — 취소·환불된 예약엔 «언제 돈이 들어오는지»가 어디에도 없었다.
          거절은 위 「돌려드릴 돈」 줄이 처리 중임을 말하니 여기선 시점만 한 줄 더한다. 문장은 메일과 같은 한 벌이다. */}
      {moneyBack && (
        <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">{REFUND_TIMING_LINE}</p>
      )}

      {/* 사장님 말씀은 거절한 건에도 붙을 수 있어서(이번엔 어려운 이유) 열림 여부와 따로 둔다.
          🏷09-18 밤 QA(G-25) — 관리자가 처리한 환불(손님·사장님이 전화로 신청한 건)에도 이 줄이 「사장님 말씀」으로 섰다.
          그 말은 수락하실 때 남기신 것이라, 환불 이야기를 하는 것처럼 읽혔다. 언제 남긴 말인지를 라벨이 말한다. */}
      {b.hostMessage && (
        <p className="mt-6 text-[16px] leading-relaxed break-keep text-body">
          {b.refundRequestedAt && (b.status === "refunded" || b.status === "cancelled")
            ? "수락하실 때 사장님이 남기신 말"
            : "사장님 말씀"}{" "}
          · {b.hostMessage}
        </p>
      )}

      {/* ✉️09-17 QA — 확정 메일의 「예약 내용 보기」가 이 화면으로 오는데 취소 버튼이 없었다. 「그날 못 가는데」 싶은
          손님이 목록을 찾아 헤맸다. 목록 줄과 같은 조건·같은 버튼(`GuestCancel`)을 쓴다 — 조건이 두 벌이면 갈라진다. */}
      {(b.status === "paid" || b.status === "confirmed") && !bookingStarted(b) && (
        <div className="mt-6">
          <GuestCancel bookingId={b.id} />
        </div>
      )}

      {/* 🔻09-15 대표 — 버튼 둘을 나란히 두지 않는다. 「신청 내역 보기」가 지금 할 일이고
          「다른 공간도 둘러보기」는 그 다음에 «혹시» 할 일이라 무게가 다르다.
          🔗09-16 「신청 내역 보기」는 손님 전용 `/rent/requests`로 간다(B81). 전엔 사장님 화면인 `/rent/my`로
          가서, 손님이 자기 신청을 찾으려면 공간·받은 신청 두 덩이를 지나야 했다.
          🔁09-19 대표 [F] — 이름을 「내 예약」 한 벌로(「일단은 내 예약으로 하자」). 메뉴 바·메일·목록 제목이 같은 이름이다. */}
      <div className="mt-9">
        <Link href="/rent/requests" className={`${primaryBtnCls} h-[48px] w-full`}>
          내 예약 보기
        </Link>
        <Link href="/rent" className={`${secondaryBtnCls} mt-2 h-[48px] w-full`}>
          다른 공간도 둘러보기
        </Link>
        {/* 💬09-16 phase 1 — 버튼 무게를 늘리지 않으려고 글자 링크로 둔다. 할 일은 위 두 버튼이고 이건 «막혔을 때». */}
        <p className="mt-5 text-center text-[15px] leading-relaxed break-keep text-mute">
          {/* 🔁09-18 대표 코멘트 — 「collab5에 궁금 사항이 있으신가요? 문의하기(밑줄)」 */}
          collab5에 궁금한 사항이 있으신가요?{" "}
          <a href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer" className="text-body underline underline-offset-2">
            문의하기
          </a>
        </p>
      </div>
    </main>
  );
}
