"use server";

import { revalidatePath } from "next/cache";
import { getSessionUserId, getProfileById } from "./profiles";
import {
  saveSpace, getSpaceFull, getBooking, createPendingBooking, getBookingByOrderId,
  markBookingPaid, decideBooking,
  setBookingStatus, setOpenDate, listSpacesByOwner, listSpacesByIds, payout, FEE_RATE,
  type SpaceSaveInput,
  listLiveBookings,
} from "./spaces";
import { approvePayment, cancelPayment, guestCancelRefundRate } from "./rent-payment";
import { geocode } from "./geocode";
import {
  notifyBookingPaid, notifyBookingConfirmed, notifyBookingRejected, notifyBookingCancelled,
} from "./rent-notify";
import { hoursBetween, fitsOpenSlot, overlaps } from "./rent-time";
import type { Space, SpaceBooking, SpaceUseType, SpaceCategory, SpaceScope, OpenSlot, AccessHow } from "./types";

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
  name: string; body: string; photos: string[];
  address: string;
  category: SpaceCategory; scope: SpaceScope;
  useType: SpaceUseType; facilities: string[]; facilitiesNote: string; capacity?: number;
  rules: string;
  priceHour: number; minHours: number; openSlots: OpenSlot[];
  coffeeChat: boolean; coffeeChatMinutes: number; coffeeChatPrice: number; coffeeChatTopics: string;
  accessHow: AccessHow; contactPhone: string;
  /** 📜호스트 약관 동의. 화면의 체크 하나지만 계약의 근거라 서버가 다시 본다. */
  hostTermsOk: boolean;
  brandSlug: string;
}

