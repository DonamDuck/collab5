"use client";

// 하루 가게 — 빌려줄 날과 시간대 고르기 (2026-09-16 · 같은 날 저녁 요일 기준으로 다시 잡음)
//
// 🔁09-13엔 「비는 날」만 골랐다(하루 통째). 09-16에 시간 단위로 바뀌면서 날짜마다 시간이 붙었는데,
//   첫 판은 **고른 날마다 줄이 하나씩** 생기는 모양이었다. 대표가 바로 짚었다 —
//   *「필연적으로 엄청 여러 날 몇 달도 고를 수 있는데 이렇게 항목이 하나씩 다 나오면 너무 많겠다」*,
//   *「그냥 선택한 날짜 기준으로 요일별로 선택하게 할까?」*, *「시간 일괄 적용 같은 걸 넣으면 어떨까」*.
//
// ⭐그래서 **기본은 요일, 예외는 날짜**로 뒤집었다.
//   ① 요일별 시간을 한 번 정한다(월~금 10~18, 토 12~16, 일 안 함). 대부분의 가게가 여기서 끝난다.
//   ② 달력에서 날짜를 누르면 그 요일의 시간으로 열린다.
//   ③ 기본과 «다른» 날만 아래 목록에 줄로 나온다. 예순 날을 골라도 줄은 예외 수만큼만 생긴다.
//   📌저장은 그대로 `openSlots`(날짜마다 시각 한 벌)다 — 규칙을 저장하면 「그 규칙이 언제부터 바뀌었나」를
//     나중에 되짚을 수 없고, 이미 팔린 날의 시간이 규칙을 고치는 순간 흔들린다.
//
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

type Rule = { on: boolean; start: string; end: string };
const DEFAULT_RULE: Rule = { on: true, start: "10:00", end: "18:00" };

