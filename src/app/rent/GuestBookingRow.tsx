// 하루 가게 — 내가 보낸 신청 한 줄 + 그 줄에 필요한 것을 읽어 오는 함수 (2026-09-16)
//
// ⭐**두 화면이 이 한 벌을 쓴다** — `/rent/my`의 「내가 보낸 신청」 절과 손님 전용 `/rent/requests`(B81).
//   전엔 `/rent/my` 안에만 있었다. 같은 줄을 두 화면에 따로 적으면 취소 버튼 조건이나 연락처 문이
//   한쪽만 고쳐지는 날이 온다(이 프로젝트에서 여러 번 났다).
//
// 🚨사장님 연락처의 문은 `guestSeesHost(booking)` 하나다(09-16부터 결제를 마치면 열린다). `loadGuestBookings`가 열린 예약의 원본과
//   사장님 프로필만 읽고, 줄은 받은 값을 그리기만 한다. 화면에서 가리는 게 아니라 «읽지를 않는다».
//
// 훅이 없는 서버 컴포넌트 파일이다(`"use client"` 없음). 취소 버튼(`GuestCancel`)만 클라이언트 조각이다.
import Link from "next/link";
import { getSpaceFull, guestSeesHost, listBookingsForGuest, listSpacesByIds, type SpaceBrief } from "@/lib/spaces";
import { getProfileById, type Profile } from "@/lib/profiles";
import { repo } from "@/lib/repo";
import type { Space, SpaceBooking } from "@/lib/types";
import { bookingFinished, bookingStarted, dateLabel, rangeLabel } from "@/lib/rent-time";
import { BOOKING_HEADLINE } from "@/lib/rent-copy";
import { ContactBlock } from "./ContactBlock";
import { GuestCancel } from "./my/Actions";
import { BookingBadge, ListRow, bookingWhen, won } from "./ui";

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
};

/** 로그인한 사람이 보낸 신청 전부를, 줄을 그리는 데 필요한 것과 함께. 최근에 보낸 것부터. */
export async function loadGuestBookings(uid: number): Promise<GuestBookingView[]> {
  const bookings = await listBookingsForGuest(uid);
  // 내가 «빌린» 곳은 남의 공간이라 id로 따로 읽는다(`listSpacesByIds` 주석 참조).
  const spaces = await listSpacesByIds(bookings.map((b) => b.spaceId));

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
    return {
      booking: b,
      space: sp,
      reveal: open ? reveals.get(b.spaceId) : undefined,
      host: open ? (hosts.get(sp!.ownerUserId) ?? null) : null,
    };
  });
}

// ☕09-16 커피챗으로 이름이 바뀌면서 칸도 바뀌었다(`amountMentor` → `amountChat`).
//   옛 예약은 옛 칸에만 값이 있어서 둘 다 본다. 말은 확인 팝업·상세와 같은 「커피챗」으로 맞췄다.
/** 메타 줄의 토막들. 🩸09-17 QA(폰 375px) — 한 줄 글자열이라 「1 / 명」·「(4시 / 간)」처럼 낱말 중간에서 줄이 끊겼다.
 *  토막마다 `whitespace-nowrap`으로 감싸고, 줄바꿈은 토막 사이 `·`에서만 일어나게 한다.
 *  날짜와 시간도 따로 토막이다 — 둘을 한 덩어리로 묶으면 좁은 폭에서 한 토막이 줄보다 길어진다. */
function metaParts(b: SpaceBooking, area?: string): string[] {
  const when = b.startTime && b.endTime ? [dateLabel(b.useDate), rangeLabel(b.startTime, b.endTime)] : [bookingWhen(b)];
  return [
    ...when,
    b.headcount ? `${b.headcount}명` : "",
    area ?? "",
    won(b.amountTotal),
    b.amountChat > 0 || b.amountMentor > 0 ? "커피챗 포함" : "",
  ].filter(Boolean);
}

