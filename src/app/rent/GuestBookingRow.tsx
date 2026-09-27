// 하루 팝업 — 내가 보낸 신청 한 줄 + 그 줄에 필요한 것을 읽어 오는 함수 (2026-09-16)
//
// ⭐**두 화면이 이 한 벌을 쓴다** — `/rent/my`의 「내가 보낸 신청」 절과 손님 전용 `/rent/requests`(B81).
//   전엔 `/rent/my` 안에만 있었다. 같은 줄을 두 화면에 따로 적으면 취소 버튼 조건이나 연락처 문이
//   한쪽만 고쳐지는 날이 온다(이 프로젝트에서 여러 번 났다).
//
// 🚨사장님 연락처의 문은 `guestSeesHost(booking)` 하나다(09-16부터 결제를 마치면 열린다). `loadGuestBookings`가 열린 예약의 원본과
//   사장님 프로필만 읽고, 줄은 받은 값을 그리기만 한다. 화면에서 가리는 게 아니라 «읽지를 않는다».
//
// 🗂09-27 대표 — 탭(「예약 확정 대기」·「예약 확정 완료」·「지난 예약」·「취소 예약」)으로 나누는 것도 이 파일의 `guestTabViews` 한 벌이다.
//   판정은 `lib/rent-groups`(`GUEST_TABS`·`guestBookingTab`), 순서는 여기. 두 화면이 같은 순서로 같은 줄을 보인다.
// 🔗09-27 대표 #158·#161 — 줄 전체가 예약 한 건 화면(`/rent/done`)으로 가는 링크다. 「자세히」 글자 링크와 「예약 취소하기」는 뺐다.
//   취소는 그 화면의 버튼에서만 한다.
//
// 훅이 없는 서버 컴포넌트 파일이다(`"use client"` 없음).
import Link from "next/link";
import { getSpaceFull, guestSeesHost, listBookingsForGuest, listPaymentsByOrderIds, listSpacesByIds, type SpaceBrief } from "@/lib/spaces";
// 🔒09-27(fix-money3) 결제 전 신청에 «결제를 시도한 흔적»이 있나 — 정리 작업·승인 관문과 같은 판정 한 벌이다.
import { hasPayTrace } from "@/lib/rent-recover";
import { PAY_CHECKING_TITLE, PAY_CHECKING_WAIT } from "@/lib/rent-payment";
import { getProfileById, type Profile } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import type { Space, SpaceBooking } from "@/lib/types";
import { bookingFinished, dateLabel, rangeLabel } from "@/lib/rent-time";
import { PRODUCT_LABEL, telHref } from "@/lib/rent-copy";
import { bookingHasChat } from "@/lib/rent-products";
import { GUEST_TABS, groupGuestBookings, guestBookingTab, type GuestTabKey } from "@/lib/rent-groups";
import { autoRejected, BookingBadge, CoverPlaceholder, InfoList, InfoRow, ListRow, bookingWhen, won } from "./ui";

type Reveal = {
  accessNote: string; contactPhone: string; accessHow: Space["accessHow"];
  /** 사장님이 「내 소개서 보여주기」를 켰을 때만 있다. */
  brand: { name: string; slug: string } | null;
};

export type GuestBookingView = {
  booking: SpaceBooking;
  space?: SpaceBrief;
  /** 확정된 예약에만 있다. 「들어오는 법」·가게 전화·이용 안내는 요약본에 없어서 원본을 한 번 더 읽는다. */
  reveal?: Reveal;
  /** 확정된 예약에만 읽는다. 아니면 null. */
  host: Profile | null;
  /** 🆕09-27(fix-money3) 결제 전(`pending`)인데 결제를 시도한 흔적이 있다 — 승인 결과를 아직 모른다. 「결제를 확인하고 있어요」 한 줄로 선다. */
  checking?: boolean;
  /** 이 줄이 서는 탭(`lib/rent-groups`의 `guestBookingTab`). */
  tab: GuestTabKey;
};

/** 로그인한 사람이 보낸 신청 중 «목록에 서는 것»을, 줄을 그리는 데 필요한 것과 함께. 최근에 보낸 것부터.
 *  🔻09-27 대표 — 결제창만 열고 떠난 신청(흔적 없는 `pending`)과 결제 시간이 지난 신청(`expired`)은 여기서 뺀다.
 *    대표 원문: 「이어서 결제하기는 결제 중간 이탈이라 리스트에 별도 안 남겨도 될 거 같아. 결제 중 취소는 그냥 새로 결제하는 걸로 가자」.
 *    ⚠️흔적이 있는 결제 전 신청은 남긴다 — 돈이 나갔을 수 있어서 손님이 봐야 한다(「결제를 확인하고 있어요」). */
