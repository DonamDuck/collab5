import type { Metadata } from "next";
import Link from "next/link";
import { repo } from "@/lib/repo";
import { kstDateLabel } from "@/lib/magazine-format";
import { isMagazineEditor } from "@/lib/magazine-auth";

// 매거진 목록 (2026-08-10) — 콜라보 성사 사례를 현장 기록으로 모아 보여준다.
//
// ⚠️`force-dynamic` — 발행하자마자 목록에 떠야 한다. 정적 프리렌더면 재배포 전까지 새 글이 안 보인다
//   (`/search`가 같은 이유로 이 설정을 쓴다). 글 수가 수백 건이 되면 그때 ISR을 고민한다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "매거진 — collab5",
  description:
    "작은 브랜드들이 만나 만든 장면을 직접 찾아가 기록합니다. 콜라보가 실제로 어떻게 굴러가는지 담은 현장 기록이에요.",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식에 상속돼, 안 덮으면 이 페이지가 '홈의 사본'이 된다.
  alternates: { canonical: "/magazine" },
};

export default async function MagazinePage() {
  // 편집자에겐 초안까지 보인다. ⚠️판정은 서버에서 — 클라에 넘겨 숨기는 방식이 아니다.
  const editor = await isMagazineEditor();
  const articles = editor ? await repo.listAllArticles() : await repo.listPublishedArticles();

  return (
    <main className="mx-auto w-full max-w-[720px] px-4 py-10 sm:px-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight text-ink sm:text-[32px]">매거진</h1>
          <p className="mt-2 text-[17px] leading-relaxed break-keep text-body">
            작은 브랜드들이 만나 만든 장면을 직접 찾아가 기록해요.
          </p>
        </div>
        {editor && (
          <Link href="/magazine/new"
            className="mt-1 shrink-0 rounded-md bg-primary px-4 py-2.5 text-[14px] font-medium text-primary-on">
            새 글
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        // 빈 화면도 화면이다 — "곧 올라와요"가 없으면 고장난 페이지로 읽힌다.
        <p className="mt-10 rounded-lg border border-hairline bg-surface-soft px-5 py-10 text-center text-[15px] leading-relaxed break-keep text-mute">
          첫 번째 이야기를 준비하고 있어요.
          <br />
          곧 콜라보 현장의 기록을 들려드릴게요.
        </p>
      ) : (
        <ul className="mt-8 space-y-4">
          {articles.map((a) => (
            <li key={a.slug}>
              <Link
                href={`/magazine/${a.slug}`}
                className="block overflow-hidden rounded-lg border border-hairline bg-surface transition-colors hover:border-border-strong"
              >
                {a.coverImage && (
                  <div className="relative aspect-[16/9] w-full bg-surface-soft">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={a.coverImage}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover"
                    />
                  </div>
                )}
                <div className="px-5 py-4">
                  {a.status === "draft" && (
                    <span className="mb-1.5 inline-block rounded-sm bg-surface-soft px-1.5 py-0.5 text-[12px] font-medium text-mute">
                      초안
                    </span>
                  )}
                  {a.subtitle && (
                    <p className="text-[13px] font-medium text-primary-on">{a.subtitle}</p>
                  )}
                  <h2 className="mt-1 text-[19px] font-bold leading-snug text-balance break-keep text-ink">
                    {a.title}
                  </h2>
                  {a.summary && (
                    <p className="mt-2 line-clamp-2 text-[15px] leading-relaxed break-keep text-mute">
                      {a.summary}
                    </p>
                  )}
                  <p className="mt-3 text-[13px] text-faint">
                    {a.editorName}
                    {a.publishedAt && ` · ${kstDateLabel(a.publishedAt)}`}
                  </p>
                </div>
              </Link>
              {/* 수정은 카드 링크 **바깥**에 둔다 — 안에 넣으면 <a> 안의 <a>가 되어 마크업이 깨진다. */}
              {editor && (
                <Link href={`/magazine/${a.slug}/edit`}
                  className="mt-1.5 inline-block text-[13px] text-mute underline underline-offset-2 hover:text-ink">
                  수정
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
