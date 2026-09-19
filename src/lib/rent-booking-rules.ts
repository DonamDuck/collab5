// 하루 팝업 — 「이 신청이 «지금도» 말이 되나」 (2026-09-18 밤 QA G-01·SC-11·SC-30)
//
// 🚨훅도 DB도 fetch도 안 부른다. 신청 시작(`startBookingAction`)·결제 승인(`confirmBookingAction`)·결제 화면이
//   «같은 함수»로 본다. 세 곳이 규칙을 따로 적으면 어느 하나만 뒤처지고, 그 틈으로 돈이 지나간다.
//
// 🩸09-18 밤 QA: 검사가 «신청 시작»에만 있었다. 결제창에 다녀오는 사이에 사장님이 공간을 쉬게 하거나 그 시간을 닫아도,
//   이용 시각이 이미 지났어도 승인이 그대로 나갔다. 이틀 전 신청이 결제되는 화면을 QA가 실제로 열었다(G-01).
// ⭐그래서 승인은 «부르기 전에» 공간을 다시 읽어 이 함수를 돌린다. 걸리면 토스를 아예 안 부른다 — 돈이 안 움직인다.
import type { RentProduct, Space, SpaceBooking } from "./types";
import { bookingStarted, durationLabel, fitsOpenSlot, isTimeMark, minutesBetween, overlaps, RENT_MIN_MINUTES, toMinutes } from "./rent-time";
import { bookingHasChat, isRentProduct, productPrice } from "./rent-products";
import { CAPACITY_MAX } from "./rent-limits";
import { bizOnFile } from "./bizcheck";

/** ⏳토스 결제창이 살아 있는 시간. 정리 작업(`sweepBookings`)이 신청을 만료로 옮기는 기준과 같은 값이다. */
export const PAY_WINDOW_MINUTES = 30;

/** 걸린 이유. 화면·승인이 이 코드로 「돈을 되돌릴 일인가 · 만료로 옮길 일인가」를 가른다. */
export type BookingRuleCode =
  | "closed"        // 공간이 쉬는 중이거나 아직 공개 전
  | "no-biz"        // 사업자등록번호가 빈 공간(09-19 오후 대표 — 손님 앞에 안 세운다)
  | "product-off"   // 사장님이 그 상품을 껐다
  | "chat-off"      // 커피챗을 껐다
  | "started"       // 이용 시각이 이미 시작했다(지난 날짜 포함)
  | "bad-time"      // 시각 모양이 깨졌다
  | "too-short"     // 최소 대여 시간을 못 채운다
  | "outside-slot"  // 사장님이 열어 둔 시간 밖이다
  | "taken"         // 그 사이 다른 분이 먼저 결제했다
  | "headcount";    // 인원이 1명~정원 밖이다

export type BookingRuleResult =
  /** 🔁09-19 길이는 «분»으로 돌려준다(30분 단위). 금액(`bookingAmount`)도 분을 받는다. */
  | { ok: true; minutes: number }
  | { ok: false; code: BookingRuleCode; message: string };

/** 검사에 필요한 만큼의 신청서. 신청 폼이 보낸 값과 이미 저장된 예약 행이 같은 모양으로 들어온다. */
export interface BookingRequest {
  useDate: string;
  startTime: string;
  endTime: string;
  product: RentProduct | string;
  withChat?: boolean;
  headcount?: number;
}

/** 검사에 필요한 만큼의 공간. `Space` 전체를 받지 않는 이유 = 이 파일이 타입 하나에 묶이지 않게. */
export type BookingRuleSpace = Pick<
  Space,
  "status" | "bizNumber" | "openSlots" | "capacity" | "coffeeChat" | "coffeeChatPrice"
  | "rentSpaceOn" | "rentSpacePrice" | "rentSpaceNote" | "rentFullOn" | "rentFullPrice" | "rentFullNote"
>;

/** 이미 저장된 예약 행을 신청서 모양으로. 승인·결제 화면이 쓴다. */
export function bookingRequestOf(b: Pick<SpaceBooking, "useDate" | "startTime" | "endTime" | "product" | "withChat" | "amountChat" | "amountMentor" | "headcount">): BookingRequest {
  return {
    useDate: b.useDate, startTime: b.startTime, endTime: b.endTime, product: b.product,
    // ☕옛 칸(`amountMentor`)도 커피챗으로 읽는다. 값이 붙어 있으면 산 것이다.
    //   🔁09-19 무료 커피챗은 값이 0이라 `withChat`을 같이 본다(`bookingHasChat`).
    withChat: bookingHasChat(b),
    headcount: b.headcount,
  };
}

