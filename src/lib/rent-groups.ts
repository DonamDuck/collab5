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

/** 🗂09-27 대표 — 손님 목록의 탭 «한 벌». `/rent/requests`(위 탭)와 `/rent/my?tab=guest`(칩)가 이 배열로 탭을 그리고,
 *  아래 `guestBookingTab`이 예약 한 건을 탭에 넣는다. ⭐탭을 늘리거나 이름·순서를 바꿀 땐 이 둘만 고친다.
 *  대표 원문(09-27 #162): 「메뉴 탭을 만들어서 관리하자 한 화면에 모두 스크롤로 넣지말고!」 → 넷으로 확정.
 *  · `key` 주소의 `?g=` 값(새로 고침·뒤로 가기·메일 링크에서 같은 탭이 열린다)
 *  · `ahead` 아직 쓰기 전인 예약의 탭 — `/my`의 「내 예약」 숫자가 이 탭들을 센다. 빈 탭엔 「공간 둘러보기」가 붙는다.
 *  · `empty` 탭이 비었을 때 한 줄 */
export const GUEST_TABS = [
  { key: "waiting", label: "예약 확정 대기", empty: "사장님 확정을 기다리는 예약이 없어요.", ahead: true },
  { key: "confirmed", label: "예약 확정 완료", empty: "확정된 예약이 없어요.", ahead: true },
  { key: "past", label: "지난 예약", empty: "다녀온 예약이 아직 없어요.", ahead: false },
  { key: "cancel", label: "취소 예약", empty: "취소하거나 돌려받은 예약이 없어요.", ahead: false },
] as const;

export type GuestTabKey = (typeof GUEST_TABS)[number]["key"];

/** 예약 한 건이 어느 탭에 서나. `null`이면 목록에 안 세운다.
 *  · 예약 확정 대기 = 결제 완료(`paid`). 이용일이 지났어도 정리 작업이 옮길 때까지 여기 둔다(대표 09-27).
 *    + 결제를 시도한 흔적이 있는 결제 전 신청(`checking`, 「결제를 확인하고 있어요」) — 돈이 나갔을 수 있어 꼭 보여 준다.
 *  · 예약 확정 완료 = 확정(`confirmed`)이고 이용이 안 끝남
 *  · 지난 예약 = 다녀옴(`done`), 그리고 이용이 끝난 확정(정리 작업이 다녀옴으로 옮기기 전)
 *  · 취소 예약 = 손님 취소·사장님 거절·환불
 *  · 🔻안 세움 = 결제창만 열고 떠난 신청(흔적 없는 `pending`)과 결제 시간이 지난 신청(`expired`).
 *    대표 09-27: 「이어서 결제하기 스펙 자체를 지우자. 결제창 갔다가 껐다가 고민하는 걸 다 남기면 너무 큰 데이터 낭비」.
 *  @param checking 결제 전인데 결제를 시도한 흔적이 있나(`hasPayTrace`). 모르면 거짓으로 둔다. */
export function guestBookingTab(b: Pick<SpaceBooking, "status" | "useDate" | "endTime">, checking = false): GuestTabKey | null {
  switch (b.status) {
    case "pending": return checking ? "waiting" : null;
    case "expired": return null;
    case "paid": return "waiting";
    case "confirmed": return bookingFinished(b) ? "past" : "confirmed";
    case "done": return "past";
    default: return "cancel"; // cancelled · rejected · refunded
  }
}

/** 빌린 예약을 탭별로. 안 세우는 예약은 빠진다. 무리 안의 순서는 받은 순서 그대로다(정렬은 화면 몫).
 *  화면마다 줄 모양이 달라(`SpaceBooking` 그대로 · 줄 묶음 `{ booking }`) 예약과 흔적을 꺼내는 법을 받는다. */
export function groupGuestBookings<T>(
  list: T[],
  bookingOf: (item: T) => SpaceBooking,
  checkingOf: (item: T) => boolean = () => false,
): Record<GuestTabKey, T[]> {
  const out = Object.fromEntries(GUEST_TABS.map((t) => [t.key, [] as T[]])) as Record<GuestTabKey, T[]>;
  for (const item of list) {
    const tab = guestBookingTab(bookingOf(item), checkingOf(item));
    if (tab) out[tab].push(item);
  }
  return out;
}

/** 아직 쓰기 전인 예약 수 — `ahead` 탭들의 합. `/my`의 「내 예약」 숫자.
 *  ⚠️`/my`는 결제 줄을 안 읽어서 결제 확인 중인 신청(흔적 있는 `pending`, 잠깐 있다 사라진다)은 세지 않는다. */
export function countGuestAhead(list: SpaceBooking[]): number {
  const g = groupGuestBookings(list, (b) => b);
  return GUEST_TABS.filter((t) => t.ahead).reduce((n, t) => n + g[t.key].length, 0);
}

/** 주소의 `?g=` 값 → 탭. 모르는 값(옛 `upcoming` 등)은 null. */
export function parseGuestTab(v: string | undefined | null): GuestTabKey | null {
  return GUEST_TABS.find((t) => t.key === v)?.key ?? null;
}

/** 주소에 탭이 없을 때 여는 탭 — 줄이 있는 첫 탭. 다 비었으면 첫 탭.
 *  🩸첫 탭만 기본으로 두면 확정이 끝난 손님은 늘 빈 「예약 확정 대기」부터 본다. */
export function defaultGuestTab<T>(groups: Record<GuestTabKey, T[]>): GuestTabKey {
  return GUEST_TABS.find((t) => groups[t.key].length > 0)?.key ?? GUEST_TABS[0].key;
}

/** 예약 한 건을 짚는 「내 예약」 주소 — 그 예약이 선 탭을 열고 그 줄(`#b-<번호>`)로 간다. 목록에 안 서는 예약이면 목록 첫 화면. */
export function guestBookingHref(b: Pick<SpaceBooking, "id" | "status" | "useDate" | "endTime">, checking = false): string {
  const tab = guestBookingTab(b, checking);
  return tab ? `/rent/requests?g=${tab}#b-${b.id}` : "/rent/requests";
}