/** 공간 등록·수정. 저장하면 `pending`(검토 대기)로 들어간다. */
export async function saveSpaceAction(input: SpaceFormInput): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };

  // 🔻09-16 대표 — 음식 여부·임대인 동의 «칸»을 없앴다.
  //   전대 확인은 등록 화면의 체크박스가 아니라 **호스트 약관 한 줄**로 옮겼다(약관규제법 제3조③④).
  //   음식 차단도 뺐다 — 무신고 영업 문제는 호스트 명의의 영업신고 범위 안에서 호스트 관리·감독으로
  //   푸는 것이 맞고(식품위생법 제37조④), 그것도 약관이 맡는다.
  // ⭐「사용 유의 사항」은 이 서비스에서 제일 중요한 칸이라 빈칸으로 못 넘어간다.
  if (input.rules.trim().length < 10) {
    return { ok: false, message: "사용 시 유의 사항을 열 글자 이상 적어 주세요. 이 칸이 사장님을 지켜 줍니다." };
  }
  if (!input.name.trim()) return { ok: false, message: "공간 이름을 적어 주세요." };
  if (!input.category) return { ok: false, message: "어떤 업종인지 골라 주세요." };
  if (input.openSlots.length === 0) return { ok: false, message: "빌려줄 수 있는 날과 시간을 하나 이상 정해 주세요." };
  if (input.photos.length === 0) return { ok: false, message: "사진을 한 장 이상 올려 주세요. 사진 없는 공간은 아무도 안 빌려요." };
  if (input.priceHour <= 0) return { ok: false, message: "시간당 대여 비용을 적어 주세요." };
  if (input.minHours < 1) return { ok: false, message: "최소 대여 시간은 한 시간 이상이어야 해요." };
  // ☎️🚨청약 «전»에 보여야 하는 값이라 빈칸으로 못 넘어간다.
  //   전자상거래법 제20조②(시행 2026-07-21): 중개자는 사업자 호스트의 성명·주소·전화번호를 확인해
  //   청약 전에 소비자에게 제공해야 하고, 안 하면 제20조의2②로 **우리가 연대 책임**을 진다.
  if (!input.contactPhone.trim()) {
    return { ok: false, message: "매장 전화번호를 적어 주세요. 법에 따라 신청 전에 손님께 보여드려야 해요." };
  }
  // 📜호스트 약관 동의. 없으면 수수료·정산·구상을 나중에 주장할 근거가 없다.
  if (!input.hostTermsOk) {
    return { ok: false, message: "공간 제공자 약관에 동의해 주세요." };
  }
  // 열어 둔 시간대가 말이 되는지. 거꾸로거나 최소 시간보다 짧은 칸은 아무도 못 빌린다.
  for (const sl of input.openSlots) {
    const h = hoursBetween(sl.start, sl.end);
    if (h <= 0) return { ok: false, message: `${sl.date}의 시간이 거꾸로예요. 끝나는 시각이 더 늦어야 해요.` };
    if (h < input.minHours) {
      return { ok: false, message: `${sl.date}는 ${h}시간만 열려 있어서 최소 ${input.minHours}시간을 못 채워요.` };
    }
  }

  // 수정이면 주인 확인부터. ⚠️입력에 실린 slug를 믿지 않고 DB에서 소유자를 다시 읽는다.
  if (input.slug) {
    const cur = await getSpaceFull(input.slug);
    if (!cur) return { ok: false, message: "그 공간을 찾지 못했어요." };
    if (cur.ownerUserId !== uid) return { ok: false, message: "내 공간만 고칠 수 있어요." };
  }

  // 📍주소가 «바뀔 때만» 좌표를 다시 잰다(대표 09-14 지도 요청). 유료 호출이라 매번 부르지 않고,
  //   실패해도 저장은 그대로 간다 — 지도는 있으면 좋은 것이지 올리기를 막을 것이 아니다.
  const prev = input.slug ? await getSpaceFull(input.slug) : null;
  let lat = prev?.lat;
  let lng = prev?.lng;
  if (input.address.trim() && input.address.trim() !== (prev?.address ?? "")) {
    const hit = await geocode(input.address);
    if (hit) { lat = hit.lat; lng = hit.lng; }
  }

  const slug = input.slug || makeSlug(input.name);
  // 🔁09-16 대표 — **고쳐도 공개가 유지된다.** 전엔 글자 하나만 바꿔도 검토 대기로 내려가 목록에서 사라졌다.
  //   다시 검토받는 건 «가게가 바뀌는» 둘뿐이다: 주소와 매장 이름. 나머지는 사장님이 알아서 고친다.
  const renamed = !!prev && prev.name.trim() !== input.name.trim();
  const moved = !!prev && prev.address.trim() !== input.address.trim();
  const status: Space["status"] = !prev ? "pending" : renamed || moved ? "pending" : prev.status;

  const row: SpaceSaveInput = {
    slug, ownerUserId: uid, brandSlug: input.brandSlug,
    name: input.name.trim(), tagline: "", body: input.body, photos: input.photos,
    // 동네는 이제 안 묻는다(대표 09-16: 「주소면 충분」). 옛 칸은 주소에서 앞 두 조각만 넣어 둔다 —
    // 목록의 동네 거르개가 아직 이 칸을 본다.
    area: input.address.trim().split(/\s+/).slice(0, 2).join(" "),
    address: input.address.trim(), lat, lng, accessNote: "",
    useType: input.useType, facilities: input.facilities,
    facilitiesNote: input.facilitiesNote.trim(), capacity: input.capacity,
    hours: "", rules: input.rules.trim(),
    priceDay: 0, mentorMinutes: 0, mentorPrice: 0,
    openDates: [], servesFood: false, subleaseOk: true,

    category: input.category, scope: input.scope,
    priceHour: input.priceHour, minHours: input.minHours, openSlots: input.openSlots,
    coffeeChat: input.coffeeChat,
    coffeeChatMinutes: input.coffeeChat ? input.coffeeChatMinutes : 0,
    coffeeChatPrice: input.coffeeChat ? input.coffeeChatPrice : 0,
    coffeeChatTopics: input.coffeeChat ? input.coffeeChatTopics.trim() : "",
    accessHow: input.accessHow, contactPhone: input.contactPhone.trim(),
    hostTermsAt: prev?.hostTermsAt ?? new Date().toISOString(),
    status,
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
  plan: string;
  headcount?: number;
  /** ⏱`HH:MM`. 하루 통째가 아니라 「그날 몇 시부터 몇 시까지」를 받는다(09-16). */
  startTime: string;
  endTime: string;
  withChat: boolean;
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
  if (input.plan.trim().length < 10) return { ok: false, message: "그날 무엇을 하실지 열 글자 이상 적어 주세요." };

  // ⏱시간 검사 — 화면에서도 막지만 관문은 여기다.
  const hours = hoursBetween(input.startTime, input.endTime);
  if (hours <= 0) return { ok: false, message: "끝나는 시각이 시작보다 늦어야 해요." };
  if (hours < sp.minHours) return { ok: false, message: `이 공간은 최소 ${sp.minHours}시간부터 빌릴 수 있어요.` };
  if (!fitsOpenSlot(sp.openSlots, input.useDate, input.startTime, input.endTime)) {
    return { ok: false, message: "사장님이 열어 두신 시간 안에서 골라 주세요." };
  }
  // 이미 팔린 시간과 겹치는지. ⚠️여기서 막아도 «관문은 DB»다 — 두 사람이 같은 순간에 들어오면
  //   이 검사는 둘 다 통과시키고, 승인 때 배제 제약이 뒤에 온 쪽을 떨어뜨린다.
  const taken = await listLiveBookings(sp.id, input.useDate);
  if (taken.some((b) => overlaps(b.startTime, b.endTime, input.startTime, input.endTime))) {
    return { ok: false, message: "그 시간은 이미 찼어요. 다른 시간을 골라 주세요." };
  }

  const amountSpace = Math.round(sp.priceHour * hours);
  const amountChat = input.withChat && sp.coffeeChat ? sp.coffeeChatPrice : 0;
  const amountTotal = amountSpace + amountChat;
  if (amountTotal <= 0) return { ok: false, message: "값이 정해지지 않은 공간이에요. 사장님께 확인이 필요합니다." };

  // 주문번호는 우리가 만든다. 토스에 그대로 실려 가고 돌아올 때 이 값으로 행을 찾는다.
  const orderId = `rent-${sp.id}-${input.useDate.replace(/-/g, "")}-${Math.random().toString(36).slice(2, 10)}`;

  const booking = await createPendingBooking({
    spaceId: sp.id, guestUserId: uid, guestBrandSlug: input.guestBrandSlug,
    useDate: input.useDate, hours: `${input.startTime}~${input.endTime}`, plan: input.plan.trim(),
    startTime: input.startTime, endTime: input.endTime, hoursCount: hours,
    headcount: input.headcount, withChat: amountChat > 0, amountChat,
    withMentor: false, amountMentor: 0,
    amountSpace, amountTotal,
    paymentKey: "", orderId,
  });
  if (!booking) return { ok: false, message: "신청을 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요." };

  return {
    ok: true, message: "", orderId, amount: amountTotal,
    orderName: `${sp.name} · ${input.useDate} ${input.startTime}~${input.endTime}`,
    bookingId: booking.id,
  };
}

