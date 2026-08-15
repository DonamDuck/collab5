import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { repo } from "@/lib/repo";
import { instagramUrl, instagramHandle, normalizeUrl, prettyUrl } from "@/lib/links";
import { PhotoSlider } from "@/components/PhotoSlider";
import { OG_IMAGE } from "@/lib/site";
import { RsvpBar, ShareBar, ViewTracker } from "./card-client";

// 🆕링크 미리보기(08-16) — 이 페이지엔 **메타데이터가 아예 없었다.**
//   카드는 DM으로 보내라고 만든 물건인데, 정작 카톡에 붙이면 카드가 안 펼쳐지고 주소만 떴다.
//   (홈·소개서·매거진은 진작 들어가 있었고 여기만 빠져 있었다.)
//
// ⚠️`index: false` — robots.txt가 이미 `/c/`를 막고 있다. 카드는 특정 상대에게 보내는 제안이라
//   검색에 뜨면 안 된다. 반면 **카톡 미리보기는 og 태그만 읽으므로 이 설정과 무관하게 잘 뜬다.**
//   즉 "검색엔 안 잡히고, 받은 사람 카톡엔 예쁘게 펼쳐지는" 조합이다.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const card = await repo.getCardBySlug(slug);
  if (!card) return { title: "카드를 찾을 수 없어요 — collab5", robots: { index: false, follow: false } };
  const maker = await repo.getMakerById(card.fromBrandId);
  if (!maker) return { title: "카드를 찾을 수 없어요 — collab5", robots: { index: false, follow: false } };

  // 제목 형식은 소개서(`[collab5 소개서] 캔가`)와 같은 틀로 맞춘다 — 한 브랜드가 둘 다 보내도 한 식구로 읽힌다.
  const title = `[콜라보 제안] ${maker.name}`;
  // 받는 쪽 이름을 앞에 세운다 — 카톡에서 제일 먼저 읽히는 줄이라 "나한테 온 것"이 바로 보여야 한다.
  const why = card.proposal.why || card.proposal.picture || "";
  const description = card.proposal.toName ? `${card.proposal.toName}님께 — ${why}` : why;

  return {
    title,
    description,
    robots: { index: false, follow: false },
    openGraph: {
      type: "website",
      siteName: "collab5",
      url: `/c/${slug}`,
      title,
      description,
      // 보내는 브랜드 사진이 먼저 — 받는 사람 입장에선 "누가 보냈나"가 곧 신뢰다. 없으면 로고 카드.
      images: [{ url: maker.photos[0] || OG_IMAGE }],
    },
  };
}

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
  const maker = await repo.getMakerById(card.fromBrandId);
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
  const keywords = [...maker.offers, ...maker.seeks, ...maker.keywords];

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

        {/* 2. 커버(무대) — 사진 있으면 스와이프 슬라이드, 없으면 이니셜 폴백 */}
        {maker.photos.length > 0 ? (
          <div className="mt-5">
            <PhotoSlider photos={maker.photos} rounded="rounded-md" />
          </div>
        ) : (
          <div className="mt-5 h-[108px] overflow-hidden rounded-md">
            <div className="flex h-full w-full items-center justify-center bg-primary-pale">
              <span className="text-[40px] font-bold leading-none text-primary-on">
                {initial}
              </span>
            </div>
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
        {maker.description && (
          <div className="mt-5">
            <p className="text-[12px] font-medium tracking-wide text-faint">소개</p>
            <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.description}
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
                  {h.desc && <p className="mt-0.5 whitespace-pre-line text-[13px] leading-relaxed text-mute">{h.desc}</p>}
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
          {maker.offersDescription && (
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.offersDescription}
            </p>
          )}

          {/* 하드축 칩(키위틴트) + 결 칩(파스텔, 보조층) */}
          {(maker.offers.length > 0 || maker.keywords.length > 0) && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {[...new Set([...maker.offers, ...maker.seeks])].map((o) => (
                <span
                  key={`o-${o}`}
                  className="inline-flex h-7 items-center rounded-pill bg-primary-tint px-2.5 text-[12px] font-medium text-primary-on"
                >
                  {o}
                </span>
              ))}
              {maker.keywords.map((v) => (
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
          {maker.seeksDescription && (
            <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-body">
              {maker.seeksDescription}
            </p>
          )}

          {/* 구 "찾는 콜라보" 칩 줄 은퇴(2026-07-22 통합) — 유형은 위 통합 칩(offers∪seeks)이 담당 */}
        </div>

        {/* 7. RSVP (앞 24px) */}
        <div className="mt-6">
          <RsvpBar cardId={card.id} />
        </div>

        {/* 8. 푸터 — 아톰 마크 + 카피. 08-16 대표 지정 로고로 교체.
            ⚠️전엔 `currentColor` 모노(가운데 점도 회색)였는데 PNG라 색을 못 바꾼다 —
              가운데 점이 브랜드 초록으로 나온다. 12px 글자 옆 13px짜리라 티는 거의 안 난다.
            🚨`h-4 w-4`(정사각) 였다 → 비율 1.28이라 눌린다. 높이로만 잡고 `shrink-0`. */}
        <div className="mt-5 flex items-center justify-center gap-1.5 text-faint">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-[13px] w-auto shrink-0 opacity-55" />
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
