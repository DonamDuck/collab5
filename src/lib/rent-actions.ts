"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId, getProfileById } from "./profiles";
import {
  saveSpace, getSpaceFull, getBooking, createPendingBooking, getBookingByOrderId,
  markBookingPaid, decideBooking,
  setBookingStatus, setOpenDate, listSpacesByOwner, payout, FEE_RATE,
  type SpaceSaveInput,
} from "./spaces";
import { approvePayment, cancelPayment, guestCancelRefundRate } from "./rent-payment";
import type { Space, SpaceUseType } from "./types";

// 하루 가게 — 쓰기 서버 액션 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// 🚨**이 파일은 «async 함수»만 export한다.** 타입이나 상수를 하나라도 내보내면 빌드가
//   `Export X doesn't exist in target module`로 죽는데, **tsc는 못 잡는다**(09-13에 실제로 당했다).
//   화면이 쓸 타입은 `lib/types.ts`에서 직접 가져간다.
//
// 🚨**모든 함수가 첫 줄에서 로그인·권한을 검사한다.** 화면에서 버튼을 숨기는 건 UX일 뿐이고,
//   주소를 직접 치거나 액션을 직접 호출하는 경로는 늘 열려 있다(08-06 소개서 편집에서 실제로 났던 구멍).

export interface ActionResult { ok: boolean; message: string; slug?: string; bookingId?: number }

/** 공간을 공개로 넘길 수 있는 사람 — 지금은 대표뿐이다.
 *  ⚠️`lib/staff.ts`를 안 쓴다. 그 파일 주석이 *「소유·권한 판정에는 쓰지 마라」*고 못 박았고,
 *    이건 남의 등록을 세상에 내보내는 판정이라 성격이 다르다(매거진이 같은 이유로 별도 파일을 뒀다). */
export async function isRentAdmin(): Promise<boolean> {
  // ⭐export하는 이유 — 화면이 [공개하기] 버튼을 보일지 정할 때 같은 규칙을 «다시 적으면»
  //   환경변수 이름이 어긋나는 날 버튼은 보이는데 안 눌리는 상태가 된다. 판정은 한 벌만 둔다.
  const raw = process.env.RENT_ADMIN_EMAILS ?? process.env.MAGAZINE_EDITOR_EMAILS ?? "dudejrthd@gmail.com";
  const allow = raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  const uid = await getSessionUserId();
  if (!uid) return false;
  const p = await getProfileById(uid);
  return !!p?.email && allow.includes(p.email.toLowerCase());
}

/** 주소 후보를 슬러그로. 한글 이름이면 옮길 글자가 없어 난수로 떨어진다(매거진이 같은 함정을 겪었다). */
function makeSlug(name: string): string {
  // 🩸09-13 실측: 「을지로 옥상 작업실」이 `----efpa`가 됐다. 한글을 떼고 나면 공백 자리의 대시만 남는데,
  //   그 대시 넉 자가 「3자 이상」을 통과했다. 그래서 대시를 접고 양끝을 자른 «뒤에» 길이를 잰다.
  const ascii = name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "").trim().replace(/[\s-]+/g, "-").replace(/^-+|-+$/g, "");
  const tail = Date.now().toString(36).slice(-4);
  return ascii.length >= 3 ? `${ascii}-${tail}` : `space-${Date.now().toString(36)}`;
}

export interface SpaceFormInput {
  slug?: string;
  name: string; tagline: string; body: string; photos: string[];
  area: string; address: string; accessNote: string;
  useType: SpaceUseType; facilities: string[]; capacity?: number; hours: string;
  rules: string; priceDay: number;
  mentorMinutes: number; mentorPrice: number;
  openDates: string[];
  servesFood: boolean; subleaseOk: boolean;
  brandSlug: string;
}