/** `now`(Date) → KST의 오늘 날짜와 지금 시각. 이 파일은 시계를 직접 안 읽는다 — 호출부가 넘긴 때로만 판단한다. */
function kstNow(now: Date): { today: string; hhmm: string } {
  const s = new Date(now.getTime() + 9 * 3_600_000).toISOString();
  return { today: s.slice(0, 10), hhmm: s.slice(11, 16) };
}

/**
 * 신청 한 건이 지금 이 공간에서 말이 되는가.
 * @param taken 그 공간 그 날짜에 «살아 있는» 예약들(겹침 판정용). 없으면 겹침은 안 본다 — DB가 마지막 관문이다.
 */
export function validateBookingRequest(
  space: BookingRuleSpace,
  req: BookingRequest,
  now: Date = new Date(),
  taken: Pick<SpaceBooking, "startTime" | "endTime">[] = [],
): BookingRuleResult {
  const { today, hhmm } = kstNow(now);

  if (space.status !== "open") return { ok: false, code: "closed", message: "지금은 신청할 수 없는 공간이에요." };
  // 🚪09-19 오후 대표 — 사업자등록번호가 빈 공간은 목록·상세에서 빠진다(`spaceListed`). 주소를 들고 오거나 결제창에 다녀오는
  //   사이에도 돈이 움직이지 않게 여기서 막는다. 결제 승인은 이 코드를 «되돌릴 일 없는 막힘»으로 읽는다(토스를 안 부른다).
  if (!bizOnFile(space)) {
    return { ok: false, code: "no-biz", message: "이 공간은 아직 사장님 사업자 정보를 확인하는 중이에요." };
  }
  if (!isRentProduct(req.product) || productPrice(space, req.product) <= 0) {
    return { ok: false, code: "product-off", message: "이 공간에서 팔지 않는 상품이에요. 새로고침하고 다시 골라 주세요." };
  }
  // 🔁09-19 대표 #93 — 무료 커피챗(값 0)도 켜진 커피챗이다. 값이 아니라 켜짐으로 본다.
  if (req.withChat && !space.coffeeChat) {
    return { ok: false, code: "chat-off", message: "지금은 커피챗을 받지 않는 공간이에요. 새로고침하고 다시 골라 주세요." };
  }
  // ⏳지난 «날». 화면도 거르지만(`futureSlots`) 관문은 여기다 — 열어 둔 날이 지나도 주소를 그대로 들고 오는 길이 있다.
  if (req.useDate < today) return { ok: false, code: "started", message: "지난 날짜는 신청할 수 없어요." };
  // ⏱30분 눈금(대표 09-19). 🔁09-18 밤 QA(SEC-08)엔 정시만 받게 막았다가 대표 결정으로 되돌렸다.
  //   24시 넘김(`24:30`)과 눈금 밖(`10:15`)은 여전히 여기서 걸린다.
  if (!isTimeMark(req.startTime) || !isTimeMark(req.endTime)) {
    return { ok: false, code: "bad-time", message: "시작과 끝 시각은 30분 단위로 골라 주세요. 새로고침하고 다시 골라 주세요." };
  }
  const minutes = minutesBetween(req.startTime, req.endTime);
  if (minutes <= 0) return { ok: false, code: "bad-time", message: "끝나는 시각이 시작보다 늦어야 해요." };
  // ⚠️지난 «시각» 검사는 모양 검사 «뒤»다. 앞에 두면 못 읽은 시각(`-1`)이 「이미 지났다」로 잡힌다.
  if (req.useDate === today && toMinutes(req.startTime) <= toMinutes(hhmm)) {
    return { ok: false, code: "started", message: "이미 지난 시간이에요. 다른 시간을 골라 주세요." };
  }
  // ⏱🔒09-19 대표 #88 — 최소 대여 시간은 모든 공간 1시간. 공간 행의 옛 값(2·3시간)은 안 본다.
  if (minutes < RENT_MIN_MINUTES) {
    return { ok: false, code: "too-short", message: `최소 ${durationLabel(RENT_MIN_MINUTES)}부터 빌릴 수 있어요.` };
  }
  if (!fitsOpenSlot(space.openSlots, req.useDate, req.startTime, req.endTime)) {
    return { ok: false, code: "outside-slot", message: "사장님이 열어 두신 시간 안에서 골라 주세요." };
  }
  // 🙋09-18 밤 QA(G-08) — 인원. 화면은 「최대 N명까지 들어가요」라고 약속하는데 서버는 음수도 500명도 받았다.
  //   ⭐대표 판단은 «막기»다(화면이 이미 약속한 숫자라 안 지키면 그 약속이 거짓이 된다). 안 적은 경우(모르겠어요)는 그대로 둔다.
  if (req.headcount !== undefined && req.headcount !== null) {
    const cap = space.capacity && space.capacity > 0 ? Math.min(space.capacity, CAPACITY_MAX) : CAPACITY_MAX;
    if (!Number.isInteger(req.headcount) || req.headcount < 1 || req.headcount > cap) {
      return { ok: false, code: "headcount", message: `인원은 1명부터 최대 ${cap}명까지 적어 주세요.` };
    }
  }
  // 이미 팔린 시간과 겹치는지. ⚠️여기서 막아도 «관문은 DB»다 — 같은 순간에 둘이 들어오면 배제 제약이 뒤에 온 쪽을 떨어뜨린다.
  if (taken.some((b) => overlaps(b.startTime, b.endTime, req.startTime, req.endTime))) {
    return { ok: false, code: "taken", message: "그 시간은 이미 찼어요. 다른 시간을 골라 주세요." };
  }
  return { ok: true, minutes };
}

