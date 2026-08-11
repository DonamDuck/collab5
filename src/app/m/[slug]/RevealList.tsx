"use client";

import { useState } from "react";
import { track } from "@/lib/track";
import { REVEAL_STEP, PRINT_ITEM_LIMIT } from "@/lib/limits";

// 활동·콜라보 목록을 5건씩 끊어 보여주는 껍데기 (2026-08-10, 상한 5→30 확장).
// spec: docs/superpowers/specs/2026-08-10-activity-collab-30-design.md
//
// ⭐**항목을 잘라내지 않는다 — 전부 그려놓고 CSS로 숨긴다.** 이유가 셋이고, 셋 다 중요하다:
//
//  1. 🔍**검색엔진이 읽는다.** 08-09에 소개서를 구글·네이버에 열었다. 여기서 `slice`로 잘라
//     클라이언트에서만 뒤를 그리면 **접힌 항목이 서버 HTML에 없어 통째로 색인이 안 된다** —
//     콜라보 이력을 자산으로 만들자면서 검색에는 5건만 내놓는 꼴이 된다.
//     (자식은 서버 컴포넌트에서 이미 만들어져 `children`으로 넘어온다 = 서버 HTML에 다 있다.)
//  2. 🖼**그래도 사진은 안 받는다.** `display:none` 안의 `loading="lazy"` 이미지는 브라우저가
//     뷰포트 밖으로 보고 요청하지 않는다. **SEO는 얻고 트래픽은 안 낸다.**
//  3. 🖨**인쇄가 공짜로 풀린다.** 화면에서 몇 건을 펼쳤든 인쇄는 늘 앞 PRINT_ITEM_LIMIT건.
//     화면 상태와 인쇄 분량이 서로 간섭하지 않는다(펼쳐놓고 인쇄해도 지류는 그대로).
//
// 🪤 그래서 이 컴포넌트는 `children`을 **배열로 받아 개수를 세는 것**이 전부다.
//    부모가 `.slice()`를 하고 넘기면 위 셋이 전부 무너진다 — 자르지 말고 통째로 넘길 것.
export function RevealList({
  children,
  kind,
  label,
}: {
  children: React.ReactNode[];
  /** 계측 이벤트 구분용 — "activity" | "collab" */
  kind: "activity" | "collab";
  /** 더보기 줄에 쓰는 우리말 이름 — "활동" | "콜라보" */
  label: string;
}) {
  const total = children.length;
  const [shown, setShown] = useState(REVEAL_STEP);
  const rest = total - shown;

  const more = () => {
    const next = shown + REVEAL_STEP;
    setShown(next);
    // 몇 번째 장까지 실제로 보는지 — 아무도 2장째를 안 누르면 뒤 층은 창고라는 뜻이고,
    // 그러면 다음 결정은 "더 늘리기"가 아니라 "앞 5개를 더 잘 고르기"가 된다.
    track(`${kind}_more`, { page: Math.ceil(next / REVEAL_STEP), total });
  };

  return (
    <>
      <div className="space-y-6">
        {children.map((child, i) => (
          <div
            key={i}
            // 화면: 앞 `shown`개만 / 인쇄: 화면 상태와 무관하게 앞 PRINT_ITEM_LIMIT개만.
            className={`${i < shown ? "" : "hidden"} ${
              i < PRINT_ITEM_LIMIT ? "print:block" : "print:hidden"
            }`}
          >
            {child}
          </div>
        ))}
      </div>

      {rest > 0 && (
        <button
          type="button"
          onClick={more}
          className="mt-5 flex w-full items-center justify-center gap-1.5 rounded-md border border-hairline bg-surface py-3 text-[15px] font-medium text-ink transition-colors hover:bg-primary-pale print:hidden"
        >
          {/* 남은 개수를 말해준다 — "더 보기"만 있으면 몇 개가 더 있는지 몰라서 안 누른다.
              한 번에 늘어나는 건 REVEAL_STEP개지만, 문구는 **남은 전체**를 알려주는 게 정직하다. */}
          {label} {rest}건 더 보기
          <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true">
            <path d="M5 8l5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      )}
    </>
  );
}