/** 공간 등록·수정. 저장하면 `pending`(검토 대기)로 들어간다. */
export async function saveSpaceAction(input: SpaceFormInput): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  // 🚨1단계는 음식·음료를 안 받는다. 남의 영업신고 시설에서 남이 팔면 무신고 영업이다
  //   (식품위생법 제37조 ④ → 제97조, 3년 이하 또는 3천만 원). 09-13 법규 조사.
  if (input.servesFood) {
    return { ok: false, message: "음식이나 음료를 파는 공간은 아직 받지 못해요. 법이 정리되는 대로 열겠습니다." };
  }
  // 임대인 동의 없는 전대는 계약 해지 사유다. 본인 확인을 받고 넘어간다.
  if (!input.subleaseOk) {
    return { ok: false, message: "내 소유이거나 임대인 동의를 받았는지 확인해 주세요." };
  }
  // ⭐「우리 집 규칙」은 이 서비스에서 제일 중요한 칸이라 빈칸으로 못 넘어간다.
  if (input.rules.trim().length < 10) {
    return { ok: false, message: "우리 집 규칙을 열 글자 이상 적어 주세요. 이 칸이 사장님을 지켜 줍니다." };
  }
  if (!input.name.trim()) return { ok: false, message: "공간 이름을 적어 주세요." };
  if (input.openDates.length === 0) return { ok: false, message: "빌려줄 수 있는 날을 하루 이상 골라 주세요." };
  if (input.photos.length === 0) return { ok: false, message: "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요." };
  if (input.priceDay < 0) return { ok: false, message: "값이 이상해요." };

  // 수정이면 주인 확인부터. ⚠️입력에 실린 slug를 믿지 않고 DB에서 소유자를 다시 읽는다.
  if (input.slug) {
    const cur = await getSpaceFull(input.slug);
    if (!cur) return { ok: false, message: "그 공간을 찾지 못했어요." };
    if (cur.ownerUserId !== uid) return { ok: false, message: "내 공간만 고칠 수 있어요." };
  }

  const slug = input.slug || makeSlug(input.name);
  const row: SpaceSaveInput = {
    slug, ownerUserId: uid, brandSlug: input.brandSlug,
    name: input.name.trim(), tagline: input.tagline.trim(), body: input.body, photos: input.photos,
    area: input.area.trim(), address: input.address.trim(), accessNote: input.accessNote.trim(),
    useType: input.useType, facilities: input.facilities, capacity: input.capacity,
    hours: input.hours, rules: input.rules.trim(),
    priceDay: input.priceDay, mentorMinutes: input.mentorMinutes, mentorPrice: input.mentorPrice,
    openDates: input.openDates, servesFood: false, subleaseOk: true,
    status: "pending",
  };
  const saved = await saveSpace(row);
  if (!saved) return { ok: false, message: "저장에 실패했어요. 잠시 뒤 다시 시도해 주세요." };
  revalidatePath("/rent");
  revalidatePath(`/rent/${slug}`);
  return { ok: true, message: "올렸어요. 확인하고 공개해 드릴게요.", slug };
}

/** 검토 통과 — 대표만. `pending` → `open`. */
export async function publishSpaceAction(slug: string): Promise<ActionResult> {
  if (!(await isRentAdmin())) return { ok: false, message: "권한이 없어요." };
  const sp = await getSpaceFull(slug);
  if (!sp) return { ok: false, message: "그 공간을 찾지 못했어요." };
  const saved = await saveSpace({ ...sp, status: "open" });
  revalidatePath("/rent");
  return saved ? { ok: true, message: "공개했어요.", slug } : { ok: false, message: "실패했어요." };
}

export interface BookingFormInput {
  spaceSlug: string;
  useDate: string;
  hours: string;
  plan: string;
  headcount?: number;
  withMentor: boolean;
  guestBrandSlug: string;
}

export interface StartBookingResult extends ActionResult {
  orderId?: string;
  amount?: number;
  orderName?: string;
}

/** ① 결제창으로 보내기 «직전» — 검사하고 자리를 잡는다.
 *
 *  ⭐**금액을 여기서 정한다.** 화면이 보내 온 금액은 받지도 않는다. 공간 행에서 다시 계산한 값만
 *  `pending` 행에 적히고, 돌아왔을 때 그 값으로 승인을 건다. 화면을 조작해도 값이 안 바뀐다.
 *  🚨`pending` 행은 호스트에게 안 보인다(`listBookingsForHost`가 거른다). */
export async function startBookingAction(input: BookingFormInput): Promise<StartBookingResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const sp = await getSpaceFull(input.spaceSlug);
  if (!sp || sp.status !== "open") return { ok: false, message: "지금은 신청할 수 없는 공간이에요." };
  if (sp.ownerUserId === uid) return { ok: false, message: "내 공간은 내가 빌릴 수 없어요." };
  if (!sp.openDates.includes(input.useDate)) return { ok: false, message: "그날은 이미 찼어요. 다른 날을 골라 주세요." };
  if (input.plan.trim().length < 10) return { ok: false, message: "그날 무엇을 하실지 열 글자 이상 적어 주세요." };

  const amountSpace = sp.priceDay;
  const amountMentor = input.withMentor && sp.mentorMinutes > 0 ? sp.mentorPrice : 0;
  const amountTotal = amountSpace + amountMentor;
  if (amountTotal <= 0) return { ok: false, message: "값이 정해지지 않은 공간이에요. 사장님께 확인이 필요합니다." };

  // 주문번호는 우리가 만든다. 토스에 그대로 실려 가고 돌아올 때 이 값으로 행을 찾는다.
  const orderId = `rent-${sp.id}-${input.useDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 10)}`;

  const booking = await createPendingBooking({
    spaceId: sp.id, guestUserId: uid, guestBrandSlug: input.guestBrandSlug,
    useDate: input.useDate, hours: input.hours || sp.hours, plan: input.plan.trim(),
    headcount: input.headcount, withMentor: amountMentor > 0,
    amountSpace, amountMentor, amountTotal,
    paymentKey: "", orderId,
  });
  if (!booking) return { ok: false, message: "신청을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." };

  return {
    ok: true, message: "", orderId, amount: amountTotal,
    orderName: `${sp.name} · ${input.useDate}`,
    bookingId: booking.id,
  };
}

