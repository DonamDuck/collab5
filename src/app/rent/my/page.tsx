import type { Metadata } from "next";
import type { ReactNode } from "react";
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
import { bookingFinished, bookingStarted, dateLabel, hoursBetween, kstDaysUntil } from "@/lib/rent-time";
import type { SpaceBooking } from "@/lib/types";
import { ClearQuery } from "./ClearQuery";
import { PlanQuote } from "./PlanQuote";
import { GuestBookingRow, loadGuestBookings } from "../GuestBookingRow";
import { StickyTabs } from "@/components/StickyTabs";
import { BookingBadge, ListRow as Row, SpaceBadge, primaryBtnCls, secondaryBtnCls, won } from "../ui";
import { PRODUCT_LABEL } from "@/lib/rent-copy";
import { productPrice, sellableProducts } from "@/lib/rent-products";
import { groupGuestBookings, groupHostBookings, hostBookingGroup, type HostBookingGroup } from "@/lib/rent-groups";

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
// 🃏09-18 들어온 요청만 다시 카드로 세웠다(대표 코멘트 #63 「텍스트 나열처럼만 보인다」). 빌린 공간 카드와 같은 틀이다. `hostRow` 머리말.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "내 하루 가게 — collab5",
  // 로그인해야 보이는 화면이라 검색 결과에 뜰 일이 없다. 설명은 짧게.
  description: "내가 올린 공간과 들어온 요청, 내가 빌린 공간을 한곳에서 봐요.",
  alternates: { canonical: "/rent/my" },
  // 🔎09-18 밤 QA SC-18 — 사람마다 다른 화면이라 색인하지 않는다. robots.txt에도 막았고, 이건 robots를 안 따르는 크롤러를 위한 두 번째 문이다.
  robots: { index: false },
};

const emptyCls = "mt-5 text-[15px] leading-relaxed break-keep text-faint";
const h2Cls = "text-[21px] font-bold leading-snug tracking-tight text-ink";
/** 들어온 요청 안의 무리 이름. 절 제목(21)보다 두 단 아래, 목록 줄 이름(17)보다 조용하게. */
const h3Cls = "mt-6 text-[15px] font-medium text-mute";

// 연락처 블록은 `../ContactBlock`(09-14) — `/rent/done`과 같은 얼굴이어야 해서 밖으로 뺐다.
//   ⚠️여기 오기 전에 호출부가 `isRevealed`로 거른다. 블록은 그 판정을 다시 하지 않는다.

// 줄(`Row`)과 잠긴 안내(`Locked`)는 `../ui`로 올렸다(09-16). 보낸 신청 줄이 `/rent/requests`와 같이 쓴다.

/** 📋들어온 요청의 순서 — **답할 것 → 다가오는 예약 → 나머지**(09-17 QA).
 *  🩸09-16까지 `created_at` 최신순이라 답해야 할 새 요청이 취소 세 건 아래 네 번째에 있었다.
 *  사장님이 이 절을 여는 첫 질문은 「답할 게 있나」, 두 번째는 「다음에 누가 오나」다.
 *  ⚠️읽기(`listBookingsForHost`)는 그대로 두고 화면에서 가른다 — 시간 판정(`bookingStarted`·`bookingFinished`)이
 *    «지금»에 달려 있어서 DB 정렬로는 못 한다.
 *  🗂순위는 무리 판정 한 벌(`lib/rent-groups`의 `hostBookingGroup`)에서 온다. `/my`의 숫자도 같은 판정을 쓴다(09-18 밤 QA SC-14). */
const HOST_RANK: Record<HostBookingGroup, number> = { answer: 0, upcoming: 1, past: 2 };

