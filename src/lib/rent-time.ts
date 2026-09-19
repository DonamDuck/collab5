// 하루 가게 — 시간 계산 (2026-09-16)
//
// ⭐**순수 함수만 둔다.** DB도 React도 안 부른다 — 그래야 서버 액션과 화면이 «같은 코드»로 계산한다.
//   화면과 서버가 각자 계산하면 언젠가 두 값이 갈라지고, 그때 손님이 보는 쪽이 틀린다.
// ⏱눈금은 30분이다(대표 09-19: 「9시 30분 ~ 12시의 자투리도 가능」 · 「고객은 30분 단위로」).
//   🔁09-16엔 1시간이었다. 그때는 「가게가 30분으로 생각하지 않는다」고 봤는데, 사장님이 여는 시각부터 반 시간에 걸쳐 있었다.
//   ⭐시각은 전부 이 파일의 함수로 읽고 센다. 길이는 «분»(정수)으로 세고, 사람에게 보일 땐 `durationLabel` 하나로 적는다.
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

/** ⏱눈금 한 칸(분). 사장님이 여는·닫는 시각, 손님이 고르는 시작·끝 시각이 모두 이 간격이다(대표 09-19). */
export const TIME_STEP_MIN = 30;

/** 눈금 모양(`HH:00`·`HH:30`, 00:00~24:00)인가. 서버가 새로 받는 시각은 이 모양이어야 한다.
 *  🔁09-18 밤 QA(SEC-08)에 정시만 받게 막았던 자리다. 대표 09-19 결정으로 30분까지 연다.
 *  ⚠️24시는 «끝나는 시각» 자리의 `24:00` 하나뿐이다. `24:30`은 여기서도 `toMinutes`에서도 걸린다. */
export function isTimeMark(hhmm: string): boolean {
  return /^(([01]\d|2[0-3]):[03]0|24:00)$/.test(hhmm ?? "");
}

/** 분 → "HH:MM". */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** 하루의 눈금 전부 — `00:00`, `00:30` … `24:00`(49개). 사장님이 여는·닫는 시각을 고르는 목록이다. */
export const DAY_MARKS: readonly string[] = Array.from({ length: (24 * 60) / TIME_STEP_MIN + 1 }, (_, i) => toHHMM(i * TIME_STEP_MIN));

/** 두 시각 사이의 «분». 못 읽거나 거꾸로면 0.
 *  ⭐길이는 이 정수로 센다. 09-18까지는 «시간»(소수)으로 셌고, 반 시간이 들어오면 `2.5`를 화면마다 따로 자르게 된다. */
export function minutesBetween(start: string, end: string): number {
  const a = toMinutes(start);
  const b = toMinutes(end);
  if (a < 0 || b < 0 || b <= a) return 0;
  return b - a;
}

/** 길이 한 줄 — 150 → `2시간 30분`, 180 → `3시간`, 30 → `30분`. 0 이하면 빈 글.
 *  ⭐사람에게 보이는 길이는 전부 이 함수다(신청 폼·확인 팝업·결제 화면·내 하루 가게·메일의 `bookingWhen`).
 *    🩸09-18까지는 자리마다 `h % 1 === 0 ? h : h.toFixed(1)`을 따로 적어 반 시간이 `2.5시간`으로 나올 참이었다. */
export function durationLabel(minutes: number): string {
  if (!(minutes > 0)) return "";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (!h) return `${m}분`;
  return m ? `${h}시간 ${m}분` : `${h}시간`;
}

/** 예약 한 건의 길이(분). 시작·끝 시각이 있으면 그 차이가 답이다(값의 근거와 같은 칸).
 *  ⚠️시각이 없는 옛 예약만 저장된 분(`minutesCount`), 그다음 옛 시간 수(`hoursCount`)로 물러선다. */
export function bookingMinutes(b: { startTime?: string; endTime?: string; minutesCount?: number; hoursCount?: number }): number {
  const byTime = b.startTime && b.endTime ? minutesBetween(b.startTime, b.endTime) : 0;
  if (byTime > 0) return byTime;
  if (b.minutesCount && b.minutesCount > 0) return b.minutesCount;
  return b.hoursCount && b.hoursCount > 0 ? Math.round(b.hoursCount * 60) : 0;
}