/** 알림에 실을 세 당사자 — 공간 원본(주소 포함)·사장님·손님. 없으면 null(알림만 빠지고 본작업은 그대로).
 *  ⚠️예약 행엔 공간 id만 있고 `getSpaceFull`은 slug를 받는다. 그래서 요약본으로 slug를 찾아 한 번 더 읽는다. */
async function notifyParties(b: SpaceBooking): Promise<{ space: Space; host: Awaited<ReturnType<typeof getProfileById>>; guest: Awaited<ReturnType<typeof getProfileById>> } | null> {
  const brief = (await listSpacesByIds([b.spaceId])).get(b.spaceId);
  if (!brief) return null;
  const space = await getSpaceFull(brief.slug);
  if (!space) return null;
  const [host, guest] = await Promise.all([getProfileById(space.ownerUserId), getProfileById(b.guestUserId)]);
  return { space, host, guest };
}

/** 알림 한 통 — 🚨**결과에 영향을 주면 안 된다.** `rent-notify.ts`가 스스로 삼키지만, 조회 단계(`notifyParties`)가
 *  던질 수도 있어 한 겹 더 감싼다. 결제는 끝났는데 메일 때문에 「실패」가 뜨는 일은 없어야 한다. */
async function safeNotify(run: () => Promise<unknown>): Promise<void> {
  try { await run(); } catch (e) { console.error("[rent-actions] 알림 실패(본작업은 정상)", e); }
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
  await safeNotify(async () => {
    const p = await notifyParties(paid);
    if (p) await notifyBookingPaid(paid, p.space, p.host, p.guest);
  });
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
    await safeNotify(async () => {
      const p = await notifyParties(decided);
      if (p) await notifyBookingRejected(decided, p.space, p.host, p.guest);
    });
    return refunded
      ? { ok: true, message: "거절하고 전액 환불했어요." }
      : { ok: true, message: "거절했어요. 환불이 지연되고 있어 확인 중입니다." };
  }
  revalidatePath("/rent/my");
  await safeNotify(async () => {
    const p = await notifyParties(decided);
    if (p) await notifyBookingConfirmed(decided, p.space, p.host, p.guest);
  });
  return { ok: true, message: "수락했어요. 이제 신청자 연락처가 보입니다." };
}