function hostOrder(list: SpaceBooking[]): SpaceBooking[] {
  const at = (b: SpaceBooking) => `${b.useDate} ${b.startTime || "00:00"}`;
  const rank = (b: SpaceBooking) => HOST_RANK[hostBookingGroup(b)];
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
  searchParams: Promise<{ saved?: string; did?: string; b?: string; tab?: string; g?: string }>;
}) {
  const { saved, did, b: didBooking, tab: tabParam, g: guestView } = await searchParams;
  const uid = await getSessionUserId();
  if (!uid) {
    // 🔗09-18 밤 QA(H-07) — 사장님 메일의 「요청 보기」를 로그아웃 상태로 누르면 복귀 주소에 `?tab=host`가 빠져서
    //   로그인 뒤 «빌린 공간» 칸이 열렸다. 요청을 보러 온 사장님이 남의 칸에 떨어진다.
    //   ⭐복귀 주소는 «지금 열려던 주소»여야 한다. 아는 값만 실어 보낸다(주소를 그대로 이어 붙이지 않는다).
    const backTab = tabParam === "host" ? "host" : tabParam === "guest" ? "guest" : "";
    const backG = ["upcoming", "past", "cancel"].includes(guestView ?? "") ? guestView : "";
    const back = backTab ? `/rent/my?tab=${backTab}${backTab === "guest" && backG ? `&g=${backG}` : ""}` : "/rent/my";
    return (
      <main className="mx-auto w-full max-w-[560px] px-4 py-14 sm:px-6">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 하루 가게</h1>
        <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
          올리신 공간과 주고받은 신청을 보시려면 로그인해 주세요.
        </p>
        <Link href={`/login?redirect=${encodeURIComponent(back)}`} className={`${primaryBtnCls} mt-8 h-[48px]`}>
          로그인
        </Link>
      </main>
    );
  }

  // ⏹읽기 «전에» 끝난 확정 예약을 「다녀왔어요」로 넘긴다(09-16). 뒤에서 넘기면 이번 화면엔 옛 상태가 나간다.
  //   크론 대신 이 화면이 열릴 때 한다 — 끝난 예약은 누군가 볼 때 넘어가면 충분하고, 두 번 불려도 같은 결과다.
  await sweepBookings();

  // 보낸 신청은 줄과 함께 `loadGuestBookings`가 읽는다 — `/rent/requests`와 같은 한 벌(09-16).
  // 🧹09-18 밤 QA SC-28 — 여기서 내 프로필(`getProfileById(uid)`)도 같이 읽었는데 쓰는 곳이 없었다. 조회 하나를 뺐다.
  const [mySpaces, hostBookingsRaw, guestBookings] = await Promise.all([
    listSpacesByOwner(uid),
    listBookingsForHost(uid),
    loadGuestBookings(uid),
  ]);
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

  // 🗂세 무리 — 정렬(`hostOrder`)·카드 색(`tone`)과 같은 판정 한 벌(`lib/rent-groups`). `/my`의 숫자 세 칸도 이걸 센다.
  const { toAnswer, upcoming, past } = groupHostBookings(hostBookings);

  // 💬09-18 밤 QA(H-08) — 수락·거절한 뒤의 결과 한 줄이 **그 카드 안**에 떴다. 답한 카드는 목록 아래쪽이라
  //   1440에서 1,832px, 지난 요청 안이면 2,824px 자리였다. 누른 사람은 화면 맨 위에 있는데 결과는 화면 밖이다.
  //   ⭐결과는 «누른 자리»가 아니라 «보고 있는 자리»에 떠야 한다. 탭 바로 아래에 두고, 그 카드로 가는 길을 같이 준다.
  //   ⚠️거절의 환불 성패는 여전히 «상태»로 읽는다(버튼이 돌려준 값이 아니라). 거절 직후 `refunded`면 환불까지 끝난 것이다.
  const didTarget = didId ? hostBookings.find((x) => x.id === didId) : undefined;
  const didLine = !didTarget
    ? ""
    : did === "accept" && isRevealed(didTarget)
      ? "수락했어요. 그 요청 카드에서 손님 연락처를 보실 수 있어요."
      : did === "reject" && didTarget.status === "refunded"
        ? "거절했어요. 손님께 전액 돌려드렸어요."
        : did === "reject" && didTarget.status === "rejected"
          ? "거절했어요. 환불이 늦어지고 있어 저희가 확인하고 있어요."
          : "";
  const openSpaces = mySpaces.filter((sp) => sp.status === "open").length;

  // 🃏09-18 대표 코멘트 #63 — 「여기 영역도 UI 조정이 필요한데 지금 그냥 텍스트 나열처럼만 보인다」.
  //   한 줄에 공간 이름·상품·날짜·인원·커피챗이 같은 크기로 이어지고, 계획·소개서·손님·돈이 같은 15px 줄로 쌓여서
  //   무엇을 먼저 봐야 하는지가 모양에 없었다. 카드 한 장을 **머리(언제·무슨 상태·얼마) / 몸(손님이 적은 계획·손님) / 발(할 일)**로 나눈다.
  //   · 왼쪽 날짜 칸 — 날짜를 카드에서 가장 크게. 세로로 훑으면 달력처럼 읽힌다.
  //     빌린 공간 카드(`GuestBookingRow`)의 64px 사진 자리와 같은 자리·크기라 두 탭이 한 집안으로 보인다.
  //   · 답해야 할 요청만 날짜 칸이 레몬 면이다(기다리는 것의 색 — 숫자 칸·탭 점과 같다). 지난 요청은 글자를 흐린다.
  //   · 받을 돈은 넓은 화면에서 오른쪽 기둥으로 뺀다. 720 칸에서 한 줄에 글만 길게 늘어서지 않게. 폰에선 날짜 옆 글 기둥 맨 아래.
  //   · 수락·거절은 카드 발에 선을 긋고 모은다. 넓은 화면은 오른쪽 정렬, 폰은 한 줄을 나눠 쓴다.
  //   ⚠️문(`isRevealed`)·버튼 조건·환불 신청 흐름은 그대로다. 바꾼 건 자리와 크기뿐이다.
  const hostRow = (b: SpaceBooking) => {
      const sp = spaceById.get(b.spaceId);
      const open = isRevealed(b);
      const brief = guestBriefs.get(b.guestUserId);
      // 무리 판정(`toAnswer`·`upcoming`·`past`)과 같은 함수. 따로 적으면 레몬 칸이 엉뚱한 무리에 선다.
      const tone: RowTone = hostBookingGroup(b);
      // 답할 수 있나 = «답을 기다려요» 무리(결제 완료·이용 시작 전). 수락·거절 버튼과 손님 한 줄이 이걸 본다.
      const answerable = tone === "answer";
      const finished = bookingFinished(b);
      const masked = b.status === "done" || finished;
      const brandName = b.guestBrandSlug ? guestBrands.get(b.guestBrandSlug) : undefined;
      const refundAskable = b.status === "confirmed" || (b.status === "paid" && bookingStarted(b));
      const needAccount = !payoutAccount && (b.status === "confirmed" || b.status === "done");
      // 👤카드 몸의 손님 한 줄 토막들. 연락처 판을 안 그리는 카드(수락 전·가려진 뒤)에만 쓴다.
      const guestBits: ReactNode[] = [];
      if (!open) {
        // 👤수락 전 손님 정보 — 이름과 전화번호가 있는지만(09-17 QA). 번호 «값»은 수락 뒤 연락처 블록이 연다.
        //   🪪09-18 대표 — 이름은 신청 때 받은 성함(실명)이 먼저다. 옛 예약은 성함이 비어 있어 프로필 브랜드명으로 물러선다.
        //   🩸09-18 밤 QA(H-29) — 이 줄을 «프로필을 읽어 둔 카드»(답할 요청)에만 그려서, 취소·거절된 요청 카드엔
        //     손님 이름이 통째로 없었다. 한 목록 안에서 이름이 보이다 말다 한다. 예약 행에 적힌 성함은 늘 있으니 그걸 먼저 쓴다.
        guestBits.push(
          <>
            손님 <span className="font-medium text-body">{b.guestName?.trim() || brief?.name || "이름을 안 남기셨어요"}</span>
          </>,
        );
        // 📞「번호를 남기셨나」는 답해야 할 때만 뜻이 있다. 취소·환불 카드에 「이메일로 연락하셔야 해요」가 붙으면 할 일로 읽힌다.
        if (answerable) {
          guestBits.push(brief?.hasPhone || b.guestPhone ? "전화번호를 남기셨어요" : "전화번호가 없어 이메일로 연락하셔야 해요");
        }
      }
      if (open && masked) {
        // 🙈다녀간 뒤 — 「-」 넷짜리 판 대신 한 줄. 문은 그대로 `masked`이고, 문장은 `ContactBlock`의 가림 문장과 같다.
        const who = withBookingContact(contacts.get(b.guestUserId) ?? null, b.guestPhone, b.guestName)?.brandName?.trim();
        if (who) guestBits.push(<>손님 <span className="font-medium text-body">{who}</span></>);
        guestBits.push("이용일이 지나 연락처는 가려 두었어요");
      }
      // 📎손님이 고른 소개서 — 어떤 브랜드가 오는지 사장님이 미리 볼 수 있게(대표 09-16). 연락처 판이 열린 카드는 판 안 「소개서」 칸으로.
      if (brandName && !(open && !masked)) {
        guestBits.push(
          <>
            소개서{" "}
            <Link href={`/m/${b.guestBrandSlug}`} className="text-body underline underline-offset-2">
              {brandName}
            </Link>
          </>,
        );
      }

      return (
        <Row
          card
          key={b.id}
          // 🔗09-18 밤 QA(H-08) — 탭 아래 결과 줄이 이 카드로 데려온다. `scroll-mt`는 헤더와 고정 탭 높이.
          id={`booking-${b.id}`}
          status={null}
          head={
            <RequestHead
              b={b}
              tone={tone}
              spaceName={sp?.name ?? "내 공간"}
              // 🙋환불 신청이 들어간 확정 예약 — 상태는 그대로 「예약 확정」이라 머리에 한 토막 더 붙인다.
              refundPending={refundAskable && !!b.refundRequestedAt}
            />
          }
        >
          {/* ⭐신청자가 쓴 「그날 무엇을」 — 사장님이 수락을 정하는 근거. 답할 카드는 세 줄, 나머지는 두 줄에서 자르고 「더 보기」. */}
          {b.plan && <PlanQuote text={b.plan} lines={tone === "answer" ? 3 : 2} quiet={tone === "past"} />}

          {guestBits.length > 0 && (
            // 375px에서 「커/피챗」처럼 낱말 중간이 꺾였다(09-17 QA) — 토막마다 줄바꿈은 `·` 사이에서만.
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
              {guestBits.map((bit, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  {bit}
                </span>
              ))}
            </p>
          )}

          {open && !masked ? (
            // 🎨09-17 QA — 연락처 블록이 `section` + 위 구분선 + 19px 제목이라 **다음 절처럼** 떠 보였다.
            //   블록(`ContactBlock`)은 `/rent/done`과 같이 쓰는 파일이라 안 고치고, 이 줄 안에서만 옷을 줄인다:
            //   옅은 판 안으로 넣고 구분선·위 여백을 지우고 제목을 본문 크기로. 자식 선택자라 이 자리에만 먹는다.
            //   📐09-18 카드 안으로 들어가며 판이 32px 좁아져 375에서 메일 주소가 「.co / m」으로 꺾였다. 라벨 칸 88 → 72(「전화번호」 네 글자 폭).
            <div className="mt-4 rounded-lg bg-surface-soft px-4 py-3 [&>section]:mt-0 [&>section]:border-t-0 [&>section]:pt-0 [&_h2]:text-[16px] [&_h2]:font-medium [&_dt]:w-[72px]">
              <ContactBlock
                who="손님"
                // 🩸09-16까지 제목을 안 넘겨서 기본값 「가게 정보」가 떴다. 사장님이 보는 건 손님 정보다.
                title="손님 연락처"
                // ☎️신청 때 받은 번호가 프로필 번호보다 먼저다(09-17). 옛 예약은 프로필 번호로.
                // 🪪이름도 신청 때 받은 성함(실명)이 먼저다(09-18). 옛 예약은 프로필 브랜드명 그대로.
                profile={withBookingContact(contacts.get(b.guestUserId) ?? null, b.guestPhone, b.guestName)}
                // 📎소개서 칸은 블록이 이미 가진 자리를 쓴다(09-18). 카드 몸에 따로 한 줄 두면 판 위아래로 손님 정보가 갈라진다.
                brand={brandName ? { name: brandName, slug: b.guestBrandSlug } : null}
                // 🙈이용일이 지난 예약은 가린다 — 손님 쪽(`GuestBookingRow`)과 같은 규칙(09-17 QA 🔴).
                //   09-16까지 사장님 화면만 안 넘겨서, 다녀간 뒤에도 손님 번호·메일이 계속 열려 있었다.
                //   ⚠️여기 오는 카드는 `masked`가 거짓인 것뿐이다. 가려진 카드는 위 한 줄로 말한다.
                masked={masked}
              />
            </div>
          ) : null}
          {/* 🔻09-17 QA — 「수락하시면 신청하신 분의 연락처가 열려요」 줄 삭제. 바로 위 버튼 「수락하고 연락처 열기」가 같은 말이었다. */}

          {b.hostMessage && (
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
              남기신 말 · {b.hostMessage}
            </p>
          )}

          {/* ⏯이용 시간이 시작하면 수락·거절 버튼을 거둔다(서버도 막는다). 결제 완료는 phase 1에서 곧 예약 완료다. */}
          {answerable && <HostDecide bookingId={b.id} amountTotal={b.amountTotal} />}
          {/* 🙋관리자에게 환불 신청(대표 09-16) — 수락해 확정한 예약에서만. 수락 전(결제 완료)엔 거절이 곧 전액 환불이라
              관리자를 거칠 일이 없다. 단 수락 안 한 채 이용 시간이 시작되면 거절이 막히니 그때는 신청으로 연다.
              신청이 들어가 있으면 버튼 대신 상태 한 줄. */}
          {refundAskable &&
            (b.refundRequestedAt ? (
              <p className="mt-3 text-[15px] leading-relaxed break-keep text-lemon-on">
                환불 신청을 받았어요. 사장님과 손님께 전화로 확인한 뒤 처리해 드릴게요.
              </p>
            ) : (
              // 글자 버튼의 터치 여백(아래 12px)이 카드 아래 여백에 겹쳐 바닥이 휑했다. 보이는 간격만 되돌린다.
              <div className="-mb-[12px]">
                <RefundRequest bookingId={b.id} />
              </div>
            ))}

          {/* 🏦수락한 예약인데 계좌가 없으면 한 줄(09-17). 이용일이 지나도 보낼 곳이 없다. 날짜 약속은 안 한다. */}
          {needAccount && (
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-lemon-on">
              <Link href="#payout-account" className="underline underline-offset-2">
                정산 받을 계좌를 등록해 주세요
              </Link>
            </p>
          )}
        </Row>
      );
    };

  // 🔁09-18 대표 코멘트 — 기본 칸은 «빌린 공간». 사장님에게 가는 링크(메일·저장 뒤·정산)는 `?tab=host`를 달고 온다.
  const tab: "host" | "guest" = tabParam === "host" ? "host" : "guest";

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      {/* 한 번 뜬 알림 표시(`saved`·`did`)를 주소에서 지운다. key로 새로 달아야 같은 화면 안의 두 번째 알림에서도 돈다. */}
      {(saved || did) && <ClearQuery key={`${saved ?? ""}-${did ?? ""}-${didBooking ?? ""}`} />}
      <header>
        {/* 🔁09-18 대표 코멘트 — 「← 하루 가게」가 제목 위 한 줄을 통째로 차지해 상단이 비어 보였다.
            앱처럼 헤더에 넣기엔 우리 헤더가 사이트 공용이라, 제목 왼쪽에 44px 화살표 하나로 붙인다(원티드·리멤버 웹의 상세 제목 줄). */}
        <div className="flex items-center gap-1">
          <Link
            href="/rent"
            aria-label="하루 가게로 돌아가기"
            className="-ml-3 flex size-[44px] shrink-0 items-center justify-center rounded-pill text-body transition-colors hover:bg-surface-soft"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-[22px]" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">내 하루 가게</h1>
        </div>
        {/* 🏦대표만 보인다. 판정은 `isRentAdmin` 한 벌이고, 정산 화면도 같은 판정으로 다시 막는다. */}
        {admin && (
          // 🧾09-18 「검토하기」 — 남이 올린 공간을 공개하는 화면(`/rent/review`). 이 화면의 [공개하기]는 내 공간에만 뜬다.
          <div className="mt-2 flex gap-5">
            <Link href="/rent/payouts" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
              정산하기
            </Link>
            <Link href="/rent/review" className="inline-block py-[12px] text-[15px] text-mute underline underline-offset-2">
              검토하기
            </Link>
          </div>
        )}
      </header>

      {savedLine && (
        <p role="status" className="mt-6 rounded-lg bg-surface-soft px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
          {savedLine}
        </p>
      )}

      {/* 🗂09-18 대표 코멘트 — 「올린 공간과 빌린 공간이 위아래로 있으니 위계가 나뉜 거 같아. 같은 위계인데 탭 방식으로(우리 잘 쓰는 플로팅)」.
          ⭐두 칸은 같은 사람의 두 얼굴이다(빌려주는 나 · 빌리는 나). 위아래로 쌓으면 아래 것이 부록처럼 읽힌다.
          탭은 주소(`?tab=`)로 나눈다 — 새로고침·뒤로 가기·메일 링크에서도 같은 칸이 열린다.
          기본 칸: 공간이나 들어온 요청이 있으면 «빌려준 공간», 빌린 것만 있으면 «빌린 공간». */}
      <StickyTabs
        className="mt-6"
        label="내 하루 가게 나누기"
        active={tab}
        items={[
          // 🔁09-18 대표 코멘트 — 「대부분 공급자보다 신청자가 많을 거라 빌린 공간이 먼저, default 왼쪽으로」.
          { key: "guest", label: "빌린 공간", href: "/rent/my?tab=guest" },
          { key: "host", label: "빌려준 공간", href: "/rent/my?tab=host", dot: toAnswer.length > 0 },
        ]}
      />

      {tab === "host" && (
        <>
      {didLine && (
        <p
          role="status"
          className="mt-4 flex flex-wrap items-baseline gap-x-2 rounded-lg bg-surface-soft px-4 py-3 text-[15px] leading-relaxed break-keep text-mint-on"
        >
          <span className="min-w-0">{didLine}</span>
          <a href={`#booking-${didId}`} className="shrink-0 text-body underline underline-offset-2">
            그 요청 보기
          </a>
        </p>
      )}
      {/* 📊09-17 디자인팀 — 숫자 세 칸. 절까지 내려가기 전에 «오늘 할 일이 있나»를 첫 화면에서 답한다(원티드·리멤버 대시보드).
          칸을 누르면 그 무리로 내려간다. 새 요청이 있을 때만 그 숫자에 레몬 글자색을 준다 — 기다리는 것의 색(`BookingBadge`)과 같다. */}
      {(mySpaces.length > 0 || hostBookings.length > 0) && (
        <nav aria-label="요약" className="mt-8 grid grid-cols-3 gap-2 sm:gap-3">
          {[
            // 🔗09-18 밤 QA(H-19) — 「다가오는 예약」을 눌러도 `#requests`(절 머리)로 가서 **새 요청 무리**가 열렸다.
            //   숫자를 누른 사람은 그 숫자가 센 무리를 보러 가는 것이다. 무리마다 이름을 달아 그리로 보낸다.
            { href: "#requests", n: toAnswer.length, label: "새 요청", hot: toAnswer.length > 0 },
            { href: "#upcoming", n: upcoming.length, label: "다가오는 예약", hot: false },
            { href: "#spaces", n: openSpaces, label: "공개 중인 공간", hot: false },
          ].map((t) => (
            <a
              key={t.label}
              href={t.href}
              className="rounded-lg border border-hairline bg-surface px-3 py-3.5 transition-colors hover:bg-surface-soft sm:px-5 sm:py-4"
            >
              <span className={`block text-[24px] font-bold leading-none tabular-nums ${t.hot ? "text-lemon-on" : "text-ink"}`}>
                {t.n}
              </span>
              <span className="mt-2 block text-[14px] leading-snug break-keep text-mute sm:text-[15px]">{t.label}</span>
            </a>
          ))}
        </nav>
      )}

      {/* ── ① 들어온 요청 ── */}
      {/* 🎨09-17 디자인팀 — 절 순서를 **요청 → 공간 → 계좌**로 뒤집었다. 이 화면을 여는 첫 질문은 「답할 게 있나」인데
          (`hostOrder` 머리말), 그 답이 공간 네 줄과 계좌 아래 세 번째 절에 있어 폰에선 두 화면을 내려가야 나왔다.
          그리고 한 목록을 **답할 것 / 다가오는 예약 / 지난 요청** 세 무리로 갈랐다. 순서만으로는 어디서 무리가 바뀌는지
          안 보여서, 새 요청 아래 취소 줄이 같은 얼굴로 이어졌다. 지난 요청은 접어 둔다. */}
      {/* 공간이 하나도 없는 분에겐 이 절을 안 그린다. 받을 수 없는 요청의 빈 상태가 「새로 올리기」보다 먼저 서게 된다. */}
      {(mySpaces.length > 0 || hostBookings.length > 0) && (
      // 📐09-18 밤 QA(H-19) — 고정 탭이 3.5rem 헤더 아래에 또 붙어 있어서, 숫자 칸을 누르면 절 제목이 그 밑에 깔렸다.
      <section id="requests" className="mt-10 scroll-mt-32">
        <h2 className={h2Cls}>들어온 요청</h2>
        {hostBookings.length === 0 ? (
          <p className={emptyCls}>아직 들어온 요청이 없어요.</p>
        ) : (
          <>
            {toAnswer.length > 0 && (
              <>
                <h3 className={h3Cls}>답을 기다려요 · {toAnswer.length}</h3>
                <ul className="mt-3">{toAnswer.map(hostRow)}</ul>
              </>
            )}
            {upcoming.length > 0 && (
              <>
                <h3 id="upcoming" className={`${h3Cls} scroll-mt-32`}>
                  다가오는 예약 · {upcoming.length}
                </h3>
                <ul className="mt-3">{upcoming.map(hostRow)}</ul>
              </>
            )}
            {past.length > 0 && (
              // 지난 것은 접는다. 열 일은 드물고, 펼쳐 두면 폰에서 이 절이 여섯 화면이 된다.
              //   방금 거절한 줄(`?did=reject`)이 여기 있으면 펼친 채로 연다 — 결과 한 줄을 봐야 한다.
              <details className="group mt-8" open={past.some((b) => b.id === didId)}>
                <summary className="flex cursor-pointer list-none items-center gap-1.5 py-[12px] text-[15px] font-medium text-mute [&::-webkit-details-marker]:hidden">
                  {/* ✍️09-18 밤 QA(H-30) — 「지난」이라기엔 이용일이 안 지난 취소·환불 건이 여기 섞인다. 끝난 요청으로. */}
                  끝난 요청 · {past.length}
                  <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="size-[16px] transition-transform group-open:rotate-180">
                    <path d="m5 7.5 5 5 5-5" />
                  </svg>
                </summary>
                <ul className="mt-3">{past.map(hostRow)}</ul>
              </details>
            )}
          </>
        )}
      </section>
      )}

      {/* ── ② 내가 올린 공간 ── */}
      <section id="spaces" className="mt-12 scroll-mt-32">
        {/* 🔁09-18 대표 코멘트 — 제목 옆 글자 링크 「새로 올리기」 대신, 목록 아래 「+ 공간 올리기」 버튼. */}
        <h2 className={h2Cls}>내가 올린 공간</h2>
        {mySpaces.length === 0 ? (
          // ⚠️대표 문안은 「1시간, 30분 단위」였는데 열리는 시간은 정시만이다(`OpenSlotsCalendar` 09-16 대표 결정). 사실에 맞춰 1시간으로.
          <p className={emptyCls}>아직 올린 공간이 없어요. 내 공간이 있다면 비는 시간을 1시간 단위로 빌려줄 수 있어요.</p>
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
                    {/* 📐09-18 밤 QA(H-23) — 375에서 「대관 / 만」·「30,000 / 원」처럼 낱말과 금액이 가운데서 꺾였고,
                        상품 값에 «시간당»이라는 말이 없어 하루 값으로 읽혔다(손님 화면엔 「/ 시간」이 붙어 있다).
                        ⭐토막마다 줄바꿈을 막고 값 뒤에 단위를 붙인다. 줄은 토막 사이 `·`에서만 바뀐다.
                        ✍️그리고 「동네 미정」을 뺐다 — 사장님이 안 적은 게 아니라 옛 공간이라 비어 있는 칸이고,
                          모르는 값은 말하지 않는 편이 낫다(업종 라벨이 같은 이유로 09-17에 빈 값을 안 그린다). */}
                    <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
                      {[
                        sp.area,
                        sellableProducts(sp)
                          .map((p) => `${PRODUCT_LABEL[p]} 시간당 ${won(productPrice(sp, p))}`)
                          .join(" · ") || `시간당 ${won(sp.priceHour)}`,
                        `열어 둔 날 ${new Set(sp.openSlots.map((sl) => sl.date)).size}일`,
                      ]
                        .filter(Boolean)
                        .map((t, i) => (
                          <span key={t}>
                            {i > 0 && " · "}
                            <span className="whitespace-nowrap">{t}</span>
                          </span>
                        ))}
                      {/* 🔁09-17 — `openSlots`는 매주 규칙을 펼친 12주치까지 센다. 규칙이 있으면 요일을 짧게 붙인다(월요일부터). */}
                      {sp.repeatWeekly.length > 0 &&
                        ` · 매주 ${[...sp.repeatWeekly].sort((a, b) => ((a.dow + 6) % 7) - ((b.dow + 6) % 7)).map((r) => "일월화수목금토"[r.dow]).join("·")} 계속 열림`}
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
                {/* 🧾09-18 국세청 기록과 달라 공개가 막힌 공간 — 사장님이 떠난 뒤에도 알 수 있게 그 줄에 한 번 더. */}
                {sp.bizCheckStatus === "mismatch" && (
                  <p className="mt-2 text-[15px] leading-relaxed break-keep text-lemon-on">
                    사업자 정보가 국세청 기록과 달라 열어 드리지 못하고 있어요.{" "}
                    {/* 👆09-18 밤 QA(H-28) — 문장 안 링크라 누를 자리가 글자 높이(18px)뿐이었다.
                        문단 흐름을 안 깨면서 위아래로 늘리려면 `inline-block` + 세로 여백이 답이다(음수 여백으로 줄 간격은 되돌린다). */}
                    <Link
                      href={`/rent/${sp.slug}/edit#f-biz`}
                      className="-my-[13px] inline-block py-[13px] underline underline-offset-2"
                    >
                      고치러 가기
                    </Link>
                  </p>
                )}
                {/* 대표에게만 보이는 손잡이. 남의 등록을 세상에 내보내는 판정이라 화면에도 문을 둔다.
                    🧾09-18 밤 QA(H-32) — 국세청 기록과 다른 공간에도 [공개하기]가 떴다. 서버(`publishSpaceAction`)는
                    막으니 새는 건 없지만, 누르면 거절 한 줄이 돌아올 뿐인 버튼이라 «되는 일»처럼 보였다.
                    바로 위 줄이 이미 「고치러 가기」로 할 일을 말한다. */}
                {admin && sp.status === "pending" && sp.bizCheckStatus !== "mismatch" && <PublishButton slug={sp.slug} />}
                {/* ⏸잠시 쉬기 / 다시 열기(09-17). 검토 대기·작성 중엔 안 뜬다 — 서버도 open↔paused만 받는다. */}
                {(sp.status === "open" || sp.status === "paused") && (
                  <PauseToggle slug={sp.slug} paused={sp.status === "paused"} />
                )}
              </Row>
            ))}
          </ul>
        )}
        <Link href="/rent/new" className={`${secondaryBtnCls} mt-5 h-[48px] w-full sm:w-auto sm:px-6`}>
          + 공간 올리기
        </Link>
      </section>

      {/* ── ①' 정산 받을 계좌 (09-17) ── 공간을 올린 분에게만. 🔗메일·확정 줄이 `#payout-account`로 곧장 내려온다. */}
      {mySpaces.length > 0 && (
        <section id="payout-account" className="mt-12 scroll-mt-32">
          <h2 className={h2Cls}>정산 받을 계좌</h2>
          <PayoutAccount initial={payoutAccount} />
        </section>
      )}

        </>
      )}

      {/* ── ③ 내가 빌린 공간 ── */}
      {/* 🔗09-16 손님 전용 화면(`/rent/requests`, B81)이 생겼다. 이 절은 남긴다 — 사장님이면서 남의 공간을
          빌리는 분도 있어서, 여기서 통째로 빼면 그분은 두 화면을 오가야 한다. 옆에 건너가는 글자 링크만 둔다. */}
      {/* 🔻09-17 QA — 빈 상태면 절을 통째로 접는다. 사장님 화면 맨 아래에 손님용 빈 절이 늘 붙어 있었다.
          남의 공간을 빌린 적이 생기면 그때 나타난다. */}
      {tab === "guest" && (
        <section className="mt-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className={h2Cls}>내가 빌린 공간</h2>
            <Link href="/rent/requests" className="shrink-0 py-[12px] text-[15px] text-mute underline underline-offset-2">
              따로 모아 보기
            </Link>
          </div>
          {guestBookings.length === 0 ? (
            <p className="mt-5 text-[16px] leading-relaxed break-keep text-mute">
              아직 빌린 공간이 없어요.{" "}
              <Link href="/rent" className="text-body underline underline-offset-2">
                빌릴 곳 둘러보기
              </Link>
            </p>
          ) : (
            <>
              {/* 🏷09-18 대표 코멘트 — 「여기 미니탭이 있어야 할 것 같아. 예약 완료, 예약 취소, 지난 예약 정도」.
                  나누는 기준:
                    · 예약 완료 = 결제 완료·확정이고 이용이 안 끝남 + 결제 전인데 날짜가 안 지난 신청(이어서 결제할 수 있다)
                    · 지난 예약 = 다녀옴, 또는 결제 완료·확정인데 이용이 끝남
                    · 취소·환불 = 손님 취소·사장님 거절·환불, 그리고 결제 안 한 채 끝난 신청(만료·날짜 지난 결제 전)
                  칩은 주소(`?g=`)로 나눠 새로고침해도 같은 칸이다. 기본은 «예약 완료». */}
              {(() => {
                // 나누는 판정은 `lib/rent-groups`의 `groupGuestBookings` 한 벌 — `/my`의 「빌린 예약」 숫자가 «예약 완료» 칸을 센다.
                const { upcoming: upcomingG, past: pastG, cancel: cancelG } = groupGuestBookings(guestBookings, (v) => v.booking);
                const views = [
                  { key: "upcoming", label: "예약 완료", list: upcomingG, empty: "다가오는 예약이 없어요." },
                  { key: "past", label: "지난 예약", list: pastG, empty: "다녀온 예약이 아직 없어요." },
                  { key: "cancel", label: "취소·환불", list: cancelG, empty: "취소하거나 돌려받은 예약이 없어요." },
                ] as const;
                const cur = views.find((x) => x.key === guestView) ?? views[0];
                return (
                  <>
                    <div className="mt-4 flex flex-wrap gap-2" role="tablist" aria-label="빌린 공간 나누기">
                      {views.map((x) => {
                        const on = x.key === cur.key;
                        return (
                          <Link
                            key={x.key}
                            href={`/rent/my?tab=guest&g=${x.key}`}
                            scroll={false}
                            role="tab"
                            aria-selected={on}
                            // 👆09-18 밤 QA(G-22) — 36px 칩이라 손끝 하한에 못 미쳤다. 보이는 칩은 그대로 두고 위아래 4px씩 넓힌다.
                            className={`relative inline-flex h-[36px] items-center gap-1 rounded-pill px-4 text-[14px] font-medium transition-colors after:absolute after:-inset-y-1 after:content-[''] ${
                              on ? "bg-ink text-surface" : "bg-surface-soft text-body hover:bg-surface-faint"
                            }`}
                          >
                            {x.label}
                            <span className={`tabular-nums ${on ? "text-surface/70" : "text-faint"}`}>{x.list.length}</span>
                          </Link>
                        );
                      })}
                    </div>
                    {cur.list.length === 0 ? (
                      <p className="mt-5 text-[15px] leading-relaxed break-keep text-mute">{cur.empty}</p>
                    ) : (
                      <ul className="mt-4">
                        {cur.list.map((v) => (
                          <GuestBookingRow key={v.booking.id} view={v} />
                        ))}
                      </ul>
                    )}
                  </>
                );
              })()}
            </>
          )}
        </section>
      )}
    </main>
  );
}

