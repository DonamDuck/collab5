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
      {/* 🔻09-14 쓰임새 칩(전체·원래 목적대로·대관) **삭제** — 대표: *「여기 카테고리는 일단 전체만
          남기고 제거, 나중에 한번 싹 업데이트 할게. 다만 등록 type DB는 등록할때 입력하도록 할거야」*.
          ⭐**칩을 「전체」 하나만 남기지 않고 줄을 통째로 뺐다.** 고를 게 하나뿐인 고르개는 고르개가 아니라
            아무것도 안 하는 버튼이다. 「전체」는 이제 «상태»로만 있다(아무 조건도 안 건 상태).
          ⭐`use_type`은 **DB·등록 폼·상세 화면에 그대로 살아 있다.** 없앤 건 목록의 «거르개»뿐이라
            되살릴 땐 이 줄만 복구하면 된다(`UseFilter`·`apply`의 `use` 배선을 남겨 둔 이유). */}
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
