import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getPaymentByOrderId, listPayouts, listRefundRequests, listSpacesByIds, listStuckBookings, sweepBookings,
  type SpaceBrief,
} from "@/lib/spaces";
import { getProfileById, type Profile } from "@/lib/profiles";
import { isRentAdmin } from "@/lib/rent-actions";
import type { Payment, PayoutStatus, SpaceBooking } from "@/lib/types";
import { bookingWhen, won } from "../ui";
import { PRODUCT_LABEL } from "@/lib/rent-copy";
import { RefundDecision } from "./RefundDecision";
import { listPayoutAccounts, type PayoutAccount } from "@/lib/payout-accounts";
import { bankName, HOLDER_TYPE_LABEL } from "@/lib/banks";

// 하루 가게 — 정산 (2026-09-16) · 대표만
//
// 🔁**정산은 토스 «지급대행»이다**(대표 09-16 확정, 볼트 [[결제-모듈-토스]]). 돈이 우리 계좌를 거치지 않는다.
//   처음엔 「대표가 은행에서 손으로 입금 → 여기서 표시」로 만들었는데, 그건 손님 돈이 대표 통장을
//   거치는 구조라 볼트의 결정(전자금융업 등록 불요의 이유)과 어긋났다. 그 버튼은 지웠다.
//
// 📐금액은 «결제 줄»에 굳혀 둔 값이다(`payments.payout_amount`). 환불하고 남은 돈에서 수수료를 뺀 몫이고,
//   지급을 요청하는 순간부터는 다시 계산하지 않는다(요청 뒤 환불이 나도 보낸 돈과 장부가 안 어긋난다).
//
// ⏳**실제 「지급 요청」 버튼은 아직 없다.** 토스 지급대행은 별도 계약이 필요하고, 사장님이 토스에 «셀러»로
//   등록·인증돼야 돈을 보낼 수 있다. 그때까지 이 화면은 «누구에게 얼마를 보낼지»를 정확히 쌓아 두는 장부다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "정산 — 하루 가게",
  robots: { index: false },
};

type Row = { payment: Payment; booking: SpaceBooking | null };
type SellerGroup = { sellerId: number; profile: Profile | null; rows: Row[]; account?: PayoutAccount };

/** 판매자별로 묶는다 — 지급은 사람 단위로 나간다. */
async function groupBySeller(rows: Row[]): Promise<SellerGroup[]> {
  const map = new Map<number, SellerGroup>();
  for (const r of rows) {
    const id = r.payment.sellingUserId ?? -1;
    const g = map.get(id) ?? { sellerId: id, profile: null, rows: [] };
    g.rows.push(r);
    map.set(id, g);
  }
  const groups = Array.from(map.values());
  await Promise.all(groups.map(async (g) => { g.profile = g.sellerId > 0 ? await getProfileById(g.sellerId) : null; }));
  // 🏦정산 받을 계좌(09-17). 🔒원문 계좌번호를 읽는 «유일한» 화면이다 — 이 페이지는 첫 줄에서 `isRentAdmin`으로 막힌다.
  //   돈을 보내려면 번호 전체가 필요해서 여기서만 가리지 않는다.
  const accounts = await listPayoutAccounts(groups.map((g) => g.sellerId));
  for (const g of groups) g.account = accounts.get(g.sellerId);
  return groups;
}

const sum = (rows: Row[]) => rows.reduce((x, r) => x + r.payment.payoutAmount, 0);

