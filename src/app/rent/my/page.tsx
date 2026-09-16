import type { Metadata } from "next";
import Link from "next/link";
import { sweepBookings, listSpacesByOwner, listBookingsForHost, isRevealed } from "@/lib/spaces";
import { getSessionUserId, getProfileById, type Profile } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import type { Space } from "@/lib/types";
import { isRentAdmin } from "@/lib/rent-actions";
import { HostDecide, PauseToggle, PublishButton, RefundRequest } from "./Actions";
import { PayoutAccount } from "./PayoutAccount";
import { getPayoutAccount, toMasked } from "@/lib/payout-accounts";
import { ContactBlock } from "../ContactBlock";
import { bookingFinished, bookingStarted } from "@/lib/rent-time";
import type { SpaceBooking } from "@/lib/types";
import { ClearQuery } from "./ClearQuery";
import { GuestBookingRow, loadGuestBookings } from "../GuestBookingRow";
import { BookingBadge, ListRow as Row, SpaceBadge, bookingWhen, primaryBtnCls, won } from "../ui";

// 하루 가게 — 내 공간 · 들어온 요청 · 내가 빌린 공간 (2026-09-13)
//
// 🔁09-17 대표 결정 4 — 사장님 쪽에 들어온 것은 «요청», 수락한 뒤가 «예약»이다. 손님 쪽은 결제 전 «신청», 결제 뒤 «예약».
//   09-16까지 절 제목 「받은 신청」·배지 「새 신청이에요」·메일 「예약이 들어왔어요」가 한 건을 세 이름으로 불렀다.
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
  description: "내가 올린 공간과 들어온 요청, 내가 빌린 공간을 한곳에서 봐요.",
  alternates: { canonical: "/rent/my" },
};

const emptyCls = "mt-5 text-[15px] leading-relaxed break-keep text-faint";
const h2Cls = "text-[21px] font-bold leading-snug tracking-tight text-ink";

// 연락처 블록은 `../ContactBlock`(09-14) — `/rent/done`과 같은 얼굴이어야 해서 밖으로 뺐다.
//   ⚠️여기 오기 전에 호출부가 `isRevealed`로 거른다. 블록은 그 판정을 다시 하지 않는다.

// 줄(`Row`)과 잠긴 안내(`Locked`)는 `../ui`로 올렸다(09-16). 보낸 신청 줄이 `/rent/requests`와 같이 쓴다.

/** 📋들어온 요청의 순서 — **답할 것 → 다가오는 예약 → 나머지**(09-17 QA).
 *  🩸09-16까지 `created_at` 최신순이라 답해야 할 새 요청이 취소 세 건 아래 네 번째에 있었다.
 *  사장님이 이 절을 여는 첫 질문은 「답할 게 있나」, 두 번째는 「다음에 누가 오나」다.
 *  ⚠️읽기(`listBookingsForHost`)는 그대로 두고 화면에서 가른다 — 시간 판정(`bookingStarted`·`bookingFinished`)이
 *    «지금»에 달려 있어서 DB 정렬로는 못 한다. */
function hostOrder(list: SpaceBooking[]): SpaceBooking[] {
  const at = (b: SpaceBooking) => `${b.useDate} ${b.startTime || "00:00"}`;
  const rank = (b: SpaceBooking) =>
    b.status === "paid" && !bookingStarted(b) ? 0 : (b.status === "paid" || b.status === "confirmed") && !bookingFinished(b) ? 1 : 2;
  return [...list].sort((a, b) => {
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    // 답할 것·다가오는 것은 가까운 날부터, 지난 것은 최근 것부터.
    return rank(a) === 2 ? (at(a) < at(b) ? 1 : at(a) > at(b) ? -1 : 0) : at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : 0;
  });
}