// ─── 들어온 요청 카드의 머리 (09-18 대표 코멘트 #63) ───

/** 카드가 어느 무리에 서나 — 답할 것 / 다가오는 예약 / 지난 요청. 모양(레몬 칸·흐린 글자)이 이걸로 갈린다.
 *  무리 이름은 판정 한 벌(`lib/rent-groups`)의 것을 그대로 쓴다. */
type RowTone = HostBookingGroup;

/** 이용일까지 남은 날 한 토막. 답할 카드와 다가오는 카드에만 붙인다(지난 카드는 날짜 칸이 이미 말한다).
 *  ⭐오늘·내일은 레몬 글자 — 답할 시간이 곧 닫힌다는 뜻이라 날짜 칸을 읽기 전에 눈에 걸려야 한다.
 *  ⚠️날 수는 `kstDaysUntil`(달력 날짜 차이)로만 센다. 시각까지 따지는 판정은 `bookingStarted`의 몫이다. */
function dayTag(b: SpaceBooking, tone: RowTone): { text: string; hot: boolean } | null {
  if (tone === "past") return null;
  if (bookingStarted(b)) return { text: "이용 중", hot: false };
  const n = kstDaysUntil(b.useDate);
  // 「오늘 22:00 시작」으로 적었다가 바로 아래 시간 줄과 같은 말이 두 번이 됐다(09-18 실측). 날만 말한다.
  if (n <= 0) return { text: "오늘", hot: tone === "answer" };
  if (n === 1) return { text: "내일", hot: tone === "answer" };
  return { text: `${n}일 뒤`, hot: false };
}

