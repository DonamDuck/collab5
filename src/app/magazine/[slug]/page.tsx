import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { kstDateLabel } from "@/lib/magazine-format";
import { isMagazineEditor } from "@/lib/magazine-auth";
import { ArticleBody, BrandLinkCards } from "./ArticleBody";

// 매거진 상세 (2026-08-10)
// ⭐기본은 **발행분만**이고, 편집자에게만 초안을 여는 예외를 뚫었다(PR2).
//   순서가 중요하다 — 열어놓고 막는 게 아니라 **닫아두고 예외를 좁게** 뚫는다.
//   `getArticleForEditor`(초안 포함)는 `isMagazineEditor()`를 통과한 뒤에만 부른다.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const a = await repo.getPublishedArticle(slug);
  if (!a) return { title: "아티클을 찾을 수 없어요 — collab5" };

  const title = `${a.title} — collab5 매거진`;
  const description = a.summary || a.subtitle;
  return {
    title,
    description,
    alternates: { canonical: `/magazine/${slug}` },
    openGraph: {
      type: "article",
      siteName: "collab5",
      url: `/magazine/${slug}`,
      title,
      description,
      publishedTime: a.publishedAt,
      ...(a.coverImage ? { images: [{ url: a.coverImage }] } : {}),
    },
  };
}

export default async function MagazineArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  let a = await repo.getPublishedArticle(slug);
  const editor = await isMagazineEditor();
  if (!a && editor) a = await repo.getArticleForEditor(slug); // 편집자만 초안 열람
  if (!a) notFound();

  return (
    <main className="mx-auto w-full max-w-[680px] px-4 py-10 sm:px-6">
      {editor && (
        <div className="mb-6 flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface-soft px-4 py-2.5">
          <span className="text-[13px] text-mute">
            {a.status === "draft" ? "초안이에요. 나만 볼 수 있어요." : "발행된 글이에요."}
          </span>
          <Link href={`/magazine/${a.slug}/edit`}
            className="shrink-0 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink">
            수정
          </Link>
        </div>
      )}

      <article>
        {/* ── 머리 ── */}
        <header>
          {a.subtitle && (
            <p className="text-[14px] font-medium text-primary-on">{a.subtitle}</p>
          )}
          <h1 className="mt-2 text-[28px] font-bold leading-tight text-balance break-keep text-ink sm:text-[32px]">
            {a.title}
          </h1>
          <p className="mt-3 text-[14px] text-faint">
            글·사진 {a.editorName}
            {a.publishedAt && ` · ${kstDateLabel(a.publishedAt)}`}
            {a.location && ` · ${a.location}`}
          </p>
        </header>

        {/* 커버 — ⭐**본문에선 자르지 않는다**(대표 확정 08-13). 목록 카드는 16:9로 잘라 얼굴을
             통일하지만, 글을 열면 사장님이 고른 사진이 통째로 보여야 한다.
             ⚠️대신 **높이에 상한**을 둔다. 안 그러면 세로로 긴 사진(인스타 4:5 등)이 글 폭을 꽉 채워
             화면 하나를 통째로 잡아먹는다 — 1080×1350 커버가 680px 폭에서 850px로 나왔다(대표 제보).
             `max-h`+`w-auto`라 **잘리는 게 아니라 통째로 작아진다.** 가로형(3:2)은 680px 폭에서
             453px이라 상한에 안 걸려 지금과 똑같이 나오고, 폰에서도 폭이 좁아 걸리지 않는다. */}
        {a.coverImage && (
          <div className="mt-6 flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.coverImage}
              alt=""
              className="max-h-[500px] w-auto max-w-full rounded-lg bg-surface-soft"
            />
          </div>
        )}

        {/* ── 정보 카드 — 스캔하는 독자와 검색엔진 둘 다를 위한 자리 ──
             항목 개수가 호마다 다르므로 배열을 그대로 순회한다(고정 4칸으로 짜지 말 것). */}
        {a.factBox.length > 0 && (
          <dl className="mt-7 space-y-2 rounded-lg border border-hairline bg-surface-soft px-5 py-4">
            {a.factBox.map((f, i) => (
              <div key={i} className="flex flex-wrap gap-x-3 gap-y-0.5 text-[15px] leading-relaxed">
                <dt className="shrink-0 font-medium text-mute">{f.label}</dt>
                <dd className="min-w-0 flex-1 break-keep text-ink">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {/* ── 본문 ── */}
        <div className="mt-9">
          <ArticleBody doc={a.body} />
        </div>

        {/* ── 꼬리: 연결 브랜드 + 초대 ── */}
        {a.brandLinks.length > 0 && (
          <section className="mt-12 border-t border-hairline pt-8">
            <h2 className="text-[17px] font-bold text-ink">이 이야기의 브랜드</h2>
            <div className="mt-4">
              <BrandLinkCards links={a.brandLinks} />
            </div>
          </section>
        )}

        {/* CTA는 아티클당 여기 한 곳만(지시서 §2 포맷 9번). 본문 중간에 서비스 홍보를 넣지 않는다. */}
        <section className="mt-10 rounded-lg border border-hairline bg-surface px-5 py-6 text-center">
          <p className="text-[16px] leading-relaxed text-balance break-keep text-body">
            읽다가 <b className="font-semibold text-ink">우리도 이런 거 해보고 싶은데</b> 싶었다면,
            먼저 소개서를 하나 만들어두세요.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-[16px] font-medium text-primary-on"
          >
            브랜드 소개서 만들기
          </Link>
          <p className="mt-3">
            <Link href="/search" className="text-[14px] text-mute underline underline-offset-2">
              다른 브랜드 둘러보기
            </Link>
          </p>
        </section>
      </article>
    </main>
  );
}
