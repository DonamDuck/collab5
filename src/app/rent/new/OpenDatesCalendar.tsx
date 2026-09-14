"use client";

// 하루 가게 — 비는 날 달력 (2026-09-14)
//
// 라이브러리 없이 한 달 격자를 직접 그린다. 09-13엔 「날짜 칸 하나 + 담기 버튼」이었는데
// 대표 평가가 *「입력 UI가 불편하다」*였다 — 사장님은 「다음 주 화·목」처럼 «달력을 보며» 고르지,
// 날짜를 글자로 떠올려 치지 않는다. 격자 하나면 그 눈으로 고른다.
//
// ⚠️날짜 계산은 전부 UTC 자정 기준의 정수 연산이다. `new Date(y, m, d)`는 브라우저 시간대를 타서
//   달의 첫 요일이 기기마다 어긋날 수 있다. 오늘만 KST(`todayKst`)로 받고 나머지는 글자 비교로 한다.
import { useState } from "react";
import { dateLabel, todayKst } from "../ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export function OpenDatesCalendar({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const today = todayKst();
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ty, m: tm });

  const firstDow = new Date(Date.UTC(view.y, view.m - 1, 1)).getUTCDay();
  const daysInMonth = new Date(Date.UTC(view.y, view.m, 0)).getUTCDate();
  const cells: (number | null)[] = [
    ...Array<null>(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  // 지난 달로는 못 간다 — 지난 날은 어차피 전부 비활성이라 빈 격자만 보게 된다.
  const canPrev = view.y > ty || (view.y === ty && view.m > tm);
  const prev = () => setView((v) => (v.m === 1 ? { y: v.y - 1, m: 12 } : { y: v.y, m: v.m - 1 }));
  const next = () => setView((v) => (v.m === 12 ? { y: v.y + 1, m: 1 } : { y: v.y, m: v.m + 1 }));

  const toggle = (iso: string) =>
    onChange(value.includes(iso) ? value.filter((d) => d !== iso) : [...value, iso].sort());

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
            const on = value.includes(iso);
            return (
              <button
                key={iso}
                type="button"
                disabled={past}
                aria-pressed={on}
                aria-label={dateLabel(iso)}
                onClick={() => toggle(iso)}
                // 44px 터치 타깃. 고른 날만 키위 틴트, 오늘은 글자만 medium — 면은 「고름」 하나에만 준다.
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

      {value.length === 0 ? (
        <p className="mt-3 text-[15px] leading-relaxed break-keep text-faint">
          하루 이상 눌러 주세요. 이게 없으면 아무도 신청할 수 없어요.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {value.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggle(d)}
              aria-label={`${dateLabel(d)} 빼기`}
              className="inline-flex h-[44px] items-center rounded-pill bg-primary-tint px-4 text-[15px] font-medium text-primary-on"
            >
              {dateLabel(d)} <span className="ml-1.5 text-primary-on/60">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