/** 🗓날짜 칸 — 「9월 / 20 / 일」 세 줄. 서식은 `dateLabel` 한 벌에서 떼어 쓴다(날짜 계산을 여기서 다시 하지 않는다). */
function DateTile({ b, tone }: { b: SpaceBooking; tone: RowTone }) {
  const label = dateLabel(b.useDate);
  const m = /^(\d+)월 (\d+)일 \((.)\)$/.exec(label);
  const face =
    tone === "answer" ? "bg-lemon-pale text-lemon-on" : tone === "upcoming" ? "bg-surface-soft text-ink" : "bg-surface-soft text-faint";
  const small = tone === "upcoming" ? "text-mute" : "";
  return (
    <div className={`flex size-[64px] shrink-0 flex-col items-center justify-center rounded-lg ${face}`}>
      <span className="sr-only">{label}</span>
      {m ? (
        <>
          <span aria-hidden="true" className={`text-[13px] leading-none ${small}`}>{m[1]}월</span>
          <span aria-hidden="true" className="mt-1 text-[24px] font-bold leading-none tabular-nums">{m[2]}</span>
          <span aria-hidden="true" className={`mt-1 text-[13px] leading-none ${small}`}>{m[3]}</span>
        </>
      ) : (
        <span aria-hidden="true" className="px-1 text-center text-[13px] leading-tight break-keep">{label}</span>
      )}
    </div>
  );
}

