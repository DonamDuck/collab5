// 하루 가게 — 시간 계산 (2026-09-16)
//
// ⭐**순수 함수만 둔다.** DB도 React도 안 부른다 — 그래야 서버 액션과 화면이 «같은 코드»로 계산한다.
//   화면과 서버가 각자 계산하면 언젠가 두 값이 갈라지고, 그때 손님이 보는 쪽이 틀린다.
// ⏱눈금은 1시간이다(대표 09-16). 30분은 가게가 그렇게 생각하지 않고 달력·요금·겹침이 두 배로 복잡해진다.
//   대신 호스트가 정하는 «최소 대여 시간»이 그 필요를 덮는다.
import type { OpenSlot, RepeatRule } from "./types";

/** "HH:MM" → 분. 모양이 아니면 -1 — 호출부가 「못 읽었다」와 「0시」를 가를 수 있어야 한다.
 *  ⏱24시는 «끝나는 시각» 자리에 오는 `24:00` 하나뿐이다. 🩸09-18 밤 QA(SEC-08) — 전엔 `24:30`이 1470분으로 읽혀서
 *    화면 없이 부른 액션이 자정 넘은 칸을 열고 팔 수 있었다. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(hhmm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h < 0 || h > 24 || mi < 0 || mi > 59 || (h === 24 && mi > 0)) return -1;
  return h * 60 + mi;
}

/** 정시 모양(`HH:00`, 00시~24시)인가. 눈금이 1시간이라(대표 09-16) 서버가 새로 받는 시각은 이 모양이어야 한다.
 *  화면 고르개(`OpenSlotsCalendar`의 `HOURS`, 신청 폼의 `hourMarks`)도 이 모양만 만든다(09-18 밤 QA SEC-08). */
export function isHourMark(hhmm: string): boolean {
  return /^([01]\d|2[0-4]):00$/.test(hhmm ?? "");
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
 *    그래서 Date를 거치지 않고 글자를 쪼갠 뒤, 요일만 따로 계산한다.
 *  🩸09-16까지 같은 계산이 화면(`app/rent/ui.tsx`)과 메일(`lib/rent-notify.ts`)에 따로 있었다.
 *    한 벌이면 어느 날 서식이 갈라질 자리가 없다.
 *  🩸09-18 밤 QA(SC-25) — 요일을 «KST 정오의 `getDay()`»로 셌다. `getDay()`는 기기 시간대를 타서 로스앤젤레스 같은 곳에선
 *    하루 앞 요일(9월 21일이 (일))이 나왔고, 서버(서울)가 그린 글자와 달라 hydration 불일치가 났다.
 *    이제 UTC 달력으로 세는 `dowOfIso`를 쓴다. 날짜 글자는 그대로 두고 요일만 날짜 글자에서 곧장 나온다. */
export function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const dow = "일월화수목금토"[dowOfIso(iso)];
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

/** 📅오늘(KST)부터 그 날짜까지 «달력으로» 며칠 남았나. 오늘이면 0, 내일이면 1, 어제면 -1.
 *  ⭐시각을 안 본다 — 환불 규정의 「이용일 7일 전까지」는 한국 달력 날짜의 차이다.
 *  두 날짜를 둘 다 UTC 자정으로 읽어 빼므로 시간대 어긋남이 서로 지워진다. */
export function kstDaysUntil(useDate: string, today = todayKst()): number {
  const a = Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1, +today.slice(8, 10));
  const b = Date.UTC(+useDate.slice(0, 4), +useDate.slice(5, 7) - 1, +useDate.slice(8, 10));
  return Math.round((b - a) / 86_400_000);
}

