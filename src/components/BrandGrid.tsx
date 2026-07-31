"use client";

// 홈 "콜라보 가능한 브랜드" — 2열 카드 그리드 (07-31 캐러셀 대체, 대표 확정).
// 스펙: Obsidian [[홈-콜라보-프레임-개편]] §고민3 — 칩·검색바 없음(prod 실측: 칩당 대부분 1곳),
// n≤12 동안 전량 노출, 정렬은 repo가 최신순으로 준다.
// 카드 디자인은 캐러셀 카드(디자인팀 07-27 "무대 원칙")를 그리드 셀로 그대로 이식 —
// 뱃지·지역 생략, 썸네일 3:2 + 상호 + 한 줄 + 키워드 2개.
// "use client"인 이유 = 카드 클릭 계측(track) 하나뿐. 데이터는 서버(page.tsx)가 주입.
import Link from "next/link";
import { track } from "@/lib/track";
import type { Maker } from "@/lib/types";

export function BrandGrid({ brands }: { brands: Maker[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
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
      className="block overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:bg-surface-soft"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-surface-soft">
        {m.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-pale">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.svg" alt="collab5" className="h-10 w-10 opacity-70" />
          </div>
        )}
      </div>
      {/* 2열 그리드는 캐러셀 카드보다 폭이 좁다 — 패딩·본문을 한 단 줄이고 한 줄 소개는 모바일에서 숨긴다 */}
      <div className="px-3 py-2.5">
        <p className="truncate text-[15px] font-medium text-ink">{m.name}</p>
        {m.oneLiner && (
          <p className="mt-0.5 hidden line-clamp-1 text-[13px] text-body sm:block">{m.oneLiner}</p>
        )}
        <div className="mt-1.5 flex h-5 flex-wrap gap-1.5 overflow-hidden">
          {m.keywords.slice(0, 2).map((v) => (
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
 *  개수 표기 없음("N곳 더"는 데이터 적을 때 빈약해 보임), 흰 면 + 실선 hairline(점선 금지). */
function MoreCell() {
  return (
    <Link
      href="/search"
      onClick={() => track("home_grid_more_click")}
      className="flex min-h-[160px] flex-col items-center justify-center rounded-lg border border-hairline bg-surface px-3 text-center transition-colors hover:bg-primary-pale"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-pill bg-surface-soft text-primary-on">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="mt-3 text-[15px] font-medium text-ink">더 많은 브랜드 보기</span>
    </Link>
  );
}