export async function loadGuestBookings(uid: number): Promise<GuestBookingView[]> {
  const all = await listBookingsForGuest(uid);
  // 🔒09-27(fix-money3) 결제 전 신청은 결제 줄도 같이 읽는다. 흔적이 있으면 「결제를 확인하고 있어요」로 세운다.
  //   ⚠️결제 줄 읽기가 실패하면(빈 표) 흔적을 모르는 채라 결제 전 신청이 다 빠진다. 다음에 열면 다시 읽는다.
  //   내가 «빌린» 곳은 남의 공간이라 id로 따로 읽는다(`listSpacesByIds` 주석 참조). 둘은 같이 읽는다.
  const [pays, spaces] = await Promise.all([
    listPaymentsByOrderIds(all.filter((b) => b.status === "pending").map((b) => b.orderId)),
    listSpacesByIds(all.map((b) => b.spaceId)),
  ]);
  const checkingOf = (b: SpaceBooking) => {
    const pay = b.status === "pending" ? pays.get(b.orderId) : undefined;
    return !!pay && hasPayTrace({ payStatus: pay.status, payKey: pay.paymentKey });
  };
  const bookings = all.filter((b) => guestBookingTab(b, checkingOf(b)) !== null);

  // 원본·프로필은 열린 예약 것만, 같은 공간·같은 사장님은 한 번만 읽는다.
  const openSpaceIds = new Set<number>();
  const hostIds = new Set<number>();
  for (const b of bookings) {
    const sp = spaces.get(b.spaceId);
    if (!guestSeesHost(b) || !sp) continue;
    openSpaceIds.add(b.spaceId);
    hostIds.add(sp.ownerUserId);
  }
  const [reveals, hosts] = await Promise.all([
    Promise.all(
      Array.from(openSpaceIds).map(async (id) => {
        const full = await getSpaceFull(spaces.get(id)!.slug);
        const maker = full?.brandSlug ? await repo.getMakerBySlug(full.brandSlug) : null;
        const r: Reveal = {
          accessNote: full?.accessNote ?? "",
          contactPhone: full?.contactPhone ?? "",
          accessHow: full?.accessHow ?? "sms",
          brand: maker && full?.brandSlug ? { name: maker.name, slug: full.brandSlug } : null,
        };
        return [id, r] as [number, Reveal];
      }),
    ).then((rows) => new Map(rows)),
    Promise.all(
      Array.from(hostIds).map(async (id) => [id, await getProfileById(id)] as [number, Profile | null]),
    ).then((rows) => new Map(rows)),
  ]);

  return bookings.map((b) => {
    const sp = spaces.get(b.spaceId);
    const open = guestSeesHost(b) && !!sp;
    const checking = checkingOf(b);
    return {
      booking: b,
      space: sp,
      reveal: open ? reveals.get(b.spaceId) : undefined,
      host: open ? (hosts.get(sp!.ownerUserId) ?? null) : null,
      checking,
      tab: guestBookingTab(b, checking) as GuestTabKey,
    };
  });
}

/** 정렬 열쇠 — 날짜 + 시작 시각. 둘 다 고정폭 글자라 문자열 비교로 순서가 맞다. */
const whenKey = (v: GuestBookingView) => `${v.booking.useDate} ${v.booking.startTime ?? ""}`;

export type GuestTabView = (typeof GUEST_TABS)[number] & { list: GuestBookingView[] };

/** 🗂09-27 대표 — 탭마다의 줄. `/rent/requests`와 `/rent/my?tab=guest`가 이 한 벌로 나누고 줄 세운다.
 *  아직 쓰기 전인 탭(`ahead`)은 가까운 날부터(다음에 챙길 것이 맨 위), 나머지는 최근 것부터.
 *  결제를 확인하고 있는 신청은 「예약 확정 대기」 맨 위에 선다 — 돈이 나갔을 수 있어서 먼저 보여야 한다. */
export function guestTabViews(views: GuestBookingView[]): GuestTabView[] {
  const g = groupGuestBookings(views, (v) => v.booking, (v) => !!v.checking);
  return GUEST_TABS.map((t) => {
    const list = [...g[t.key]].sort((a, b) => (t.ahead ? whenKey(a).localeCompare(whenKey(b)) : whenKey(b).localeCompare(whenKey(a))));
    return { ...t, list: [...list.filter((v) => v.checking), ...list.filter((v) => !v.checking)] };
  });
}

