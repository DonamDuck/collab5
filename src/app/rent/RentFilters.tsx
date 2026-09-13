"use client";

// 하루 가게 목록 거르개 — 쓰임새 · 동네 · 날짜 (2026-09-13)
//
// ⭐거른 결과를 **주소(query string)에 담는다.** 클라 상태로만 들고 있으면 새로고침·뒤로가기에서
//   조건이 사라지고, 「성수동 목록」을 남에게 링크로 줄 수도 없다. 거르기는 서버가 한다
//   (`listOpenSpaces`의 날짜 거르기가 jsonb 안을 봐야 해서 클라가 흉내 낼 수 없다).
//
// ⚠️초기값을 `useSearchParams`로 읽지 않고 **props로 받는다.** 이 컴포넌트는 Suspense 밖이라
//   그 훅을 쓰면 Next가 페이지 전체를 CSR로 강등시킨다(`/search/page.tsx`가 같은 함정을 적어 뒀다).
//   페이지가 이미 `force-dynamic`이라 서버에서 읽어 내려주는 게 공짜다.
//
// 🎨09-13 재작업 — 검정 [찾기] 버튼을 뺐다. 이 화면의 버튼은 히어로의 키위 하나뿐이어야 하고,
//   검정 면은 우리 사이트 어디에도 없는 어휘다. 대신 값이 바뀌는 순간 주소에 싣는다
//   (칩·날짜는 고르는 즉시, 동네는 Enter나 칸을 벗어날 때 — 글자마다 새로고침하면 목록이 떨린다).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { todayKst } from "./ui";

export type UseFilter = "" | "as_is" | "open";

const USE_TABS: { v: UseFilter; label: string }[] = [
  { v: "", label: "전체" },
  { v: "as_is", label: "원래 목적대로" },
  { v: "open", label: "대관" },
];

/** 거르개 입력칸 — 폼 입력칸(`rentInputCls`, border-strong)보다 한 단 조용하다.
 *  여긴 채우는 곳이 아니라 훑는 곳이라, 테두리가 진하면 「써야 하는 칸」처럼 보인다. */
const quietInputCls =
  "h-[44px] rounded-md border border-hairline bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";

export function RentFilters({
  initialArea,
  initialDate,
  initialUse,
}: {
  initialArea: string;
  initialDate: string;
  initialUse: UseFilter;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [area, setArea] = useState(initialArea);
  const [date, setDate] = useState(initialDate);
  const [use, setUse] = useState<UseFilter>(initialUse);

  /** 세 값을 한 번에 주소로 옮긴다. 빈 값은 아예 안 싣는다 — `?area=&date=` 같은 껍데기가 남으면
   *  「지금 걸린 조건이 있나」를 주소만 보고 알 수 없게 된다. */
  const apply = (next: { area?: string; date?: string; use?: UseFilter }) => {
    const a = next.area ?? area;
    const d = next.date ?? date;
    const u = next.use ?? use;
    const q = new URLSearchParams();
    if (a.trim()) q.set("area", a.trim());
    if (d) q.set("date", d);
    if (u) q.set("use", u);
    const qs = q.toString();
    // replace를 쓰는 이유 — 거르개를 만질 때마다 뒤로가기 기록이 쌓이면, 목록에서 빠져나가려고
    // 뒤로가기를 열 번 눌러야 한다. 거르기는 「다른 페이지로 이동」이 아니다.
    start(() => router.replace(qs ? `/rent?${qs}` : "/rent"));
  };

  const hasAny = !!area.trim() || !!date || !!use;

  return (
    <div className="mt-10 space-y-3">
      {/* 쓰임새는 pill 칩 셋 — 값이 셋뿐이라 select보다 한 번에 보이는 쪽이 낫다.
          고른 칩만 키위 틴트. 이 덩어리 안의 pill은 이 한 종류뿐이다. */}
      <div className="flex flex-wrap gap-2">
        {USE_TABS.map((t) => {
          const on = use === t.v;
          return (
            <button
              key={t.v || "all"}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setUse(t.v);
                apply({ use: t.v });
              }}
              className={`inline-flex h-[44px] items-center rounded-pill px-4 text-[15px] font-medium transition-colors ${
                on
                  ? "bg-primary-tint text-primary-on"
                  : "border-[0.5px] border-[#DFDFE3] bg-surface text-body hover:bg-surface-soft"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          apply({});
        }}
      >
        <input
          className={`${quietInputCls} min-w-0 flex-1`}
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onBlur={() => {
            if (area.trim() !== initialArea) apply({});
          }}
          placeholder="동네로 찾기"
          aria-label="동네"
        />
        <input
          type="date"
          className={`${quietInputCls} w-[160px] shrink-0`}
          value={date}
          min={todayKst()}
          onChange={(e) => {
            setDate(e.target.value);
            // 날짜는 고르는 순간이 곧 확정이다 — 달력을 닫고 버튼을 또 누르게 하면 한 번 더 일을 시킨다.
            apply({ date: e.target.value });
          }}
          aria-label="날짜"
        />
      </form>

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setArea("");
            setDate("");
            setUse("");
            start(() => router.replace("/rent"));
          }}
          // 배경 없는 글자 링크는 세로 패딩으로 44px를 채운다(디자인-시스템 §터치 타깃).
          className="py-[12px] text-[15px] text-mute underline underline-offset-2"
        >
          조건 지우기
        </button>
      )}
    </div>
  );
}
