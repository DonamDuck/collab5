// 하루 가게 — 시간 계산 (2026-09-16)
//
// ⭐**순수 함수만 둔다.** DB도 React도 안 부른다 — 그래야 서버 액션과 화면이 «같은 코드»로 계산한다.
//   화면과 서버가 각자 계산하면 언젠가 두 값이 갈라지고, 그때 손님이 보는 쪽이 틀린다.
// ⏱눈금은 1시간이다(대표 09-16). 30분은 가게가 그렇게 생각하지 않고 달력·요금·겹침이 두 배로 복잡해진다.
//   대신 호스트가 정하는 «최소 대여 시간»이 그 필요를 덮는다.
import type { OpenSlot } from "./types";

/** "HH:MM" → 분. 모양이 아니면 -1 — 호출부가 「못 읽었다」와 「0시」를 가를 수 있어야 한다. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 24 || mi < 0 || mi > 59) return -1;
  return h * 60 + mi;
}

/** 분 → "HH:MM". */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 두 시각 사이의 «시간» 수. 못 읽거나 거꾸로면 0. */
export function hoursBetween(start: string, end: string): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a < 0 || b < 0 || b <= a) return 0;
  return (b - a) / 60;
}

/** 그 날짜에 호스트가 열어 둔 시간대. 같은 날 여러 칸이 있을 수 있다. */
export function slotsOn(slots: OpenSlot[], date: string): OpenSlot[] {
  return slots.filter((s) => s.date === date);
}

/** 신청한 구간이 열린 시간대 «안»에 통째로 들어가는가.
 *  ⚠️걸쳐 있으면 안 된다 — 10~18시를 열었는데 17~19시를 받으면 문 닫은 뒤 한 시간이 팔린다. */
export function fitsOpenSlot(slots: OpenSlot[], date: string, start: string, end: string): boolean {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a < 0 || b < 0 || b <= a) return false;
  return slotsOn(slots, date).some((s) => {
    const sa = toMinutes(s.start);
    const sb = toMinutes(s.end);
    return sa >= 0 && sb >= 0 && a >= sa && b <= sb;
  });
}

/** 그 시간대를 1시간 눈금으로 쪼갠 «시작 가능 시각» 목록.
 *  ⭐끝나는 시각은 따로 계산한다 — 시작을 고르면 그때부터 남은 시간이 정해지기 때문이다. */
export function hourMarks(slot: OpenSlot): string[] {
  const a = toMinutes(slot.start);
  const b = toMinutes(slot.end);
  if (a < 0 || b < 0 || b <= a) return [];
  const out: string[] = [];
  // 정시로 올려서 시작한다. 10:30에 연 가게는 11시부터 팔린다 — 30분 조각을 만들지 않기로 했다.
  for (let t = Math.ceil(a / 60) * 60; t <= b; t += 60) out.push(toHHMM(t));
  return out;
}

/** 두 구간이 겹치는가. 끝과 시작이 맞닿는 건 «안 겹침»이다(10~12와 12~14는 나란히 쓸 수 있다). */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = toMinutes(aStart), a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart), b2 = toMinutes(bEnd);
  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
}

/** 화면에 쓰는 한 줄. "10:00~14:00 (4시간)" */
export function rangeLabel(start: string, end: string): string {
  const h = hoursBetween(start, end);
  return h > 0 ? `${start}~${end} (${h % 1 === 0 ? h : h.toFixed(1)}시간)` : `${start}~${end}`;
}

/** `2026-10-05` → `10월 5일 (월)`.
 *  ⚠️`new Date("2026-10-05")`는 UTC 자정으로 읽혀 KST에선 하루 전으로 밀린다.
 *    그래서 Date를 거치지 않고 글자를 쪼갠 뒤, 요일만 정오 기준으로 계산한다.
 *  🩸09-16까지 같은 계산이 화면(`app/rent/ui.tsx`)과 메일(`lib/rent-notify.ts`)에 따로 있었다.
 *    한 벌이면 어느 날 서식이 갈라질 자리가 없다. */