// ☕09-16 커피챗으로 이름이 바뀌면서 칸도 바뀌었다(`amountMentor` → `amountChat`).
//   옛 예약은 옛 칸에만 값이 있어서 둘 다 본다. 말은 확인 팝업·상세와 같은 「커피챗」으로 맞췄다.
/** 메타 줄의 토막들. 🩸09-17 QA(폰 375px) — 한 줄 글자열이라 「1 / 명」·「(4시 / 간)」처럼 낱말 중간에서 줄이 끊겼다.
 *  토막마다 `whitespace-nowrap`으로 감싸고, 줄바꿈은 토막 사이 `·`에서만 일어나게 한다.
 *  날짜와 시간도 따로 토막이다 — 둘을 한 덩어리로 묶으면 좁은 폭에서 한 토막이 줄보다 길어진다. */
function whenParts(b: SpaceBooking): string[] {
  return b.startTime && b.endTime ? [dateLabel(b.useDate), rangeLabel(b.startTime, b.endTime)] : [bookingWhen(b)];
}

/** 목록 줄 안의 연락처 두 줄 — 전화(가게 번호가 있으면 그것, 없으면 사장님 번호, 둘 다 없으면 이메일)와 주소.
 *  번호 순서는 `ContactBlock`과 같다(호스트 약관 제6조가 여는 번호가 가게 번호다). */
function CompactContact({ host, shopPhone, address }: { host: Profile | null; shopPhone?: string; address?: string }) {
  const phone = shopPhone?.trim() || host?.phone?.trim() || "";
  const email = host?.email?.trim() || "";
  return (
    <div className="mt-3 rounded-lg bg-surface-soft px-4 py-3">
      <InfoList>
        {phone ? (
          <InfoRow
            label="연락"
            value={
              // ☎️09-18 밤 QA(G-19) — 번호에 메모가 섞이면 `tel:` 값이 틀어졌다. 뽑기는 한 벌(`telHref`).
              telHref(phone) ? (
                // 줄 전체를 덮는 링크(`ListRow`의 `href`) 위로 올려 따로 눌린다(09-27 #158).
                <a href={`tel:${telHref(phone)}`} className="relative z-[1] underline underline-offset-2">
                  {phone}
                </a>
              ) : (
                <span>{phone}</span>
              )
            }
          />
        ) : email ? (
          <InfoRow
            label="연락"
            value={
              <a href={`mailto:${email}`} className="relative z-[1] break-all underline underline-offset-2">
                {email}
              </a>
            }
          />
        ) : null}
        {address && <InfoRow label="주소" value={address} />}
      </InfoList>
    </div>
  );
}

