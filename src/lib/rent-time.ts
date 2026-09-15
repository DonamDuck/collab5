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
