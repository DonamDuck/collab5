"use client";

// 홈 ②「콜라보 가능한 브랜드」 — **가로 캐러셀 6개 + 출구 둘** (대표 확정 2026-08-16, C1안).
//
// 📜왜 바뀌었나 — 07-31에는 "카드가 단조롭다"는 지적에 **정보량**으로 답해 가로형 정보 카드를
//   전량 나열했다. 그런데 브랜드가 늘면서 문제가 바뀌었다: **모바일에서 이 구좌만 1321px**,
//   화면 1.6개어치였다(대표: *"세로형으로 나열하다보니 스크롤도 좀 길어지는 감이 있다"*).
//   → 레퍼런스(팝플리·와사비) 형태인 캐러셀로 전환. 📏실측 1321 → **462px (-65%)**.
//   비교했던 5안·수치는 [[홈-개편-0816-쇼룸퍼스트]]에 남겼다.
//
// 🚪**출구가 둘인 게 핵심이다**(대표 지시).
//   · 레일 **끝 칸** = 끝까지 민 사람의 출구. 거기서 가장 가까운 다음 행동이다.
//   · **하단 버튼** = 안 민 사람의 출구. 캐러셀은 대다수가 안 밀기 때문에, 끝 칸만 두면
//     사실상 출구가 없는 것과 같다. 둘 중 어느 쪽이 먹히는지는 GA로 갈린다(이벤트가 다르다).
//
// ⏭️**다음 단계 = C2(유형 칩)**. 대표 확정 — *"나중에 업체가 많아지면 C2로 넘어가고 싶다"*.
//   켜는 법은 아래 `SHOW_TYPE_CHIPS` 주석에 통째로 적어뒀다. 지금 끈 이유는 **브랜드가 9곳뿐**이라
//   칩을 누르면 3~6곳이 나와서다 — 셸이 오히려 빈약함을 드러낸다.
import Link from "next/link";
import { COLLAB_TYPES, type CollabType, type Maker } from "@/lib/types";
import { track } from "@/lib/track";

/** 캐러셀에 그릴 최대 개수(대표 지시 08-16). 뒤는 출구 둘이 받는다. */
const CAROUSEL_LIMIT = 6;

/** ⏭️**C2 전환 스위치.** `true`로 바꾸면 레일 위에 콜라보 유형 칩이 붙는다.
 *  누르면 `/search?type=팝업` 꼴로 **그 유형으로 좁혀진 검색**이 열린다(서버가 파라미터를 읽는다 —
 *  `search/page.tsx`의 `parseTypes`). 실측 확인: 전체 9 → 팝업 6 / 공간대여 4 / 공동굿즈 3.
 *  🕐**켤 시점 = 브랜드가 20곳쯤 됐을 때**(대표 판단 몫). 그 전엔 칩이 빈약함을 드러낸다.
 *  ⚠️켤 때 `TypeChips`가 **실제 등록된 유형만** 그리는지 확인할 것 — 아무도 안 하는 유형을
 *    띄우면 눌렀을 때 빈 화면이 나오고, 그 순간 셸이 거짓말이 된다. */
const SHOW_TYPE_CHIPS = false;

/** 홈에 띄울 유형 순서(전체 7종 중 앞 5개). 어휘 정본은 `lib/types.ts`의 `COLLAB_TYPES`. */
const HOME_TYPES: CollabType[] = ["제품콜라보", "팝업", "워크숍", "공동굿즈", "공동콘텐츠"];

export function BrandGrid({ brands }: { brands: Maker[] }) {
  const shown = brands.slice(0, CAROUSEL_LIMIT);
  return (
    <div>
      {SHOW_TYPE_CHIPS && <TypeChips brands={brands} />}
      {/* ⚠️`-mx-4 px-4`가 핵심이다 — 레일이 **지면 끝까지 흐르게** 해야 마지막 카드가 잘려 보이고,
          그래야 "옆에 더 있다"가 손을 대기 전에 읽힌다. 가운데 정렬돼 끝이 딱 맞으면 아무도 안 민다.
          숫자는 부모(`page.tsx` main)의 좌우 패딩과 같아야 한다(`px-4 sm:px-6`).

          🚨**`scroll-pl-*`이 없으면 첫 카드가 화면에 쩍 붙는다**(대표 지적 08-16, 실측으로 확인).
            `snap-start`는 스냅 위치를 **스크롤 패딩 기준**으로 잡는데 그 값이 0이면 패딩을 무시하고
            정렬해 버린다 — 브라우저가 스스로 `scrollLeft`를 17px 밀어 `px-4`를 상쇄했다.
            (증상: 레일 `paddingLeft: 17px`인데 첫 카드 `left: 0`, `scrollLeft: 17`)
            → **`scroll-pl`을 `px`와 같은 값으로 맞춘다.** 둘은 항상 같이 움직여야 한다. */}
      <div
        className="-mx-4 flex snap-x snap-mandatory scroll-pl-4 gap-3 overflow-x-auto px-4 pb-3 sm:-mx-6 sm:scroll-pl-6 sm:px-6"
        style={{ scrollbarWidth: "none" }}
      >
        {shown.map((m) => (
          <div key={m.id} className="w-[210px] shrink-0 snap-start sm:w-[300px]">
            <BrandCard m={m} />
          </div>
        ))}
        <div className="w-[210px] shrink-0 snap-start sm:w-[300px]">
          <EndCard total={brands.length} />
        </div>
      </div>
      <BottomMore />
    </div>
  );
}