// ─── 🔁요일 계속 열기 (2026-09-17 대표: 「오늘 다 구현」) ───
//
// 🩸그 전엔 날짜를 하나씩(또는 요일 머리글로 «그 달»만) 담았다. 「매주 월요일 9~17시」를 열려면 달마다 다시 와야 했다.
// ⭐규칙은 `spaces.repeat_weekly`에 저장하고 **읽을 때 펼친다**(`toSpace` 한 곳). 그래서 목록 날짜 거르기·상세 달력·
//   결제 전 `fitsOpenSlot` 검사가 전부 같은 값을 본다. 펼친 날짜는 DB에 굳히지 않는다(`stripRepeat`) —
//   굳히면 규칙을 꺼도 날이 안 사라진다.
// 🧷«하루만 쉬기»는 규칙 안의 `skip` 날짜로 푼다. 새 칸을 만들지 않으려고 같은 jsonb 안에 뒀다.

/** 규칙이 앞으로 몇 주를 펼치나. 오늘(KST)부터 7×12일, 오늘 포함. */
export const REPEAT_WEEKS = 12;

/** `YYYY-MM-DD`의 요일 번호(0=일 … 6=토). `Date.UTC`로 만들어 기기 시간대를 안 탄다.
 *  ⚠️`OpenSlotsCalendar`의 `DOW = ["일","월",…]` 순서와 같다 — 규칙의 `dow`도 이 번호다. */
export function dowOfIso(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** 날짜에 n일 더하기. 역시 UTC 정수 연산이라 시간대가 안 낀다. */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 규칙 하나가 지금 여는 날짜들 — 오늘부터 12주 안의 그 요일, 쉬는 날(`skip`)은 뺀다. 지난 날짜는 안 만든다. */
export function repeatDates(rule: RepeatRule, today = todayKst()): string[] {
  const skip = new Set(rule.skip ?? []);
  const first = (rule.dow - dowOfIso(today) + 7) % 7;
  const out: string[] = [];
  for (let k = first; k < REPEAT_WEEKS * 7; k += 7) {
    const iso = addDaysIso(today, k);
    if (!skip.has(iso)) out.push(iso);
  }
  return out;
}

/** 직접 연 칸 + 규칙이 연 칸. ⭐**같은 날짜에 직접 연 칸이 있으면 직접 연 쪽이 이긴다**
 *  (사장님이 그날만 시간을 바꿔 둔 것이다). 결과는 날짜순. */
export function expandRepeat(direct: OpenSlot[], rules: RepeatRule[], today = todayKst()): OpenSlot[] {
  const have = new Set(direct.map((sl) => sl.date));
  const add: OpenSlot[] = [];
  for (const r of rules) {
    for (const date of repeatDates(r, today)) {
      if (have.has(date)) continue;
      have.add(date);
      add.push({ date, start: r.start, end: r.end });
    }
  }
  return [...direct, ...add].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.start < b.start ? -1 : 1));
}

/** 저장 직전 — «규칙이 만든 것과 똑같은 칸»(같은 요일·같은 시각·12주 창 안·쉬는 날 아님)을 뺀다.
 *  🚨안 빼면 펼친 날짜가 DB에 굳어서 규칙을 꺼도 그 날들이 계속 열려 있다.
 *  ⭐시각이 다른 칸(그날만 따로 정한 날)과 창 밖의 칸은 남는다. */
export function stripRepeat(slots: OpenSlot[], rules: RepeatRule[], today = todayKst()): OpenSlot[] {
  if (rules.length === 0) return slots;
  const made = new Map<string, string>();
  for (const r of rules) for (const date of repeatDates(r, today)) made.set(date, `${r.start}~${r.end}`);
  return slots.filter((sl) => made.get(sl.date) !== `${sl.start}~${sl.end}`);
}

/** 지난 쉬는 날은 들고 있을 이유가 없다. 저장할 때 턴다. */
export function pruneRepeat(rules: RepeatRule[], today = todayKst()): RepeatRule[] {
  return rules.map((r) => {
    const skip = (r.skip ?? []).filter((d) => d >= today);
    return skip.length ? { dow: r.dow, start: r.start, end: r.end, skip } : { dow: r.dow, start: r.start, end: r.end };
  });
}
