import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";

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
      {maker.oneLiner && <p className="mt-2 text-base text-body">{maker.oneLiner}</p>}
      {maker.region && <p className="mt-1 text-sm text-mute">📍 {maker.region}</p>}

      {/* 결 — AI 보조층(파스텔, 검증처럼 강조하지 않음) */}
      {maker.soul.values.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-sm font-medium text-faint">분위기</h2>
          <div className="flex flex-wrap gap-1.5">
            {maker.soul.values.map((v) => (
              <span
                key={v}
                className="rounded-sm bg-mint-pale px-2 py-0.5 text-xs font-medium text-mint-on"
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
                    className="inline-flex h-7 items-center rounded-pill border border-hairline bg-surface px-2.5 text-xs text-body"
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
                    className="inline-flex h-7 items-center rounded-pill border border-hairline bg-surface px-2.5 text-xs text-body"
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
            <TrustTag>📷 {maker.trust.instagram}</TrustTag>
          )}
          {maker.trust.homepage && <TrustTag>🔗 홈페이지</TrustTag>}
          {maker.trust.address && <TrustTag>📍 {maker.trust.address}</TrustTag>}
        </div>
        {maker.trust.description && (
          <p className="mt-3 text-base leading-relaxed text-body">
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
    <span className="inline-flex h-7 items-center gap-1 rounded-sm bg-surface-soft px-2.5 text-xs font-medium text-mute">
      {children}
    </span>
  );
}