export function GuestBookingRow({ view }: { view: GuestBookingView }) {
  const { booking: b, space: sp, reveal, host, checking } = view;
  const open = guestSeesHost(b);
  // 🔗09-27 대표 코멘트 #158 — 「자세히 버튼 삭제하고, 섹션 영역 클릭하면 자세히 화면으로 들어가게 하자」.
  //   줄 전체가 예약 한 건 화면(`/rent/done`)으로 간다. 결제를 확인하고 있는 신청(`pending`)은 누를 곳을 두지 않는다 —
  //   그 화면은 결제 전 신청을 결제 화면으로 돌려보내고, 결제 화면은 「결제를 확인하고 있어요」만 다시 말한다. 이 줄이 이미 그 말이다.
  const href = b.status === "pending" ? undefined : `/rent/done/${b.id}`;
  // 🔻09-18 밤 QA(G-27) — 카드 오른쪽 배지가 「예약 완료」인데 바로 아래에 「하루 팝업 예약이 완료됐어요」가 또 섰다.
  //   같은 말이 한 카드에 두 번이라, 목록을 세로로 훑으면 줄마다 같은 문장이 반복됐다.
  //   ⭐긴 문장(`BOOKING_HEADLINE`)이 사는 자리는 «그 한 건만 보여 주는» 화면(`/rent/done`)과 메일 제목이다.
  //     목록의 한 줄에선 배지가 그 짧은 꼴이라 둘 중 하나만 있으면 된다.
  return (
    <ListRow
      card
      // 🔗09-27 대표 D2 — 예약 한 건 화면의 「예약 내역 확인」이 `/rent/requests?g=<탭>#b-<번호>`로 이 줄을 짚는다(`requests/HashFocus`).
      id={`b-${b.id}`}
      href={href}
      hrefLabel={href ? `${sp?.name ?? "공간"} ${whenParts(b).join(" ")} 예약 자세히 보기` : undefined}
      head={
        // 🖼09-18 대표 코멘트 — 「가독성이 좀 떨어지고, 작은 정방형 이미지도 1장」. 한 줄에 여섯 토막이던 메타를
        //   **언제 / 무엇을·어디서 / 얼마** 세 줄로 나누고, 왼쪽에 공간 첫 사진(정사각 64)을 둔다.
        <div className="flex gap-3">
          <div className="size-[64px] shrink-0 overflow-hidden rounded-lg bg-surface-soft">
            {sp?.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sp.photo} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <CoverPlaceholder />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-medium text-ink">
              {sp ? (
                // 줄 전체를 덮는 링크(`ListRow`의 `href`) 위로 올려 따로 눌린다 — 이 이름은 공간 상세로 간다.
                <Link href={`/rent/${sp.slug}`} className="relative z-[1] underline-offset-2 hover:underline">
                  {sp.name}
                </Link>
              ) : (
                "공간"
              )}
            </p>
            {/* 토막마다 줄바꿈을 막아 「(2시 / 간)」·「포 / 함」처럼 낱말 가운데서 꺾이지 않게 한다(375 실측). */}
            <p className="mt-0.5 text-[15px] text-body">
              {whenParts(b).map((w, i) => (
                <span key={i}>
                  {i > 0 && " · "}
                  <span className="whitespace-nowrap">{w}</span>
                </span>
              ))}
            </p>
            <p className="mt-0.5 text-[14px] text-mute">
              {[PRODUCT_LABEL[b.product], sp?.area ?? "", b.headcount ? `${b.headcount}명` : ""].filter(Boolean).join(" · ")}
            </p>
            <p className="mt-1 text-[15px] text-ink">
              {/* 📐09-18 밤 QA(G-27) — 375에서 「150,000 / 원」처럼 «원»만 다음 줄로 떨어졌다. 금액은 한 덩어리다. */}
              <span className="whitespace-nowrap font-semibold tabular-nums">{won(b.amountTotal)}</span>
              {/* ☕09-19 무료 커피챗(값 0)도 「포함」이다 — `bookingHasChat` 한 벌로 본다. */}
              {bookingHasChat(b) && <span className="whitespace-nowrap text-mute"> · 커피챗 포함</span>}
            </p>
          </div>
        </div>
      }
      // 🆕09-27(fix-six) 흔적 있는 결제 전 신청은 「결제 전」이 아니라 「결제 확인 중」(아래 「결제를 확인하고 있어요」 줄과 같은 뜻).
      status={<BookingBadge status={b.status} auto={autoRejected(b)} checking={!!checking} />}
    >
      {/* 🔒09-27(fix-money3) 결제를 시도한 흔적이 있는 결제 전 신청 — 승인 결과를 모른다. 확인 중이라는 한 줄만.
          결제 실패 화면이 「몇 분 뒤 내 예약에서 확인해 주세요」라며 손님을 이 줄로 보낸다. 정리 작업이 토스에 되물어 끝낸다.
          🔻09-27 대표 — 흔적 없는 결제 전 신청의 「이어서 결제하기」·「결제를 마치지 않은 채 날짜가 지났어요」 줄은 지웠다.
            그 신청은 이제 목록에 안 선다(`loadGuestBookings`). */}
      {b.status === "pending" && checking ? (
        <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
          {`${PAY_CHECKING_TITLE}. ${PAY_CHECKING_WAIT}`}
        </p>
      ) : open && !(b.status === "done" || bookingFinished(b)) ? (
        // 🎨09-17 디자인팀 — 목록에선 **바로 쓸 두 줄만**. 전엔 줄마다 7줄짜리 「가게 정보」 블록(제목·안내·사장님·소개서·
        //   가게 전화·전화번호·이메일·주소·이용 안내)을 통째로 펼쳐서, 앞으로 갈 곳 셋이면 폰에서 이 화면이 6,300px였다.
        //   목록에서 손님이 하는 일은 «연락하기»와 «찾아가기» 둘이다. 나머지는 예약 한 건 화면(`/rent/done`)이 전부 보여 준다.
        //   ⚠️문은 그대로 `guestSeesHost` 하나다. 줄이는 건 보여 주는 칸 수지, 여는 조건이 아니다.
        //   🙈이용일이 지난 줄엔 판을 안 그린다. 가려진 「-」 넷이 남는 것보다 조용하고, 완료 화면이 가림을 따로 말한다.
        <CompactContact host={host} shopPhone={reveal?.contactPhone} address={sp?.address} />
      ) : null}
      {/* 🔻09-16 「사장님이 수락하면 주소와 연락처가 열려요」 삭제 — 결제를 마치면 바로 열린다(대표, phase 1). */}

      {b.hostMessage && (
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">사장님 말씀 · {b.hostMessage}</p>
      )}
      {/* 🔻09-27 대표 코멘트 #161 — 「이거 취소하기도 삭제, 자세히 화면에서 버튼으로 처리할거야」. 줄의 「예약 취소하기」를 뺐다.
          취소 조건(결제 완료·확정이고 이용 시작 전)과 버튼(`GuestCancel`)은 예약 한 건 화면 한 곳에만 있다. */}
    </ListRow>
  );
}
