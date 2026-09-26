import type { Metadata } from "next";
import Link from "next/link";
import { listOpenSpaces } from "@/lib/spaces";
import type { SpaceCategory, SpacePublic, SpaceUseType } from "@/lib/types";
import { EmptyState } from "@/components/EmptyState";
import { RentFilters, type UseFilter } from "./RentFilters";
import { CATEGORY_OPTIONS, categoryLabel, CoverPlaceholder, secondaryBtnCls, won } from "./ui";
import { PRODUCT_LABEL } from "@/lib/rent-copy";
import { lowestPrice, productPrice, sellableProducts } from "@/lib/rent-products";
import { OG_IMAGE } from "@/lib/site";

// 하루 팝업 — 목록 (2026-09-13)
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

const TITLE = "하루 팝업 — collab5";
const DESCRIPTION =
  "안 쓰는 날의 공간을 시간 단위로 빌려드려요. 가게를 열어보고 싶은 사람이 그 시간만큼 사장님이 됩니다.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식에 상속돼, 안 덮으면 이 페이지가 홈의 사본이 된다.
  alternates: { canonical: "/rent" },
  // 🔗링크 미리보기(09-18 밤 QA SC-06). 안 주면 루트의 홈 카드(주소 `/`·홈 제목)가 그대로 상속돼서
  //   카톡에 하루 팝업 링크를 붙여도 홈 카드가 떴다.
  //   ⚠️`openGraph`는 칸 하나만 줘도 루트 것을 «통째로» 갈아 끼운다(Next 메타데이터는 얕게 합친다).
  //   그래서 사이트 이름·언어·기본 썸네일도 여기 같이 적는다. 빼면 카드에서 그림이 사라진다.
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: "/rent",
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
  },
};

/** 주소로 들어온 쓰임새 값을 걸러 낸다. 모르는 값은 「전체」로 떨어뜨린다 —
 *  목록을 좁히는 값일 뿐이라 접근 범위와 무관하고, 404를 내면 오타 하나에 빈 화면이 된다. */
function parseUse(raw: string | undefined): UseFilter {
  return raw === "as_is" || raw === "open" ? raw : "";
}

/** 📂업종도 같은 규칙(09-18 밤 QA G-24).
 *  🩸전엔 주소의 값을 그대로 DB 조건으로 넘겨서, `?category=foo`처럼 모르는 값이 오면 **아무것도 안 걸린
 *    빈 목록**이 떴다. 화면의 거르개는 「업종 전체」를 가리키고 있어서(그 값이 목록에 없으니) 손님 눈엔
 *    조건이 하나도 안 걸렸는데 공간이 0곳인 상태가 된다. 오타 하나가 「이 서비스엔 공간이 없다」가 되는 셈이다.
 *  ⭐아는 값만 받는다. 목록은 `CATEGORY_OPTIONS` 한 벌이라 고르개·거르개·여기가 같은 줄을 본다. */
function parseCategory(raw: string | undefined): SpaceCategory | undefined {
  return CATEGORY_OPTIONS.some(([v]) => v === raw) ? (raw as SpaceCategory) : undefined;
}