export default async function RentPayoutsPage() {
  // 🔒없는 척한다. 「권한이 없어요」라고 말하면 이 주소가 무엇을 하는 곳인지 알려 주는 셈이다.
  if (!(await isRentAdmin())) notFound();

  // 시간이 흘러 바뀌어야 하는 것부터 옮긴다 — 안 하면 어제 다녀온 예약이 지급 대기에 안 올라온다.
  await sweepBookings();

  const [all, stuck, refundReqs] = await Promise.all([listPayouts(), listStuckBookings(), listRefundRequests()]);
  // 🙋환불 신청 — 전화로 확인할 사람 둘의 연락처와, 실제로 돌아갈 돈(결제 줄의 남은 돈)을 같이 읽는다.
  const refundRows = await Promise.all(
    refundReqs.map(async (b) => {
      const [pay, guest] = await Promise.all([getPaymentByOrderId(b.orderId), getProfileById(b.guestUserId)]);
      return { b, amount: pay?.balanceAmount ?? b.amountTotal, guest };
    }),
  );
  const spaceIds = [
    ...refundReqs.map((b) => b.spaceId),
    ...all.map((r) => r.booking?.spaceId).filter((x): x is number => typeof x === "number"),
    ...stuck.unanswered.map((b) => b.spaceId),
    ...stuck.refundFailed.map((b) => b.spaceId),
  ];
  const spaces = await listSpacesByIds(spaceIds);

  const by = (st: PayoutStatus[]) => all.filter((r) => st.includes(r.payment.payoutStatus));
  const [waiting, inFlight, done] = await Promise.all([
    groupBySeller(by(["WAITING"])),
    groupBySeller(by(["REQUESTED", "FAILED"])),
    groupBySeller(by(["DONE"])),
  ]);
  const waitingTotal = waiting.reduce((x, g) => x + sum(g.rows), 0);

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent/my" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 내 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">정산</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          사장님께 보낼 돈이에요. 이용일이 지난 예약만 올라와요.
        </p>
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-faint">
          실제로 보내는 건 토스 지급대행으로 해요. 계약과 사장님 셀러 등록이 끝나면 여기서 바로 요청할 수 있게 붙일게요.
        </p>
      </header>

      {/* 🙋사장님의 환불 신청(대표 09-16) — 맨 위에 둔다. 손님 돈이 걸려 있고 전화가 먼저라 가장 먼저 봐야 한다. */}
      {refundRows.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">환불 신청</h2>
          <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
            사장님이 사정이 생겨 신청하셨어요. 사장님과 손님께 전화로 확인하신 뒤 처리해 주세요.
          </p>
          <ul className="mt-4">
            {await Promise.all(
              refundRows.map(async ({ b, amount, guest }) => {
                const sp = spaces.get(b.spaceId);
                const host = sp ? await getProfileById(sp.ownerUserId) : null;
                const line = (p: Profile | null) =>
                  [p?.brandName?.trim(), p?.phone?.trim(), p?.email?.trim()].filter(Boolean).join(" · ") || "연락처가 없어요";
                return (
                  <li key={b.id} className="border-b border-hairline py-4">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className="min-w-0 truncate text-[16px] font-medium text-ink">{sp?.name ?? "공간"}</p>
                      <p className="shrink-0 text-[16px] tabular-nums text-ink">{won(amount)}</p>
                    </div>
                    {/* 🛍09-18 상품 이름 — 환불 금액이 어느 상품 값에서 나왔는지 전화로 대조할 때 쓴다. */}
                    <p className="mt-0.5 text-[14px] text-mute">{PRODUCT_LABEL[b.product]} · {bookingWhen(b)}</p>
                    <dl className="mt-2 space-y-1 text-[14px] leading-relaxed">
                      <div className="flex gap-2"><dt className="w-[48px] shrink-0 text-mute">사장님</dt><dd className="min-w-0 break-all text-body">{line(host)}</dd></div>
                      <div className="flex gap-2"><dt className="w-[48px] shrink-0 text-mute">손님</dt><dd className="min-w-0 break-all text-body">{line(guest && b.guestPhone ? { ...guest, phone: b.guestPhone } : guest)}</dd></div>
                      {b.refundRequestNote && (
                        <div className="flex gap-2"><dt className="w-[48px] shrink-0 text-mute">사정</dt><dd className="min-w-0 whitespace-pre-line text-body">{b.refundRequestNote}</dd></div>
                      )}
                    </dl>
                    <RefundDecision bookingId={b.id} amount={amount} />
                  </li>
                );
              }),
            )}
          </ul>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">보낼 돈</h2>
          {waiting.length > 0 && <p className="text-[17px] font-medium tabular-nums text-ink">{won(waitingTotal)}</p>}
        </div>
        {waiting.length === 0 ? (
          <p className="mt-5 text-[15px] leading-relaxed break-keep text-faint">지금 보낼 돈은 없어요.</p>
        ) : (
          <div className="mt-5 space-y-8">
            {waiting.map((g) => <SellerBlock key={g.sellerId} group={g} spaces={spaces} />)}
          </div>
        )}
      </section>

      {inFlight.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">보내는 중</h2>
          <div className="mt-5 space-y-8">
            {inFlight.map((g) => <SellerBlock key={g.sellerId} group={g} spaces={spaces} />)}
          </div>
        </section>
      )}

      {(stuck.unanswered.length > 0 || stuck.refundFailed.length > 0) && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">손이 필요한 예약</h2>
          <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
            정산에 넣지 않았어요. 손님 돈이 묶여 있거나 돌려드려야 하는 예약이에요.
          </p>
          {stuck.unanswered.length > 0 && (
            <StuckList
              // 🔁09-17 QA — 옛 문안은 「사장님이 답을 안 하신 채 날이 지났어요 / 거절하시면 전액 환불」이었다.
              //   phase 1은 결제가 곧 예약이라 답이 없어도 다녀간 예약은 `sweepBookings`가 done으로 넘겨 정산에 올린다.
              //   그래서 여기 남는 `paid`는 «환불 신청이 걸린 채 날이 지난 것»이거나 넘기기가 실패한 것뿐이고,
              //   이용 시작 뒤엔 거절 자체가 막혀 있다(`decideBookingAction`). 목록 조건(`listStuckBookings`)은 그대로 두고 문안만 맞췄다.
              title="결제 완료 상태로 이용일이 지난 예약"
              hint="대개 위 환불 신청에 같이 걸려 있는 예약이에요. 신청 없이 여기 있으면 이용 완료로 넘어가지 못한 것이니, 사장님께 다녀가셨는지 여쭤봐 주세요."
              rows={stuck.unanswered}
              spaces={spaces}
            />
          )}
          {stuck.refundFailed.length > 0 && (
            <StuckList
              title="환불이 안 된 결제"
              hint="토스 관리자 화면에서 직접 취소해 주세요. 손님께 돌려드릴 돈이에요."
              rows={stuck.refundFailed}
              spaces={spaces}
            />
          )}
        </section>
      )}

      {done.length > 0 && (
        <section className="mt-12 border-t border-hairline pt-8">
          <h2 className="text-[21px] font-bold leading-snug tracking-tight text-ink">보낸 돈</h2>
          <div className="mt-5 space-y-8">
            {done.map((g) => <SellerBlock key={g.sellerId} group={g} spaces={spaces} />)}
          </div>
        </section>
      )}
    </main>
  );
}