/** 💬저장 뒤 한 줄(`?saved=`) — `SpaceForm`이 상황을 골라 실어 보낸다(09-17 QA: 말없이 목록으로 떨어졌다). */
const SAVED_LINE: Record<string, string> = {
  new: "올리셨어요. 읽어 본 뒤 목록에 열어 드릴게요.",
  review: "매장 이름이나 주소가 바뀌어서 한 번 더 읽어 볼게요. 그동안 목록에서 잠시 빠져요.",
  pending: "고치신 것까지 같이 읽어 볼게요. 끝나면 목록에 열어 드려요.",
  ok: "고친 내용이 공간 화면에 바로 보여요.",
  kept: "저장해 뒀어요.",
};

export default async function MyRentPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; did?: string; b?: string }>;
}) {
  const { saved, did, b: didBooking } = await searchParams;
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
  await sweepBookings();

  // 보낸 신청은 줄과 함께 `loadGuestBookings`가 읽는다 — `/rent/requests`와 같은 한 벌(09-16).
  const [me, mySpaces, hostBookingsRaw, guestBookings] = await Promise.all([
    getProfileById(uid),
    listSpacesByOwner(uid),
    listBookingsForHost(uid),
    loadGuestBookings(uid),
  ]);
  void me;
  const hostBookings = hostOrder(hostBookingsRaw);
  const admin = await isRentAdmin();
  // 🏦정산 받을 계좌(09-17). 🔒원문은 여기서 바로 마스킹본으로 줄인다 — 화면 컴포넌트로 번호 원문이 안 넘어간다.
  //   공간이 없는 분에겐 읽지도 않는다(절 자체가 안 뜬다).
  const payoutRaw = mySpaces.length > 0 ? await getPayoutAccount(uid) : null;
  const payoutAccount = payoutRaw ? toMasked(payoutRaw) : null;

  const spaceById = new Map<number, Space>(mySpaces.map((sp) => [sp.id, sp]));
  // 🔑연락처 조회는 **열린 예약 것만** 한다. 전부 미리 읽어 두고 화면에서 가리는 방식은,
  //   서버 컴포넌트라 HTML에 안 실리긴 하지만 「가리기」가 판정을 대신하게 만든다.
  //   그러다 한 번 쓰는 자리가 늘면 그때 새어 나간다.
  // 📎손님이 신청하며 고른 소개서(대표 09-16: 사장님이 볼 수 있게). 이름만 한 번에 읽어 둔다.
  const guestBrands = new Map<string, string>();
  await Promise.all(
    Array.from(new Set(hostBookings.map((b) => b.guestBrandSlug).filter(Boolean))).map(async (slug) => {
      const m = await repo.getMakerBySlug(slug);
      if (m) guestBrands.set(slug, m.name);
    }),
  );

  const contactIds = new Set<number>();
  //   보낸 신청 쪽 사장님 연락처는 `loadGuestBookings`가 같은 규칙으로 따로 읽는다.
  for (const b of hostBookings) if (isRevealed(b)) contactIds.add(b.guestUserId);
  const contacts = new Map<number, Profile | null>(
    await Promise.all(
      Array.from(contactIds).map(
        async (id) => [id, await getProfileById(id)] as [number, Profile | null],
      ),
    ),
  );

  // 👤수락 «전»에 보이는 손님 정보 — 이름과 「전화번호가 있나」 둘뿐(09-17 QA).
  //   🩸09-16까지 수락 근거가 손님이 쓴 한 줄뿐이었다. 열쇠를 넘기는 사장님이 누군지 모르는 사람을 수락했다.
  //   🔑연락처 규칙은 그대로다 — 번호·이메일 «값»은 여기 담지 않는다. 읽자마자 이름과 참/거짓으로 줄여서,
  //     전체 프로필이 이 화면 변수에 머물지 않게 한다(위 `contacts`가 «열린 예약 것만» 읽는 것과 같은 규율).
  //   ⚠️손님 전화 필수화(09-17 대표 결정 2)는 신청 폼 쪽 일이다. 그 전 예약엔 번호가 없을 수 있다.
  const lockedGuestIds = new Set<number>();
  for (const b of hostBookings) if (!isRevealed(b) && b.status === "paid") lockedGuestIds.add(b.guestUserId);
  const guestBriefs = new Map<number, { name: string; hasPhone: boolean }>(
    await Promise.all(
      Array.from(lockedGuestIds).map(async (id) => {
        const p = await getProfileById(id);
        return [id, { name: p?.brandName?.trim() ?? "", hasPhone: !!p?.phone?.trim() }] as [
          number,
          { name: string; hasPhone: boolean },
        ];
      }),
    ),
  );
  const savedLine = saved ? SAVED_LINE[saved] ?? "" : "";
  const didId = Number(didBooking) || 0;

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      {/* 한 번 뜬 알림 표시(`saved`·`did`)를 주소에서 지운다. key로 새로 달아야 같은 화면 안의 두 번째 알림에서도 돈다. */}
      {(saved || did) && <ClearQuery key={`${saved ?? ""}-${did ?? ""}-${didBooking ?? ""}`} />}
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

      {savedLine && (
        <p role="status" className="mt-6 rounded-lg bg-surface-soft px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
          {savedLine}
        </p>
      )}

      {/* ── ① 내가 올린 공간 ── */}
      <section className="mt-12">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className={h2Cls}>내가 올린 공간</h2>
          <Link href="/rent/new" className="shrink-0 py-[12px] text-[15px] text-mute underline underline-offset-2">
            새로 올리기
          </Link>
        </div>
        {mySpaces.length === 0 ? (
          <p className={emptyCls}>아직 올리신 공간이 없어요. 몇 시간만 비어도 괜찮아요.</p>
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
                {/* ⏸잠시 쉬기 / 다시 열기(09-17). 검토 대기·작성 중엔 안 뜬다 — 서버도 open↔paused만 받는다. */}
                {(sp.status === "open" || sp.status === "paused") && (
                  <PauseToggle slug={sp.slug} paused={sp.status === "paused"} />
                )}
              </Row>
            ))}
          </ul>
        )}
      </section>

      {/* ── ①' 정산 받을 계좌 (09-17) ── 공간을 올린 분에게만. 🔗메일·확정 줄이 `#payout-account`로 곧장 내려온다. */}
      {mySpaces.length > 0 && (
        <section id="payout-account" className="mt-12 scroll-mt-20">
          <h2 className={h2Cls}>정산 받을 계좌</h2>
          <PayoutAccount initial={payoutAccount} />
        </section>
      )}

      {/* ── ② 들어온 요청 ── */}
      <section className="mt-12">
        <h2 className={h2Cls}>들어온 요청</h2>
        {hostBookings.length === 0 ? (
          <p className={emptyCls}>아직 들어온 요청이 없어요.</p>
        ) : (
          <ul className="mt-5">
            {hostBookings.map((b) => {
              const sp = spaceById.get(b.spaceId);
              const open = isRevealed(b);
              const brief = guestBriefs.get(b.guestUserId);
              // 💬방금 누른 수락·거절의 결과 한 줄(`HostDecide`가 `?did=&b=`로 실어 온다). 거절은 환불 성패를 상태로 읽는다.
              const didLine =
                didId === b.id
                  ? did === "accept" && open
                    ? "수락했어요. 아래에 손님 연락처가 열렸어요."
                    : did === "reject" && b.status === "refunded"
                      ? "거절했어요. 손님께 전액 돌려드렸어요."
                      : did === "reject" && b.status === "rejected"
                        ? "거절했어요. 환불이 늦어지고 있어 저희가 확인하고 있어요."
                        : ""
                  : "";
              return (
                <Row
                  key={b.id}
                  head={
                    <>
                      <p className="truncate text-[17px] font-medium text-ink">{sp?.name ?? "내 공간"}</p>
                      {/* 375px에서 「커/피챗」처럼 낱말 중간이 꺾였다(09-17 QA) — break-keep. */}
                      <p className="mt-1 text-[15px] break-keep text-mute">
                        {bookingWhen(b)}
                        {b.headcount ? ` · ${b.headcount}명` : ""}
                        {/* ☕🩸09-16까지 사장님 쪽엔 커피챗 표시가 없었다. 손님 화면 네 곳엔 「커피챗 포함」이 뜨는데
                            정작 커피챗을 해 줄 사람이 모르는 상태였다. 옛 예약은 옛 칸에만 값이 있어 둘 다 본다. */}
                        {b.amountChat > 0 || b.amountMentor > 0 ? " · 커피챗 신청" : ""}
                      </p>
                    </>
                  }
                  status={<BookingBadge status={b.status} viewer="host" />}
                >
                  {/* ⭐신청자가 쓴 「그날 무엇을」 — 사장님이 수락을 정하는 근거라 이 줄에서 제일 크게 읽힌다. */}
                  <p className="mt-3 whitespace-pre-line text-[16px] leading-relaxed break-keep text-body">
                    {b.plan}
                  </p>
                  {/* 📎손님이 고른 소개서 — 어떤 브랜드가 오는지 사장님이 미리 볼 수 있게(대표 09-16). */}
                  {b.guestBrandSlug && guestBrands.get(b.guestBrandSlug) && (
                    <p className="mt-2 text-[15px] text-mute">
                      소개서{" "}
                      <Link href={`/m/${b.guestBrandSlug}`} className="text-body underline underline-offset-2">
                        {guestBrands.get(b.guestBrandSlug)}
                      </Link>
                    </p>
                  )}
                  {/* 👤수락 전 손님 정보 — 이름과 전화번호가 있는지만(09-17 QA). 번호 «값»은 수락 뒤 연락처 블록이 연다. */}
                  {brief && !open && (
                    <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
                      손님 <span className="text-body">{brief.name || "이름을 안 적으셨어요"}</span>
                      {" · "}
                      {brief.hasPhone || b.guestPhone ? "전화번호를 남기셨어요" : "전화번호가 없어 이메일로 연락하셔야 해요"}
                    </p>
                  )}
                  {/* 받는 금액을 적는다. 낸 금액만 보이면 정산 때 「이만큼 들어올 줄 알았는데」가 된다.
                      💸09-17 QA — 거절·환불·취소 줄에도 「받으실 돈」이 그대로 떠 있었다. 받을 돈이 아닌 줄은 무슨 돈인지 바꿔 적고 흐리게.
                      ⚠️손님 취소는 날에 따라 일부가 남아 정산될 수 있어(약관 제8조) 금액을 단정하지 않는다. */}
                  <p className="mt-2 text-[15px] text-mute">
                    {b.status === "refunded" ? (
                      <span className="text-faint">손님께 전액 돌려드렸어요 · {won(b.amountTotal)}</span>
                    ) : b.status === "rejected" ? (
                      <span className="text-faint">돌려드릴 돈 {won(b.amountTotal)} · 저희가 환불을 챙기고 있어요</span>
                    ) : b.status === "cancelled" ? (
                      <span className="text-faint">손님 취소 · 낸 돈 {won(b.amountTotal)}</span>
                    ) : (
                      <>
                        받으실 돈 {won(b.amountPayout)}
                        <span className="text-faint"> · 손님이 낸 돈 {won(b.amountTotal)}</span>
                      </>
                    )}
                  </p>

                  {/* ⏯이용 시간이 시작하면 수락·거절 버튼을 거둔다(서버도 막는다). 결제 완료는 phase 1에서 곧 예약 완료다. */}
                  {b.status === "paid" && !bookingStarted(b) && (
                    <HostDecide bookingId={b.id} amountTotal={b.amountTotal} />
                  )}
                  {/* 🙋관리자에게 환불 신청(대표 09-16) — 수락해 확정한 예약에서만. 수락 전(결제 완료)엔 거절이 곧 전액 환불이라
                      관리자를 거칠 일이 없다. 단 수락 안 한 채 이용 시간이 시작되면 거절이 막히니 그때는 신청으로 연다.
                      신청이 들어가 있으면 버튼 대신 상태 한 줄. */}
                  {(b.status === "confirmed" || (b.status === "paid" && bookingStarted(b))) &&
                    (b.refundRequestedAt ? (
                      <p className="mt-3 text-[15px] leading-relaxed break-keep text-lemon-on">
                        환불 신청을 받았어요. 사장님과 손님께 전화로 확인한 뒤 처리해 드릴게요.
                      </p>
                    ) : (
                      <RefundRequest bookingId={b.id} />
                    ))}

                  {/* 🏦수락한 예약인데 계좌가 없으면 한 줄(09-17). 이용일이 지나도 보낼 곳이 없다. 날짜 약속은 안 한다. */}
                  {!payoutAccount && (b.status === "confirmed" || b.status === "done") && (
                    <p className="mt-2 text-[15px] leading-relaxed break-keep text-lemon-on">
                      <Link href="#payout-account" className="underline underline-offset-2">
                        정산 받을 계좌를 등록해 주세요
                      </Link>
                    </p>
                  )}

                  {didLine && (
                    <p role="status" className="mt-3 text-[15px] leading-relaxed break-keep text-mint-on">
                      {didLine}
                    </p>
                  )}

                  {open ? (
                    // 🎨09-17 QA — 연락처 블록이 `section` + 위 구분선 + 19px 제목이라 **다음 절처럼** 떠 보였다.
                    //   블록(`ContactBlock`)은 `/rent/done`과 같이 쓰는 파일이라 안 고치고, 이 줄 안에서만 옷을 줄인다:
                    //   옅은 판 안으로 넣고 구분선·위 여백을 지우고 제목을 본문 크기로. 자식 선택자라 이 자리에만 먹는다.
                    <div className="mt-4 rounded-lg bg-surface-soft px-4 py-3 [&>section]:mt-0 [&>section]:border-t-0 [&>section]:pt-0 [&_h2]:text-[16px] [&_h2]:font-medium">
                      <ContactBlock
                        who="손님"
                        // 🩸09-16까지 제목을 안 넘겨서 기본값 「가게 정보」가 떴다. 사장님이 보는 건 손님 정보다.
                        title="손님 연락처"
                        // ☎️신청 때 받은 번호가 프로필 번호보다 먼저다(09-17). 옛 예약은 프로필 번호로.
                        profile={withBookingPhone(contacts.get(b.guestUserId) ?? null, b.guestPhone)}
                        // 🙈이용일이 지난 예약은 가린다 — 손님 쪽(`GuestBookingRow`)과 같은 규칙(09-17 QA 🔴).
                        //   09-16까지 사장님 화면만 안 넘겨서, 다녀간 뒤에도 손님 번호·메일이 계속 열려 있었다.
                        masked={b.status === "done" || bookingFinished(b)}
                      />
                    </div>
                  ) : null}
                  {/* 🔻09-17 QA — 「수락하시면 신청하신 분의 연락처가 열려요」 줄 삭제. 바로 위 버튼 「수락하고 연락처 열기」가 같은 말이었다. */}

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

      {/* ── ③ 내가 빌린 공간 ── */}
      {/* 🔗09-16 손님 전용 화면(`/rent/requests`, B81)이 생겼다. 이 절은 남긴다 — 사장님이면서 남의 공간을
          빌리는 분도 있어서, 여기서 통째로 빼면 그분은 두 화면을 오가야 한다. 옆에 건너가는 글자 링크만 둔다. */}
      {/* 🔻09-17 QA — 빈 상태면 절을 통째로 접는다. 사장님 화면 맨 아래에 손님용 빈 절이 늘 붙어 있었다.
          남의 공간을 빌린 적이 생기면 그때 나타난다. */}
      {guestBookings.length > 0 && (
        <section className="mt-12">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={h2Cls}>내가 빌린 공간</h2>
            <Link href="/rent/requests" className="shrink-0 py-[12px] text-[15px] text-mute underline underline-offset-2">
              따로 모아 보기
            </Link>
          </div>
          <ul className="mt-5">
            {guestBookings.map((v) => (
              <GuestBookingRow key={v.booking.id} view={v} />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}

/** 예약에 적힌 손님 번호를 프로필 번호 자리에 얹는다. 둘 다 없으면 프로필 그대로(블록이 「번호를 안 남기셨어요」라고 말한다). */
function withBookingPhone(p: Profile | null, bookingPhone: string): Profile | null {
  const phone = bookingPhone?.trim();
  if (!phone) return p;
  return p ? { ...p, phone } : p;
}