/** 그 날짜의 요일 번호. `Date.UTC`로 만들어 기기 시간대를 안 탄다. */
function dowOf(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

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

  /** 요일별 기본 시간. 화면 안에서만 사는 «규칙»이고, 저장되는 건 그 규칙으로 만든 날짜들이다. */
  const [rules, setRules] = useState<Rule[]>(() =>
    // 이미 고른 날이 있으면 그 시간을 첫 요일 기본으로 되살린다 — 고치기로 들어온 사장님이 다시 정하지 않게.
    DOW.map((_, i) => {
      const hit = value.find((sl) => dowOf(sl.date) === i);
      return hit ? { on: true, start: hit.start, end: hit.end } : { ...DEFAULT_RULE, on: i !== 0 };
    }),
  );
  /** 예외만 펼친다. 기본과 같은 날은 줄을 안 만든다 — 그게 이 화면을 다시 잡은 이유다. */
  const [openException, setOpenException] = useState<string | null>(null);

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

  const picked = (iso: string) => value.find((sl) => sl.date === iso);
  const sorted = [...value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  /** 기본 규칙과 시간이 다른 날 = 예외. 목록에 줄로 나오는 건 이것들뿐이다. */
  const isException = (sl: OpenSlot) => {
    const r = rules[dowOf(sl.date)];
    return !r || sl.start !== r.start || sl.end !== r.end;
  };
  const exceptions = sorted.filter(isException);

  const toggle = (iso: string) => {
    if (picked(iso)) {
      onChange(value.filter((sl) => sl.date !== iso));
      if (openException === iso) setOpenException(null);
      return;
    }
    const r = rules[dowOf(iso)] ?? DEFAULT_RULE;
    onChange([...value, { date: iso, start: r.start, end: r.end }]);
  };

  const editDate = (iso: string, patch: Partial<OpenSlot>) =>
    onChange(value.map((sl) => (sl.date === iso ? { ...sl, ...patch } : sl)));

  /** 요일 규칙을 고치면 «그 요일로 이미 고른 날»도 따라간다 — 규칙을 바꿨는데 화면이 안 변하면 안 먹은 걸로 읽힌다.
   *  ⚠️예외로 따로 고쳐 둔 날은 건드리지 않는다. 사장님이 일부러 다르게 한 것이다. */
  const editRule = (i: number, patch: Partial<Rule>) => {
    const before = rules[i];
    const after = { ...before, ...patch };
    setRules((rs) => rs.map((r, j) => (j === i ? after : r)));
    if (patch.start || patch.end) {
      onChange(
        value.map((sl) =>
          dowOf(sl.date) === i && sl.start === before.start && sl.end === before.end
            ? { ...sl, start: after.start, end: after.end }
            : sl,
        ),
      );
    }
    // 요일을 끄면 그 요일로 고른 날을 다 뺀다.
    if (patch.on === false) onChange(value.filter((sl) => dowOf(sl.date) !== i));
  };

  /** 이 달에서 «켠 요일»에 해당하는 날을 한꺼번에 담는다. 대표가 말한 「일괄 적용」이 이 버튼이다. */
  const fillMonth = () => {
    const add: OpenSlot[] = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = `${view.y}-${pad(view.m)}-${pad(d)}`;
      if (iso < today || picked(iso)) continue;
      const r = rules[dowOf(iso)];
      if (r?.on) add.push({ date: iso, start: r.start, end: r.end });
    }
    if (add.length) onChange([...value, ...add]);
  };

  const navCls =
    "inline-flex h-[44px] w-[44px] items-center justify-center rounded-md text-[18px] text-body transition-colors hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent";
  const timeSel = "h-[40px] w-[96px]";

  return (
    <div className="space-y-4">
      {/* ── ① 요일별 기본 시간 ── */}
      <div className="rounded-md border border-border-strong bg-surface p-3">
        <p className="text-[16px] font-medium text-ink">요일마다 몇 시에 여시나요</p>
        <p className="mt-1 text-[15px] leading-relaxed break-keep text-mute">
          여기서 정한 시간으로 날짜가 열려요. 특별한 날만 아래에서 따로 고치시면 됩니다.
        </p>
        <div className="mt-3 space-y-1.5">
          {rules.map((r, i) => (
            <div key={DOW[i]} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                aria-pressed={r.on}
                onClick={() => editRule(i, { on: !r.on })}
                className={`inline-flex h-[40px] w-[52px] shrink-0 items-center justify-center rounded-md text-[15px] font-medium transition-colors ${
                  r.on ? "bg-primary-tint text-primary-on" : "border border-hairline bg-surface text-faint"
                }`}
              >
                {DOW[i]}
              </button>
              {r.on ? (
                <>
                  <RentSelect
                    aria-label={`${DOW[i]}요일 여는 시각`}
                    className={timeSel}
                    value={r.start}
                    onChange={(e) => editRule(i, { start: e.target.value })}
                  >
                    {HOURS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </RentSelect>
                  <span className="text-mute">~</span>
                  <RentSelect
                    aria-label={`${DOW[i]}요일 닫는 시각`}
                    className={timeSel}
                    value={r.end}
                    onChange={(e) => editRule(i, { end: e.target.value })}
                  >
                    {HOURS.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </RentSelect>
                  {hoursBetween(r.start, r.end) < minHours && (
                    <span className="text-[14px] text-danger">최소 {minHours}시간을 못 채워요</span>
                  )}
                </>
              ) : (
                <span className="text-[15px] text-faint">이 요일은 안 빌려줘요</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── ② 달력 ── */}
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
            const sl = picked(iso);
            const ex = sl && isException(sl);
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
                {/* 예외인 날에만 점 하나. 달력만 보고도 「이 날은 다르다」가 보여야 한다. */}
                {ex && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-1 left-1/2 size-[4px] -translate-x-1/2 rounded-full bg-primary-on"
                  />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={fillMonth}
          className="mt-2 h-[44px] w-full rounded-md border border-hairline text-[15px] text-body transition-colors hover:bg-surface-soft"
        >
          이 달에서 켠 요일 전부 담기
        </button>
      </div>

      {/* ── ③ 고른 결과 ── */}
      {sorted.length === 0 ? (
        <p className="text-[15px] leading-relaxed break-keep text-faint">
          날짜를 눌러 주세요. 하루도 없으면 아무도 신청할 수 없어요.
        </p>
      ) : (
        <div>
          <p className="text-[15px] leading-relaxed break-keep text-body">
            <span className="font-medium text-ink">{sorted.length}일</span>을 여셨어요. 대여하시는 분에게 이 날짜가
            보입니다.
            {exceptions.length > 0 && (
              <span className="text-mute"> · 시간을 따로 정한 날 {exceptions.length}일</span>
            )}
          </p>

          {/* 예외만 줄로. 기본과 같은 날은 여기 안 나온다 — 예순 날을 골라도 목록이 안 길어지는 이유다. */}
          {exceptions.length > 0 && (
            <div className="mt-3 space-y-2">
              {exceptions.map((sl) => (
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

          {/* 기본대로인 날은 접어 둔다. 눌러야 펼쳐진다. */}
          {sorted.length > exceptions.length && (
            <details className="mt-3">
              <summary className="cursor-pointer list-none py-[10px] text-[15px] text-mute underline underline-offset-2">
                시간을 따로 정하고 싶은 날이 있나요
              </summary>
              <div className="mt-2 space-y-2">
                {sorted
                  .filter((sl) => !isException(sl))
                  .map((sl) =>
                    openException === sl.date ? (
                      <SlotRow
                        key={sl.date}
                        sl={sl}
                        minHours={minHours}
                        onEdit={(patch) => editDate(sl.date, patch)}
                        onRemove={() => toggle(sl.date)}
                      />
                    ) : (
                      <div key={sl.date} className="flex items-center gap-2 rounded-md border border-hairline px-3 py-2">
                        <p className="min-w-0 flex-1 text-[15px] text-body">
                          {dateLabel(sl.date)} · {sl.start}~{sl.end}
                        </p>
                        <button
                          type="button"
                          onClick={() => setOpenException(sl.date)}
                          className="h-[40px] px-2 text-[15px] text-mute underline underline-offset-2"
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

/** 한 날짜의 시각을 고치는 줄. 예외 목록과 「시간 바꾸기」로 편 줄이 같은 모양을 쓴다. */
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
  const h = hoursBetween(sl.start, sl.end);
  const bad = h <= 0 ? "끝나는 시각이 더 늦어야 해요." : h < minHours ? `최소 ${minHours}시간을 못 채워요.` : "";
  return (
    <div className="rounded-md border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="min-w-[104px] text-[16px] font-medium text-ink">{dateLabel(sl.date)}</p>
        <RentSelect
          aria-label={`${dateLabel(sl.date)} 여는 시각`}
          className="h-[40px] w-[96px]"
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
          className="h-[40px] w-[96px]"
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
          className="ml-auto h-[40px] px-2 text-[15px] text-mute underline underline-offset-2"
        >
          빼기
        </button>
      </div>
      {bad && <p className="mt-2 text-[15px] leading-relaxed break-keep text-danger">{bad}</p>}
    </div>
  );
}
