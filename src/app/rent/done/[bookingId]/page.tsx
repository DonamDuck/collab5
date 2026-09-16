import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getBooking, getSpaceFull, guestSeesHost, listSpacesByIds } from "@/lib/spaces";
import { getSessionUserId, getProfileById } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import { ContactBlock } from "../../ContactBlock";
import { KAKAO_CHAT_URL } from "@/lib/site";
import { bookingFinished } from "@/lib/rent-time";
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
  const title = b.status === "paid" ? "예약을 완료했어요" : open ? "예약이 확정됐어요" : "이 신청은 끝났어요";
  const emoji = b.status === "paid" ? "✨" : open ? "🎉" : "";
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
          {b.status === "paid" && (
            // 📌09-15 대표 문안을 바탕으로, 09-16 phase 1에 맞춰 첫 줄만 바꿨다.
            //   전엔 「이틀 안에 연락이 없으면 전화번호를 신청 내역에서 확인」이었는데, 이제 번호가 바로 아래에 열린다.
            <section className="mt-8 border-t border-hairline pt-7">
              <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">예약 안내 사항</h2>
              <ul className="mt-4 space-y-3">
                {[
                  "사장님 연락처를 아래에 적어 두었어요. 이용 전에 궁금한 게 있으면 편하게 연락해 보세요.",
                  "사장님 사정으로 어려워지면 전액 돌려드려요. 환불은 사흘에서 닷새 안에 끝나요.",
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
            brand={hostBrand}
            // 🙈이용일이 지난 예약은 연락처를 가린다(대표 09-16)
            masked={b.status === "done" || bookingFinished(b)}
          />
        </>
      ) : (
        <p className="mt-6 text-[15px] leading-relaxed break-keep text-mute">
          자세한 상태는 신청 내역에서 보실 수 있어요.
        </p>
      )}

      {/* 🔻09-15 대표 — 버튼 둘을 나란히 두지 않는다. 「신청 내역 보기」가 지금 할 일이고
          「다른 공간도 둘러보기」는 그 다음에 «혹시» 할 일이라 무게가 다르다.
          🔗09-16 「신청 내역 보기」는 손님 전용 `/rent/requests`로 간다(B81). 전엔 사장님 화면인 `/rent/my`로
          가서, 손님이 자기 신청을 찾으려면 공간·받은 신청 두 덩이를 지나야 했다. */}
      <div className="mt-9">
        <Link href="/rent/requests" className={`${primaryBtnCls} h-[48px] w-full`}>
          신청 내역 보기
        </Link>
        <Link href="/rent" className={`${secondaryBtnCls} mt-2 h-[48px] w-full`}>
          다른 공간도 둘러보기
        </Link>
        {/* 💬09-16 phase 1 — 버튼 무게를 늘리지 않으려고 글자 링크로 둔다. 할 일은 위 두 버튼이고 이건 «막혔을 때». */}
        <p className="mt-5 text-center text-[15px] leading-relaxed break-keep text-mute">
          궁금한 게 있으면{" "}
          <a href={KAKAO_CHAT_URL} target="_blank" rel="noreferrer" className="text-body underline underline-offset-2">
            카카오톡으로 물어봐 주세요
          </a>
        </p>
      </div>
    </main>
  );
}
