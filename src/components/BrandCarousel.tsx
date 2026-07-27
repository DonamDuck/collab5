"use client";

// 홈 "콜라보 가능한 브랜드" 가로 캐러셀 — /search 카드의 세미 버전.
// 모바일=손가락 스와이프(스크롤스냅), 데스크탑=좌우 화살표. 자동재생 없음.
//
// ⚠️ **마우스 드래그(잡고 끌기)는 일부러 넣지 않았다.** 카드가 <Link>라서,
//    드래그용 setPointerCapture를 걸면 click이 캡처 대상(스크롤 컨테이너)으로 retarget돼
//    앵커의 클릭이 아예 안 불려 **데스크탑에서만 카드 이동이 죽는다**(PhotoSlider에서 겪은 버그).
//    데이터는 서버가 주입하고(page.tsx) 여기선 스크롤 상태만 다룬다.
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Maker } from "@/lib/types";

/** 카드 폭 — 디자인팀 스펙(07-27) = 모바일 카드 ~82vw + 다음 카드 ~14vw peek(밀 수 있다는 신호),
 *  데스크탑(960 컨테이너)은 3.3장이 걸치게 280px.
 *  ⚠️ `%`는 뷰포트가 아니라 **레일의 콘텐츠 박스**(뷰포트 − 좌우 패딩 32) 기준으로 풀린다.
 *     그래서 스펙의 82vw를 그대로 82%로 쓰면 실제론 75vw밖에 안 나온다 → 86%로 보정(실측 peek 14%).
 *  640~ 구간에서 %가 과하게 커지지 않도록 상한도 둔다. */
const CARD_W = "w-[86%] max-w-[300px] shrink-0 sm:w-[280px] sm:max-w-none";

export function BrandCarousel({ brands }: { brands: Maker[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  const sync = () => {
    const el = ref.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 8);
    // 소수점 오차로 끝에서 1px 남는 경우가 있어 여유 8px
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 8);
  };

  // 첫 렌더 + 리사이즈 시 화살표 노출 여부 재계산(카드 수가 적어 스크롤이 없으면 둘 다 숨김)
  useEffect(() => {
    sync();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(sync);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const nudge = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: "smooth" });
  };

  return (
    <div className="relative">
      {/* 모바일에선 카드가 화면 가장자리까지 흘러야 "더 있다"가 읽힌다 →
          부모(main)의 좌우 패딩을 음수 마진으로 상쇄하고 같은 값을 안쪽 패딩으로 되돌린다. */}
      <div
        ref={ref}
        onScroll={sync}
        // snap은 proximity — 한 화면에 카드가 여러 장 보이는 레일이라 mandatory(=PhotoSlider처럼
        //   한 장씩 넘기는 갤러리용)는 과하다. 마지막 카드는 스냅 지점이 최대 스크롤보다 뒤라
        //   mandatory에선 끝에 얌전히 멈추질 못한다.
        // scroll-pl-* 없으면 snap-start가 패딩을 무시하고 카드를 스크롤포트 맨 끝에 붙여
        //   첫 장이 25px 밀린 채로 시작한다(왼쪽 여백 증발 + 화살표가 처음부터 뜸).
        className="no-scrollbar -mx-4 flex snap-x snap-proximity gap-3 overflow-x-auto scroll-pl-4 px-4 pb-1 sm:-mx-6 sm:scroll-pl-6 sm:px-6"
      >
        {brands.map((m) => (
          <BrandCard key={m.id} m={m} />
        ))}
        <MoreCard />
      </div>

      {/* 데스크탑 화살표 — 모바일은 스와이프라 숨김. 더 스크롤할 게 없으면 각각 숨긴다. */}
      {!atStart && (
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="이전 브랜드"
          className="absolute -left-3 top-[86px] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill border border-hairline bg-surface text-lg text-ink shadow-e1 hover:bg-surface-soft lg:flex"
        >
          ‹
        </button>
      )}
      {!atEnd && (
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="다음 브랜드"
          className="absolute -right-3 top-[86px] hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-pill border border-hairline bg-surface text-lg text-ink shadow-e1 hover:bg-surface-soft lg:flex"
        >
          ›
        </button>
      )}
    </div>
  );
}

/** 검색 카드의 세미 버전 — 썸네일 3:2(검색과 동일) + 상호 + 한 줄 소개 + 키워드 2개.
 *  디자인팀 "무대 원칙"(07-27): 주인공은 썸네일·상호, collab5 크롬은 덜어낸다.
 *  - `콜라보 받는 중` 뱃지 제거 = 섹션 자체가 그 조건이라 전 카드에 붙어 중복.
 *  - 지역 제거 = 홈은 맛보기라 노이즈. (검색 카드는 여러 상태가 섞이므로 둘 다 그대로 유지) */
function BrandCard({ m }: { m: Maker }) {
  return (
    <Link
      href={`/m/${m.slug}`}
      className={`block shrink-0 snap-start overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:bg-surface-soft ${CARD_W}`}
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
      <div className="px-4 py-3">
        <p className="truncate text-base font-medium text-ink">{m.name}</p>
        {m.oneLiner && <p className="mt-0.5 line-clamp-1 text-sm text-body">{m.oneLiner}</p>}
        {/* 키워드는 2개까지 — 카드 폭이 검색(3열 그리드)보다 좁아 3개면 줄바꿈이 난다 */}
        <div className="mt-2 flex h-5 flex-wrap gap-1.5 overflow-hidden">
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

/** 마지막 슬라이드 = 찾기 페이지로 넘기는 카드. 브랜드 카드와 **같은 폭**이라 스냅 리듬이 안 깨진다.
 *  디자인팀 스펙(07-27): 헤더 우측 '전체 보기' 링크는 두지 않고 이 카드 하나로 통일(둘 다는 과하다),
 *  "N곳 더" 같은 개수 표기도 뺀다(데이터가 적을 때 "3곳 더"가 오히려 빈약해 보임).
 *  ⚠️ 섹션 밴드가 `bg-surface-soft`라 카드까지 soft면 배경에 묻힌다 → 카드 면은 흰색 유지.
 *  ⚠️ 테두리는 **실선 hairline**. 점선(`border-dashed`)은 07-26 `/my` 빈 화면에서 대표가
 *     "옛날 스타일"이라며 전부 걷어낸 표현이라 쓰지 않는다(플레이스홀더·미완성 느낌).
 *     실카드는 썸네일이 있어 저절로 구분되고, 여긴 흰 면 + 얇은 실선 + 중앙 배지로 충분하다. */
function MoreCard() {
  return (
    <Link
      href="/search"
      className={`flex snap-start flex-col items-center justify-center rounded-lg border border-hairline bg-surface px-4 text-center transition-colors hover:bg-primary-pale ${CARD_W}`}
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
