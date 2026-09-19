"use client";

// 하루 팝업 — 빌려줄 날과 시간대 고르기 (2026-09-16, 세 판째)
//
// 🔁**판이 세 번 바뀌었다.** 그 자리마다 대표 지적이 있었다.
//   ① 날짜마다 시각 한 줄 → *「몇 달도 고를 수 있는데 항목이 하나씩 다 나오면 너무 많겠다」*
//   ② 요일 규칙을 달력 «위»에 → *「이건 달력 하단에 들어가야 하고, 달력에서 선택한 요일만 표현해 주면 될 것 같아」*
//   ③ 세로로 길다 → *「드롭다운을 한 줄에 같이 표현해서 줄이면 좋겠고, 월·화 간격 마진도 좀 있어야」*
//
// ⭐그래서 지금 모양은 **날짜가 먼저, 시간은 그다음**이다.
//   달력에서 날짜를 누르면 기본 시간(10~18)으로 열리고, **고른 요일만** 아래에 한 줄씩 나온다.
//   월요일을 하나도 안 골랐으면 월요일 줄은 아예 없다 — 화면에 있는 줄은 전부 내가 만든 것이다.
//   📌요일 머리글(일·월·화…)을 누르면 그 달의 그 요일이 통째로 담긴다. 대표가 말한 「일괄 적용」이 이 자리다.
//   📌시간이 기본과 다른 날은 달력에 점이 찍히고, 그 날만 아래 「날짜별로 시간 바꾸기」 카드에 줄이 생긴다(09-19 #104 — 전엔 접힌 「따로 정한 날」).
//
// 💾저장은 날짜마다 시각 한 벌(`openSlots`)이다.
// 🔁09-17 대표 「오늘 다 구현」 — **요일 줄마다 「매주 계속 열기」가 붙었다.** 그 전엔 요일 규칙을 저장하지 않았고,
//   「매주 월요일」을 열려면 달마다 다시 와서 요일 머리글을 눌러야 했다.
//   켜면 규칙(`repeat`)이 생기고 앞으로 12주의 그 요일이 달력에 열린 것으로 보인다(`expandRepeat`).
//   ⭐이 화면의 `value`는 **직접 연 날만** 든다. 규칙이 연 날은 그릴 때 합친다 — 그래야 끄면 규칙 날만 빠지고 직접 누른 날은 남는다.
//   🧷규칙이 연 날을 달력에서 누르면 그날만 쉰다(`skip`). 다시 누르면 다시 열린다.
//   ⚠️09-16엔 「규칙을 고치면 이미 팔린 날의 시간까지 흔들린다」는 이유로 규칙을 안 저장했다. 예약은 자기 시각을 행에 따로 들고 있어서
//     규칙 시각을 바꿔도 이미 받은 예약은 안 바뀐다. 바뀌는 건 «앞으로 팔 수 있는 시간»뿐이다.
//
// ⚠️날짜 계산은 UTC 자정 기준 정수 연산이다. `new Date(y, m, d)`는 브라우저 시간대를 타서
//   달의 첫 요일이 기기마다 어긋날 수 있다. 오늘만 KST로 받고 나머지는 글자 비교로 한다.
import { useState } from "react";
import type { OpenSlot, RepeatRule } from "@/lib/types";
import { addDaysIso, DAY_MARKS, durationLabel, expandRepeat, minutesBetween, RENT_MIN_MINUTES, REPEAT_WEEKS } from "@/lib/rent-time";
import { dateLabel, todayKst, RentSelect } from "../ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
/** 여는·닫는 시각 목록 — 30분 눈금, 00:00~24:00(대표 09-19: 「9시 30분 ~ 12시의 자투리도 가능」).
 *  🔁09-16엔 정시 25개였다. 서버(`saveSpaceAction`)가 같은 눈금(`isTimeMark`)으로 다시 본다. */
const HOURS = DAY_MARKS;
const BASE = { start: "10:00", end: "18:00" };

