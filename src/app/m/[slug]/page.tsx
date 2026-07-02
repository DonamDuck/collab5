import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { instagramUrl, instagramHandle, normalizeUrl, prettyUrl } from "@/lib/links";
import { PhotoSlider } from "@/components/PhotoSlider";

// 공개 업체 상세페이지 — 누구나 열람(MVP 검색 결과의 도착지). 검증 가능한 신뢰 시그널 노출.
export default async function MakerPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const maker = await repo.getMakerBySlug(slug);
  if (!maker) notFound();

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-8 sm:px-6">
      {/* 히어로 — 주인공은 메이커 */}
      <div className="flex items-center gap-2">
        <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink">
          {maker.name}
        </h1>
        {maker.collabOpen && (
          <span className="inline-flex h-6 items-center rounded-sm bg-primary-pale px-2 text-xs font-medium text-primary-on">
            콜라보 받는 중
          </span>
        )}
      </div>
      {maker.oneLiner && <p className="mt-2 text-[17px] leading-relaxed text-body">{maker.oneLiner}</p>}
      {maker.region && <p className="mt-1 text-[15px] text-mute">📍 {maker.region}</p>}

      {/* 브랜드 사진 — 스와이프 슬라이드 */}
      {maker.photos.length > 0 && (
        <div className="mt-6 max-w-[460px]">
          <PhotoSlider photos={maker.photos} />
        </div>
      )}

      {/* 결 — AI 보조층(파스텔, 검증처럼 강조하지 않음) */}
      {maker.soul.values.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-faint">분위기</h2>
          <div className="flex flex-wrap gap-1.5">
            {maker.soul.values.map((v) => (
              <span
                key={v}
                className="inline-flex h-8 items-center rounded-sm bg-mint-pale px-2.5 text-[13px] font-medium text-mint-on"
              >
                {v}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* 콜라보 유형 */}
      {(maker.offers.length > 0 || maker.seeks.length > 0) && (
        <section className="mt-6 grid gap-4 sm:grid-cols-2">
          {maker.offers.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-faint">제공할 수 있어요</h2>
              <div className="flex flex-wrap gap-1.5">
                {maker.offers.map((o) => (
                  <span
                    key={o}
                    className="inline-flex h-8 items-center rounded-pill border border-hairline bg-surface px-3 text-[13px] text-body"
                  >
                    {o}
                  </span>
                ))}
              </div>
            </div>
          )}
          {maker.seeks.length > 0 && (
            <div>
              <h2 className="mb-2 text-sm font-medium text-faint">찾고 있어요</h2>
              <div className="flex flex-wrap gap-1.5">
                {maker.seeks.map((s) => (
                  <span
                    key={s}
                    className="inline-flex h-8 items-center rounded-pill border border-hairline bg-surface px-3 text-[13px] text-body"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 신뢰 시그널 — 검증 가능한 것만 */}
      <section className="mt-6">
        <h2 className="mb-2 text-sm font-medium text-faint">더 알아보기</h2>
        <div className="flex flex-wrap gap-2">
          {maker.trust.instagram && (
            <TrustLink href={instagramUrl(maker.trust.instagram)}>
              📷 {instagramHandle(maker.trust.instagram)}
            </TrustLink>
          )}
          {maker.trust.homepage && (
            <TrustLink href={normalizeUrl(maker.trust.homepage)}>
              🔗 {prettyUrl(maker.trust.homepage)}
            </TrustLink>
          )}
          {maker.trust.address && <TrustTag>📍 {maker.trust.address}</TrustTag>}
        </div>
        {maker.trust.description && (
          <p className="mt-3 text-[17px] leading-relaxed text-body">
            {maker.trust.description}
          </p>
        )}
      </section>

      {/* 카드 만들기 */}
      <div className="mt-8">
        <a
          href={`/m/${maker.slug}/card`}
          className="flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
        >
          이 프로필로 카드 만들기
        </a>
      </div>
    </main>
  );
}

function TrustTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-1 rounded-sm bg-surface-soft px-3 text-[13px] font-medium text-mute">
      {children}
    </span>
  );
}

// 클릭하면 새 탭으로 링크 열림(인스타·홈피)
function TrustLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex h-8 items-center gap-1 rounded-sm bg-surface-soft px-3 text-[13px] font-medium text-body transition-colors hover:bg-primary-pale hover:text-primary-on"
    >
      {children}
    </a>
  );
}
