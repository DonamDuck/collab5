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
// 💾저장은 날짜마다 시각 한 벌(`openSlots`)이다. 규칙을 저장하지 않는 이유 —
//   규칙을 고치는 순간 **이미 팔린 날의 시간까지 흔들린다.** 규칙은 이 화면 안에서만 산다.
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
const BASE = { start: "10:00", end: "18:00" };

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
  /** 🚨**갱신 함수를 받는다**(값만 받지 않는다). 달력은 연달아 눌리는 화면이라, 렌더 사이에 두 번 누르면
   *  두 번째가 «한 판 전의 목록»으로 덮어써서 첫 번째 선택이 사라진다(09-16 실측 — 두 날을 눌렀는데 하나만 담겼다).
   *  ⭐부모의 `setOpenSlots`를 그대로 넘기면 React가 최신 값을 물어다 준다. */
  onChange: (next: OpenSlot[] | ((cur: OpenSlot[]) => OpenSlot[])) => void;
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

  const picked = (iso: string) => value.find((sl) => sl.date === iso);
  const sorted = [...value].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  /** 고른 날들이 쓰는 요일 목록 — 여기 있는 요일만 아래에 줄로 나온다. */
  const usedDows = Array.from(new Set(value.map((sl) => dowOf(sl.date)))).sort();
  /** 그 요일의 «대표 시간». 같은 요일에 여러 시간이 섞여 있으면 제일 많은 쪽을 기준으로 삼는다. */
  const dowTime = (d: number) => {
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

  const toggle = (iso: string) => {
    if (picked(iso)) {
      onChange((cur) => cur.filter((sl) => sl.date !== iso));
      if (editing === iso) setEditing(null);
      return;
    }
    // 새로 고르는 날은 그 요일의 기준 시간을 따라간다. 처음 고르는 요일이면 기본값.
    const t = dowTime(dowOf(iso));
    onChange((cur) =>
      cur.some((sl) => sl.date === iso) ? cur : [...cur, { date: iso, start: t.start, end: t.end }],
    );
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
    if (allPicked) {
      onChange((cur) => cur.filter((sl) => !inMonth.includes(sl.date)));
      return;
    }
    const t = dowTime(d);
    onChange((cur) => {
      const have = new Set(cur.map((sl) => sl.date));
      const add = inMonth.filter((iso) => !have.has(iso)).map((iso) => ({ date: iso, start: t.start, end: t.end }));
      return [...cur, ...add];
    });
  };

  /** 요일 줄의 시각을 고치면 그 요일의 «기준을 따르던» 날이 다 따라간다.
   *  ⚠️따로 정해 둔 날은 안 건드린다 — 사장님이 일부러 다르게 한 것이다. */
  const editDow = (d: number, patch: { start?: string; end?: string }) => {
    const before = dowTime(d);
    const after = { ...before, ...patch };
    onChange((cur) =>
      cur.map((sl) =>
        dowOf(sl.date) === d && sl.start === before.start && sl.end === before.end ? { ...sl, ...after } : sl,
      ),
    );
  };

  const editDate = (iso: string, patch: Partial<OpenSlot>) =>
    onChange((cur) => cur.map((sl) => (sl.date === iso ? { ...sl, ...patch } : sl)));

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
              className="mx-0.5 mb-1 rounded-pill bg-surface-soft py-1.5 text-center text-[14px] font-medium text-body transition-colors hover:bg-primary-pale"
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
              const h = hoursBetween(t.start, t.end);
              const n = value.filter((sl) => dowOf(sl.date) === d).length;
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
                  {h < minHours && (
                    <span className="text-[14px] text-danger">최소 {minHours}시간을 못 채워요</span>
                  )}
                </div>
              );
            })}
          </div>
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
  const h = hoursBetween(sl.start, sl.end);
  const bad = h <= 0 ? "끝나는 시각이 더 늦어야 해요." : h < minHours ? `최소 ${minHours}시간을 못 채워요.` : "";
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
