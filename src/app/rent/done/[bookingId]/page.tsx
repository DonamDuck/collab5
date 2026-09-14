import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBooking, getSpaceFull, isRevealed, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId, getProfileById } from "@/lib/profiles";
import { ContactBlock } from "../../ContactBlock";
import { dateLabel, primaryBtnCls, secondaryBtnCls, won } from "../../ui";

// 하루 가게 — 신청 완료 화면 (2026-09-14)
//
// 결제창에서 돌아온 사람이 처음 보는 화면이다. 전엔 `/rent/my`로 떨어졌는데, 거기는 목록이라 「내가 방금
// 한 게 뭐지」가 한눈에 안 잡혔다. 여기는 그 한 건만 보여 준다.
//
// 🚨**로그인 + 그 예약의 손님 본인만.** 주소가 `/rent/done/4`라 숫자를 바꿔 남의 것을 볼 수 있는 구조다.
//   남의 것이면 404 — 「있는데 못 본다」보다 「없다」가 새는 정보가 적다.
// 🔑연락처·주소는 `isRevealed`가 참일 때만 읽는다. 화면에서 가리는 게 아니라 «읽지를 않는다».
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "신청했어요 — collab5",
  robots: { index: false },
};

export default async function RentDonePage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  const id = Number(bookingId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const uid = await getSessionUserId();
  if (!uid) redirect(`/login?redirect=${encodeURIComponent(`/rent/done/${id}`)}`);

  const b = await getBooking(id);
  if (!b || b.guestUserId !== uid) notFound();
  // 결제창만 열고 안 낸 자리는 「완료」가 아니다. 목록으로 보내 상태를 그대로 보게 한다.
  if (b.status === "pending") redirect("/rent/my");

  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  const open = isRevealed(b);
  // 주소·들어오는 법이 든 원본은 확정된 뒤에만 읽는다.
  const space = open && brief ? await getSpaceFull(brief.slug) : null;
  const host = open && brief ? await getProfileById(brief.ownerUserId) : null;

  const title = open ? "확정됐어요" : b.status === "paid" ? "신청했어요" : "이 신청은 끝났어요";
  const spaceName = brief?.name ?? "공간";

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
      <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">{title}</h1>
      <p className="mt-4 text-[17px] leading-relaxed break-keep text-body">
        <span className="font-medium text-ink">{spaceName}</span> · {dateLabel(b.useDate)}
        {b.hours ? ` · ${b.hours}` : ""}
      </p>
      <p className="mt-1 text-[17px] leading-relaxed break-keep text-body">
        낸 돈 {won(b.amountTotal)}
        {b.amountMentor > 0 && <span className="text-mute"> (사장님 시간 포함)</span>}
      </p>

      {open ? (
        <>
          {b.hostMessage && (
            <p className="mt-4 text-[16px] leading-relaxed break-keep text-body">사장님 말씀 · {b.hostMessage}</p>
          )}
          <ContactBlock who="사장님" profile={host} address={space?.address} accessNote={space?.accessNote} />
        </>
      ) : b.status === "paid" ? (
        <>
          <p className="mt-5 text-[15px] leading-relaxed break-keep text-mute">
            사장님이 보통 하루 안에 답해요. 답이 오면 이메일로 알려드릴게요.
          </p>
          <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">거절되면 전액 돌려드려요.</p>
        </>
      ) : (
        <p className="mt-5 text-[15px] leading-relaxed break-keep text-mute">
          자세한 상태는 내 하루 가게에서 보실 수 있어요.
        </p>
      )}

      <div className="mt-8 flex flex-wrap gap-2">
        <Link href="/rent/my" className={`${primaryBtnCls} h-[48px]`}>
          내 하루 가게 보기
        </Link>
        <Link href="/rent" className={`${secondaryBtnCls} h-[48px]`}>
          다른 공간 보기
        </Link>
      </div>
    </main>
  );
}
