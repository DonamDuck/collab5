import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { CopyLinkButton } from "./CopyLinkButton";
import { MakerArticle } from "./MakerArticle";

// 공개 업체 상세페이지 — 누구나 열람(MVP 검색 결과의 도착지). 검증 가능한 신뢰 시그널 노출.
export default async function MakerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) notFound();

  // 세션 유저 + 소유 계정 프로필(로고용)을 병렬 조회 — 왕복 안 늘림
  const [user, ownerProfile] = await Promise.all([
    getSessionUser(),
    maker.ownerUserId ? getProfile(maker.ownerUserId) : Promise.resolve(null),
  ]);
  const isOwner = !!user && maker.ownerUserId === user.id;
  const logoUrl = ownerProfile?.profileImage || undefined;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      {/* 소개서 본문 — /preview와 공유하는 단일 렌더 */}
      <MakerArticle maker={maker} isOwner={isOwner} logoUrl={logoUrl} />

      {/* 링크 복사 — 소개서 공유 */}
      <div className="mt-12">
        <CopyLinkButton />
        <p className="mt-2.5 text-center text-[13px] text-faint">
          링크를 복사해 협업하고 싶은 곳에 보내보세요.
        </p>
        {maker.introFileUrl && (
          <a href={maker.introFileUrl} target="_blank" rel="noopener noreferrer"
            className="mt-3 flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink">
            소개 자료 받기
          </a>
        )}
      </div>
    </main>
  );
}