/** 그 날짜의 요일 번호. `Date.UTC`로 만들어 기기 시간대를 안 탄다. */
function dowOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function OpenSlotsCalendar({
  value,
  onChange,
  repeat,
  onRepeatChange,
}: {
  /** ⭐**직접 연 날만.** 규칙이 연 날은 여기 안 들어온다(위 머리말). */
  value: OpenSlot[];
  /** 🚨**갱신 함수를 받는다**(값만 받지 않는다). 달력은 연달아 눌리는 화면이라, 렌더 사이에 두 번 누르면
   *  두 번째가 «한 판 전의 목록»으로 덮어써서 첫 번째 선택이 사라진다(09-16 실측 — 두 날을 눌렀는데 하나만 담겼다).
   *  ⭐부모의 `setOpenSlots`를 그대로 넘기면 React가 최신 값을 물어다 준다. */
  onChange: (next: OpenSlot[] | ((cur: OpenSlot[]) => OpenSlot[])) => void;
  /** 🔁매주 계속 여는 요일(09-17). 갱신 함수를 받는 이유는 `onChange`와 같다. */
  repeat: RepeatRule[];
  onRepeatChange: (next: RepeatRule[] | ((cur: RepeatRule[]) => RepeatRule[])) => void;
  // 🔻09-19 #88 `minHours` 받기를 뺐다. 최소 대여 시간은 모든 공간 1시간(`RENT_MIN_MINUTES`)이라 이 화면이 직접 안다.
}) {
  const today = todayKst();
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm });
  /** 「날짜별로 시간 바꾸기」에 «+ 날짜 추가»로 올려 둔 날짜들(09-19 #104). 시간을 아직 안 바꿔도 줄이 남아 있게 따로 든다.
   *  시간을 바꾸면 그날은 «따로 정한 날»(`isOdd`)이 되고, 되돌리면 이 목록에서도 빠진다. */
  const [extra, setExtra] = useState<string[]>([]);
  /** 「+ 날짜 추가」를 눌러 날짜 고르개가 열려 있나. */
  const [adding, setAdding] = useState(false);
  /** 🩸09-20 요일 시간을 «붙잡아 둔» 값(매주 반복을 끈 요일만). 전엔 요일 시간을 그 요일 날짜들의 시간에서 매번 셌다.
   *  그래서 연 날이 하루뿐인 요일은 그날 시간을 「날짜별로 시간 바꾸기」로 바꾸면 요일 시간까지 같이 바뀌었다
   *  (요일 줄도 12:00이 되고, 바꾼 날의 점도 안 찍히고, 다음에 여는 같은 요일도 그 시간으로 열렸다).
   *  ⭐날짜를 열 때, 날짜 하나를 바꾸기 «직전», 요일 줄을 고치거나 매주 반복을 끌 때 붙잡는다. 붙잡기 전에는 전처럼 센다
   *    (고치기 화면을 처음 열 때·임시 저장을 되살릴 때는 저장된 날짜들밖에 단서가 없다).
   *  💾저장 모양(`openSlots`·`repeatWeekly`)은 그대로다. 이 값은 화면 안에서만 산다. */
  const [dowBase, setDowBase] = useState<Record<number, { start: string; end: string }>>({});

  const firstDow = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  const canPrev = view.y > ty || (view.y === ty && view.m > tm);
  const prev = () => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));

  /** 달력에 보이는 전부 = 직접 연 날 + 규칙이 연 날(같은 날이면 직접 연 쪽). 날짜순. */
  const all = expandRepeat(value, repeat, today);
  const picked = (iso: string) => all.find((sl) => sl.date === iso);
  const sorted = all;
  const ruleOf = (d: number) => repeat.find((r) => r.dow === d);
  const windowEnd = addDaysIso(today, REPEAT_WEEKS * 7);
  /** 이 날짜가 규칙이 «맡는» 날인가 — 그 요일에 규칙이 있고 12주 창 안. 쉬는 날이어도 맡는 날이다. */
  const ruleCovers = (iso: string) => !!ruleOf(dowOf(iso)) && iso >= today && iso < windowEnd;

  /** 고른 날들이 쓰는 요일 목록 — 여기 있는 요일만 아래에 줄로 나온다. 규칙을 켠 요일은 날이 다 쉬어도 남긴다. */
  const usedDows = Array.from(new Set([...all.map((sl) => dowOf(sl.date)), ...repeat.map((r) => r.dow)])).sort();
  /** 그 요일의 «대표 시간». 규칙이 있으면 규칙 시각. 없으면 붙잡아 둔 시간(`dowBase`), 그것도 없으면 같은 요일에 섞인 시간 중 제일 많은 쪽.
   *  그 요일에 연 날이 하나도 없으면 기본값이다. 다 닫았다가 다시 여는 요일은 처음 고르는 요일과 같게 본다. */
  const dowTime = (d: number) => {
    const r = ruleOf(d);
    if (r) return { start: r.start, end: r.end };
    const times = value.filter((sl) => dowOf(sl.date) === d).map((sl) => `${sl.start}~${sl.end}`);
    if (times.length === 0) return BASE;
    if (dowBase[d]) return dowBase[d];
    const top = times.sort(
      (a, b) => times.filter((t) => t === b).length - times.filter((t) => t === a).length,
    )[0];
    const [start, end] = top.split("~");
    return { start, end };
  };
  /** 그 요일의 기준 시간과 «다른» 날 = 따로 정한 날. */
  const isOdd = (sl: OpenSlot) => {
    const t = dowTime(dowOf(sl.date));
    return sl.start !== t.start || sl.end !== t.end;
  };
  /** 「날짜별로 시간 바꾸기」에 서는 줄 = 따로 정한 날 + «+ 날짜 추가»로 올려 둔 날(아직 열려 있는 것만), 날짜순. */
  const changedRows = sorted.filter((sl) => isOdd(sl) || extra.includes(sl.date));
  /** «+ 날짜 추가»가 고르게 하는 날 = 열린 날 중 오늘 이후이고 아직 줄이 없는 날. */
  const addable = sorted.filter((sl) => sl.date >= today && !isOdd(sl) && !extra.includes(sl.date));

  /** 날짜들을 닫는다 — 직접 연 칸은 지우고, 규칙이 맡는 날이면 그날을 쉬는 날로 적는다. */
  const closeDates = (isos: string[]) => {
    const set = new Set(isos);
    onChange((cur) => cur.filter((sl) => !set.has(sl.date)));
    const skipIsos = isos.filter(ruleCovers);
    if (skipIsos.length) {
      onRepeatChange((cur) =>
        cur.map((r) => {
          const mine = skipIsos.filter((iso) => dowOf(iso) === r.dow);
          if (!mine.length) return r;
          return { ...r, skip: Array.from(new Set([...(r.skip ?? []), ...mine])).sort() };
        }),
      );
    }
    setExtra((cur) => cur.filter((x) => !set.has(x)));
  };

  /** 날짜들을 연다 — 규칙이 맡는 날이면 쉬는 날에서 지우고, 아니면 그 요일 기준 시간으로 직접 연다. */
  const openDates = (isos: string[]) => {
    const byRule = new Set(isos.filter(ruleCovers));
    if (byRule.size) {
      onRepeatChange((cur) =>
        cur.map((r) => (r.skip?.some((x) => byRule.has(x)) ? { ...r, skip: r.skip.filter((x) => !byRule.has(x)) } : r)),
      );
    }
    const add = isos.filter((iso) => !byRule.has(iso));
    // 여는 순간의 요일 시간을 붙잡는다. 다 닫았다가 다시 연 요일은 기본값으로 새로 붙잡힌다(예전에 붙잡은 값이 남지 않게).
    for (const d of new Set(add.map(dowOf))) if (!ruleOf(d)) pinDow(d, dowTime(d));
    if (add.length) {
      // 새로 고르는 날은 그 요일의 기준 시간을 따라간다. 처음 고르는 요일이면 기본값.
      onChange((cur) => {
        const have = new Set(cur.map((sl) => sl.date));
        return [
          ...cur,
          ...add.filter((iso) => !have.has(iso)).map((iso) => ({ date: iso, ...dowTime(dowOf(iso)) })),
        ];
      });
    }
  };

  /** 요일 시간을 붙잡는다(`dowBase`). 매주 반복이 켜진 요일은 규칙 시각이 곧 요일 시간이라 안 쓴다. */
  const pinDow = (d: number, t: { start: string; end: string }) =>
    setDowBase((cur) => (cur[d]?.start === t.start && cur[d]?.end === t.end ? cur : { ...cur, [d]: { start: t.start, end: t.end } }));

  const toggle = (iso: string) => (picked(iso) ? closeDates([iso]) : openDates([iso]));

  /** 「매주 계속 열기」 켜기·끄기. 켜면 지금 그 요일 줄의 시각으로 규칙이 생긴다.
   *  ⭐끄면 규칙만 빠진다 — 직접 누른 날은 `value`에 그대로 있다. */
  const setRepeat = (d: number, on: boolean) => {
    const t = dowTime(d);
    // 끌 때 규칙 시각을 요일 시간으로 붙잡는다. 안 그러면 남은 «직접 연 날»(따로 시간을 바꾼 날일 수 있다)에서 다시 세어,
    //   바꾼 날 하나가 요일 시간이 되어 버린다(아래 `editDate`와 같은 버그).
    if (!on) pinDow(d, t);
    onRepeatChange((cur) => (on ? [...cur.filter((r) => r.dow !== d), { dow: d, start: t.start, end: t.end }] : cur.filter((r) => r.dow !== d)));
  };

  /** 요일 머리글 누르기 — 이 달의 그 요일을 통째로 담거나 뺀다(대표가 말한 「일괄 적용」). */
  const toggleDow = (d: number) => {
    const inMonth: string[] = [];
    for (let day = 1; day <= daysInMonth; day++) {
      const iso = `${view.y}-${pad(view.m)}-${pad(day)}`;
      if (dowOf(iso) === d && iso >= today) inMonth.push(iso);
    }
    if (inMonth.length === 0) return;
    const allPicked = inMonth.every((iso) => picked(iso));
    if (allPicked) closeDates(inMonth);
    else openDates(inMonth.filter((iso) => !picked(iso)));
  };

  /** 요일 줄의 시각을 고치면 그 요일의 «기준을 따르던» 날이 다 따라간다.
   *  ⚠️따로 정해 둔 날은 안 건드린다 — 사장님이 일부러 다르게 한 것이다. */
  const editDow = (d: number, patch: { start?: string; end?: string }) => {
    const before = dowTime(d);
    const after = { ...before, ...patch };
    if (ruleOf(d)) onRepeatChange((cur) => cur.map((r) => (r.dow === d ? { ...r, ...after } : r)));
    else pinDow(d, after);
    onChange((cur) =>
      cur.map((sl) =>
        dowOf(sl.date) === d && sl.start === before.start && sl.end === before.end ? { ...sl, ...after } : sl,
      ),
    );
  };

  /** 한 날짜만 시각 바꾸기. 규칙이 연 날이면 그날을 «직접 연 날»로 떼어 낸다(같은 날이면 직접 연 쪽이 이긴다). */
  const editDate = (iso: string, patch: Partial<OpenSlot>) => {
    const base = picked(iso);
    // 🩸09-20 바꾸기 «전»의 요일 시간을 붙잡는다. 그 요일에 연 날이 이날 하나뿐이면, 안 붙잡은 요일 시간은 이날 시간을 따라온다.
    const d = dowOf(iso);
    if (!ruleOf(d)) pinDow(d, dowTime(d));
    onChange((cur) =>
      cur.some((sl) => sl.date === iso)
        ? cur.map((sl) => (sl.date === iso ? { ...sl, ...patch } : sl))
        : base
          ? [...cur, { ...base, ...patch, date: iso }]
          : cur,
    );
  };

  /** 「날짜별로 시간 바꾸기」 줄 하나를 요일 시간으로 되돌린다(09-19 #104). 날짜는 그대로 열려 있다 — 닫는 건 달력이 한다.
   *  · 규칙(매주 반복)이 맡는 날 → 떼어 낸 «직접 연 칸»을 지운다. 규칙이 다시 그날을 연다.
   *  · 직접 연 날 → 그 요일의 기준 시간으로 맞춘다. */
  const revertDate = (iso: string) => {
    setExtra((cur) => cur.filter((x) => x !== iso));
    if (ruleCovers(iso)) {
      onChange((cur) => cur.filter((sl) => sl.date !== iso));
      return;
    }
    const t = dowTime(dowOf(iso));
    onChange((cur) => cur.map((sl) => (sl.date === iso ? { ...sl, ...t } : sl)));
  };

  const navCls =
    "inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-[18px] text-body transition-colors hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div className="space-y-4">
      {/* 🔻09-19 대표 코멘트 #100 — 「요일(일·월·화…)을 누르면 이 달의 그 요일이 한 번에 담겨요」 안내를 지웠다.
          머리글 알약(누를 수 있는 얼굴)과 낭독기 이름(「월요일 전부 담기」)은 그대로다. */}
      {/* ── ① 달력 ── */}
      <div className="rounded-md border border-border-strong bg-surface p-3">
        <div className="flex items-center justify-between">
          <button type="button" onClick={prev} disabled={!canPrev} aria-label="이전 달" className={navCls}>
            ‹
          </button>
          <p className="text-[16px] font-medium text-ink">
            {view.y}년 {view.m}월
          </p>
          <button type="button" onClick={next} aria-label="다음 달" className={navCls}>
            ›
          </button>
        </div>

        <div className="mt-2 grid grid-cols-7">
          {/* 요일 머리글이 곧 버튼이다 — 누르면 이 달의 그 요일이 통째로 담긴다.
              ⭐일괄 담기 버튼을 따로 두는 것보다 이쪽이 자리가 맞다. 「월요일마다 연다」는 생각이
                월요일 칸 위에서 그대로 실행된다. */}
          {DOW.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDow(i)}
              aria-label={`${d}요일 전부 담기`}
              // 누를 수 있는 얼굴 — 옅은 알약 면(09-17 QA: 회색 작은 글자라 표 머리로만 보였다).
              // 👆09-18 밤 QA(H-28) — 41×34라 손끝 하한에 못 미쳤다. 「일괄 담기」가 이 자리에만 있어서 못 누르면 길이 없다.
              //   보이는 알약은 그대로 두고 칸 사이 여백(mx-0.5)만큼을 히트영역으로 빌린다.
              className="relative mx-0.5 mb-1 rounded-pill bg-surface-soft py-1.5 text-center text-[14px] font-medium text-body transition-colors after:absolute after:-inset-x-[2px] after:-inset-y-[5px] after:content-[''] hover:bg-primary-pale"
            >
              {d}
            </button>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const iso = `${view.y}-${pad(view.m)}-${pad(d)}`;
            const past = iso < today;
            const sl = picked(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                aria-pressed={!!sl}
                aria-label={dateLabel(iso)}
                onClick={() => toggle(iso)}
                className={`relative h-[44px] w-full rounded-md text-[16px] transition-colors ${
                  sl
                    ? "bg-primary-tint font-medium text-primary-on"
                    : past
                      ? "text-faint/60"
                      : `text-ink hover:bg-surface-soft ${iso === today ? "font-medium underline underline-offset-4" : ""}`
                }`}
              >
                {d}
                {sl && isOdd(sl) && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-[4px] -translate-x-1/2 rounded-full bg-primary-on"
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ② 요일별 시간 + ③ 날짜별로 시간 바꾸기 ── 달력 «아래», 고른 요일만(대표 09-16).
          🔁09-19 대표 코멘트 #101~#104 — ②와 ③을 같은 카드 모양으로 붙여 한 덩어리로 읽히게 했다.
            대표: 「(이 날만 시간을 다르게) 이거 진짜 중요한데 잘 안 보이거든. 상단의 시간과 좀 더 잘 어울려 볼 수 있게」.
            ⭐전엔 ③이 접힌 `details` 한 줄(「이 날만 시간을 다르게 하고 싶어요」)이었다. 이제 늘 펼친 카드이고, 바꾼 날은 줄로 늘 보인다.
            🔻「N일을 여셨어요」(#103) 줄은 뺐다. 요일 줄마다 날 수가 이미 있다. */}
      {usedDows.length === 0 ? (
        <p className="text-[15px] leading-relaxed break-keep text-faint">
          날짜를 눌러 주세요. 하루도 없으면 아무도 신청할 수 없어요.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="rounded-md border border-border-strong bg-surface p-3">
            {/* 🔁09-19 #102 「몇 시에 여시나요」 → 대표 문안(맞춤법만). */}
            <p className="text-[16px] font-medium text-ink">요일별 대여 가능 시간을 정해 주세요</p>
            <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
              고르신 요일만 나와요. 여기서 바꾸면 그 요일로 고른 날이 같이 바뀌어요.
            </p>
            <div className="mt-3 space-y-2.5">
              {usedDows.map((d) => {
                const t = dowTime(d);
                const h = minutesBetween(t.start, t.end);
                const n = all.filter((sl) => dowOf(sl.date) === d).length;
                const on = !!ruleOf(d);
                return (
                  <div key={d} className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
                    <span className="inline-flex h-[40px] w-[44px] shrink-0 items-center justify-center rounded-md bg-primary-tint text-[15px] font-medium text-primary-on">
                      {DOW[d]}
                    </span>
                    <TimeSelects
                      label={`${DOW[d]}요일`}
                      start={t.start}
                      end={t.end}
                      onEdit={(patch) => editDow(d, patch)}
                    />
                    <span className="text-[14px] text-faint">{n}일</span>
                    {/* 🔁09-19 대표 코멘트 #101 — 「매주 계속 열기」 알약 → 「매주 반복」 스위치(네/아니오가 한눈에).
                        모양은 상품 카드의 켜기 스위치와 같다. 글자까지 누름 자리라 40px 줄 전체를 누르면 된다. */}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={on}
                      aria-label={`${DOW[d]}요일 매주 반복`}
                      onClick={() => setRepeat(d, !on)}
                      className="ml-auto inline-flex h-[40px] shrink-0 items-center gap-2 pl-2 text-[15px] text-body"
                    >
                      매주 반복
                      <span
                        aria-hidden="true"
                        className={`flex h-[26px] w-11 items-center rounded-pill p-[2px] transition-colors ${on ? "bg-primary" : "bg-border-strong"}`}
                      >
                        <span className={`h-[22px] w-[22px] rounded-pill bg-white transition-transform ${on ? "translate-x-[18px]" : "translate-x-0"}`} />
                      </span>
                    </button>
                    {h < RENT_MIN_MINUTES && (
                      <span className="basis-full text-[14px] text-danger">최소 {durationLabel(RENT_MIN_MINUTES)}을 못 채워요</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* 🔁09-17 — 켜기 전에 무엇이 일어나는지 먼저 읽히게 줄들 바로 밑에 둔다. 쉬는 날은 `skip`으로 실제로 빠진다. */}
            <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
              매주 반복을 켜 두시면 늘 앞으로 12주치 그 요일이 열려 있어요. 하루만 쉬고 싶은 날은 달력에서 그날을 눌러 빼면 돼요.
            </p>
          </div>

          {/* ③ 날짜별로 시간 바꾸기 — 요일 시간과 다른 날. 바꾼 날은 달력에도 점이 찍힌다. */}
          <div className="rounded-md border border-border-strong bg-surface p-3">
            <p className="text-[16px] font-medium text-ink">날짜별로 시간 바꾸기</p>
            <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
              특정한 날만 시간이 다르면 여기서 바꿔 주세요. 바꾼 날은 달력에 점으로 표시돼요.
            </p>
            {changedRows.length > 0 && (
              <div className="mt-3 space-y-2.5">
                {changedRows.map((sl) => (
                  <DateRow key={sl.date} sl={sl} onEdit={(patch) => editDate(sl.date, patch)} onRevert={() => revertDate(sl.date)} />
                ))}
              </div>
            )}
            {addable.length > 0 &&
              (adding ? (
                <div className="mt-3">
                  <RentSelect
                    aria-label="시간을 바꿀 날짜"
                    autoFocus
                    value=""
                    onChange={(e) => {
                      const iso = e.target.value;
                      if (iso) setExtra((cur) => (cur.includes(iso) ? cur : [...cur, iso]));
                      setAdding(false);
                    }}
                    onBlur={() => setAdding(false)}
                  >
                    <option value="" disabled>
                      날짜를 골라 주세요
                    </option>
                    {addable.map((sl) => (
                      <option key={sl.date} value={sl.date}>
                        {dateLabel(sl.date)} · {sl.start}~{sl.end}
                      </option>
                    ))}
                  </RentSelect>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="mt-3 inline-flex h-[44px] items-center rounded-pill border border-border-strong bg-surface px-4 text-[15px] font-medium text-body transition-colors hover:bg-surface-soft"
                >
                  + 날짜 추가
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** 여는·닫는 시각 한 쌍(30분 눈금). 요일 줄과 날짜 줄이 같이 쓴다.
 *  ⚠️폭은 `wrapClassName`으로 준다 — `className`으로는 안 먹는다(`RentSelect`). */
function TimeSelects({
  label,
  start,
  end,
  onEdit,
}: {
  /** 낭독기 이름 앞머리 — 「월요일」·「9월 21일 (일)」. */
  label: string;
  start: string;
  end: string;
  onEdit: (patch: { start?: string; end?: string }) => void;
}) {
  // 셋(여는 ~ 닫는)을 한 덩어리로 묶는다 — 좁은 화면에서 줄이 바뀔 때 「~」만 윗줄 끝에 남지 않게.
  return (
    <span className="flex shrink-0 items-center gap-2">
      <RentSelect aria-label={`${label} 여는 시각`} compact wrapClassName="w-[104px] shrink-0" value={start} onChange={(e) => onEdit({ start: e.target.value })}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </RentSelect>
      <span className="text-mute">~</span>
      <RentSelect aria-label={`${label} 닫는 시각`} compact wrapClassName="w-[104px] shrink-0" value={end} onChange={(e) => onEdit({ end: e.target.value })}>
        {HOURS.map((x) => (
          <option key={x} value={x}>
            {x}
          </option>
        ))}
      </RentSelect>
    </span>
  );
}

/** 「날짜별로 시간 바꾸기」의 줄 하나(09-19 #104) — 요일 줄과 같은 모양이다(날짜 칩 → 시각 둘 → 오른쪽 끝에 되돌리기).
 *  폰(375)에선 날짜 칩 뒤로 시각이 다음 줄로 내려간다. 넓은 화면에선 한 줄. */
function DateRow({
  sl,
  onEdit,
  onRevert,
}: {
  sl: OpenSlot;
  onEdit: (patch: Partial<OpenSlot>) => void;
  onRevert: () => void;
}) {
  const m = minutesBetween(sl.start, sl.end);
  const bad = m <= 0 ? "끝나는 시각이 더 늦어야 해요." : m < RENT_MIN_MINUTES ? `최소 ${durationLabel(RENT_MIN_MINUTES)}을 못 채워요.` : "";
  const label = dateLabel(sl.date);
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="inline-flex h-[40px] shrink-0 items-center rounded-md bg-primary-tint px-3 text-[15px] font-medium text-primary-on">
        {label}
      </span>
      <TimeSelects label={label} start={sl.start} end={sl.end} onEdit={onEdit} />
      <button
        type="button"
        onClick={onRevert}
        aria-label={`${label} 요일 시간으로 되돌리기`}
        className="ml-auto h-[40px] shrink-0 px-2 text-[15px] text-mute underline underline-offset-2"
      >
        되돌리기
      </button>
      {bad && <p className="basis-full text-[14px] text-danger">{bad}</p>}
    </div>
  );
}