/** 💸받을 돈. 낸 금액만 보이면 정산 때 「이만큼 들어올 줄 알았는데」가 된다.
 *  💸09-17 QA — 거절·환불·취소 카드엔 받을 돈이 아니라 무슨 돈인지 바꿔 적고 흐리게.
 *  ⚠️손님 취소는 날에 따라 일부가 남아 정산될 수 있어(약관 제8조) 금액을 단정하지 않는다.
 *  📐`wide` — 넓은 화면은 오른쪽 기둥(세 줄, 오른쪽 정렬), 폰은 글 기둥 맨 아래 두 줄. 문장은 둘이 같다. */
function Money({ b, wide, tone }: { b: SpaceBooking; wide: boolean; tone: RowTone }) {
  const gone = b.status === "refunded" || b.status === "rejected" || b.status === "cancelled";
  const [label, sub] =
    b.status === "refunded"
      ? ["손님께 전액 돌려드렸어요", ""]
      : b.status === "rejected"
        ? ["돌려드릴 돈", "저희가 환불을 챙기고 있어요"]
        : b.status === "cancelled"
          ? ["손님 취소 · 낸 돈", ""]
          : ["받으실 돈", `손님이 낸 돈 ${won(b.amountTotal)}`];
  const amount = won(gone ? b.amountTotal : b.amountPayout);
  // 지난 카드는 받을 돈도 한 단 낮춘다 — 굵은 잉크 금액이 지난 요청 목록에서 「지금 볼 것」처럼 튀었다.
  const amountCls = gone ? "font-medium text-faint" : tone === "past" ? "font-medium text-body" : "font-bold text-ink";
  if (wide) {
    return (
      <div className="hidden w-[168px] shrink-0 text-right sm:block">
        <p className={`text-[14px] leading-snug break-keep ${gone ? "text-faint" : "text-mute"}`}>{label}</p>
        <p className={`mt-0.5 text-[19px] leading-snug tabular-nums ${amountCls}`}>{amount}</p>
        {sub && <p className="mt-0.5 text-[14px] leading-snug break-keep text-faint">{sub}</p>}
      </div>
    );
  }
  // 폰 — 「받으실 돈 127,500원」 한 줄 + 보조 한 줄. 한 줄에 붙이면 375에서 「손님이 낸 돈 / 150,000원」으로 꺾였다.
  return (
    <div className="mt-2 text-[14px] leading-snug break-keep sm:hidden">
      <p>
        <span className={gone ? "text-faint" : "text-mute"}>{label}</span>{" "}
        <span className={`whitespace-nowrap text-[16px] tabular-nums ${amountCls}`}>{amount}</span>
      </p>
      {sub && <p className="mt-0.5 text-faint">{sub}</p>}
    </div>
  );
}

