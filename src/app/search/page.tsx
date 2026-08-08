// 콜라보 찾기 — 서버에서 목록을 조회해 첫 렌더에 카드까지 실어 보낸다(클라 왕복 제거).
// 필터·페이지네이션은 클라 상태라 SearchClient가 담당. 로딩 표시는 loading.tsx(라우트 레벨).
import type { Metadata } from "next";
import { repo } from "@/lib/repo";
import { SearchClient } from "./SearchClient";

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

export default async function SearchPage() {
  const all = await repo.searchMakers("");
  return <SearchClient all={all} />;
}
