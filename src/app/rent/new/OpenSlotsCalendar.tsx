"use client";

// 하루 가게 — 빌려줄 날과 시간대 고르기 (2026-09-16, 세 판째)
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
//   📌시간이 기본과 다른 날은 달력에 점이 찍히고, 그 날만 아래 「따로 정한 날」로 줄이 생긴다.
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
import { addDaysIso, DAY_MARKS, durationLabel, expandRepeat, minHoursToMinutes, minutesBetween, REPEAT_WEEKS } from "@/lib/rent-time";
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
  minHours,
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
  /** 최소 대여 시간 — 이보다 짧게 연 날은 아무도 못 빌리므로 그 자리에서 알려 준다. */
  minHours: number;
}) {
  const today = todayKst();
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm });
  /** 「이 날만 따로」로 펼쳐 둔 날짜. */
  const [editing, setEditing] = useState<string | null>(null);

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
  /** 그 요일의 «대표 시간». 규칙이 있으면 규칙 시각. 없으면 같은 요일에 섞인 시간 중 제일 많은 쪽. */
  const dowTime = (d: number) => {
    const r = ruleOf(d);
    if (r) return { start: r.start, end: r.end };
    const times = value.filter((sl) => dowOf(sl.date) === d).map((sl) => `${sl.start}~${sl.end}`);
    if (times.length === 0) return BASE;
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
  const odds = sorted.filter(isOdd);

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
    if (editing && set.has(editing)) setEditing(null);
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

  const toggle = (iso: string) => (picked(iso) ? closeDates([iso]) : openDates([iso]));

  /** 「매주 계속 열기」 켜기·끄기. 켜면 지금 그 요일 줄의 시각으로 규칙이 생긴다.
   *  ⭐끄면 규칙만 빠진다 — 직접 누른 날은 `value`에 그대로 있다. */
  const setRepeat = (d: number, on: boolean) => {
    const t = dowTime(d);
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
    onChange((cur) =>
      cur.map((sl) =>
        dowOf(sl.date) === d && sl.start === before.start && sl.end === before.end ? { ...sl, ...after } : sl,
      ),
    );
  };

  /** 한 날짜만 시각 바꾸기. 규칙이 연 날이면 그날을 «직접 연 날»로 떼어 낸다(같은 날이면 직접 연 쪽이 이긴다). */
  const editDate = (iso: string, patch: Partial<OpenSlot>) => {
    const base = picked(iso);
    onChange((cur) =>
      cur.some((sl) => sl.date === iso)
        ? cur.map((sl) => (sl.date === iso ? { ...sl, ...patch } : sl))
        : base
          ? [...cur, { ...base, ...patch, date: iso }]
          : cur,
    );
  };

  const navCls =
    "inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-[18px] text-body transition-colors hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent";
  /** 한 줄에 서야 하는 시간 칸. ⚠️폭·높이는 `wrapClassName`/`size`로 준다 — `className`으로는 안 먹는다. */
  const timeWrap = "w-[104px] shrink-0";

  return (
    <div className="space-y-4">
      {/* 👆🔁09-17 QA — 이 안내가 달력 «아래»에 있어서 다 누른 뒤에야 읽혔다. 머리글이 버튼이라는 걸 누르기 전에 안다. */}
      <p className="text-[15px] leading-relaxed break-keep text-mute">
        요일(일·월·화…)을 누르면 이 달의 그 요일이 한 번에 담겨요.
      </p>
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

      {/* ── ② 고른 요일의 시간 ── 달력 «아래», 고른 요일만(대표 09-16). */}
      {usedDows.length === 0 ? (
        <p className="text-[15px] leading-relaxed break-keep text-faint">
          날짜를 눌러 주세요. 하루도 없으면 아무도 신청할 수 없어요.
        </p>
      ) : (
        <div className="rounded-md border border-border-strong bg-surface p-3">
          <p className="text-[16px] font-medium text-ink">몇 시에 여시나요</p>
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
                  <RentSelect
                    aria-label={`${DOW[d]}요일 여는 시각`}
                    compact
                    wrapClassName={timeWrap}
                    value={t.start}
                    onChange={(e) => editDow(d, { start: e.target.value })}
                  >
                    {HOURS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </RentSelect>
                  <span className="text-mute">~</span>
                  <RentSelect
                    aria-label={`${DOW[d]}요일 닫는 시각`}
                    compact
                    wrapClassName={timeWrap}
                    value={t.end}
                    onChange={(e) => editDow(d, { end: e.target.value })}
                  >
                    {HOURS.map((x) => (
                      <option key={x} value={x}>
                        {x}
                      </option>
                    ))}
                  </RentSelect>
                  <span className="text-[14px] text-faint">{n}일</span>
                  {/* 🔁09-17 — 이 폼의 알약 모양(고르면 키위 틴트, 아니면 흰 면)을 그대로 쓴다. 한 개짜리라 눌림 상태로 말한다. */}
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setRepeat(d, !on)}
                    className={`ml-auto inline-flex h-[40px] shrink-0 items-center rounded-pill px-4 text-[15px] font-medium transition-colors ${
                      on
                        ? "bg-primary-tint text-primary-on"
                        : "border-[0.5px] border-[#DFDFE3] bg-surface text-body hover:bg-surface-soft"
                    }`}
                  >
                    {on ? "매주 여는 중" : "매주 계속 열기"}
                  </button>
                  {h < minHoursToMinutes(minHours) && (
                    <span className="basis-full text-[14px] text-danger">최소 {durationLabel(minHoursToMinutes(minHours))}을 못 채워요</span>
                  )}
                </div>
              );
            })}
          </div>
          {/* 🔁09-17 — 켜기 전에 무엇이 일어나는지 먼저 읽히게 줄들 바로 밑에 둔다. 쉬는 날은 `skip`으로 실제로 빠진다. */}
          <p className="mt-3 text-[15px] leading-relaxed break-keep text-mute">
            매주 계속 열어 두시면 늘 앞으로 12주치 그 요일이 열려 있어요. 하루만 쉬고 싶은 날은 달력에서 그날을 눌러 빼면 돼요.
          </p>
        </div>
      )}

      {/* ── ③ 결과 한 줄 + 따로 정한 날 ── */}
      {sorted.length > 0 && (
        <div>
          <p className="text-[15px] leading-relaxed break-keep text-body">
            {/* 🔻「대여하시는 분에게 이 날짜가 보입니다」 삭제 — 절 설명과 같은 말이 두 번이었다(09-17 QA). */}
            <span className="font-medium text-ink">{sorted.length}일</span>을 여셨어요.
          </p>

          {odds.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-[15px] text-mute">시간을 따로 정한 날</p>
              {odds.map((sl) => (
                <SlotRow
                  key={sl.date}
                  sl={sl}
                  minHours={minHours}
                  onEdit={(patch) => editDate(sl.date, patch)}
                  onRemove={() => toggle(sl.date)}
                />
              ))}
            </div>
          )}

          {sorted.length > odds.length && (
            <details className="mt-3">
              <summary className="cursor-pointer list-none py-[10px] text-[15px] text-mute underline underline-offset-2">
                이 날만 시간을 다르게 하고 싶어요
              </summary>
              <div className="mt-2 space-y-2">
                {sorted
                  .filter((sl) => !isOdd(sl))
                  .map((sl) =>
                    editing === sl.date ? (
                      <SlotRow
                        key={sl.date}
                        sl={sl}
                        minHours={minHours}
                        onEdit={(patch) => editDate(sl.date, patch)}
                        onRemove={() => toggle(sl.date)}
                      />
                    ) : (
                      <div
                        key={sl.date}
                        className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2"
                      >
                        <p className="min-w-0 flex-1 text-[15px] text-body">
                          {dateLabel(sl.date)} · {sl.start}~{sl.end}
                        </p>
                        <button
                          type="button"
                          onClick={() => setEditing(sl.date)}
                          className="h-[40px] shrink-0 px-2 text-[15px] text-mute underline underline-offset-2"
                        >
                          시간 바꾸기
                        </button>
                      </div>
                    ),
                  )}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

/** 한 날짜의 시각을 고치는 줄. 「따로 정한 날」과 펼친 줄이 같은 모양을 쓴다. */
function SlotRow({
  sl,
  minHours,
  onEdit,
  onRemove,
}: {
  sl: OpenSlot;
  minHours: number;
  onEdit: (patch: Partial<OpenSlot>) => void;
  onRemove: () => void;
}) {
  const m = minutesBetween(sl.start, sl.end);
  const minM = minHoursToMinutes(minHours);
  const bad = m <= 0 ? "끝나는 시각이 더 늦어야 해요." : m < minM ? `최소 ${durationLabel(minM)}을 못 채워요.` : "";
  return (
    <div className="rounded-md border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
        <p className="min-w-[92px] shrink-0 text-[15px] font-medium text-ink">{dateLabel(sl.date)}</p>
        <RentSelect
          aria-label={`${dateLabel(sl.date)} 여는 시각`}
          compact
          wrapClassName="w-[104px] shrink-0"
          value={sl.start}
          onChange={(e) => onEdit({ start: e.target.value })}
        >
          {HOURS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </RentSelect>
        <span className="text-mute">~</span>
        <RentSelect
          aria-label={`${dateLabel(sl.date)} 닫는 시각`}
          compact
          wrapClassName="w-[104px] shrink-0"
          value={sl.end}
          onChange={(e) => onEdit({ end: e.target.value })}
        >
          {HOURS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </RentSelect>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${dateLabel(sl.date)} 빼기`}
          className="ml-auto h-[40px] shrink-0 px-2 text-[15px] text-mute underline underline-offset-2"
        >
          빼기
        </button>
      </div>
      {bad && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{bad}</p>}
    </div>
  );
}