/** 카드 머리 — 왼쪽 날짜 칸 · 가운데 상태와 시간과 무엇을 · 오른쪽 돈(넓은 화면). */
function RequestHead({
  b,
  tone,
  spaceName,
  refundPending,
}: {
  b: SpaceBooking;
  tone: RowTone;
  spaceName: string;
  refundPending: boolean;
}) {
  const day = dayTag(b, tone);
  const hours = b.startTime && b.endTime ? hoursBetween(b.startTime, b.endTime) : 0;
  // ☕🩸09-16까지 사장님 쪽엔 커피챗 표시가 없었다. 손님 화면 네 곳엔 「커피챗 포함」이 뜨는데
  //   정작 커피챗을 해 줄 사람이 모르는 상태였다. 옛 예약은 옛 칸에만 값이 있어 둘 다 본다.
  const chat = b.amountChat > 0 || b.amountMentor > 0;
  // 🏷칩 = 사장님이 «준비할 것»(상품·인원·커피챗). 한 카드 안의 알약은 이 한 종류뿐이다(디자인-시스템 §형태가 의미를 만든다).
  //   🛍09-18 공간 전체면 사장님이 시설까지 준비해야 해서 첫 칩이다.
  const chips = [PRODUCT_LABEL[b.product], b.headcount ? `${b.headcount}명` : "", chat ? "커피챗 신청" : ""].filter(Boolean);
  const chipCls = tone === "past" ? "text-faint" : "text-body";
  return (
    <div className="flex gap-3 sm:gap-4">
      <DateTile b={b} tone={tone} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[15px] leading-snug">
          {/* ⏯수락 안 한 채 이용 시간이 시작된 결제 완료 — phase 1에선 곧 예약 완료다(버튼도 거둔다).
              「새 요청」으로 두면 답할 수 없는 카드가 답을 기다리는 이름을 달고 지난 요청에 선다. 손님 쪽 이름을 빌린다. */}
          <BookingBadge dot status={b.status} viewer={b.status === "paid" && bookingStarted(b) ? "guest" : "host"} />
          {day && (
            <>
              <span aria-hidden="true" className="text-faint">·</span>
              <span className={day.hot ? "font-medium text-lemon-on" : "text-mute"}>{day.text}</span>
            </>
          )}
          {refundPending && (
            <>
              <span aria-hidden="true" className="text-faint">·</span>
              <span className="font-medium text-lemon-on">환불 신청 중</span>
            </>
          )}
        </p>
        {/* ⭐시간이 카드에서 제일 큰 글자다. 날짜는 왼쪽 칸이 말한다. */}
        <p className={`mt-1 text-[19px] font-bold leading-snug tabular-nums ${tone === "past" ? "text-mute" : "text-ink"}`}>
          {b.startTime && b.endTime ? (
            <>
              <span className="whitespace-nowrap">
                {b.startTime}~{b.endTime}
              </span>
              {hours > 0 && (
                <span className="ml-1.5 whitespace-nowrap text-[15px] font-normal text-mute">
                  {hours % 1 === 0 ? hours : hours.toFixed(1)}시간
                </span>
              )}
            </>
          ) : (
            // 옛 예약 — 시각 칸이 비어 옛 `hours` 글만 있다(`bookingWhen`과 같은 물러섬).
            b.hours || dateLabel(b.useDate)
          )}
        </p>
        <p className="mt-0.5 truncate text-[15px] text-mute">{spaceName}</p>
        {chips.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="요청 내용">
            {chips.map((c) => (
              <li key={c} className={`inline-flex h-[28px] items-center rounded-pill bg-surface-soft px-2.5 text-[14px] ${chipCls}`}>
                {c}
              </li>
            ))}
          </ul>
        )}
        <Money b={b} tone={tone} wide={false} />
      </div>
      <Money b={b} tone={tone} wide />
    </div>
  );
}

/** 예약에 적힌 손님 번호·성함을 프로필의 번호·이름 자리에 얹는다. 비어 있는 쪽은 프로필 그대로
 *  (블록이 「번호를 안 남기셨어요」라고 말한다). 🪪성함(09-18)은 이용 당일 신분을 맞춰 보는 이름이라 브랜드명보다 먼저다. */
function withBookingContact(p: Profile | null, bookingPhone: string, bookingName: string): Profile | null {
  if (!p) return p;
  const phone = bookingPhone?.trim();
  const name = bookingName?.trim();
  return { ...p, ...(phone ? { phone } : {}), ...(name ? { brandName: name } : {}) };
}
