import type { Metadata } from "next";
import Link from "next/link";
import { listOpenSpaces } from "@/lib/spaces";
import type { SpacePublic, SpaceUseType } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { RentFilters, type UseFilter } from "./RentFilters";
import { CoverPlaceholder, primaryBtnCls, secondaryBtnCls, won } from "./ui";

// 하루 가게 — 목록 (2026-09-13)
// 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
//
// ⚠️`force-dynamic` — 공개하자마자 목록에 떠야 한다. 프리렌더면 재배포 전까지 새 공간이 안 보인다
//   (`/search`·`/magazine`이 같은 이유로 같은 설정을 쓴다).
//   여기엔 이유가 하나 더 있다: **비는 날이 예약될 때마다 목록이 바뀐다.** 어제 만든 HTML은 이미 틀렸다.
//
// 🎨09-13 재작업 — 히어로 한 문장 + 키위 버튼 하나, 그 아래는 `/search`와 같은 3:2 커버 카드.
//   ⛔레몬색 「공간 있으세요?」 배너를 뺐다. 노란 면은 이 사이트에 없는 어휘고, 공급을 부르는 일은
//     히어로 옆의 키위 버튼 하나가 더 잘한다(배너는 목록을 훑으러 온 사람에게 광고처럼 읽혔다).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "하루 가게 — collab5",
  description:
    "안 쓰는 날의 공간을 하루 단위로 빌려드려요. 가게를 열어보고 싶은 사람이 그날 하루 사장님이 됩니다.",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식에 상속돼, 안 덮으면 이 페이지가 홈의 사본이 된다.
  alternates: { canonical: "/rent" },
};

/** 주소로 들어온 쓰임새 값을 걸러 낸다. 모르는 값은 「전체」로 떨어뜨린다 —
 *  목록을 좁히는 값일 뿐이라 접근 범위와 무관하고, 404를 내면 오타 하나에 빈 화면이 된다. */
function parseUse(raw: string | undefined): UseFilter {
  return raw === "as_is" || raw === "open" ? raw : "";
}

/** 카드 한 장 — 고르는 것이라 박스(디자인-시스템 §카드 어휘). `/search` 카드와 같은 옷:
 *  위 3:2 커버, 아래 이름 15 bold · 한 줄 15 · 메타 13 faint.
 *  ⭐카드 위 pill은 「사장님이 알려줘요」 하나뿐. 비는 날 개수·가까운 날·쓰임새 칩은 뺐다 —
 *    카드는 고르게만 하면 되고, 나머지는 눌러서 본다(칩 셋이 쌓이니 표처럼 보였다).
 *  🚨주소는 여기 없다. `listOpenSpaces`가 `SpacePublic`을 돌려주므로 **런타임 객체에 주소 자체가 없다** —
 *    확정 전에 가게가 특정되면 플랫폼을 건너뛴 직거래가 일어난다(설계 §이탈). */
function SpaceCard({ sp }: { sp: SpacePublic }) {
  const cover = sp.photos[0];
  return (
    <Link
      href={`/rent/${sp.slug}`}
      className="block h-full overflow-hidden rounded-lg border-[0.5px] border-[#DFDFE3] bg-surface transition-colors hover:bg-surface-soft"
    >
      <div className="relative aspect-[3/2] w-full overflow-hidden bg-surface-soft">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <CoverPlaceholder />
        )}
        {/* 사장님 시간은 이 서비스만 파는 물건이라 커버 위에 미리 알린다(설계 §노하우 = 옵션 상품). */}
        {sp.mentorMinutes > 0 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-pill bg-surface/90 px-3 py-1 text-[13px] font-medium text-ink">
            사장님이 {sp.mentorMinutes}분 알려줘요
          </span>
        )}
      </div>

      <div className="px-4 py-3.5">
        {/* min-w-0 + truncate 한 쌍 — 375px에서 긴 이름이 카드를 밀어 **가로 스크롤**을 만든다. */}
        <p className="min-w-0 truncate text-[15px] font-bold text-ink">{sp.name}</p>
        {sp.tagline && (
          <p className="mt-1 line-clamp-1 text-[15px] leading-relaxed text-body">{sp.tagline}</p>
        )}
        <p className="mt-2 text-[13px] text-faint">
          {sp.area || "동네 미정"} · 하루 {won(sp.priceDay)}
        </p>
      </div>
    </Link>
  );
}

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; date?: string; use?: string }>;
}) {
  const { area, date, use } = await searchParams;
  const useFilter = parseUse(use);
  // ⚠️`listOpenSpaces`는 `useType`이 "both"면 거르기를 건너뛴다. 그래서 「전체」는 값을 **안 넘긴다** —
  //   "both"를 넘겨도 결과는 같지만, 뜻이 다른 두 값(전체 / 둘 다 가능한 공간)을 한 글자로 섞으면
  //   다음 사람이 필터 로직을 고칠 때 반드시 헷갈린다.
  const spaces = await listOpenSpaces({
    area: area?.trim() || undefined,
    date: date || undefined,
    useType: (useFilter || undefined) as SpaceUseType | undefined,
  });
  const filtered = !!(area?.trim() || date || useFilter);

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 py-10 sm:px-6 sm:py-14">
      {/* 히어로 — 큰 제목 한 문장 + 넉넉한 여백 + 강조는 버튼 하나(리틀리에서 가져온 「덜어냄」). */}
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-[680px]">
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
            안 쓰는 날, 하루만 빌려드려요
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
            가게를 열어보고 싶은 분이 그날 하루 사장님이 돼요.
          </p>
        </div>
        {/* ⭐이 화면의 유일한 키위. 공급이 병목이라(설계 §조사 ④) 부르는 버튼이 목록보다 먼저 보여야 한다. */}
        <Link href="/rent/new" className={`${primaryBtnCls} h-[48px] shrink-0`}>
          안 쓰는 날 올리기
        </Link>
      </header>

      <RentFilters
        initialArea={area?.trim() ?? ""}
        initialDate={date ?? ""}
        initialUse={useFilter}
      />

      {spaces.length === 0 ? (
        // 빈 화면이 두 종류다 — 아직 아무것도 없는 것과, 조건에 안 걸린 것.
        // 같은 문장을 쓰면 「조건을 지우면 보인다」는 사실이 안 보여 고장난 페이지로 읽힌다.
        // ⚠️`EmptyState`의 ctaLabel은 키위 버튼을 그린다. 이 화면의 키위는 위 히어로 하나뿐이라
        //   여기선 children으로 보조 버튼을 넣는다.
        <div className="mt-6">
          {filtered ? (
            <EmptyState title="조건에 맞는 공간이 아직 없어요" desc="동네나 날짜를 조금 넓혀 보시겠어요?">
              <Link href="/rent" className={secondaryBtnCls}>
                조건 지우고 전체 보기
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              title="첫 번째 공간을 기다리고 있어요"
              desc="안 쓰는 날이 있는 공간을 먼저 올려주시면, 빌리실 분들께 보여드릴게요."
            >
              <Link href="/rent/new" className={secondaryBtnCls}>
                내 공간 올리기
              </Link>
            </EmptyState>
          )}
        </div>
      ) : (
        <>
          <p className="mt-10 text-[15px] text-faint">{spaces.length}곳이 기다리고 있어요</p>
          {/* 모바일 1열 → 640px부터 2열. 카드 안쪽을 min-w-0으로 잠가 뒀으니 좁은 화면에서 밀리지 않는다. */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {spaces.map((sp) => (
              <SpaceCard key={sp.slug} sp={sp} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
