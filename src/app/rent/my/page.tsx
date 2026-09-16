import type { Metadata } from "next";
import Link from "next/link";
import {
  markFinishedBookings,
  listSpacesByOwner,
  listBookingsForHost,
  listBookingsForGuest,
  isRevealed,
  listSpacesByIds,
  getSpaceFull,
  type SpaceBrief,
} from "@/lib/spaces";
import { getSessionUserId, getProfileById, type Profile } from "@/lib/profiles";
import type { Space, SpaceBooking } from "@/lib/types";
import { isRentAdmin } from "@/lib/rent-actions";
import { HostDecide, GuestCancel, PublishButton } from "./Actions";
import { ContactBlock } from "../ContactBlock";
import { bookingStarted } from "@/lib/rent-time";
import { BookingBadge, SpaceBadge, bookingWhen, primaryBtnCls, won } from "../ui";

// 하루 가게 — 내 공간 · 받은 신청 · 보낸 신청 (2026-09-13)
//
// 🚨**이 화면이 주소와 연락처가 열리는 «유일한» 자리다.** 목록·상세는 확정 전 화면이라 동네까지만
//   보여준다(설계 §이탈). 여기서도 문은 하나뿐이다 — `isRevealed(booking)`.
//   ⚠️`booking.status === "confirmed"`라고 직접 적지 마라. `done`(그날이 지난 예약)도 열려 있어야 하고,
//     조건을 손으로 옮겨 적으면 상태가 하나 늘 때 이 화면만 조용히 뒤처진다.
//
// 🎨09-13 재작업 — 항목을 박스가 아니라 **줄**로(디자인-시스템 §카드 어휘: 읽는 목록은 구분선).
//   왼쪽 글(이름 17 medium · 메타 15 mute), 오른쪽 상태 글자 15px(색만). 상태 배지 pill·회색 안내 상자·
//   민트 연락처 상자를 전부 뺐다 — 세 섹션이 다 카드면 화면이 서류철이 된다.
//   빈 상태도 `EmptyState` 대신 15px 한 줄. 아톰 마크 셋이 세로로 서면 무겁다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 하루 가게 — collab5",
  // 로그인해야 보이는 화면이라 검색 결과에 뜰 일이 없다. 설명은 짧게.
  description: "내가 올린 공간과 주고받은 신청을 한곳에서 봐요.",
  alternates: { canonical: "/rent/my" },
};

const emptyCls = "mt-5 text-[15px] leading-relaxed break-keep text-faint";
const h2Cls = "text-[21px] font-bold leading-snug tracking-tight text-ink";

// 연락처 블록은 `../ContactBlock`(09-14) — `/rent/done`과 같은 얼굴이어야 해서 밖으로 뺐다.
//   ⚠️여기 오기 전에 호출부가 `isRevealed`로 거른다. 블록은 그 판정을 다시 하지 않는다.

/** 아직 안 열린 연락처 — 회색 상자 대신 한 줄. */
function Locked({ text }: { text: string }) {
  return <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">{text}</p>;
}

/** 읽는 목록의 한 줄 — 위 구분선 + 왼쪽 글 + 오른쪽 상태. 마지막 줄은 아래 구분선도 갖는다. */
function Row({
  head,
  status,
  children,
}: {
  head: React.ReactNode;
  status: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <li className="border-t border-hairline py-5 last:border-b">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{head}</div>
        {status}
      </div>
      {children}
    </li>
  );
}

