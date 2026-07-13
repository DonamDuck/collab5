// /m 상단 브랜드 요약 카드 — 정체성 존(로고+이름+소개) + 신뢰정보 박스.
// design.md 토큰·Avatar(square=브랜드 로고) 기준. 스펙: docs/superpowers/specs/2026-07-13-m-brand-summary-card-design.md
import { Avatar } from "@/components/Avatar";
import { instagramUrl, instagramHandle, normalizeUrl, prettyUrl } from "@/lib/links";
import type { Maker } from "@/lib/types";
import { EditButton } from "./EditButton";

export function BrandSummaryCard({
  maker,
  isOwner,
  logoUrl,
}: {
  maker: Maker;
  isOwner: boolean;
  logoUrl?: string;
}) {
  const { instagram, homepage, address } = maker.trust;
  const hasTrust = !!(instagram || homepage || address);

  return (
    <div className="rounded-md border border-hairline bg-surface p-[18px] shadow-e1">
      {/* 정체성 존 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3.5">
          {/* 로고 = 계정 프로필 이미지. 없으면 렌더 안 함(이니셜 폴백 미사용) → 텍스트 타이틀만. */}
          {logoUrl && <Avatar image={logoUrl} name={maker.name} size={56} shape="square" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[24px] font-bold leading-tight tracking-tight text-ink">
                {maker.name}
              </h1>
              {maker.collabOpen && (
                <span className="inline-flex h-6 items-center rounded-sm bg-primary-pale px-2 text-xs font-medium text-primary-on">
                  콜라보 받는 중
                </span>
              )}
            </div>
            {maker.oneLiner && (
              <p className="mt-1.5 text-[15px] leading-relaxed text-body">{maker.oneLiner}</p>
            )}
            {maker.region && <p className="mt-1 text-[13px] text-faint">{maker.region}</p>}
          </div>
        </div>
        <div className="shrink-0">
          <EditButton slug={maker.slug} isOwner={isOwner} />
        </div>
      </div>

      {/* 신뢰정보 박스 — 라벨+값 리스트(아이콘 없음). 값 하나 이상일 때만. */}
      {hasTrust && (
        <dl className="mt-4 grid grid-cols-[64px_1fr] gap-x-3 gap-y-3 rounded-sm bg-surface-soft p-[14px] sm:grid-cols-[72px_1fr]">
          {instagram && (
            <TrustRow label="인스타그램" href={instagramUrl(instagram)}>
              {instagramHandle(instagram)}
            </TrustRow>
          )}
          {homepage && (
            <TrustRow label="홈페이지" href={normalizeUrl(homepage)}>
              {prettyUrl(homepage)}
            </TrustRow>
          )}
          {address && <TrustRow label="주소">{address}</TrustRow>}
        </dl>
      )}
    </div>
  );
}

// 신뢰 행 — 라벨(dt) + 값(dd). href 있으면 새 탭 링크, 없으면 텍스트.
function TrustRow({
  label,
  href,
  children,
}: {
  label: string;
  href?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <dt className="text-[13px] leading-6 text-mute">{label}</dt>
      <dd className="min-w-0 text-[14px] font-medium leading-6 text-ink">
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="break-all underline-offset-2 transition-colors hover:text-primary-on hover:underline"
          >
            {children}
          </a>
        ) : (
          <span className="break-keep">{children}</span>
        )}
      </dd>
    </>
  );
}
