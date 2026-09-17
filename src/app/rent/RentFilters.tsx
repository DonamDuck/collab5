"use client";

// 하루 가게 목록 거르개 — 동네 · 업종 (2026-09-13 · 2026-09-16 날짜→업종)
//
// ⭐거른 결과를 **주소(query string)에 담는다.** 클라 상태로만 들고 있으면 새로고침·뒤로가기에서
//   조건이 사라지고, 「성수동 목록」을 남에게 링크로 줄 수도 없다. 거르기는 서버가 한다.
//
// 🔁**09-16에 날짜 칸을 업종으로 갈았다** (백로그 B84).
//   🩸날짜 거르개는 시간 단위 개편 이후 «항상 0건»이었다. 옛 `open_dates` 칸을 보고 있었는데
//     새 등록은 그 칸을 안 채운다. 화면엔 멀쩡한 달력이 서 있고 고르면 목록이 비는 상태였다.
//   ⭐그리고 고르는 축으로도 날짜가 맞지 않는다. 훑는 사람은 「이 날 되는 곳」보다
//     「어떤 가게인가」를 먼저 본다. 날짜는 그 가게를 고른 «다음»에 상세에서 고른다.
//
// ⚠️초기값을 `useSearchParams`로 읽지 않고 **props로 받는다.** 이 컴포넌트는 Suspense 밖이라
//   그 훅을 쓰면 Next가 페이지 전체를 CSR로 강등시킨다(`/search/page.tsx`가 같은 함정을 적어 뒀다).
//   페이지가 이미 `force-dynamic`이라 서버에서 읽어 내려주는 게 공짜다.
//
// 🎨09-13 재작업 — 검정 [찾기] 버튼을 뺐다. 이 화면의 버튼은 히어로의 키위 하나뿐이어야 하고,
//   검정 면은 우리 사이트 어디에도 없는 어휘다. 대신 값이 바뀌는 순간 주소에 싣는다
//   (업종은 고르는 즉시, 동네는 Enter나 칸을 벗어날 때. 글자마다 새로고침하면 목록이 떨린다).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { SpaceCategory } from "@/lib/types";
import { CATEGORY_OPTIONS, RentSelect, rentQuietInputCls } from "./ui";

export type UseFilter = "" | "as_is" | "open";
// 🧹09-18 밤 QA SC-28 — 쓰임새 탭 목록(`USE_TABS`)을 걷었다. 09-14에 화면에서 쓰임새 칩을 뺀 뒤로 그리는 곳이 없었다.
//   주소의 `?use=`는 그대로 읽어 넘긴다.

export function RentFilters({
  initialArea,
  initialCategory,
  initialUse,
}: {
  initialArea: string;
  initialCategory: SpaceCategory;
  initialUse: UseFilter;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [area, setArea] = useState(initialArea);
  const [category, setCategory] = useState<SpaceCategory>(initialCategory);
  const [use, setUse] = useState<UseFilter>(initialUse);

  /** 세 값을 한 번에 주소로 옮긴다. 빈 값은 아예 안 싣는다 — `?area=&category=` 같은 껍데기가 남으면
   *  「지금 걸린 조건이 있나」를 주소만 보고 알 수 없게 된다. */
  const apply = (next: { area?: string; category?: SpaceCategory; use?: UseFilter }) => {
    const a = next.area ?? area;
    const c = next.category ?? category;
    const u = next.use ?? use;
    const q = new URLSearchParams();
    if (a.trim()) q.set("area", a.trim());
    if (c) q.set("category", c);
    if (u) q.set("use", u);
    const qs = q.toString();
    // replace를 쓰는 이유 — 거르개를 만질 때마다 뒤로가기 기록이 쌓이면, 목록에서 빠져나가려고
    // 뒤로가기를 열 번 눌러야 한다. 거르기는 「다른 페이지로 이동」이 아니다.
    start(() => router.replace(qs ? `/rent?${qs}` : "/rent"));
  };

  const hasAny = !!area.trim() || !!category || !!use;

  return (
    // 📐09-17 디자인팀 — 목록이 lg에서 1120으로 넓어지며 동네 칸이 1,030px로 늘었다. 두세 글자 동네 이름을 받는 칸이다.
    <div className="mt-10 space-y-3 lg:max-w-[640px]">
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
          className={`${rentQuietInputCls} min-w-0 flex-1`}
          value={area}
          onChange={(e) => setArea(e.target.value)}
          onBlur={() => {
            if (area.trim() !== initialArea) apply({});
          }}
          placeholder="지역, 이름으로 검색해 보세요"
          aria-label="지역이나 공간 이름"
        />
        {/* 업종도 고르는 순간이 곧 확정이다. 고른 뒤 버튼을 또 누르게 하면 한 번 더 일을 시킨다. */}
        <RentSelect
            tone="quiet"
            wrapClassName="w-[150px] shrink-0"
            value={category}
            onChange={(e) => {
              const v = e.target.value as SpaceCategory;
              setCategory(v);
              apply({ category: v });
            }}
            aria-label="업종"
          >
            <option value="">업종 전체</option>
            {CATEGORY_OPTIONS.map(([v, t]) => (
              <option key={v} value={v}>
                {t}
              </option>
            ))}
          </RentSelect>
      </form>

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setArea("");
            setCategory("");
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
