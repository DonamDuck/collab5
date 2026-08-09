import type { Maker } from "@/lib/types";
import { PhotoSlider } from "@/components/PhotoSlider";
import { normalizeUrl, mapLinkLabel } from "@/lib/links";
import { MapCard } from "@/components/MapCard";
import { BrandSummaryCard } from "./BrandSummaryCard";
import { BlockSections } from "./BlockSections";
import { RevealList } from "./RevealList";

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
      {maker.description && (
        <Section title="우리는 이런 브랜드에요">
          <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
            {maker.description}
          </p>
        </Section>
      )}

      {/* ② 우리는 이런 일을 하고 있습니다 — activities */}
      {maker.activities.length > 0 && (
        <Section title="우리는 이런 일을 하고 있어요">
          {/* 🆕08-10 상한 5→30. RevealList가 5건씩 끊어 보여준다 —
              ⚠️여기서 `.slice()`로 자르면 안 된다(검색엔진·인쇄가 같이 깨진다, RevealList 머리말 참조). */}
          <RevealList kind="activity" label="활동">
            {maker.activities.map((a, i) => (
              <div key={i} className="print:break-inside-avoid">
                <ItemLabel kind="활동" index={i} total={maker.activities.length} />
                {(a.title || a.link) && (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    {a.title && (
                      <p className="text-[18px] font-semibold leading-snug text-ink">{a.title}</p>
                    )}
                    {a.link && (
                      <a href={normalizeUrl(a.link)} target="_blank" rel="noopener noreferrer nofollow"
                        className="inline-flex items-center gap-0.5 text-[14px] font-medium text-primary-on underline underline-offset-2 print:hidden">
                        아티클 보기
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                      </a>
                    )}
                  </div>
                )}
                {a.desc && (
                  // ⚠️ whitespace-pre-line — 폼이 textarea(멀티라인)라 줄바꿈·빈 줄로 문단을 나눠 쓰는데,
                  //    이게 없으면 **전부 한 문단으로 뭉개진다**(대표 제보 07-29). 소개서의 다른 장문 필드
                  //    (자세히소개·시작이야기·협업/파트너 서술·콜라보 내용)는 전부 갖고 있었고 활동만 빠져 있었다.
                  <p className="mt-1 whitespace-pre-line text-[16px] leading-relaxed text-mute">{a.desc}</p>
                )}
                {a.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px] print:mx-auto">
                    <PhotoSlider photos={a.photos} />
                  </div>
                )}
              </div>
            ))}
          </RevealList>
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
          {/* 🆕08-10 상한 5→30 — 활동 섹션과 같은 규칙(RevealList 머리말 참조) */}
          <RevealList kind="collab" label="콜라보">
            {maker.collabHistory.map((h, i) => (
              <div key={i} className="print:break-inside-avoid">
                <ItemLabel kind="콜라보" index={i} total={maker.collabHistory.length} />
                {/* 제목·타입·연도 한 줄, 그 오른쪽에 밑줄 텍스트 '아티클 보기'(헤더가 주인공, 링크는 가벼운 액센트) */}
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <p className="text-[16px] text-body">
                    <span className="font-semibold text-ink">{h.partner}</span>
                    {h.types.length > 0 && <span className="text-mute"> · {h.types.join("·")}</span>}
                    {h.year && <span className="text-mute"> · {h.year}</span>}
                  </p>
                  {h.link && (
                    <a href={normalizeUrl(h.link)} target="_blank" rel="noopener noreferrer nofollow"
                      className="inline-flex items-center gap-0.5 text-[14px] font-medium text-primary-on underline underline-offset-2 print:hidden">
                      아티클 보기
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" /></svg>
                    </a>
                  )}
                </div>
                {h.desc && <p className="mt-0.5 whitespace-pre-line text-[15px] leading-relaxed text-mute">{h.desc}</p>}
                {h.photos.length > 0 && (
                  <div className="mt-3 max-w-[460px] print:mx-auto">
                    <PhotoSlider photos={h.photos} />
                  </div>
                )}
              </div>
            ))}
          </RevealList>
        </Section>
      )}

      {/* 선택 블록 — 배열 순서대로 렌더 */}
      {maker.showcases.length > 0 && <BlockSections blocks={maker.showcases} Section={Section} />}

      {/* ⑤⑥ 통폐합(2026-07-22) — 콜라보 3형제: 기대(통합 칩)·제공·파트너를 같은 타이틀 위계로.
          제공·파트너 제목도 Section h2와 동일 스타일(대표 확정), 블록 간격은 활동 아이템 간격(space-y-6).
          기존 소개서도 합집합 읽기로 그대로 정상 렌더(분기 없음). */}
      {(maker.offers.length > 0 || maker.seeks.length > 0 || maker.offersDescription || maker.seeksDescription) && (
        <Section title="이런 콜라보를 기대하고 있어요">
          <div className="space-y-6">
            {(maker.offers.length > 0 || maker.seeks.length > 0) && (
              <div className="flex flex-wrap gap-2">
                {[...new Set([...maker.offers, ...maker.seeks])].map((o) => (
                  <TypeChip key={o}>{o}</TypeChip>
                ))}
              </div>
            )}
            {maker.offersDescription && (
              <div className="print:break-inside-avoid">
                <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink print:break-after-avoid-page">이런 콜라보를 제공할 수 있어요</h2>
                <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
                  {maker.offersDescription}
                </p>
              </div>
            )}
            {maker.seeksDescription && (
              <div className="print:break-inside-avoid">
                <h2 className="mb-4 text-[21px] font-bold leading-snug tracking-tight text-ink print:break-after-avoid-page">이런 파트너를 찾고 있어요</h2>
                <p className="whitespace-pre-line text-[17px] leading-relaxed text-body">
                  {maker.seeksDescription}
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
      {maker.keywords.length > 0 && (
        <Section title="우리를 표현하는 키워드에요">
          <div className="flex flex-wrap gap-2">
            {maker.keywords.map((v) => (
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

      {/* 상세 주소 — 참고 수준으로 최하단 배치. 07-31: 좌표가 있으면 지도 카드까지. */}
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
          {/* ⚠️ 좌표가 있을 때만. 사장님이 직접 붙여넣은 place 링크(좌표 없음)인 소개서는
              위 텍스트 링크만 보인다 — 지도 카드가 조용히 빠지는 것이지 오류가 아니다.
              print:hidden — 인쇄본(지류 포트폴리오)에서 원격 이미지 요청은 무의미하다. */}
          {maker.trust.lat != null && maker.trust.lng != null && (
            <div className="mt-3 max-w-[460px] print:hidden">
              <MapCard
                lat={maker.trust.lat}
                lng={maker.trust.lng}
                address={maker.trust.address}
                mapUrl={mapLinkLabel(maker.trust.mapUrl) ? normalizeUrl(maker.trust.mapUrl!) : undefined}
              />
            </div>
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

// 항목 아이브로우 — "활동 1" "콜라보 2"처럼 제목 위에 얹는 작은 길잡이.
// 배경: 소개서를 쭉 읽다 보면 **지금 읽는 게 활동인지 콜라보인지 놓친다**는 제보(대표 지인, 07-31).
//   섹션 타이틀은 스크롤로 올라가 버리는데 아이템은 계속 이어지기 때문.
// · 숫자만(1. 2.) 붙이는 안은 순서만 주고 "무슨 섹션인지"는 여전히 안 알려줘서 기각.
// · 제목 앞 인라인("콜라보 1 · 제목")은 사장님 제목과 섞여 길어지고 모바일에서 두 줄로 꺾인다 → 기각.
// · 홈의 `STEP 1/2/3` 아이브로우와 같은 문법이라 시스템에 이미 있는 패턴을 재사용한다.
// ⚠️ **2개 이상일 때만** — 1개뿐인데 "활동 1"만 뜨면 뒤에 뭔가 더 있는 줄 알게 된다.
// ⚠️ 색은 faint(회색). 홈 STEP은 Kiwi지만 거긴 우리 마케팅 화면이고, 소개서는 **사장님 콘텐츠가 주인공**이라
//    길잡이가 브랜드색으로 소리치면 안 된다(무대 원칙 · Kiwi 희소 원칙).
function ItemLabel({ kind, index, total }: { kind: string; index: number; total: number }) {
  if (total < 2) return null;
  return (
    <p className="mb-0.5 text-[12px] font-medium tracking-[0.04em] text-faint">
      {kind} {index + 1}
    </p>
  );
}

function TypeChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-9 items-center rounded-pill border border-hairline bg-surface px-3.5 text-[15px] text-body">
      {children}
    </span>
  );
}
