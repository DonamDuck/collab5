import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { isMagazineEditor } from "@/lib/magazine-auth";
import { ArticleForm } from "../../ArticleForm";

// 수정 (2026-08-10) — 권한 검사 후에만 초안까지 읽는다.
export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: { params: Promise<{ slug: string }> }) {
  if (!(await isMagazineEditor())) notFound();
  const { slug } = await params;
  // ⚠️`getArticleForEditor`는 초안도 돌려준다 — 위 권한 검사를 통과한 뒤에만 부를 것.
  const article = await repo.getArticleForEditor(slug);
  if (!article) notFound();

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6">
      <h1 className="text-[24px] font-bold text-ink">아티클 수정</h1>
      <p className="mt-1.5 text-[15px] text-mute">
        /magazine/{article.slug} · {article.status === "published" ? "발행됨" : "초안"}
      </p>
      <div className="mt-8"><ArticleForm initial={article} /></div>
    </main>
  );
}
