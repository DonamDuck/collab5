import type { Maker } from "@/lib/types";
import { PhotoSlider } from "@/components/PhotoSlider";
import { normalizeUrl, mapLinkLabel } from "@/lib/links";
import { BrandSummaryCard } from "./BrandSummaryCard";
import { BlockSections } from "./BlockSections";

// 소개서 본문 — /m 상세와 /preview 데모가 공유하는 단일 렌더.
export function MakerArticle({ maker, isOwner, logoUrl, readOnly }: {
  maker: Maker; isOwner: boolean; logoUrl?: string;
  readOnly?: boolean; // /preview 데모용 — 남의 예시라 수정 진입점 자체를 숨긴다
}) {
  return (
    <>
      {/* ── 상단 요약 카드 — 로고+정체성 + 신뢰정보 박스 ── */}
      <BrandSummaryCard maker={maker} isOwner={isOwner} logoUrl={logoUrl} readOnly={readOnly} />

      {/* 브랜드 사진 — 스와이프 슬라이드 */}
      {maker.photos.length > 0 && (
        <div className="mt-7 max-w-[460px] print:max-w-none print:break-inside-avoid">
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
              <div key={i} className="print:break-inside-avoid">
                {a.title && (
                  <p className="text-[18px] font-semibold leading-snug text-ink">{a.title}</p>
                )}
                {a.desc && (
                  <p className="mt-1 text-[16px] leading-relaxed text-mute">{a.desc}</p>
                )}
                {a.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px] print:mx-auto">
                    <PhotoSlider photos={a.photos} />
                  </div>
                )}
                {a.link && (
                  <a href={normalizeUrl(a.link)} target="_blank" rel="noopener noreferrer nofollow"
                    className="mt-1 inline-block text-[14px] font-medium text-primary-on underline underline-offset-2 print:hidden">
                    소개 보기
                  </a>
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
              <div key={i} className="print:break-inside-avoid">
                <p className="text-[16px] text-body">
                  <span className="font-semibold text-ink">{h.partner}</span>
                  {h.types.length > 0 && <span className="text-mute"> · {h.types.join("·")}</span>}
                  {h.year && <span className="text-mute"> · {h.year}</span>}
                </p>
                {h.desc && <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-mute">{h.desc}</p>}
                {h.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px] print:mx-auto">
                    <PhotoSlider photos={h.photos} />
                  </div>
                )}
                {h.link && (
                  <a href={normalizeUrl(h.link)} target="_blank" rel="noopener noreferrer nofollow"
                    className="mt-1 inline-block text-[14px] font-medium text-primary-on underline underline-offset-2 print:hidden">
                    소개 보기
                  </a>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* 선택 블록 — 배열 순서대로 렌더 */}
      {maker.blocks.length > 0 && <BlockSections blocks={maker.blocks} Section={Section} />}

      {/* ⑤⑥ 통폐합(2026-07-22) — 콜라보 3형제: 기대(통합 칩)·제공·파트너를 같은 타이틀 위계로.
          제공·파트너 제목도 Section h2와 동일 스타일(대표 확정), 블록 간격은 활동 아이템 간격(space-y-6).
          기존 소개서도 합집합 읽기로 그대로 정상 렌더(분기 없음). */}
      {(maker.offers.length > 0 || maker.seeks.length > 0 || maker.offersNote || maker.seeksNote) && (
        <Section title="이런 콜라보를 기대하고 있어요">
          <div className="space-y-6">
            {(maker.offers.length > 0 || maker.seeks.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {[...new Set([...maker.offers, ...maker.seeks])].map((o) => (
                  <TypeChip key={o}>{o}</TypeChip>
                ))}
              </div>
            )}
            {maker.offersNote && (
              <div className="print:break-inside-avoid">
                <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink print:break-after-avoid-page">이런 콜라보를 제공할 수 있어요</h2>
                <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
                  {maker.offersNote}
                </p>
              </div>
            )}
            {maker.seeksNote && (
              <div className="print:break-inside-avoid">
                <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink print:break-after-avoid-page">이런 파트너를 찾고 있어요</h2>
                <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
                  {maker.seeksNote}
                </p>
              </div>
            )}
          </div>
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

      {/* 상세 주소 — 참고 수준으로 최하단 배치(추후 지도 연동용) */}
      {maker.trust.address && (
        <Section title="상세 주소">
          {/* 지도 링크가 있으면 주소 자체를 지도로 연결(찾아가기). 없으면 기존처럼 텍스트. */}
          {mapLinkLabel(maker.trust.mapUrl) ? (
            <a
              href={normalizeUrl(maker.trust.mapUrl!)}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-baseline gap-1.5 text-[16px] leading-relaxed text-body underline decoration-hairline underline-offset-4 hover:text-ink hover:decoration-current"
            >
              {maker.trust.address}
              <span className="shrink-0 text-[13px] text-faint print:hidden">
                {mapLinkLabel(maker.trust.mapUrl)}에서 보기 ↗
              </span>
            </a>
          ) : (
            <p className="text-[16px] leading-relaxed text-body">{maker.trust.address}</p>
          )}
        </Section>
      )}
    </>
  );
}

// 소개서 섹션 — 편집물처럼 큰 타이틀 + 상단 구분선 + 내용
// 인쇄: 섹션 통째 개행보호는 긴 섹션이 통째로 밀려 대공백을 만들어 아이템 단위 보호로 대체
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-9 border-t border-hairline pt-8">
      <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink print:break-after-avoid-page">{title}</h2>
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