/** ② 결제창에서 돌아온 뒤 — 승인하고 신청을 성립시킨다.
 *
 *  🚨**돌아온 금액을 안 믿는다.** `pending` 행에 적어 둔 금액으로 승인을 건다.
 *    주소창의 `amount`를 고쳐도 승인 금액은 안 바뀐다.
 *  🩸승인은 됐는데 `paid`로 못 올리면 **돈만 받고 예약이 없는** 상태다. 그 자리에서 되돌린다. */
export async function confirmBookingAction(
  paymentKey: string, orderId: string
): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const b = await getBookingByOrderId(orderId);
  if (!b) return { ok: false, message: "그 신청을 찾지 못했어요." };
  if (b.guestUserId !== uid) return { ok: false, message: "내 신청만 결제할 수 있어요." };
  // 새로고침·뒤로가기로 이 함수가 두 번 불릴 수 있다. 이미 끝난 건 조용히 성공으로 돌려준다.
  if (b.status !== "pending") return { ok: true, message: "이미 신청이 끝났어요.", bookingId: b.id };

  const approved = await approvePayment(paymentKey, orderId, b.amountTotal);
  if (!approved.ok) return { ok: false, message: approved.message };

  const paid = await markBookingPaid(orderId, approved.paymentKey);
  if (!paid) {
    await cancelPayment(approved.paymentKey, "예약 확정 실패 — 자동 환불");
    await setBookingStatus(b.id, "cancelled");
    return { ok: false, message: "그 사이 그날이 찼어요. 결제는 자동으로 취소했습니다." };
  }

  await setOpenDate(b.spaceId, b.useDate, false);
  revalidatePath("/rent");
  revalidatePath("/rent/my");
  return { ok: true, message: "신청했어요. 사장님 답을 기다려 주세요.", bookingId: paid.id };
}

/** 호스트의 수락·거절. 거절이면 **전액 환불**한다(대표 09-13). */
export async function decideBookingAction(
  bookingId: number, accept: boolean, message: string
): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  const b = await getBooking(bookingId);
  if (!b) return { ok: false, message: "그 신청을 찾지 못했어요." };
  // ⚠️권한은 "이 사람이 그 공간의 주인인가"다. booking에는 주인이 안 적혀 있어 공간을 거쳐 확인한다.
  const mine = await listSpacesByOwner(uid);
  const sp = mine.find((x) => x.id === b.spaceId);
  if (!sp) return { ok: false, message: "내 공간의 신청만 결정할 수 있어요." };

  const decided = await decideBooking(bookingId, accept, message.trim());
  if (!decided) return { ok: false, message: "이미 처리된 신청이에요." };

  if (!accept) {
    const refunded = await cancelPayment(b.paymentKey, "사장님 거절 — 전액 환불");
    await setBookingStatus(bookingId, refunded ? "refunded" : "rejected");
    await setOpenDate(sp.id, b.useDate, true);   // 그날을 다시 판다
    revalidatePath("/rent/my");
    return refunded
      ? { ok: true, message: "거절하고 전액 환불했어요." }
      : { ok: true, message: "거절했어요. 환불이 지연되고 있어 확인 중입니다." };
  }
  revalidatePath("/rent/my");
  return { ok: true, message: "수락했어요. 이제 신청자 연락처가 보입니다." };
}

/** 게스트 취소 — 환불률은 우리 규정표가 정한다(호스트 자율 금지). */
export async function cancelBookingAction(bookingId: number): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const b = await getBooking(bookingId);
  if (!b || b.guestUserId !== uid) return { ok: false, message: "내 신청만 취소할 수 있어요." };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 신청이에요." };

  const days = Math.floor((new Date(b.useDate).getTime() - Date.now()) / 86_400_000);
  const rate = guestCancelRefundRate(days);
  const refund = Math.floor(b.amountTotal * rate);
  if (refund > 0) await cancelPayment(b.paymentKey, "게스트 취소", refund === b.amountTotal ? undefined : refund);

  await setBookingStatus(bookingId, "cancelled");
  await setOpenDate(b.spaceId, b.useDate, true);
  revalidatePath("/rent/my");
  return { ok: true, message: refund > 0 ? `취소했어요. ${refund.toLocaleString()}원이 환불됩니다.` : "취소했어요. 당일 취소라 환불은 없습니다." };
}

/** 화면에서 금액을 보여줄 때 쓰는 계산 — 호스트에게 얼마가 가는지 정직하게 적기 위한 것. */
export async function quotePayout(total: number): Promise<{ fee: number; payout: number; rate: number }> {
  const out = payout(total);
  return { fee: total - out, payout: out, rate: FEE_RATE };
}