/** 취소 환불액 — 견적과 실제 취소가 **같은 계산**을 써야 한다. 둘이 따로 계산하면 팝업엔 70%라 적고 50%만 돌려주는 날이 온다. */
function cancelRefund(b: SpaceBooking): { rate: number; refund: number } {
  const days = Math.floor((new Date(b.useDate).getTime() - Date.now()) / 86_400_000);
  // ⏳신청한 지 얼마나 됐나 — 1시간 안이면 남은 날과 무관하게 전액이다(대표 09-16).
  const mins = Math.floor((Date.now() - new Date(b.createdAt).getTime()) / 60_000);
  const rate = guestCancelRefundRate(days, mins);
  return { rate, refund: Math.floor(b.amountTotal * rate) };
}

/** 취소 «전» 팝업에 보여줄 환불액. 환불표는 서버 전용 파일(`rent-payment.ts`)에만 있다 —
 *  화면에 표를 다시 적으면 표가 바뀌는 날 화면만 뒤처진다. 그래서 화면은 늘 이걸 부른다. */
export async function quoteCancelAction(
  bookingId: number,
): Promise<{ ok: boolean; message: string; total: number; refund: number; rate: number }> {
  const none = { total: 0, refund: 0, rate: 0 };
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요.", ...none };
  const b = await getBooking(bookingId);
  if (!b || b.guestUserId !== uid) return { ok: false, message: "내 신청만 볼 수 있어요.", ...none };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 신청이에요.", ...none };
  const { rate, refund } = cancelRefund(b);
  return { ok: true, message: "", total: b.amountTotal, refund, rate };
}

/** 게스트 취소 — 환불률은 우리 규정표가 정한다(호스트 자율 금지). */
export async function cancelBookingAction(bookingId: number): Promise<ActionResult> {
  const uid = await getSessionUserId();
  if (!uid) return { ok: false, message: "로그인이 필요해요." };
  const b = await getBooking(bookingId);
  if (!b || b.guestUserId !== uid) return { ok: false, message: "내 신청만 취소할 수 있어요." };
  if (b.status !== "paid" && b.status !== "confirmed") return { ok: false, message: "이미 끝난 신청이에요." };

  const { refund } = cancelRefund(b);
  if (refund > 0) await cancelPayment(b.paymentKey, "게스트 취소", refund === b.amountTotal ? undefined : refund);

  await setBookingStatus(bookingId, "cancelled");
  await setOpenDate(b.spaceId, b.useDate, true);
  revalidatePath("/rent/my");
  await safeNotify(async () => {
    const p = await notifyParties(b);
    if (p) await notifyBookingCancelled({ ...b, status: "cancelled" }, p.space, p.host, p.guest);
  });
  return { ok: true, message: refund > 0 ? `취소했어요. ${refund.toLocaleString()}원이 환불됩니다.` : "취소했어요. 당일 취소라 환불은 없습니다." };
}

/** 화면에서 금액을 보여줄 때 쓰는 계산 — 호스트에게 얼마가 가는지 정직하게 적기 위한 것. */
export async function quotePayout(total: number): Promise<{ fee: number; payout: number; rate: number }> {
  const out = payout(total);
  return { fee: total - out, payout: out, rate: FEE_RATE };
}
