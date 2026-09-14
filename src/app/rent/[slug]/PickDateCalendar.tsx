"use client";

// 하루 가게 — 신청 날짜 고르기 달력 (2026-09-14)
//
// 대표: *「여기는 눌렀을 때 뭔가 달력 UI가 나오면 좋을 거 같음. 이쁜 달력 UI 쓸 만한 거 있음 쓰자」*
//
// 🔻09-13엔 `<select>`였다. 그때 안 쓴 이유는 *「고를 수 있는 날이 사장님이 올린 목록뿐이라 달력을
//   띄우면 못 고르는 날이 화면의 대부분」*이었는데, **그게 오히려 정보였다.** 「이 공간은 화요일만
//   열린다」가 격자에서 한눈에 보인다. 목록은 날짜를 나열할 뿐 그 규칙을 안 보여준다.
//
// 📦**라이브러리를 안 붙였다.** 등록 폼의 `OpenDatesCalendar`가 이미 같은 격자를 그리고 있어서,
//   외부 달력을 들이면 **한 서비스 안에 달력이 두 모양**이 된다. 여기선 그쪽의 짜임과 클래스를
//   그대로 쓰되 고르는 방식만 바꿨다(여러 개 담기 → 하나 고르기).
//   🔗나중에 둘을 한 파일로 합칠 수 있다. 지금 안 합친 건 고르는 규칙이 서로 반대라서다 —
//     저쪽은 «비는 날을 만들고» 이쪽은 «그중 하나를 집는다».
//
// ⚠️날짜 계산은 UTC 자정 기준 정수 연산이다. `new Date(y, m, d)`는 브라우저 시간대를 타서
//   달의 첫 요일이 기기마다 어긋난다. 오늘만 KST로 받고 나머지는 글자 비교로 한다.
import { useState } from "react";
import { dateLabel, todayKst } from "../ui";

const DOW = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");

export function PickDateCalendar({
  openDates,
  value,
  onChange,
}: {
  /** 사장님이 열어 둔 날만 고를 수 있다. 나머지는 보이되 안 눌린다. */
  openDates: string[];
  value: string;
  onChange: (iso: string) => void;
}) {
  const today = todayKst();
  // 처음 열릴 때 **고른 날이 있는 달**을 보여준다. 없으면 제일 가까운 열린 날의 달 —
  // 이번 달에 열린 날이 하나도 없는 공간에서 빈 격자를 먼저 보여주면 「없는 줄」 알고 닫는다.
  const anchor = value || openDates[0] || today;
  const [ay, am] = anchor.split("-").map(Number);
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ y: ay, m: am });

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
            const open = openDates.includes(iso);
            const on = iso === value;
            return (
              <button
                key={iso}
                type="button"
                disabled={!open}
                aria-pressed={on}
                aria-label={`${dateLabel(iso)}${open ? "" : " (빌릴 수 없어요)"}`}
                onClick={() => onChange(iso)}
                // 🎨세 상태가 눈에 구분돼야 한다 — 고른 날(키위 면) · 고를 수 있는 날(또렷한 글자)
                //   · 못 고르는 날(흐린 글자). 못 고르는 날을 «지우지 않고 흐리게** 두는 이유는
                //   그 대비가 「이 공간은 화요일만」을 말해 주기 때문이다.
                className={`h-[44px] w-full rounded-md text-[16px] transition-colors ${
                  on
                    ? "bg-primary-tint font-medium text-primary-on"
                    : open
                      ? "font-medium text-ink hover:bg-primary-pale"
                      : "cursor-default text-faint/50"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </div>

      {/* 고른 날을 글자로 한 번 더 적는다 — 격자의 키위 면만으로는 「몇 월 며칠 무슨 요일」이 안 읽힌다. */}
      <p className="mt-2 text-[15px] text-body">
        {value ? (
          <>
            고르신 날 <span className="font-medium text-ink">{dateLabel(value)}</span>
          </>
        ) : (
          <span className="text-faint">빌릴 날을 골라 주세요.</span>
        )}
      </p>
    </div>
  );
}