/** 카드 한 장 — 고르는 것이라 박스(디자인-시스템 §카드 어휘). `/search` 카드와 같은 옷:
 *  위 3:2 커버, 아래 이름 15 bold · 한 줄 15 · 메타 13 faint.
 *  ⭐카드 위 pill은 「사장님이 알려줘요」 하나뿐. 비는 날 개수·가까운 날·쓰임새 칩은 뺐다 —
 *    카드는 고르게만 하면 되고, 나머지는 눌러서 본다(칩 셋이 쌓이니 표처럼 보였다).
 *  📍09-16부터 공개 값(`toPublic`)에도 주소가 실린다(대표: 공간 이름이 이미 가게를 특정해서 감추는 게 무의미하다).
 *    카드는 고르는 자리라 주소 앞 두 토막(「서울 성동구」)만 쓴다. 전체 주소와 지도는 상세 화면에 있다.
 *    🧹09-18 밤 QA SC-28 — 여기 있던 「런타임 객체에 주소 자체가 없다」는 09-16 전의 설명이라 고쳤다. */
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
        {/* 커피챗은 이 서비스만 파는 물건이라 커버 위에 미리 알린다(설계 §노하우 = 옵션 상품). */}
        {sp.coffeeChat && sp.coffeeChatMinutes > 0 && (
          <span className="absolute bottom-2.5 left-2.5 rounded-pill bg-surface/90 px-3 py-1 text-[13px] font-medium text-ink">
            사장님과 커피챗 {sp.coffeeChatMinutes}분
          </span>
        )}
      </div>

      <div className="px-4 py-3.5">
        {/* min-w-0 + truncate 한 쌍 — 375px에서 긴 이름이 카드를 밀어 **가로 스크롤**을 만든다. */}
        <p className="min-w-0 truncate text-[15px] font-bold text-ink">{sp.name}</p>
        {/* 🔁09-16 한 줄 소개가 없어진 자리에 **업종 · 범위**가 들어간다. 한 줄 소개는 사장님이 쓰기 나름이라
            카드마다 길이가 들쭉날쭉했는데, 이 둘은 늘 같은 자리에 같은 길이로 선다. */}
        {/* 🙈업종이 빈 옛 공간은 업종 글자를 아예 안 그린다(09-17 QA — 「업종 미정」이 손님에게 그대로 보였다). */}
        <p className="mt-1 line-clamp-1 text-[15px] leading-relaxed text-body">
          {/* 🛍09-18 옛 범위(`scopeLabel`) → 켜진 상품 이름. 대관만·공간 전체를 다 파는 공간이 「공간만」으로 서면 틀린 말이다. */}
          {[categoryLabel(sp.category), ...sellableProducts(sp).map((p) => PRODUCT_LABEL[p])].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1 text-[14px] text-faint">{sp.address.split(/\s+/).slice(0, 2).join(" ") || "위치 미정"}</p>
        {/* 💸09-17 디자인팀 — 값을 흐린 13px 꼬리에서 **굵은 줄 하나**로 올렸다. 목록을 훑는 손님이 이름 다음으로
            대 보는 것이 값인데, 동네 뒤에 붙은 faint 글자라 카드 둘을 나란히 두고 비교가 안 됐다(아워플레이스 카드). */}
        <p className="mt-2.5 text-ink">
          {/* 🛍09-18 값이 상품마다 다르면 낮은 값에 「부터」. */}
          <span className="text-[16px] font-bold tabular-nums">{won(lowestPrice(sp) || sp.priceHour)}</span>
          <span className="ml-0.5 text-[14px] text-mute">
            {new Set(sellableProducts(sp).map((p) => productPrice(sp, p))).size > 1 ? "부터 / 시간" : "/ 시간"}
          </span>
        </p>
      </div>
    </Link>
  );
}

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{ area?: string; category?: string; use?: string }>;
}) {
  const { area, category, use } = await searchParams;
  const useFilter = parseUse(use);
  const categoryFilter = parseCategory(category);
  // ⚠️`listOpenSpaces`는 `useType`이 "both"면 거르기를 건너뛴다. 그래서 「전체」는 값을 **안 넘긴다** —
  //   "both"를 넘겨도 결과는 같지만, 뜻이 다른 두 값(전체 / 둘 다 가능한 공간)을 한 글자로 섞으면
  //   다음 사람이 필터 로직을 고칠 때 반드시 헷갈린다.
  const spaces = await listOpenSpaces({
    area: area?.trim() || undefined,
    category: categoryFilter,
    useType: (useFilter || undefined) as SpaceUseType | undefined,
  });
  const filtered = !!(area?.trim() || categoryFilter || useFilter);

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 lg:max-w-[1120px] pb-10 pt-4 sm:px-6 sm:pb-14 sm:pt-6">
      {/* 히어로 — 큰 제목 한 문장 + 넉넉한 여백(리틀리에서 가져온 「덜어냄」).
          🔻09-14 오른쪽 「안 쓰는 날 올리기」 키위 버튼 삭제 — 위 `RentMenuBar`가 그 일을 한다(대표 지시). */}
      <header className="flex flex-col gap-6">
        <div className="max-w-[680px]">
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] break-keep text-ink">
            {/* ✅09-18 대표 확정 — 「하루만」이 시간 단위 대여와 어긋나서 바꿨다(09-16 결정). */}
            사장님이 쉬는 날, 그 가게를 빌려보세요
          </h1>
          <p className="mt-3 text-[17px] leading-relaxed break-keep text-mute">
            {/* 🔁09-17 QA — 「대여해 보실 수 있어요」는 안내문 어미였고 제목과 말이 겹쳤다.
                두 번째 문장이 이 서비스만 가진 것(커피챗)을 말한다. */}
            {/* 제목이 「사장님이 쉬는 날」을 가져가서, 여기선 같은 말을 되풀이하지 않고 «시간 단위»를 말한다. */}
            필요한 시간만큼 그대로 써 보세요. 커피챗으로 운영 이야기도 들을 수 있어요.
          </p>
        </div>
      </header>

      <RentFilters
        initialArea={area?.trim() ?? ""}
        initialCategory={categoryFilter ?? ""}
        initialUse={useFilter}
      />

      {spaces.length === 0 ? (
        // 빈 화면이 두 종류다 — 아직 아무것도 없는 것과, 조건에 안 걸린 것.
        // 같은 문장을 쓰면 「조건을 지우면 보인다」는 사실이 안 보여 고장난 페이지로 읽힌다.
        // ⚠️`EmptyState`의 ctaLabel은 키위 버튼을 그린다. 이 화면의 키위는 위 히어로 하나뿐이라
        //   여기선 children으로 보조 버튼을 넣는다.
        <div className="mt-6">
          {filtered ? (
            <EmptyState title="조건에 맞는 공간이 아직 없어요" desc="동네나 업종을 조금 넓혀 보시겠어요?">
              <Link href="/rent" className={secondaryBtnCls}>
                조건 지우고 전체 보기
              </Link>
            </EmptyState>
          ) : (
            <EmptyState
              title="첫 번째 공간을 기다리고 있어요"
              desc="안 쓰는 날이 있는 공간을 먼저 올려 주시면, 빌리실 분들께 보여 드릴게요."
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
          {/* 📐09-17 디자인팀 — lg부터 1120에 세 칸. 1440에서 880 두 칸이면 카드 한 장이 420px라 사진만 크고
              한 화면에 두 곳밖에 안 보였다. 고르는 화면은 한눈에 여럿이 보여야 비교가 된다. */}
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 lg:gap-5">
            {spaces.map((sp) => (
              <SpaceCard key={sp.slug} sp={sp} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
