import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { CopyLinkButton } from "./CopyLinkButton";
import { MakerArticle } from "./MakerArticle";
import { ConnectProfileButton } from "./ConnectProfileButton";

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
  // 점유 가능 = 아직 소유 계정 없음(비회원 생성) + 관리 비번 존재(비번으로 점유 검증 가능).
  // 이미 소유(회원 생성 or 점유됨)면 버튼 미노출. 비번 없는 익명 소개서는 점유 불가라 미노출.
  const claimable = !maker.ownerUserId && !!maker.editPasswordHash;

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

      {/* 프로필 연결 — 비회원 관리비번으로 만든 미점유 소개서를 로그인 계정에 귀속(선택) */}
      {claimable && (
        <div className="mt-8 border-t border-hairline pt-6">
          <ConnectProfileButton slug={slug} loggedIn={!!user} />
          <p className="mt-2.5 text-center text-[13px] text-faint">
            이 소개서를 만든 계정으로 연결하면 로그인만으로 수정할 수 있어요.
          </p>
        </div>
      )}
    </main>
  );
}