function SellerBlock({ group, spaces }: { group: SellerGroup; spaces: Map<number, SpaceBrief> }) {
  const p = group.profile;
  const contact = [p?.phone?.trim(), p?.email?.trim()].filter(Boolean).join(" · ");
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 border-b border-hairline pb-3">
        <div className="min-w-0">
          <p className="truncate text-[17px] font-medium text-ink">{p?.brandName?.trim() || "이름을 안 적으셨어요"}</p>
          <p className="mt-0.5 text-[15px] break-all text-mute">{contact || "연락처가 없어요"}</p>
          <p className="mt-0.5 text-[15px] break-all text-mute">
            {group.account ? (
              <>
                {bankName(group.account.bankCode) || group.account.bankCode}{" "}
                <span className="tabular-nums text-body">{group.account.accountNumber}</span>
                {" · "}예금주 {group.account.holderName} ({HOLDER_TYPE_LABEL[group.account.holderType]}
                {group.account.businessNumber ? ` ${group.account.businessNumber}` : ""})
              </>
            ) : (
              <span className="text-lemon-on">계좌 없음</span>
            )}
          </p>
        </div>
        <p className="shrink-0 text-[17px] font-medium tabular-nums text-ink">{won(sum(group.rows))}</p>
      </div>
      <ul>
        {group.rows.map(({ payment, booking }) => (
          <li key={payment.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-body">
                {booking ? spaces.get(booking.spaceId)?.name ?? "공간" : "공간"}
              </p>
              <p className="mt-0.5 text-[14px] text-mute">
                {booking ? `${PRODUCT_LABEL[booking.product]} · ${bookingWhen(booking)}` : payment.orderId}
                {booking?.status === "cancelled" && ` · 취소하고 남은 ${won(payment.balanceAmount)}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[15px] tabular-nums text-ink">{won(payment.payoutAmount)}</p>
              <p className="text-[13px] tabular-nums text-faint">
                {payment.payoutStatus === "DONE" && payment.payoutDoneAt
                  ? `${payment.payoutDoneAt.slice(0, 10)} 보냄`
                  : payment.payoutStatus === "FAILED"
                    ? "보내지 못했어요"
                    : payment.payoutStatus === "REQUESTED"
                      ? "요청했어요"
                      : `손님 ${won(payment.amount)}`}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function StuckList({
  title,
  hint,
  rows,
  spaces,
}: {
  title: string;
  hint: string;
  rows: SpaceBooking[];
  spaces: Map<number, SpaceBrief>;
}) {
  return (
    <div className="mt-6">
      <p className="text-[16px] font-medium text-ink">{title}</p>
      <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">{hint}</p>
      <ul className="mt-3">
        {rows.map((b) => (
          <li key={b.id} className="flex items-baseline justify-between gap-3 border-b border-hairline py-3">
            <div className="min-w-0">
              <p className="truncate text-[15px] text-body">{spaces.get(b.spaceId)?.name ?? "공간"}</p>
              <p className="mt-0.5 text-[14px] text-mute">{PRODUCT_LABEL[b.product]} · {bookingWhen(b)}</p>
            </div>
            <p className="shrink-0 text-[15px] tabular-nums text-ink">{won(b.amountTotal)}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
