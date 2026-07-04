import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { instagramUrl, instagramHandle, normalizeUrl, prettyUrl } from "@/lib/links";
import { PhotoSlider } from "@/components/PhotoSlider";
import { RsvpBar, ShareBar, ViewTracker } from "./card-client";

// ★ 청첩장형 콜라보 카드 — design.md §9.1 v1. 무계정 열람. North Star = 카드 view.
export default async function CardPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { slug } = await params;
  const isNew = (await searchParams)?.new === "1";
  const card = await repo.getCardBySlug(slug);
  if (!card) notFound();
  const maker = await repo.getMakerById(card.fromMakerId);
  if (!maker) notFound();

  const p = card.proposal;
  const initial = maker.name.trim().charAt(0) || "C";
  const trust = [
    maker.trust.instagram && {
      icon: "📷",
      label: instagramHandle(maker.trust.instagram),
      href: instagramUrl(maker.trust.instagram),
    },
    maker.trust.homepage && {
      icon: "🔗",
      label: prettyUrl(maker.trust.homepage),
      href: normalizeUrl(maker.trust.homepage),
    },
    maker.trust.address && { icon: "📍", label: maker.trust.address },
  ].filter(Boolean) as { icon: string; label: string; href?: string }[];

  // 제안 본문: 키워드 1개만 키위 하이라이트
  const keywords = [...maker.offers, ...maker.seeks, ...maker.soul.values];

  return (
    <main className="mx-auto w-full max-w-[420px] px-4 py-8">
      <ViewTracker cardId={card.id} />
      {isNew && <ShareBar />}

      <article className="rounded-[24px] bg-surface p-5 shadow-e3">
        {/* 1. 상단 라벨 — collab5 존재감은 여기까지 (상태배지 없음) */}
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 rounded-pill bg-primary" />
          <span className="text-[12px] font-medium tracking-wide text-mute">
            콜라보 제안
          </span>
        </div>

        {/* 2. 커버(무대) — 사진 있으면 스와이프 슬라이드, 없으면 커버/이니셜 폴백 */}
        {maker.photos.length > 0 ? (
          <div className="mt-5">
            <PhotoSlider photos={maker.photos} rounded="rounded-md" />
          </div>
        ) : (
          <div className="mt-5 h-[108px] overflow-hidden rounded-md">
            {maker.coverImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={maker.coverImageUrl}
                alt={maker.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-primary-pale">
                <span className="text-[40px] font-bold leading-none text-primary-on">
                  {initial}
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. 상호명 + 결 한줄 (같은 그룹, 4px) */}
        <h1 className="mt-5 text-[23px] font-bold leading-tight tracking-[-0.03em] text-ink line-clamp-2">
          {maker.name}
        </h1>
        {maker.oneLiner && (
          <p className="mt-1.5 text-[15px] leading-relaxed text-body line-clamp-2">{maker.oneLiner}</p>
        )}

        {/* 4. 신뢰 시그널 — 검증된 것만, 0개면 숨김. 인스타·홈피는 클릭 시 새 탭 */}
        {trust.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {trust.map((t) =>
              t.href ? (
                <a
                  key={t.label}
                  href={t.href}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="inline-flex h-8 max-w-full items-center gap-1 truncate rounded-sm bg-surface-soft px-2.5 text-[13px] font-medium text-body transition-colors hover:bg-primary-pale hover:text-primary-on"
                >
                  {t.icon} {t.label}
                </a>
              ) : (
                <span
                  key={t.label}
                  className="inline-flex h-8 items-center gap-1 rounded-sm bg-surface-soft px-2.5 text-[13px] font-medium text-mute"
                >
                  {t.icon} {t.label}
                </span>
              )
            )}
          </div>
        )}

        {/* 브랜드 소개 — 등록 때 작성한 소개(정리되어 카드에 노출) */}
        {maker.trust.description && (
          <div className="mt-5">
            <p className="text-[12px] font-medium tracking-wide text-faint">소개</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.trust.description}
            </p>
          </div>
        )}

        {/* 시작한 이야기 — 왜 이 브랜드를 시작했나 */}
        {maker.story && (
          <div className="mt-5">
            <p className="text-[12px] font-medium tracking-wide text-faint">시작한 이야기</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.story}
            </p>
          </div>
        )}

        {/* 이런 활동을 해요 — 대표 활동 + 사진 */}
        {maker.activities.length > 0 && (
          <div className="mt-5">
            <p className="text-[12px] font-medium tracking-wide text-faint">이런 활동을 해요</p>
            <div className="mt-2 space-y-3">
              {maker.activities.map((a, i) => (
                <div key={i}>
                  {a.title && <p className="text-[15px] font-medium leading-snug text-ink">{a.title}</p>}
                  {a.desc && <p className="mt-0.5 text-[14px] leading-relaxed text-mute">{a.desc}</p>}
                  {a.photos.length > 0 && (
                    <div className="mt-2">
                      <PhotoSlider photos={a.photos} rounded="rounded-md" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 함께한 콜라보 — 수신자 신뢰의 결정타 */}
        {maker.collabHistory.length > 0 ? (
          <div className="mt-5">
            <p className="text-[12px] font-medium tracking-wide text-faint">함께한 콜라보</p>
            <div className="mt-2 space-y-2.5">
              {maker.collabHistory.map((h, i) => (
                <div key={i}>
                  <p className="text-[14px] text-body">
                    <span className="font-medium text-ink">{h.partner}</span>
                    {h.types.length > 0 && (
                      <span className="text-mute"> · {h.types.join("·")}</span>
                    )}
                    {h.year && <span className="text-mute"> · {h.year}</span>}
                  </p>
                  {h.desc && <p className="mt-0.5 text-[13px] text-mute">{h.desc}</p>}
                  {h.photos.length > 0 && (
                    <div className="mt-1.5 flex gap-1.5">
                      {h.photos.map((src, k) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={k}
                          src={src}
                          alt={`${h.partner} 콜라보 사진 ${k + 1}`}
                          className="h-14 w-14 shrink-0 rounded-sm object-cover"
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-5 text-[13px] text-faint">아직 콜라보 경험이 없어요</p>
        )}

        {/* 이런 분들과 만나요 — 수신자가 "내 손님과 결이 맞나" 가늠 */}
        {maker.targetAudience.length > 0 && (
          <div className="mt-4">
            <p className="text-[12px] font-medium tracking-wide text-faint">
              이런 분들과 만나요
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {maker.targetAudience.map((a) => (
                <span
                  key={a}
                  className="inline-flex h-7 items-center rounded-pill bg-surface-soft px-2.5 text-[12px] font-medium text-mute"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* 5. 구분선 */}
        <div className="my-[22px] border-t border-hairline" />

        {/* 6. 제안 — 라벨 + 본문(키워드 1개 하이라이트) + 칩 */}
        <div>
          <p className="text-[12px] font-medium tracking-wide text-faint">
            {p.toName ? `${p.toName}님께 드리는 제안` : "제안"}
          </p>
          {p.why && (
            <p className="mt-2 text-[15px] leading-relaxed text-ink">
              {highlight(p.why, keywords)}
            </p>
          )}
          {p.picture && (
            <p className="mt-2 text-[15px] leading-relaxed text-body">{p.picture}</p>
          )}
          {p.expectedEffect && (
            <p className="mt-2 text-[14px] leading-relaxed text-mute">
              {p.expectedEffect}
            </p>
          )}

          {/* 협업 직접 설명 — 제공 칩 위 문구 */}
          {maker.offersNote && (
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.offersNote}
            </p>
          )}

          {/* 하드축 칩(키위틴트) + 결 칩(파스텔, 보조층) */}
          {(maker.offers.length > 0 || maker.soul.values.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {maker.offers.map((o) => (
                <span
                  key={`o-${o}`}
                  className="inline-flex h-7 items-center rounded-pill bg-primary-tint px-2.5 text-[12px] font-medium text-primary-on"
                >
                  {o}
                </span>
              ))}
              {maker.soul.values.map((v) => (
                <span
                  key={`v-${v}`}
                  className="inline-flex h-7 items-center rounded-pill bg-mint-pale px-2.5 text-[12px] font-medium text-mint-on"
                >
                  {v}
                </span>
              ))}
            </div>
          )}

          {/* 파트너 직접 설명 — 찾는 콜라보 칩 위 문구 */}
          {maker.seeksNote && (
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.seeksNote}
            </p>
          )}

          {/* 찾는 콜라보 — 제안 접점 (수신자가 "내가 줄 수 있는 게 있나") */}
          {maker.seeks.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[12px] text-faint">찾는 콜라보</span>
              {maker.seeks.map((s) => (
                <span
                  key={`s-${s}`}
                  className="inline-flex h-7 items-center rounded-pill border border-hairline bg-surface px-2.5 text-[12px] font-medium text-mute"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* 7. RSVP (앞 24px) */}
        <div className="mt-6">
          <RsvpBar cardId={card.id} />
        </div>

        {/* 8. 푸터 — 아톰 마크(mono, currentColor=다크대응) + 카피 */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-faint">
          <svg viewBox="0 0 56 56" className="h-4 w-4" aria-hidden="true" fill="none">
            <g stroke="currentColor" strokeWidth="2">
              <ellipse cx="28" cy="28" rx="20" ry="7" transform="rotate(30 28 28)" />
              <ellipse cx="28" cy="28" rx="20" ry="7" transform="rotate(-30 28 28)" />
            </g>
            <circle cx="45.32" cy="38" r="2.8" fill="currentColor" />
            <circle cx="10.68" cy="18" r="2.8" fill="currentColor" />
            <circle cx="45.32" cy="18" r="2.8" fill="currentColor" />
            <circle cx="28" cy="28" r="7" fill="currentColor" />
          </svg>
          <span className="text-[12px]">collab5로 만든 카드 · 답장은 편하실 때</span>
        </div>
      </article>
    </main>
  );
}

/** 본문에서 첫 키워드 1개만 키위 하이라이트 */
function highlight(text: string, keywords: string[]): React.ReactNode {
  for (const kw of keywords) {
    if (!kw) continue;
    const idx = text.indexOf(kw);
    if (idx !== -1) {
      return (
        <>
          {text.slice(0, idx)}
          <mark className="rounded bg-primary-pale px-1 text-primary-on">{kw}</mark>
          {text.slice(idx + kw.length)}
        </>
      );
    }
  }
  return text;
}