export function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dow = "일월화수목금토"[new Date(`${iso}T12:00:00+09:00`).getDay()];
  return `${Number(m[2])}월 ${Number(m[3])}일 (${dow})`;
}

/** 예약 한 건의 「언제」 한 줄 — `10월 6일 (화) 13:00~15:00 (2시간)`.
 *
 *  🩸**09-16까지 이 자리가 날짜만 말했다.** 시간 단위로 판매를 바꿔 놓고, 정작 사장님이 받는
 *    신청 목록과 메일에는 몇 시에 오는지가 없었다. 옛 `hours` 칸(자유 글)을 보고 있었는데
 *    새 예약은 그 칸을 안 채운다 — 빈 값이라 화면에서도 조용히 사라졌다.
 *  ⭐옛 예약은 그 `hours` 글이 유일한 단서라 아직 읽어 준다. 옛 칸을 지우는 날 이 갈래도 같이 지운다. */
export function bookingWhen(b: {
  useDate: string;
  startTime?: string;
  endTime?: string;
  hours?: string;
}): string {
  const date = dateLabel(b.useDate);
  if (b.startTime && b.endTime) return `${date} ${rangeLabel(b.startTime, b.endTime)}`;
  return b.hours ? `${date} · ${b.hours}` : date;
}

/** 오늘(KST) `YYYY-MM-DD`.
 *  ⭐서버가 어느 시간대에 떠 있든 같은 답을 준다 — UTC에 9시간을 더해 «날짜만» 떼어낸다.
 *    그래서 화면(브라우저)과 서버 액션이 같은 「오늘」을 본다. */
export function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

/** 지금(KST) `HH:MM`. 같은 날 이미 지나간 시각을 파는 걸 막는 데 쓴다. */
export function nowHhmmKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(11, 16);
}

/** 아직 팔 수 있는 시간대만 남긴다 — 지난 날은 통째로 빼고, 오늘은 «이미 끝난» 칸을 뺀다.
 *
 *  🩸09-16까지 이걸 «아무도» 안 했다. 사장님이 열어 둔 날이 지나가도 달력에 그대로 남고,
 *    서버도 지난 날짜를 그냥 받았다. 지난주 날짜로 결제가 되는 것이다.
 *  ⭐화면과 서버가 같은 함수를 부른다. 한쪽만 걸러 두면 언젠가 그 틈으로 들어온다. */
export function futureSlots(slots: OpenSlot[], today = todayKst(), now = nowHhmmKst()): OpenSlot[] {
  return slots.filter((sl) => {
    if (sl.date < today) return false;
    if (sl.date > today) return true;
    return toMinutes(sl.end) > toMinutes(now);
  });
}

/** ⏯이 예약이 «시작했나» — 시작 시각이 지났으면 참.
 *  🚨**시작한 예약은 취소할 수 없다**(09-16). 09-16까지 확정된 예약은 이용일이 지나도 취소 버튼이 떠서,
 *    이미 쓴 예약을 「취소」로 바꾸면 환불은 0원인데 **사장님 정산에서 통째로 빠졌다.**
 *  ⚠️시각이 없는 옛 예약은 그날 0시를 시작으로 본다(그날이 되면 막힌다). */
export function bookingStarted(b: { useDate: string; startTime?: string }, today = todayKst(), now = nowHhmmKst()): boolean {
  if (b.useDate < today) return true;
  if (b.useDate > today) return false;
  const st = b.startTime ? toMinutes(b.startTime) : 0;
  return st <= toMinutes(now);
}

/** ⏹이 예약이 «끝났나» — 끝나는 시각이 지났으면 참. 「다녀왔어요」로 넘기는 기준이다.
 *  ⚠️시각이 없는 옛 예약은 그날이 다 지나야(다음 날) 끝난 것으로 본다. */
export function bookingFinished(b: { useDate: string; endTime?: string }, today = todayKst(), now = nowHhmmKst()): boolean {
  if (b.useDate < today) return true;
  if (b.useDate > today) return false;
  if (!b.endTime) return false;
  return toMinutes(b.endTime) <= toMinutes(now);
}

