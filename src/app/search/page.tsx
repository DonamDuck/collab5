// 콜라보 찾기 — 서버에서 목록을 조회해 첫 렌더에 카드까지 실어 보낸다(클라 왕복 제거).
// 필터·페이지네이션은 클라 상태라 SearchClient가 담당. 로딩 표시는 loading.tsx(라우트 레벨).
import { Suspense } from "react";
import type { Metadata } from "next";
import { repo } from "@/lib/repo";
import { COLLAB_TYPES, type CollabType } from "@/lib/types";
import { SearchClient } from "./SearchClient";
import { SearchIdeaGuide } from "./SearchIdeaGuide";
import { dailyOrder, dailySpotlights, todaySeed } from "./daily";

// 🆕08-07 — 이 페이지엔 제목이 없어 검색 결과·탭에 **홈 제목이 그대로** 떴다.
// ⚠️`alternates`는 더 중요하다: 루트 layout의 `canonical: "/"`가 자식에 상속되므로,
//    안 덮으면 구글이 이 페이지를 홈의 사본으로 보고 색인에서 뺀다(사이트맵엔 넣어놓고서).
export const metadata: Metadata = {
  title: "콜라보 찾기 — collab5",
  description: "잘 맞는 콜라보 파트너를 찾아보세요. 지역·분위기·콜라보 유형으로 브랜드 소개서를 둘러볼 수 있어요.",
  alternates: { canonical: "/search" },
};

// ⚠️ 필수 — 없으면 빌드 타임에 프리렌더돼 목록이 **배포 시점에 얼어붙는다**(새 소개서가 재배포 전까지 안 보임).
// 예전 클라 fetch 방식은 늘 최신이었으므로, 서버 렌더로 옮기면서 이 한 줄이 반드시 따라와야 한다.
// (ISR `revalidate = 60`으로 더 빠르게 갈 수도 있지만, 등록 직후 자기 소개서가 안 보이는 혼란을 피해 매 요청 조회.)
export const dynamic = "force-dynamic";

/** 홈에서 유형 칩을 눌러 들어온 경우 그 유형으로 좁힌 채 연다(`/search?type=팝업`, 08-16).
 *  ⚠️클라에서 `useSearchParams`로 읽지 않는 이유 — `SearchClient`는 Suspense 밖이라 그러면
 *     Next가 **페이지 전체를 CSR로 강등**시킨다(아래 SearchIdeaGuide 주석과 같은 함정).
 *     이 페이지는 이미 `force-dynamic`이라 **서버에서 읽어 초기값으로 내려주는 게 공짜**다.
 *  🔒모르는 값은 `COLLAB_TYPES`에 없으면 걸러진다 — 목록을 좁힐 뿐이라 접근 범위와 무관하다. */
function parseTypes(raw: string | string[] | undefined): CollabType[] {
  if (!raw) return [];
  const list = Array.isArray(raw) ? raw : raw.split(",");
  return list
    .map((s) => s.trim())
    .filter((s): s is CollabType => (COLLAB_TYPES as readonly string[]).includes(s));
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  const all = await repo.searchMakers("");
  // 「오늘의 순서」 — 서버에서 한 번 섞어 내려보낸다(근거·주의는 daily.ts 머리말).
  // ⭐서버에서 섞는 게 중요하다: 클라에서 섞으면 서버가 그린 HTML과 첫 렌더가 어긋나 하이드레이션이 깨진다.
  //   이 페이지는 이미 `force-dynamic`이라 매 요청 서버에서 도니 공짜다.
  const seed = todaySeed();
  const ordered = dailyOrder(all, seed);
  return (
    <>
      <SearchClient
        all={ordered}
        initialTypes={parseTypes(type)}
        spotlights={dailySpotlights(ordered, seed)}
      />
      {/* 홈에서 「콜라보 아이디어 추천 받기」를 누르고 온 사람에게만 뜨는 안내 시트(08-16).
          신호는 `?guide=idea` — 상세는 SearchIdeaGuide.tsx.
          🚨`<Suspense>` 필수 — 이 컴포넌트가 `useSearchParams`를 쓴다. 감싸지 않으면 Next가
            **페이지 전체를 CSR로 강등**시키고 빌드에서 경고를 낸다(서버 렌더로 옮긴 이 페이지의
            이득이 통째로 사라진다). 목록은 그대로 서버에서 오고 이 시트만 늦게 붙는 구조. */}
      <Suspense fallback={null}>
        <SearchIdeaGuide />
      </Suspense>
    </>
  );
}