export function GuestBookingRow({ view }: { view: GuestBookingView }) {
  const { booking: b, space: sp, reveal, host } = view;
  const open = guestSeesHost(b);
  // 🔗09-17 QA — 줄 어디에도 링크가 없어서 완료 화면(`/rent/done`)은 결제 직후 한 번만 볼 수 있었다.
  //   「자세히」는 결제를 마친 건에만 건다 — 결제 전·만료 건은 완료 화면이 보여 줄 게 없다.
  const paidOnce = b.status !== "pending" && b.status !== "expired";
  // 📛09-17 대표 — 결제 완료·확정 건은 첫 줄을 `BOOKING_HEADLINE`으로. 배지는 그 짧은 꼴이다.
  const headline = b.status === "paid" ? BOOKING_HEADLINE.guestPaid : b.status === "confirmed" ? BOOKING_HEADLINE.guestConfirmed : "";
  return (
    <ListRow
      head={
        <>
          <p className="truncate text-[17px] font-medium text-ink">
            {sp ? (
              <Link href={`/rent/${sp.slug}`} className="underline-offset-2 hover:underline">
                {sp.name}
              </Link>
            ) : (
              "공간"
            )}
          </p>
          <p className="mt-1 text-[15px] text-mute">
            {metaParts(b, sp?.area).map((t, i) => (
              <span key={i}>
                {i > 0 && " · "}
                <span className="whitespace-nowrap">{t}</span>
              </span>
            ))}
          </p>
          {headline && <p className="mt-2 text-[15px] text-body">{headline}</p>}
        </>
      }
      status={<BookingBadge status={b.status} />}
    >
      {/* 🩸09-16 — `pending`에도 「사장님이 수락하면…」이 붙어 있었다. 그 신청은 **사장님에게
          보이지도 않는다**(`listBookingsForHost`가 거른다). 기다릴 것이 없는데 기다리라고 말하고,
          이어서 낼 길도 없어서 목록에 쌓이기만 했다. 결제 화면은 주문번호로 되돌아갈 수 있다. */}
      {/* ⏳날짜가 지난 미결제 신청엔 「이어서 결제하기」를 안 띄운다(09-16). 눌러도 서버가 지난 날짜를 막아서
          (`startBookingAction`) 손님은 결제 화면에서 막다른 길을 만난다. 버튼을 거두고 사실만 말한다. */}
      {b.status === "pending" ? (
        bookingStarted(b) ? (
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
            결제를 마치지 않은 채 날짜가 지났어요. 사장님께는 전달되지 않았어요.
          </p>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
            아직 결제가 끝나지 않아 사장님께 전달되지 않았어요.{" "}
            <Link href={`/rent/pay/${b.orderId}`} className="text-body underline underline-offset-2">
              이어서 결제하기
            </Link>
          </p>
        )
      ) : open ? (
        <ContactBlock
          who="사장님"
          profile={host}
          address={sp?.address}
          accessNote={reveal?.accessNote}
          shopPhone={reveal?.contactPhone}
          accessHow={reveal?.accessHow}
          brand={reveal?.brand}
          // 🙈이용일이 지난 예약은 연락처를 가린다(대표 09-16)
          masked={b.status === "done" || bookingFinished(b)}
        />
      ) : null}
      {/* 🔻09-16 「사장님이 수락하면 주소와 연락처가 열려요」 삭제 — 결제를 마치면 바로 열린다(대표, phase 1). */}

      {b.hostMessage && (
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">사장님 말씀 · {b.hostMessage}</p>
      )}

      {/* 🚨이미 시작한 예약엔 취소 버튼을 안 띄운다(09-16). 다 쓴 예약을 취소로 바꾸면
          환불은 0원인데 사장님 정산에서 통째로 빠졌다. 관문은 서버 액션이고 이건 화면 쪽 짝이다. */}
      <div className="flex flex-wrap items-center gap-x-5">
        {paidOnce && (
          <Link
            href={`/rent/done/${b.id}`}
            className="mt-2 inline-block py-[12px] text-[15px] text-body underline underline-offset-2"
          >
            자세히
          </Link>
        )}
        {(b.status === "paid" || b.status === "confirmed") && !bookingStarted(b) && <GuestCancel bookingId={b.id} />}
      </div>
    </ListRow>
  );
}