function BrandCard({ m }: { m: Maker }) {
  return (
    <Link
      href={`/m/${m.slug}`}
      onClick={() => track("home_grid_brand_click", { slug: m.slug })}
      className="block h-full overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:bg-surface-soft"
    >
      <div className="aspect-[3/2] w-full overflow-hidden bg-surface-soft">
        {m.photos[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.photos[0]} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-primary-pale">
            {/* 🚨정사각 클래스(`w-9` 등) 금지 — 08-16 새 마크는 가로:세로 1.28이라 찌그러진다.
                높이만 주고 폭은 `w-auto`. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-mark.png" alt="collab5" className="h-[30px] w-auto opacity-70" />
          </div>
        )}
      </div>
      <div className="px-3 py-3">
        <div className="flex min-w-0 items-center gap-1.5">
          <span className="min-w-0 truncate text-[15px] font-medium text-ink">{m.name}</span>
          {m.region && <span className="shrink-0 text-[12px] text-mute">· {m.region}</span>}
        </div>
        {m.oneLiner && <p className="mt-0.5 line-clamp-1 text-[13px] text-body">{m.oneLiner}</p>}
        {/* 🔒칩은 **한 줄 고정**(`h-[19px]` + `flex-nowrap`). 줄바꿈을 허용하면 카드마다 키가
            달라져 캐러셀 바닥선이 톱니처럼 어긋난다. 넘치는 칩은 잘린다 —
            성격은 한 줄로도 전달되고, 자세한 건 눌러서 본다. */}
        {m.keywords.length > 0 && (
          <div className="mt-2 flex h-[19px] flex-nowrap gap-1.5 overflow-hidden">
            {m.keywords.slice(0, 3).map((v) => (
              <span
                key={v}
                className="shrink-0 rounded-sm bg-mint-pale px-1.5 py-0.5 text-[11px] font-medium text-mint-on"
              >
                {v}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}

/** 레일 끝 칸 — 끝까지 민 사람의 출구. 개수 표기 없음, 흰 면 + 실선 hairline(점선 금지).
 *  이 원칙은 07-27 캐러셀 MoreCard에서 승계했다. */
function EndCard({ total }: { total: number }) {
  return (
    <Link
      href="/search"
      onClick={() => track("home_grid_more_click")}
      className="flex h-full flex-col items-center justify-center gap-2 rounded-lg border border-hairline bg-surface transition-colors hover:bg-primary-pale"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-pill bg-surface-soft">
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 10h12m0 0-4.5-4.5M16 10l-4.5 4.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      {/* 🔢개수는 **여기**로 옮겼다(08-16, 하단 버튼을 짧게 줄이면서).
          끝까지 민 사람은 이미 6곳을 봤으니 "그래서 몇 곳이 더 있나"가 그 자리의 질문이다. */}
      <span className="text-[14px] font-medium text-ink">{total}곳 모두 보기</span>
    </Link>
  );
}

/** 하단 버튼 — 캐러셀을 **안 민 사람**의 출구(대표 지시 08-16). */
function BottomMore() {
  return (
    <div className="mt-5 text-center">
      <Link
        href="/search"
        onClick={() => track("home_grid_more_bottom_click")}
        className="inline-flex h-12 items-center rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface px-6 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
      >
        {/* ✂️08-16 대표 지시로 「콜라보 가능한 브랜드 N곳 모두 보기」(281px)에서 줄였다.
            개수는 레일 끝 칸으로 옮겼다 — 두 출구가 같은 말을 하면 하나가 군더더기가 된다. */}
        브랜드 더 보기
        <span className="ml-1.5 text-faint">→</span>
      </Link>
    </div>
  );
}

/** ⏭️C2용 — `SHOW_TYPE_CHIPS`가 `true`일 때만 그려진다. 위 스위치 주석 참조. */
function TypeChips({ brands }: { brands: Maker[] }) {
  // 등록된 브랜드가 실제로 제공하는 유형만 그린다(빈 결과로 보내지 않기 위해).
  const live = new Set(brands.flatMap((m) => [...m.offers, ...m.seeks]));
  const types = HOME_TYPES.filter((t) => COLLAB_TYPES.includes(t) && live.has(t));
  if (!types.length) return null;
  return (
    <div
      className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
      style={{ scrollbarWidth: "none" }}
    >
      {types.map((t) => (
        <Link
          key={t}
          href={`/search?type=${encodeURIComponent(t)}`}
          onClick={() => track("home_grid_type_click", { type: t })}
          className="inline-flex h-9 shrink-0 items-center rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface px-3.5 text-[13px] font-medium text-body transition-colors hover:bg-surface-soft"
        >
          {t}
        </Link>
      ))}
    </div>
  );
}