/** 최소 대여 시간(시간 단위, 0.5 눈금)을 분으로. 저장값은 정수가 아니어도 되지만 비교는 분(정수)으로 한다. */
export function minHoursToMinutes(minHours: number): number {
  return Math.round((minHours > 0 ? minHours : 1) * 60);
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

/** 그 시간대를 30분 눈금으로 쪼갠 시각 목록(여는 시각부터 닫는 시각까지, 둘 다 포함).
 *  신청 폼은 이 눈금을 한 줄로 깔고, 시작과 끝을 같은 줄에서 고른다(대표 09-19).
 *  ⚠️눈금에서 벗어난 옛 칸(`10:15` 같은 것)은 눈금으로 «올려서» 시작한다. 여는 시각보다 앞을 팔지 않는다. */
export function timeMarks(slot: OpenSlot): string[] {
  const a = toMinutes(slot.start);
  const b = toMinutes(slot.end);
  if (a < 0 || b < 0 || b <= a) return [];
  const out: string[] = [];
  for (let t = Math.ceil(a / TIME_STEP_MIN) * TIME_STEP_MIN; t <= b; t += TIME_STEP_MIN) out.push(toHHMM(t));
  return out;
}

// ─── 🧭신청 폼의 시작·끝 고르기 (대표 09-19: 「시작 시간과 종료 시간을 골라 주세요」) ───
//
// ⭐폼은 그날의 눈금을 한 줄로 깔고, 시작을 누르면 그 시작에서 갈 수 있는 끝만 켠다. 아래 셋이 그 계산이다.
//   서버의 관문(`validateBookingRequest`)과 같은 규칙을 쓴다 — 열린 칸 «하나» 안에 통째로 · 최소 시간 이상 ·
//   이미 팔린 칸과 안 겹침 · 오늘이면 지금보다 뒤. 화면이 켠 칸은 서버도 받고, 화면이 끈 칸은 서버도 막는다.

type TakenRange = { start: string; end: string };

/** 그날 깔 눈금 — 열린 칸마다 30분 눈금을 펴고(`timeMarks`) 시각순으로 합친다. 같은 날 칸이 둘이면(오전·오후) 사이 시각은 안 깐다. */
export function dayMarks(daySlots: OpenSlot[]): string[] {
  return Array.from(new Set(daySlots.flatMap((sl) => timeMarks(sl)))).sort();
}

/** 한 시작에서 고를 수 있는 끝 눈금들(시각순). 없으면 빈 목록 — 그 시각은 시작으로도 못 고른다.
 *  · 끝은 «시작을 품은 열린 칸»의 닫는 시각을 못 넘는다. 칸이 여럿 품으면 가장 늦게 닫는 칸까지.
 *  · 시작 뒤에 이미 팔린 칸이 있으면 그 칸이 시작하는 시각까지만(맞닿는 건 된다 — 12~14 뒤에 14~16).
 *  · 시작 자체가 팔린 칸 안이면 끝이 없다. */
export function endChoices(daySlots: OpenSlot[], taken: TakenRange[], start: string, minMinutes: number): string[] {
  const a = toMinutes(start);
  if (a < 0 || a % TIME_STEP_MIN !== 0) return [];
  let limit = -1;
  for (const sl of daySlots) {
    const sa = toMinutes(sl.start), sb = toMinutes(sl.end);
    if (sa >= 0 && sb >= 0 && sa <= a && a < sb) limit = Math.max(limit, sb);
  }
  if (limit < 0) return [];
  for (const b of taken) {
    const bs = toMinutes(b.start), be = toMinutes(b.end);
    if (bs < 0 || be < 0) continue;
    if (bs <= a && a < be) return [];
    if (bs > a && bs < limit) limit = bs;
  }
  const out: string[] = [];
  for (let t = a + Math.max(minMinutes, TIME_STEP_MIN); t <= limit; t += TIME_STEP_MIN) out.push(toHHMM(t));
  return out;
}

/** 시작으로 고를 수 있는 눈금들(시각순) — 끝이 하나라도 있는 시각만. `cutoff`(분)보다 이른 시각은 뺀다(오늘이면 지금).
 *  ⚠️서버는 `시작 <= 지금`을 막는다. 그래서 같은 시각(`cutoff`와 같음)도 뺀다. */
export function startChoices(daySlots: OpenSlot[], taken: TakenRange[], minMinutes: number, cutoff = -1): string[] {
  return dayMarks(daySlots).filter((t) => toMinutes(t) > cutoff && endChoices(daySlots, taken, t, minMinutes).length > 0);
}

/** 두 구간이 겹치는가. 끝과 시작이 맞닿는 건 «안 겹침»이다(10~12와 12~14는 나란히 쓸 수 있다). */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const a1 = toMinutes(aStart), a2 = toMinutes(aEnd);
  const b1 = toMinutes(bStart), b2 = toMinutes(bEnd);
  if (a1 < 0 || a2 < 0 || b1 < 0 || b2 < 0) return false;
  return a1 < b2 && b1 < a2;
}

/** 화면에 쓰는 한 줄. "10:00~14:00 (4시간)" · "10:30~13:00 (2시간 30분)" */
export function rangeLabel(start: string, end: string): string {
  const m = minutesBetween(start, end);
  return m > 0 ? `${start}~${end} (${durationLabel(m)})` : `${start}~${end}`;
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

/** 예약 한 건의 「언제」 한 줄 — `10월 6일 (화) 13:00~15:30 (2시간 30분)`.
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
