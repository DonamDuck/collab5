import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { getProfile, getProfileById } from "@/lib/profiles";
import { isStaffUser } from "@/lib/staff";
import { isReportCacheFresh } from "@/lib/collab-report";
import { MakerArticle } from "./MakerArticle";
import { ConnectProfileButton } from "./ConnectProfileButton";
import { MakerActionBar } from "./MakerActionBar";
import { EnrichBanner, type BannerVariant } from "./EnrichBanner";
import type { CollabReportData, Maker } from "@/lib/types";

// 사진 보강 배너 게이트 — 사진이 이 수 **미만**일 때만 뜬다(대표 확정 08-02).
const ENRICH_MIN_PHOTOS = 5;
// 컨시어지 신청 폼(구글폼). 공개 링크라 코드에 둔다 —
// 환경변수로 빼면 Vercel에 넣는 걸 잊었을 때 **배너가 조용히 사라진다**(실패가 안 보인다).
const ENRICH_FORM_URL = "https://forms.gle/6XnnSTCQ2HDVkf2Y7";

/** 소개서에 실린 **모든** 사진 수. 브랜드 대표 사진만 세면 활동 사진 20장짜리에도 배너가 뜬다. */
function countAllPhotos(m: Maker): number {
  let n = m.photos.length;
  for (const a of m.activities) n += a.photos.length;
  for (const h of m.collabHistory) n += h.photos.length;
  for (const b of m.showcases) {
    n += b.photos.length;
    if (b.type === "press") for (const it of b.items) n += it.photos?.length ?? 0;
  }
  return n;
}

/** [콜라보 분석] 시트가 로딩 화면 없이 바로 열 수 있는 쌍만 골라 fromSlug별 맵으로 돌려준다
 *  (대표 지시 08-09: "/my는 캐시면 바로 뜨는데 소개서 페이지는 왜 매번 분석중이야?").
 *
 *  ⭐**유료 콜 0** — `repo.getBrandDna`·`getLatestCollabReport`는 전부 읽기고, DNA가 없거나
 *  낡았으면(=`isReportCacheFresh`가 false) 그냥 그 쌍만 맵에서 빠진다(생성 시도 안 함).
 *  ReportSheet가 그 쌍은 지금처럼 fetch+로딩 화면을 그대로 탄다 — **이 함수는 있는 걸
 *  미리 보여주는 최적화지, 없는 걸 만들어내는 게 아니다.**
 *
 *  viewerBrands가 보통 1~2개라 쿼리 비용이 작다(toDna 1회 + 브랜드당 fromDna·latest 병렬 1쌍). */
async function computeCachedReports(
  viewerMakers: Maker[],
  to: Maker,
): Promise<Record<string, CollabReportData>> {
  const fromCandidates = viewerMakers.filter((m) => m.id !== to.id);
  if (fromCandidates.length === 0) return {};
  // ⚠️**리포트가 있는 쌍부터 좁힌다**(08-09 수정). 처음엔 브랜드마다 DNA·리포트를 낱개로 조회했는데,
  //    대표 계정은 소개서가 14개라 /m 페이지 로드마다 왕복이 29번 붙었다 — 그중 리포트가 실제로
  //    있는 건 1개였다. 쿼리 1번으로 후보를 좁히면 DNA 조회는 그 몇 건에만 든다.
  const reports = await repo.listLatestCollabReportsTo(fromCandidates.map((m) => m.id), to.id);
  if (reports.size === 0) return {};
  const hits = fromCandidates.filter((m) => reports.has(m.id));
  const toDna = await repo.getBrandDna(to.id);
  const entries = await Promise.all(
    hits.map(async (card) => {
      // 🪤**`viewerMakers`는 카드용 경량 투영이라 여기 그대로 쓰면 안 된다**(08-09 실측으로 잡은 버그).
      //   `listMakersByOwner`가 select하는 건 `id·slug·name·one_liner…`뿐인데, DNA stale 판정은
      //   `digestHash(maker)`로 **소개서 본문 전체**(description·story·activities·keywords…)의 지문을
      //   비교한다. 빈 필드로 지문을 내면 저장된 `input_hash`와 영원히 어긋나 **항상 stale** →
      //   캐시가 늘 비어 이 기능이 통째로 무력화됐다(대표 제보: "여전히 로딩이 뜬다").
      //   → 후보를 리포트 있는 몇 건으로 좁힌 뒤 **그 건만 전체 소개서를 다시 읽는다**(보통 0~1회).
      const [from, fromDna] = await Promise.all([
        repo.getMakerById(card.id),
        repo.getBrandDna(card.id),
      ]);
      if (!from) return null;
      const latest = reports.get(card.id)!;
      return isReportCacheFresh(latest, fromDna, toDna, from, to)
        ? ([from.slug, latest.report] as const)
        : null;
    }),
  );
  return Object.fromEntries(entries.filter((e): e is [string, CollabReportData] => e !== null));
}


