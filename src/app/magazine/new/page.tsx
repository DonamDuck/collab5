import { notFound } from "next/navigation";
import { isMagazineEditor } from "@/lib/magazine-auth";
import { ArticleForm } from "../ArticleForm";

// 새 글 (2026-08-10)
// 🚨**서버에서 권한을 검사한다.** 목록의 버튼을 숨기는 것만으로는 이 주소를 직접 치는 걸 못 막는다.
//   편집자가 아니면 404 — 403보다 낫다. "여기 뭔가 있다"는 사실 자체를 알리지 않는다.
export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  if (!(await isMagazineEditor())) notFound();
  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6">
      <h1 className="text-[24px] font-bold text-ink">새 아티클</h1>
      <p className="mt-1.5 text-[15px] text-mute">초안으로 저장해두고 나중에 이어 쓸 수 있어요.</p>
      <div className="mt-8"><ArticleForm /></div>
    </main>
  );
}