/** 결제 시간이 얼마나 남았나(밀리초). 음수면 지났다. 기준은 신청을 시작한 시각(`createdAt`)이다. */
export function payWindowLeftMs(createdAt: string, now: Date = new Date()): number {
  const started = new Date(createdAt).getTime();
  if (!Number.isFinite(started)) return PAY_WINDOW_MINUTES * 60_000;
  return started + PAY_WINDOW_MINUTES * 60_000 - now.getTime();
}

/** 30분이 지났나. */
export function payWindowOver(createdAt: string, now: Date = new Date()): boolean {
  return payWindowLeftMs(createdAt, now) <= 0;
}

/** 결제 전 신청이 지금 결제될 수 있는 상태인가 — 결제 화면과 승인이 같이 쓴다.
 *  · `expired` 결제 시간 30분이 지났다 → 만료로 옮긴다
 *  · `started` 이용 시각이 이미 시작했다 → 만료로 옮긴다
 *  · 그 밖(`closed`·`taken`…) → 승인을 안 부르고 그대로 둔다(사장님이 되돌리면 30분 안엔 살아 있다) */
export type PendingProblem = { code: "expired" | BookingRuleCode; message: string };

export function pendingBookingProblem(
  booking: Pick<SpaceBooking, "useDate" | "startTime" | "endTime" | "product" | "withChat" | "amountChat" | "amountMentor" | "headcount" | "createdAt">,
  space: BookingRuleSpace | null,
  taken: Pick<SpaceBooking, "startTime" | "endTime">[],
  now: Date = new Date(),
): PendingProblem | null {
  const { today, hhmm } = kstNow(now);
  // ⏯시작한 예약이 먼저다. 30분도 지났고 시각도 시작했으면 손님에게 더 분명한 쪽을 말한다.
  if (bookingStarted(booking, today, hhmm)) {
    return { code: "started", message: "신청하신 시간이 이미 시작돼서 결제할 수 없어요." };
  }
  if (payWindowOver(booking.createdAt, now)) {
    return { code: "expired", message: `결제 시간 ${PAY_WINDOW_MINUTES}분이 지나서 이 신청은 닫혔어요.` };
  }
  if (!space) return { code: "closed", message: "지금은 신청을 받지 않는 공간이에요." };
  const rule = validateBookingRequest(space, bookingRequestOf(booking), now, taken);
  return rule.ok ? null : { code: rule.code, message: rule.message };
}
