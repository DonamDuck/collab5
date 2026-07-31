import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile, getProfileById } from "@/lib/profiles";
import { isStaffUser } from "@/lib/staff";
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

  const user = await getSessionUser();
  // 소유 계정 프로필(로고) + 찜 여부 + 제안자(로그인 유저) 본인 프로필·소개서를 병렬 조회.
  // 제안자 상호·소개 링크 = 콜라보 제안 시트의 추천 메시지 프리필용.
  // 소유권·찜은 정수 profiles.user_id 기준(07-25 전환) — 세션 프로필을 먼저 풀고 나머지를 병렬 조회.
  const viewerProfile = user ? await getProfile(user.id) : null;
  const viewerUserId = viewerProfile?.id;
  const [ownerProfile, initialSaved, viewerMakers] = await Promise.all([
    maker.ownerUserId ? getProfileById(maker.ownerUserId) : Promise.resolve(null),
    viewerUserId ? repo.isMakerSaved(viewerUserId, maker.id) : Promise.resolve(false),
    viewerUserId ? repo.listMakersByOwner(viewerUserId) : Promise.resolve([]),
  ]);
  const isOwner = !!viewerUserId && maker.ownerUserId === viewerUserId;
  const logoUrl = ownerProfile?.profileImage || undefined;
  const senderName = viewerProfile?.brandName || undefined; // 제안자 상호(소개서 0개일 때 인사말 폴백)
  // 제안자의 소개서들(이름+slug) — 제안 시트에서 "어떤 소개서로 보낼지" 칩 선택용
  // ⚠️ 보고 있는 소개서가 내 것이면 후보에서 뺀다 — 안 빼면 "내 소개서로 나에게 제안"이 성립하고
  //    그게 collab_requests에 그대로 쌓여 북극성 퍼널이 오염된다(07-29, 디자인팀 QA 지적).
  const viewerBrands = viewerMakers
    .filter((m) => m.id !== maker.id)
    .map((m) => ({ id: m.id, slug: m.slug, name: m.name }));
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
        contactEmail={ownerProfile?.email || undefined}
        senderName={senderName}
        isOwner={isOwner}
        /* 내 소개서에서의 [콜라보 분석] — 사내 계정만(07-31 실고객 유입 후 원복).
           자기 브랜드끼리의 분석은 결과가 의미 없고 유료 콜만 나가므로 일반 유저에겐 안 연다.
           서버(`/api/collab-report`)에도 같은 가드가 있다 — 여긴 화면 층. */
        ownerCanReport={isOwner && isStaffUser(viewerUserId)}
        viewerBrands={viewerBrands}
      />
    </main>
  );
}
