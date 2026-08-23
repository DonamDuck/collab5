import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { kstDateLabel } from "@/lib/magazine-format";
import { isMagazineEditor } from "@/lib/magazine-auth";
import { OG_IMAGE } from "@/lib/site";
import { getSessionUserId } from "@/lib/profiles";
import { ArticleBody, BrandLinkCards } from "./ArticleBody";
import { ArticleLikeBar } from "./ArticleLikeBar";
import { ArticleComments } from "./ArticleComments";

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
      // 🆕커버가 없으면 기본 썸네일로 떨어진다(08-16). 전엔 `images`를 통째로 빼서, 커버 없는 글은
      //    카톡에 **그림 없는 맹숭한 줄**로 떴다 — 매거진은 링크로 퍼뜨리라고 만든 물건이라 뼈아프다.
      images: [{ url: a.coverImage || OG_IMAGE }],
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

  // 하트 — 이 페이지는 `force-dynamic`이라 서버에서 바로 읽어 첫 화면부터 정확한 값이 뜬다
  // (홈처럼 캐시되는 화면이었다면 클라에서 따로 물어야 했다).
  // 🔻08-15 개수 조회(`countArticleLikes`)는 뺐다 — 화면에 숫자를 안 쓰기로 했는데(대표 지시)
  //   글 열 때마다 세는 건 낭비다. 되살릴 땐 이 자리에 한 줄 되돌리면 된다(repo 함수는 그대로 있다).
  const viewerId = await getSessionUserId();
  const likedByMe = viewerId ? await repo.isArticleLiked(viewerId, a.id) : false;
  // 댓글 — 🚨표(`magazine_comments`)가 아직 없으면 여기서 던진다. **글 전체가 못 열리면 안 되므로**
  //   빈 목록으로 떨어뜨린다. 「댓글이 없다」와 「표가 없다」는 화면에서 같아 보이지만,
  //   쓰려고 하면 서버 액션이 에러를 돌려주므로 조용히 성공한 척하는 일은 없다.
  const comments = await repo.listArticleComments(a.id).catch(() => []);

  return (
    // ⚠️`pb-28` — 하트 버튼이 `fixed`라 본문 맨 끝을 덮는다. 그만큼 아래를 비워 둔다.
    <main className="mx-auto w-full max-w-[680px] px-4 pt-10 pb-28 sm:px-6">
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

      {/* 「잘 읽었어요 ❤️」 — 읽는 내내 화면 아래에 떠 있다.
          ⚠️초안(draft)에는 안 띄운다 — 아직 아무도 읽을 수 없는 글의 하트는 뜻이 없고,
            편집자가 자기 글에 하트를 눌러 수를 부풀리는 첫 단추가 된다. */}
      {/* 댓글 — 발행분에만. ⭐이름은 브랜드명이고 소개서가 있으면 그리로 링크된다.
          ⚠️`pb-28`(119px)은 **본문용** 여백이라, 댓글 섹션 아래에 같은 크기를 한 번 더 둔다.
            안 두면 플로팅 알약이 「댓글 남기기」 버튼을 덮는다. */}
      {a.status === "published" && (
        <div className="pb-28">
          <ArticleComments
            articleId={a.id}
            slug={a.slug}
            initialComments={comments}
            loggedIn={!!viewerId}
            viewerUserId={viewerId ?? undefined}
          />
        </div>
      )}

      {a.status === "published" && (
        <ArticleLikeBar
          articleId={a.id}
          slug={a.slug}
          initialLiked={likedByMe}
          loggedIn={!!viewerId}
        />
      )}
    </main>
  );
}
