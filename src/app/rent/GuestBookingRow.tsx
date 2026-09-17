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
import { BOOKING_HEADLINE, PRODUCT_LABEL } from "@/lib/rent-copy";
import { GuestCancel } from "./my/Actions";
import { BookingBadge, CoverPlaceholder, InfoList, InfoRow, ListRow, bookingWhen, won } from "./ui";

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
              <a href={`tel:${phone.replace(/[^0-9+]/g, "")}`} className="underline underline-offset-2">
                {phone}
              </a>
            }
          />
        ) : email ? (
          <InfoRow
            label="연락"
            value={
              <a href={`mailto:${email}`} className="break-all underline underline-offset-2">
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
  const { booking: b, space: sp, reveal, host } = view;
  const open = guestSeesHost(b);
  // 🔗09-17 QA — 줄 어디에도 링크가 없어서 완료 화면(`/rent/done`)은 결제 직후 한 번만 볼 수 있었다.
  //   「자세히」는 결제를 마친 건에만 건다 — 결제 전·만료 건은 완료 화면이 보여 줄 게 없다.
  const paidOnce = b.status !== "pending" && b.status !== "expired";
  // 📛09-17 대표 — 결제 완료·확정 건은 첫 줄을 `BOOKING_HEADLINE`으로. 배지는 그 짧은 꼴이다.
  const headline = b.status === "paid" ? BOOKING_HEADLINE.guestPaid : b.status === "confirmed" ? BOOKING_HEADLINE.guestConfirmed : "";
  return (
    <ListRow
      card
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
                <Link href={`/rent/${sp.slug}`} className="underline-offset-2 hover:underline">
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
              <span className="font-semibold tabular-nums">{won(b.amountTotal)}</span>
              {(b.amountChat > 0 || b.amountMentor > 0) && <span className="whitespace-nowrap text-mute"> · 커피챗 포함</span>}
            </p>
          </div>
        </div>
      }
      status={<BookingBadge status={b.status} />}
    >
      {headline && <p className="mt-3 text-[15px] text-body">{headline}</p>}
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
      ) : open && !(b.status === "done" || bookingFinished(b)) ? (
        // 🎨09-17 디자인팀 — 목록에선 **바로 쓸 두 줄만**. 전엔 줄마다 7줄짜리 「가게 정보」 블록(제목·안내·사장님·소개서·
        //   가게 전화·전화번호·이메일·주소·이용 안내)을 통째로 펼쳐서, 앞으로 갈 곳 셋이면 폰에서 이 화면이 6,300px였다.
        //   목록에서 손님이 하는 일은 «연락하기»와 «찾아가기» 둘이다. 나머지는 「자세히」(`/rent/done`)가 전부 보여 준다.
        //   ⚠️문은 그대로 `guestSeesHost` 하나다. 줄이는 건 보여 주는 칸 수지, 여는 조건이 아니다.
        //   🙈이용일이 지난 줄엔 판을 안 그린다. 가려진 「-」 넷이 남는 것보다 조용하고, 완료 화면이 가림을 따로 말한다.
        <CompactContact host={host} shopPhone={reveal?.contactPhone} address={sp?.address} />
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
