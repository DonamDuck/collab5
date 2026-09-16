// 하루 가게 — 내가 보낸 신청 한 줄 + 그 줄에 필요한 것을 읽어 오는 함수 (2026-09-16)
//
// ⭐**두 화면이 이 한 벌을 쓴다** — `/rent/my`의 「내가 보낸 신청」 절과 손님 전용 `/rent/requests`(B81).
//   전엔 `/rent/my` 안에만 있었다. 같은 줄을 두 화면에 따로 적으면 취소 버튼 조건이나 연락처 문이
//   한쪽만 고쳐지는 날이 온다(이 프로젝트에서 여러 번 났다).
//
// 🚨연락처·주소의 문은 여전히 `isRevealed(booking)` 하나다. `loadGuestBookings`가 열린 예약의 원본과
//   사장님 프로필만 읽고, 줄은 받은 값을 그리기만 한다. 화면에서 가리는 게 아니라 «읽지를 않는다».
//
// 훅이 없는 서버 컴포넌트 파일이다(`"use client"` 없음). 취소 버튼(`GuestCancel`)만 클라이언트 조각이다.
import Link from "next/link";
import { getSpaceFull, isRevealed, listBookingsForGuest, listSpacesByIds, type SpaceBrief } from "@/lib/spaces";
import { getProfileById, type Profile } from "@/lib/profiles";
import type { Space, SpaceBooking } from "@/lib/types";
import { bookingStarted } from "@/lib/rent-time";
import { ContactBlock } from "./ContactBlock";
import { GuestCancel } from "./my/Actions";
import { BookingBadge, ListRow, LockedLine, bookingWhen, won } from "./ui";

type Reveal = { accessNote: string; contactPhone: string; accessHow: Space["accessHow"] };

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
    if (!isRevealed(b) || !sp) continue;
    openSpaceIds.add(b.spaceId);
    hostIds.add(sp.ownerUserId);
  }
  const [reveals, hosts] = await Promise.all([
    Promise.all(
      Array.from(openSpaceIds).map(async (id) => {
        const full = await getSpaceFull(spaces.get(id)!.slug);
        const r: Reveal = {
          accessNote: full?.accessNote ?? "",
          contactPhone: full?.contactPhone ?? "",
          accessHow: full?.accessHow ?? "sms",
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
    const open = isRevealed(b) && !!sp;
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
const money = (b: SpaceBooking) =>
  `${won(b.amountTotal)}${b.amountChat > 0 || b.amountMentor > 0 ? " · 커피챗 포함" : ""}`;

export function GuestBookingRow({ view }: { view: GuestBookingView }) {
  const { booking: b, space: sp, reveal, host } = view;
  const open = isRevealed(b);
  return (
    <ListRow
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
          profile={host}
          address={sp?.address}
          accessNote={reveal?.accessNote}
          shopPhone={reveal?.contactPhone}
          accessHow={reveal?.accessHow}
        />
      ) : (
        <LockedLine text="사장님이 수락하면 주소와 연락처가 열려요." />
      )}

      {b.hostMessage && (
        <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">사장님 말씀 · {b.hostMessage}</p>
      )}

      {/* 🚨이미 시작한 예약엔 취소 버튼을 안 띄운다(09-16). 다 쓴 예약을 취소로 바꾸면
          환불은 0원인데 사장님 정산에서 통째로 빠졌다. 관문은 서버 액션이고 이건 화면 쪽 짝이다. */}
      {(b.status === "paid" || b.status === "confirmed") && !bookingStarted(b) && <GuestCancel bookingId={b.id} />}
    </ListRow>
  );
}
