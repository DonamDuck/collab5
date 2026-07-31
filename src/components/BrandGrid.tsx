"use client";

// 홈 "콜라보 가능한 브랜드" — 정보형 가로 리스트 카드 (07-31 대표 QA 2차: "카드가 단조롭다").
// v1(세로 2열 그리드)은 사진+이름+키워드뿐이라 밋밋했다 → /search 카드의 정보량(지역·한줄·키워드 3)을
// 옮기되, 세로 카드로 다 담으면 11곳 × ~300px = 스크롤 폭탄 → **가로형(썸네일 좌 + 정보 우)**으로 압축.
// 모바일 1열(대표: "1열로 1개씩 길게도 좋다") · sm+ 2열. 정렬은 repo가 최신순으로 준다.
// '콜라보 받는 중' 뱃지는 계속 생략(섹션 자체가 그 조건 — 디자인팀 07-27 무대 원칙 승계).
// "use client"인 이유 = 카드 클릭 계측(track) 하나뿐. 데이터는 서버(page.tsx)가 주입.
import Link from "next/link";
import { track } from "@/lib/track";
import type { Maker } from "@/lib/types";

export function BrandGrid({ brands }: { brands: Maker[] }) {
  return (
    <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-3 sm:grid-cols-2">
      {brands.map((m) => (
        <BrandCell key={m.id} m={m} />
      ))}
      <MoreCell />
    </div>
  );
}

function BrandCell({ m }: { m: Maker }) {
  return (
    <Link
      href={`/m/${m.slug}`}
      onClick={() => track("home_grid_brand_click", { slug: m.slug })}
      className="flex gap-3.5 rounded-lg border border-hairline bg-surface p-3 transition-colors hover:bg-surface-soft"
    >
      {/* 썸네일 정방형 — 가로 카드라 3:2 대신 1:1이 정보 영역을 안 잡아먹는다 */}
      <div className="h-[92px] w-[92px] shrink-0 overflow-hidden rounded-md bg-surface-soft">
        {m.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-pale">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="collab5" className="h-9 w-9 opacity-70" />
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <div className="flex items-baseline gap-1.5">
          <p className="truncate text-[15px] font-bold text-ink">{m.name}</p>
          {m.region && <span className="shrink-0 text-[12px] text-mute">· {m.region}</span>}
        </div>
        {m.oneLiner && (
          <p className="mt-1 line-clamp-2 text-[13px] leading-[1.5] text-body">{m.oneLiner}</p>
        )}
        <div className="mt-1.5 flex h-5 flex-wrap gap-1.5 overflow-hidden">
          {m.keywords.slice(0, 3).map((v) => (
            <span
              key={v}
              className="rounded-sm bg-mint-pale px-1.5 py-0.5 text-[11px] font-medium text-mint-on"
            >
              {v}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

/** 마지막 셀 = 찾기 페이지 카드. 캐러셀 MoreCard 원칙 승계(07-27 디자인팀):
 *  개수 표기 없음, 흰 면 + 실선 hairline(점선 금지). 가로 카드 높이(~118px)에 맞춘다. */
function MoreCell() {
  return (
    <Link
      href="/search"
      onClick={() => track("home_grid_more_click")}
      className="flex min-h-[118px] items-center justify-center gap-3 rounded-lg border border-hairline bg-surface px-4 transition-colors hover:bg-primary-pale"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-surface-soft text-primary-on">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-[15px] font-medium text-ink">더 많은 브랜드 보기</span>
    </Link>
  );
}
