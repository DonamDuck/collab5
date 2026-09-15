import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBooking, getSpaceFull, isRevealed, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId, getProfileById } from "@/lib/profiles";
import { ContactBlock } from "../../ContactBlock";
import { bookingWhen, InfoPanel, InfoRow, primaryBtnCls, secondaryBtnCls, won } from "../../ui";

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
  // 확정·완료 어느 쪽이든 열리는 화면이라 탭 제목은 중립으로 둔다(본문 제목이 상태를 말한다).
  title: "예약 내역 — collab5",
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

  // 🔁09-15 대표 — *「예약을 완료했어요」*·*「예약이 확정됐어요!」*. 「신청했어요」는 우리가 받은 일을 말하고
  //   「예약을 완료했어요」는 «그분이 해낸 일»을 말한다. 끝나는 화면에서 주어는 손님이어야 한다.
  // 🎉이모지는 제목 «오른쪽»에(대표: *「타이틀 우측이나 좀 뭐 재밌게」*). 왼쪽에 두면 글머리표처럼 읽혀서
  //   제목이 목록의 한 줄로 내려앉는다. 오른쪽은 문장이 끝난 뒤라 축하가 된다.
  //   ⚠️`aria-hidden` — 화면 낭독기가 「파티 크래커」를 읽으면 제목이 길어지기만 한다.
  const title = open ? "예약이 확정됐어요" : b.status === "paid" ? "예약을 완료했어요" : "이 신청은 끝났어요";
  const emoji = open ? "🎉" : b.status === "paid" ? "✨" : "";
  const spaceName = brief?.name ?? "공간";

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
          <InfoRow label="장소" value={<span className="font-medium text-ink">{spaceName}</span>} />
          <InfoRow label="일정" value={bookingWhen(b)} />
          <InfoRow
            label="결제 금액"
            value={
              <>
                <span className="font-medium text-ink">{won(b.amountTotal)}</span>
                {(b.amountChat > 0 || b.amountMentor > 0) && <span className="text-mute"> · 커피챗 포함</span>}
              </>
            }
          />
        </InfoPanel>
      </div>

      {open ? (
        <>
          {b.hostMessage && (
            <p className="mt-6 text-[16px] leading-relaxed break-keep text-body">사장님 말씀 · {b.hostMessage}</p>
          )}
          <ContactBlock
            who="사장님"
            title="가게 정보"
            profile={host}
            address={space?.address}
            accessNote={space?.accessNote}
            shopPhone={space?.contactPhone}
            accessHow={space?.accessHow}
          />
        </>
      ) : b.status === "paid" ? (
        // 📌09-15 대표가 문안까지 주셨다. 맞춤법만 손봤다 — 「~거에요」는 「~거예요」가 맞고,
        //   「1~2일 내」·「3~5일 내」는 「~일 안에」로 풀었다(우리 말투는 한자 조사를 안 쓴다).
        <section className="mt-8 border-t border-hairline pt-7">
          <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">예약 안내 사항</h2>
          <ul className="mt-4 space-y-3">
            {[
              "사장님께서 신청을 확인하신 뒤 개인 연락처로 연락해 주실 거예요. 이틀 안에 연락이 없으면 사장님 전화번호를 신청 내역에서 확인하실 수 있어요.",
              "신청이 거절되면 사흘에서 닷새 안에 환불이 끝나요.",
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
      ) : (
        <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
          자세한 상태는 내 하루 가게에서 보실 수 있어요.
        </p>
      )}

      {/* 🔻09-15 대표 — 버튼 둘을 나란히 두지 않는다. 「신청 내역 보기」가 지금 할 일이고
          「다른 공간도 둘러보기」는 그 다음에 «혹시» 할 일이라 무게가 다르다.
          ⏳「신청 내역 보기」는 아직 `/rent/my`로 간다. 전용 페이지는 백로그(B80). */}
      <div className="mt-9">
        <Link href="/rent/my" className={`${primaryBtnCls} h-[48px] w-full`}>
          신청 내역 보기
        </Link>
        <Link href="/rent" className={`${secondaryBtnCls} mt-2 h-[48px] w-full`}>
          다른 공간도 둘러보기
        </Link>
      </div>
    </main>
  );
}
