// 브랜드 찾기 — 서버에서 목록을 조회해 첫 렌더에 카드까지 실어 보낸다(클라 왕복 제거).
// 필터·페이지네이션은 클라 상태라 SearchClient가 담당. 로딩 표시는 loading.tsx(라우트 레벨).
import { repo } from "@/lib/repo";
import { SearchClient } from "./SearchClient";

// ⚠️ 필수 — 없으면 빌드 타임에 프리렌더돼 목록이 **배포 시점에 얼어붙는다**(새 소개서가 재배포 전까지 안 보임).
// 예전 클라 fetch 방식은 늘 최신이었으므로, 서버 렌더로 옮기면서 이 한 줄이 반드시 따라와야 한다.
// (ISR `revalidate = 60`으로 더 빠르게 갈 수도 있지만, 등록 직후 자기 소개서가 안 보이는 혼란을 피해 매 요청 조회.)
export const dynamic = "force-dynamic";

export default async function SearchPage() {
  const all = await repo.searchMakers("");
  return <SearchClient all={all} />;
}
