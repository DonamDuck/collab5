import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { getSessionUser } from "@/lib/supabase/server";
import { instagramUrl, instagramHandle, normalizeUrl, prettyUrl } from "@/lib/links";
import { PhotoSlider } from "@/components/PhotoSlider";
import { CopyLinkButton } from "./CopyLinkButton";
import { EditButton } from "./EditButton";

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
  const isOwner = !!user && maker.ownerUserId === user.id;

  return (
    <main className="mx-auto w-full max-w-[640px] px-4 py-10 sm:px-6">
      {/* ── 헤더 — 브랜드명 + 요약(한 줄 소개) + 신뢰 뱃지(인스타·홈피·주소) ── */}
      <header>
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[32px] font-bold leading-tight tracking-tight text-ink">
              {maker.name}
            </h1>
            {maker.collabOpen && (
              <span className="inline-flex h-6 items-center rounded-sm bg-primary-pale px-2 text-xs font-medium text-primary-on">
                콜라보 받는 중
              </span>
            )}
          </div>
          <div className="shrink-0">
            <EditButton slug={maker.slug} isOwner={isOwner} />
          </div>
        </div>
        {maker.oneLiner && (
          <p className="mt-2.5 text-[18px] leading-relaxed text-body">{maker.oneLiner}</p>
        )}
        {(maker.trust.instagram || maker.trust.homepage || maker.trust.address) && (
          <div className="mt-4 flex flex-wrap gap-2">
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
        )}
      </header>

      {/* 브랜드 사진 — 스와이프 슬라이드 */}
      {maker.photos.length > 0 && (
        <div className="mt-7 max-w-[460px]">
          <PhotoSlider photos={maker.photos} />
        </div>
      )}

      {/* ① 우리는 이런 브랜드에요 — 자세히 소개 */}
      {maker.trust.description && (
        <Section title="우리는 이런 브랜드에요">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
            {maker.trust.description}
          </p>
        </Section>
      )}

      {/* ② 우리는 이런 일을 하고 있습니다 — activities */}
      {maker.activities.length > 0 && (
        <Section title="우리는 이런 일을 하고 있어요">
          <div className="space-y-6">
            {maker.activities.map((a, i) => (
              <div key={i}>
                {a.title && (
                  <p className="text-[18px] font-semibold leading-snug text-ink">{a.title}</p>
                )}
                {a.desc && (
                  <p className="mt-1 text-[16px] leading-relaxed text-mute">{a.desc}</p>
                )}
                {a.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px]">
                    <PhotoSlider photos={a.photos} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ③ 우리 브랜드의 시작 — story */}
      {maker.story && (
        <Section title="우리 브랜드의 시작">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
            {maker.story}
          </p>
        </Section>
      )}

      {/* ④ 함께한 콜라보 — collabHistory */}
      {maker.collabHistory.length > 0 && (
        <Section title="함께한 콜라보">
          <div className="space-y-6">
            {maker.collabHistory.map((h, i) => (
              <div key={i}>
                <p className="text-[16px] text-body">
                  <span className="font-semibold text-ink">{h.partner}</span>
                  {h.types.length > 0 && <span className="text-mute"> · {h.types.join("·")}</span>}
                  {h.year && <span className="text-mute"> · {h.year}</span>}
                </p>
                {h.desc && <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-mute">{h.desc}</p>}
                {h.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px]">
                    <PhotoSlider photos={h.photos} />
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ⑤ 이런 협업을 기대하고 있어요 — offers */}
      {(maker.offers.length > 0 || maker.offersNote) && (
        <Section title="이런 협업을 기대하고 있어요">
          {maker.offersNote && (
            <p className="mb-3 whitespace-pre-line text-[17px] leading-relaxed text-body">
              {maker.offersNote}
            </p>
          )}
          {maker.offers.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {maker.offers.map((o) => (
                <TypeChip key={o}>{o}</TypeChip>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ⑥ 이런 분들과 함께하고 싶어요 — seeks */}
      {(maker.seeks.length > 0 || maker.seeksNote) && (
        <Section title="이런 분들과 함께하고 싶어요">
          {maker.seeksNote && (
            <p className="mb-3 whitespace-pre-line text-[17px] leading-relaxed text-body">
              {maker.seeksNote}
            </p>
          )}
          {maker.seeks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {maker.seeks.map((s) => (
                <TypeChip key={s}>{s}</TypeChip>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ⑦ 저희는 이런 고객들과 함께 하고 있어요 — targetAudience */}
      {maker.targetAudience.length > 0 && (
        <Section title="저희는 이런 고객들과 함께 하고 있어요">
          <div className="flex flex-wrap gap-2">
            {maker.targetAudience.map((t) => (
              <TypeChip key={t}>{t}</TypeChip>
            ))}
          </div>
        </Section>
      )}

      {/* ⑧ 우리를 표현하는 키워드에요 — values */}
      {maker.soul.values.length > 0 && (
        <Section title="우리를 표현하는 키워드에요">
          <div className="flex flex-wrap gap-2">
            {maker.soul.values.map((v) => (
              <span
                key={v}
                className="inline-flex h-9 items-center rounded-sm bg-mint-pale px-3 text-[15px] font-medium text-mint-on"
              >
                {v}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 링크 복사 — 소개서 공유 */}
      <div className="mt-12">
        <CopyLinkButton />
        <p className="mt-2.5 text-center text-[13px] text-faint">
          링크를 복사해 협업하고 싶은 곳에 보내보세요.
        </p>
      </div>
    </main>
  );
}

// 소개서 섹션 — 편집물처럼 큰 타이틀 + 상단 구분선 + 내용
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-hairline pt-8">
      <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink">{title}</h2>
      {children}
    </section>
  );
}

function TypeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center rounded-pill border border-hairline bg-surface px-3.5 text-[15px] text-body">
      {children}
    </span>
  );
}

function TrustTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center gap-1 rounded-sm bg-surface-soft px-3 text-[14px] font-medium text-mute">
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
      className="inline-flex h-9 items-center gap-1 rounded-sm bg-surface-soft px-3 text-[14px] font-medium text-body transition-colors hover:bg-primary-pale hover:text-primary-on"
    >
      {children}
    </a>
  );
}
