import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profiles";
import { MakerArticle } from "./MakerArticle";
import { ConnectProfileButton } from "./ConnectProfileButton";
import { MakerActionBar } from "./MakerActionBar";

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
  // 로그인 상태면 이 업체를 이미 찜했는지 초기 상태로 전달(플로팅 하트 초기값)
  const initialSaved = user ? await repo.isMakerSaved(user.id, maker.id) : false;
  // 점유 가능 = 아직 소유 계정 없음(비회원 생성) + 관리 비번 존재(비번으로 점유 검증 가능).
  // 이미 소유(회원 생성 or 점유됨)면 버튼 미노출. 비번 없는 익명 소개서는 점유 불가라 미노출.
  const claimable = !maker.ownerUserId && !!maker.editPasswordHash;

  // 인쇄 푸터용 공개 URL — 지류 포트폴리오 하단에 표시(수기 입력·QR 대체용)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const publicUrl = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}/m/${slug}` : `/m/${slug}`;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pt-10 pb-32 sm:px-6 print:max-w-none print:px-0 print:py-0">
      {/* 소개서 본문 — /preview와 공유하는 단일 렌더 */}
      <MakerArticle maker={maker} isOwner={isOwner} logoUrl={logoUrl} />

      {/* 인쇄 전용 푸터 — 화면엔 안 보이고 지류에만 URL 노출 */}
      <div className="hidden print:mt-8 print:block print:border-t print:border-hairline print:pt-4 print:text-center print:text-[12px] print:text-mute">
        {publicUrl}
      </div>

      {/* 프로필 연결(미점유 귀속) + 소개 자료 — 링크복사·찜은 하단 플로팅바로 이관 */}
      {(claimable || maker.introFileUrl) && (
        <div className="mt-12 print:hidden">
          {claimable && (
            <div className="mb-3">
              <ConnectProfileButton slug={slug} loggedIn={!!user} />
            </div>
          )}
          {maker.introFileUrl && (
            <a href={maker.introFileUrl} target="_blank" rel="noopener noreferrer"
              className="flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink">
              소개 자료 받기
            </a>
          )}
        </div>
      )}

      {/* 하단 고정 플로팅 액션바 — 찜 + 콜라보 시작하기(UI) + 링크복사 */}
      <MakerActionBar
        slug={slug}
        makerId={maker.id}
        makerName={maker.name}
        initialSaved={initialSaved}
        loggedIn={!!user}
        instagram={maker.trust.instagram}
        homepage={maker.trust.homepage}
      />
    </main>
  );
}