export default async function MyRentPage() {
  const uid = await getSessionUserId();
  if (!uid) {
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 하루 가게</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          올리신 공간과 주고받은 신청을 보시려면 로그인해 주세요.
        </p>
        <Link href={`/login?redirect=${encodeURIComponent("/rent/my")}`} className={`${primaryBtnCls} mt-8 h-[48px]`}>
          로그인
        </Link>
      </main>
    );
  }

  // ⏹읽기 «전에» 끝난 확정 예약을 「다녀왔어요」로 넘긴다(09-16). 뒤에서 넘기면 이번 화면엔 옛 상태가 나간다.
  //   크론 대신 이 화면이 열릴 때 한다 — 끝난 예약은 누군가 볼 때 넘어가면 충분하고, 두 번 불려도 같은 결과다.
  await markFinishedBookings();

  const [me, mySpaces, hostBookings, guestBookings] = await Promise.all([
    getProfileById(uid),
    listSpacesByOwner(uid),
    listBookingsForHost(uid),
    listBookingsForGuest(uid),
  ]);
  void me;
  const admin = await isRentAdmin();

  const spaceById = new Map<number, Space>(mySpaces.map((sp) => [sp.id, sp]));
  // 내가 «빌린» 곳은 남의 공간이라 `listSpacesByOwner`에 없다. id로 따로 읽는다(`listSpacesByIds` 주석 참조).
  const bookedSpaces = await listSpacesByIds(guestBookings.map((b) => b.spaceId));
  // 「들어오는 법」·가게 전화·이용 안내는 요약본에 없다(주소와 같은 급의 비밀).
  //   확정된 예약의 공간만 원본을 한 번 더 읽는다.
  type Reveal = { accessNote: string; contactPhone: string; accessHow: Space["accessHow"] };
  const revealed = new Map<number, Reveal>(
    await Promise.all(
      guestBookings
        .filter((b) => isRevealed(b) && bookedSpaces.has(b.spaceId))
        .map(async (b) => {
          const full = await getSpaceFull(bookedSpaces.get(b.spaceId)!.slug);
          return [
            b.spaceId,
            {
              accessNote: full?.accessNote ?? "",
              contactPhone: full?.contactPhone ?? "",
              accessHow: full?.accessHow ?? "sms",
            },
          ] as [number, Reveal];
        }),
    ),
  );

  // 🔑연락처 조회는 **열린 예약 것만** 한다. 전부 미리 읽어 두고 화면에서 가리는 방식은,
  //   서버 컴포넌트라 HTML에 안 실리긴 하지만 「가리기」가 판정을 대신하게 만든다.
  //   그러다 한 번 쓰는 자리가 늘면 그때 새어 나간다.
  const contactIds = new Set<number>();
  for (const b of hostBookings) if (isRevealed(b)) contactIds.add(b.guestUserId);
  for (const b of guestBookings) {
    if (!isRevealed(b)) continue;
    const sp = bookedSpaces.get(b.spaceId);
    if (sp) contactIds.add(sp.ownerUserId);
  }
  const contacts = new Map<number, Profile | null>(
    await Promise.all(
      Array.from(contactIds).map(
        async (id) => [id, await getProfileById(id)] as [number, Profile | null],
      ),
    ),
  );

  // ☕09-16 커피챗으로 이름이 바뀌면서 칸도 바뀌었다(`amountMentor` → `amountChat`).
  //   옛 예약은 옛 칸에만 값이 있어서 둘 다 본다. 말은 확인 팝업·상세와 같은 「커피챗」으로 맞췄다.
  const money = (b: SpaceBooking) =>
    `${won(b.amountTotal)}${b.amountChat > 0 || b.amountMentor > 0 ? " · 커피챗 포함" : ""}`;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <header>
        <Link href="/rent" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
          ← 하루 가게
        </Link>
        <h1 className="mt-3 text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 하루 가게</h1>
        {/* 🏦대표만 보인다. 판정은 `isRentAdmin` 한 벌이고, 정산 화면도 같은 판정으로 다시 막는다. */}
        {admin && (
          <Link href="/rent/payouts" className="mt-2 inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
            정산하기
          </Link>
        )}
      </header>

      {/* ── ① 내가 올린 공간 ── */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={h2Cls}>내가 올린 공간</h2>
          <Link href="/rent/new" className="shrink-0 py-[12px] text-[15px] text-mute underline underline-offset-2">
            새로 올리기
          </Link>
        </div>
        {mySpaces.length === 0 ? (
          <p className={emptyCls}>아직 올리신 공간이 없어요. 쉬는 날 하루만 내주셔도 돼요.</p>
        ) : (
          <ul className="mt-5">
            {mySpaces.map((sp) => (
              <Row
                key={sp.id}
                head={
                  <>
                    <Link
                      href={`/rent/${sp.slug}`}
                      className="block truncate text-[17px] font-medium text-ink underline-offset-4 hover:underline"
                    >
                      {sp.name}
                    </Link>
                    {/* 🩸09-16까지 이 줄이 옛 칸(`priceDay`·`openDates`)을 읽고 있었다. 시간 단위로 바뀐 뒤
                        저장한 공간은 그 칸이 비어서 **「0원 · 비는 날 0일」**로 보였다. 자기 공간을 보는
                        화면에서 값이 0원이면 사장님은 안 올라간 줄 안다. */}
                    <p className="mt-1 text-[15px] text-mute">
                      {sp.area || "동네 미정"} · 시간당 {won(sp.priceHour)} · 열어 둔 날{" "}
                      {new Set(sp.openSlots.map((sl) => sl.date)).size}일
                    </p>
                  </>
                }
                status={
                  <div className="flex shrink-0 items-center gap-3">
                    <SpaceBadge status={sp.status} />
                    {/* 고치기는 글자 링크로 — 이 줄에서 누르는 것은 이름(보기)과 이것뿐이라 버튼 얼굴이 필요 없다. */}
                    <Link
                      href={`/rent/${sp.slug}/edit`}
                      className="py-[12px] text-[15px] text-mute underline underline-offset-2"
                    >
                      고치기
                    </Link>
                  </div>
                }
              >
                {/* 대표에게만 보이는 손잡이. 남의 등록을 세상에 내보내는 판정이라 화면에도 문을 둔다. */}
                {admin && sp.status === "pending" && <PublishButton slug={sp.slug} />}
              </Row>
            ))}
          </ul>
        )}
      </section>

      {/* ── ② 받은 신청 ── */}
      <section className="mt-12">
        <h2 className={h2Cls}>받은 신청</h2>
        {hostBookings.length === 0 ? (
          <p className={emptyCls}>아직 들어온 신청이 없어요.</p>
        ) : (
          <ul className="mt-5">
            {hostBookings.map((b) => {
              const sp = spaceById.get(b.spaceId);
              const open = isRevealed(b);
              return (
                <Row
                  key={b.id}
                  head={
                    <>
                      <p className="truncate text-[17px] font-medium text-ink">{sp?.name ?? "내 공간"}</p>
                      <p className="mt-1 text-[15px] text-mute">
                        {bookingWhen(b)}
                        {b.headcount ? ` · ${b.headcount}명` : ""}
                      </p>
                    </>
                  }
                  status={<BookingBadge status={b.status} />}
                >
                  {/* ⭐신청자가 쓴 「그날 무엇을」 — 사장님이 수락을 정하는 근거라 이 줄에서 제일 크게 읽힌다. */}
                  <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed break-keep text-body">
                    {b.plan}
                  </p>
                  {/* 받는 금액을 적는다. 낸 금액만 보이면 정산 때 「이만큼 들어올 줄 알았는데」가 된다. */}
                  <p className="mt-2 text-[15px] text-mute">
                    받으실 돈 {won(b.amountPayout)}
                    <span className="text-faint"> · 신청자가 낸 돈 {won(b.amountTotal)}</span>
                  </p>

                  {b.status === "paid" && (
                    <HostDecide bookingId={b.id} amountTotal={b.amountTotal} started={bookingStarted(b)} />
                  )}

                  {open ? (
                    <ContactBlock who="신청하신 분" profile={contacts.get(b.guestUserId) ?? null} />
                  ) : b.status === "paid" ? (
                    <Locked text="수락하시면 신청하신 분의 연락처가 열려요." />
                  ) : null}

                  {b.hostMessage && (
                    <p className="mt-2 text-[15px] leading-relaxed break-keep text-faint">
                      남기신 말 · {b.hostMessage}
                    </p>
                  )}
                </Row>
              );
            })}
          </ul>
        )}
      </section>

      {/* ── ③ 내가 보낸 신청 ── */}
      <section className="mt-12">
        <h2 className={h2Cls}>내가 보낸 신청</h2>
        {guestBookings.length === 0 ? (
          <p className={emptyCls}>
            아직 신청하신 곳이 없어요.{" "}
            <Link href="/rent" className="underline underline-offset-2">
              빌릴 곳 둘러보기
            </Link>
          </p>
        ) : (
          <ul className="mt-5">
            {guestBookings.map((b) => {
              const sp: SpaceBrief | undefined = bookedSpaces.get(b.spaceId);
              const open = isRevealed(b);
              return (
                <Row
                  key={b.id}
                  head={
                    <>
                      <p className="truncate text-[17px] font-medium text-ink">{sp?.name ?? "공간"}</p>
                      <p className="mt-1 text-[15px] text-mute">
                        {bookingWhen(b)}
                        {b.headcount ? ` · ${b.headcount}명` : ""}
                        {/* 확정 전에는 동네까지만. 상세 화면과 같은 규칙이다. */}
                        {sp?.area ? ` · ${sp.area}` : ""}
                        {` · ${money(b)}`}
                      </p>
                    </>
                  }
                  status={<BookingBadge status={b.status} />}
                >
                  {/* 🩸09-16 — `pending`에도 「사장님이 수락하면…」이 붙어 있었다. 그 신청은 **사장님에게
                      보이지도 않는다**(`listBookingsForHost`가 거른다). 기다릴 것이 없는데 기다리라고 말하고,
                      이어서 낼 길도 없어서 목록에 쌓이기만 했다. 결제 화면은 주문번호로 되돌아갈 수 있다. */}
                  {b.status === "pending" ? (
                    <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
                      아직 결제가 끝나지 않아 사장님께 전달되지 않았어요.{" "}
                      <Link href={`/rent/pay/${b.orderId}`} className="text-body underline underline-offset-2">
                        이어서 결제하기
                      </Link>
                    </p>
                  ) : open ? (
                    <ContactBlock
                      who="사장님"
                      profile={contacts.get(sp?.ownerUserId ?? -1) ?? null}
                      address={sp?.address}
                      accessNote={revealed.get(b.spaceId)?.accessNote}
                      shopPhone={revealed.get(b.spaceId)?.contactPhone}
                      accessHow={revealed.get(b.spaceId)?.accessHow}
                    />
                  ) : (
                    <Locked text="사장님이 수락하면 주소와 연락처가 열려요." />
                  )}

                  {b.hostMessage && (
                    <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">
                      사장님 말씀 · {b.hostMessage}
                    </p>
                  )}

                  {/* 🚨이미 시작한 예약엔 취소 버튼을 안 띄운다(09-16). 다 쓴 예약을 취소로 바꾸면
                      환불은 0원인데 사장님 정산에서 통째로 빠졌다. 관문은 서버 액션이고 이건 화면 쪽 짝이다. */}
                  {(b.status === "paid" || b.status === "confirmed") && !bookingStarted(b) && (
                    <GuestCancel bookingId={b.id} />
                  )}
                </Row>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