// ⭐링크 미리보기(카톡·인스타 DM에서 펼쳐지는 카드) — 이게 없으면 루트 layout의 홈 제목을
//   그대로 물려받아 **"collab5 — 마음 맞는 브랜드들의 콜라보 플랫폼"** 이 뜬다(08-02 실측).
//   DM 첫 줄에서 플랫폼 이름을 뺀 이유(받는 사람은 collab5를 모른다)가 링크 카드에서 무효화되고 있었다.
//   제목에 한 줄 소개까지 이어 붙이면 **두 줄에서 잘려** 상호가 밀리므로, 소개는 description으로 내린다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) return { title: "소개서를 찾을 수 없어요 — collab5" };

  // 썸네일 — 지금까지는 og:image가 없어 카톡이 본문에서 아무 이미지나 주워왔다. 그걸 우리가 정한다.
  // ⚠️**브랜드 사진이 먼저다.** 로고(`profiles.profile_image`)는 브랜드가 아니라 **계정**의 것이라,
  //   한 계정이 소개서를 여러 개 가지면 전부 같은 썸네일이 된다 — 지금 15/17이 대표 계정 소유라
  //   로고를 우선하면 링크 미리보기가 전부 같은 그림으로 뜬다(08-02 실측: 캔버스가든·로컬페이지 동일).
  //   소유권을 사장님들께 넘기고 나면 계정=브랜드가 되어 로고도 고유해지지만, 그때도 그 브랜드의
  //   사진이 더 잘 보여준다. 로고는 사진이 아예 없을 때의 폴백으로만 둔다.
  //   (data URL 로고는 크롤러가 http로 다시 요청해 가져가므로 통째로 무시된다 → http만 통과시킨다.)
  const ownerProfile = maker.ownerUserId ? await getProfileById(maker.ownerUserId) : null;
  const logo = ownerProfile?.profileImage?.startsWith("http") ? ownerProfile.profileImage : "";
  const image = maker.photos[0] || logo || undefined;
  const title = `[collab5 소개서] ${maker.name}`;
  const description = maker.oneLiner || maker.description || "브랜드 소개서";

  return {
    title,
    description,
    // 🆕정본 주소(08-07) — `?banner=a`·`?report=`처럼 파라미터가 붙어 공유돼도 검색엔진이
    //    **한 페이지로 합쳐** 센다. 안 주면 파라미터 조합마다 별개 페이지로 세어 힘이 흩어진다.
    alternates: { canonical: `/m/${slug}` },
    openGraph: {
      title,
      description,
      type: "profile",
      url: `/m/${slug}`,
      siteName: "collab5",
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

// 공개 업체 상세페이지 — 누구나 열람(MVP 검색 결과의 도착지). 검증 가능한 신뢰 시그널 노출.
export default async function MakerPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ banner?: string }>;
}) {
  const { slug } = await params;
  // ?banner=a|b — 시안 비교용. 주인·사진수·시간 규칙을 모두 건너뛰고 그 안을 강제로 그린다.
  const bannerParam = (await searchParams)?.banner;
  const bannerPreview = bannerParam === "a" || bannerParam === "b";
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
  // [콜라보 분석] 사전 캐시 확인 — viewerMakers 확정 후에만 계산 가능해 별도 await(위 배치와 병렬 불가).
  // isOwner 여부와 무관하게 계산해도 무해하지만 viewerBrands가 보통 비어 있어(비로그인·미등록) 대부분 즉시 {}.
  const cachedReports = await computeCachedReports(viewerMakers, maker);
  // 점유 가능 = 아직 소유 계정 없음(비회원 생성) + 관리 비번 존재(비번으로 점유 검증 가능).
  // 이미 소유(회원 생성 or 점유됨)면 버튼 미노출. 비번 없는 익명 소개서는 점유 불가라 미노출.
  const claimable = !maker.ownerUserId && !!maker.editPasswordHash;

  // 인쇄 푸터용 공개 URL — 지류 포트폴리오 하단에 표시(수기 입력·QR 대체용)
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const publicUrl = host ? `${h.get("x-forwarded-proto") ?? "https"}://${host}/m/${slug}` : `/m/${slug}`;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 pt-10 pb-32 sm:px-6 print:max-w-none print:px-0 print:py-0">
      {/* 소개서 보강 신청 배너 — 주인에게만, 사진이 5장 미만일 때. 나머지(1일 숨김·7일 수명)는 클라 판정 */}
      {(bannerPreview || (isOwner && countAllPhotos(maker) < ENRICH_MIN_PHOTOS)) && (
        <EnrichBanner
          slug={slug}
          formUrl={ENRICH_FORM_URL}
          variant={(bannerParam as BannerVariant) || "a"}
          preview={bannerPreview}
        />
      )}

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
        cachedReports={cachedReports}
      />
    </main>
  );
}
