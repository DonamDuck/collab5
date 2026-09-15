"use client";

// 하루 가게 — 빌려줄 날과 «시간대» 고르기 (2026-09-16)
//
// 🔁09-13엔 「비는 날」만 골랐다(하루 통째). 09-16에 시간 단위로 바뀌면서 날짜마다 «몇 시부터 몇 시까지»가 붙는다.
//   대표: *「사람들마다 대관 가능한 시간이 다 다를 테니 후자가 맞다」* — 어떤 카페는 10~19시, 어떤 데는 14~16시.
//
// ⭐**날짜를 먼저, 시간은 그다음.** 날짜를 누르면 «기본 시간»으로 한 줄이 생기고, 다른 날만 따로 고치면 된다.
//   대부분의 가게는 매일 같은 시간에 열기 때문에, 날마다 두 번씩 시각을 고르게 하면 열 날을 고르다 지친다.
// ⚠️날짜 계산은 UTC 자정 기준 정수 연산이다. `new Date(y, m, d)`는 브라우저 시간대를 타서
//   달의 첫 요일이 기기마다 어긋날 수 있다. 오늘만 KST로 받고 나머지는 글자 비교로 한다.
import { useState } from "react";
import type { OpenSlot } from "@/lib/types";
import { hoursBetween } from "@/lib/rent-time";
import { dateLabel, todayKst, RentSelect } from "../ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
/** 정시만. 30분 눈금을 안 쓰기로 했다(대표 09-16 — 가게가 그렇게 생각하지 않는다). */
const HOURS = Array.from({ length: 25 }, (_, i) => `${pad(i)}:00`);

export function OpenSlotsCalendar({
  value,
  onChange,
  minHours,
}: {
  value: OpenSlot[];
  onChange: (next: OpenSlot[]) => void;
  /** 최소 대여 시간 — 이보다 짧게 연 날은 아무도 못 빌리므로 그 자리에서 알려 준다. */
  minHours: number;
}) {
  const today = todayKst();
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm });
  /** 새 날짜에 붙일 기본 시간. 마지막으로 고친 값을 따라간다 — 다음 날도 대개 같은 시간이다. */
  const [base, setBase] = useState({ start: "10:00", end: "18:00" });

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

  const has = (iso: string) => value.some((s) => s.date === iso);
  const sorted = [...value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  const toggle = (iso: string) =>
    onChange(
      has(iso)
        ? value.filter((s) => s.date !== iso)
        : [...value, { date: iso, start: base.start, end: base.end }],
    );

  const edit = (iso: string, patch: Partial<OpenSlot>) => {
    const merged = { ...patch };
    if (merged.start || merged.end) {
      setBase((b) => ({ start: merged.start ?? b.start, end: merged.end ?? b.end }));
    }
    onChange(value.map((s) => (s.date === iso ? { ...s, ...merged } : s)));
  };

  const navCls =
    "inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-[18px] text-body transition-colors hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent";

  return (
    <div>
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
          {DOW.map((d) => (
            <div key={d} className="py-1.5 text-center text-[13px] font-medium text-faint">
              {d}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const iso = `${view.y}-${pad(view.m)}-${pad(d)}`;
            const past = iso < today;
            const on = has(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                aria-pressed={on}
                aria-label={dateLabel(iso)}
                onClick={() => toggle(iso)}
                className={`h-[44px] w-full rounded-md text-[16px] transition-colors ${
                  on
                    ? "bg-primary-tint font-medium text-primary-on"
                    : past
                      ? "text-faint/60"
                      : `text-ink hover:bg-surface-soft ${iso === today ? "font-medium underline underline-offset-4" : ""}`
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {sorted.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
          날짜를 눌러 주세요. 하루도 없으면 아무도 신청할 수 없어요.
        </p>
      ) : (
        <div className="mt-3 space-y-2">
          {sorted.map((sl) => {
            const h = hoursBetween(sl.start, sl.end);
            const bad = h <= 0 ? "끝나는 시각이 더 늦어야 해요." : h < minHours ? `최소 ${minHours}시간을 못 채워요.` : "";
            return (
              <div key={sl.date} className="rounded-md border border-hairline bg-surface p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="min-w-[104px] text-[16px] font-medium text-ink">{dateLabel(sl.date)}</p>
                  <RentSelect
                    aria-label={`${dateLabel(sl.date)} 여는 시각`}
                    className="h-[44px] w-[104px]"
                    value={sl.start}
                    onChange={(e) => edit(sl.date, { start: e.target.value })}
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
                    className="h-[44px] w-[104px]"
                    value={sl.end}
                    onChange={(e) => edit(sl.date, { end: e.target.value })}
                  >
                    {HOURS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </RentSelect>
                  <button
                    type="button"
                    onClick={() => toggle(sl.date)}
                    aria-label={`${dateLabel(sl.date)} 빼기`}
                    className="ml-auto h-[44px] px-2 text-[15px] text-mute underline underline-offset-2"
                  >
                    빼기
                  </button>
                </div>
                {bad ? (
                  <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{bad}</p>
                ) : (
                  <p className="mt-2 text-[15px] text-faint">{h}시간 열려 있어요.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
