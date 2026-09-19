// 하루 팝업 — 예약을 무리로 가르는 판정 한 벌 (2026-09-18 밤 QA SC-14)
//
// 🩸같은 사람의 같은 예약을 `/my`의 하루 팝업 숫자와 `/rent/my`가 다르게 셌다(목 host-full: 다가오는 예약 3 vs 2).
//   `/my`는 답할 새 요청까지 「다가오는 예약」에 넣었고, 「빌린 예약」에선 아직 결제 전인 신청을 뺐다.
//   판정을 화면마다 손으로 옮겨 적은 탓이다. 한쪽 화면만 고쳐지는 날이 오면 숫자는 조용히 어긋난다.
// ⭐판정은 여기 한 곳. 화면은 이 무리를 받아 모양과 순서만 정한다. 쓰는 곳 = `/rent/my`(정렬·무리·카드 색) · `/my`(숫자 세 칸) · `/rent/requests`.
// ⏱시간 판정은 `rent-time`의 `bookingStarted`·`bookingFinished` 한 벌이다. 여기서 날짜를 따로 비교하지 않는다.
// 🚨훅·DB 없는 순수 함수다(`"use client"`도 `"use server"`도 없다). 서버·브라우저 어디서 불러도 된다.
import type { SpaceBooking } from "./types";
import { bookingFinished, bookingStarted } from "./rent-time";

// ─── 사장님 쪽 · 들어온 요청 ───

/** answer = 답을 기다리는 요청(결제 완료·이용 시작 전) · upcoming = 다가오는 예약 · past = 지난 요청(끝났거나 닫힌 것). */
export type HostBookingGroup = "answer" | "upcoming" | "past";

export function hostBookingGroup(b: SpaceBooking): HostBookingGroup {
  if (b.status === "paid" && !bookingStarted(b)) return "answer";
  if ((b.status === "paid" || b.status === "confirmed") && !bookingFinished(b)) return "upcoming";
  return "past";
}

/** 들어온 요청을 세 무리로. 무리 안의 순서는 받은 순서 그대로다(정렬은 화면 몫). */
export function groupHostBookings<T extends SpaceBooking>(list: T[]): { toAnswer: T[]; upcoming: T[]; past: T[] } {
  const out = { toAnswer: [] as T[], upcoming: [] as T[], past: [] as T[] };
  for (const b of list) {
    const g = hostBookingGroup(b);
    (g === "answer" ? out.toAnswer : g === "upcoming" ? out.upcoming : out.past).push(b);
  }
  return out;
}

// ─── 손님 쪽 · 빌린 예약 ───

/** upcoming = 예약 완료(결제 완료·확정이고 이용이 안 끝남 + 결제 전인데 이용 시작 전이라 이어서 낼 수 있는 신청)
 *  · past = 지난 예약(다녀옴, 또는 결제 완료·확정인데 이용이 끝남)
 *  · cancel = 취소·환불(손님 취소·사장님 거절·환불, 결제 안 한 채 끝난 신청). */
export type GuestBookingGroup = "upcoming" | "past" | "cancel";

export function guestBookingGroup(b: SpaceBooking): GuestBookingGroup {
  const live = b.status === "paid" || b.status === "confirmed";
  if ((live && !bookingFinished(b)) || (b.status === "pending" && !bookingStarted(b))) return "upcoming";
  if (b.status === "done" || (live && bookingFinished(b))) return "past";
  return "cancel";
}

/** 빌린 예약을 세 무리로. 화면마다 줄 모양이 달라(`SpaceBooking` 그대로 · 줄 묶음 `{ booking }`) 예약을 꺼내는 법을 받는다. */
export function groupGuestBookings<T>(
  list: T[],
  bookingOf: (item: T) => SpaceBooking,
): { upcoming: T[]; past: T[]; cancel: T[] } {
  const out = { upcoming: [] as T[], past: [] as T[], cancel: [] as T[] };
  for (const item of list) out[guestBookingGroup(bookingOf(item))].push(item);
  return out;
}
