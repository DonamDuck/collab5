// /m 상단 브랜드 요약 카드 — 정체성(로고+이름+소개) + 신뢰정보 칩.
// A형(칩): "보고서" 느낌의 회색 표 박스 대신 라운드 칩으로 따뜻하게.
// design.md 토큰·Avatar(square=브랜드 로고). 스펙: docs/superpowers/specs/2026-07-13-m-brand-summary-card-design.md
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
    <div className="rounded-[18px] border border-hairline bg-surface p-5 shadow-e1">
      {/* 정체성 존 */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-[15px]">
          {/* 로고 = 계정 프로필 이미지. 없으면 렌더 안 함(이니셜 폴백 미사용) → 텍스트 타이틀만. */}
          {logoUrl && <Avatar image={logoUrl} name={maker.name} size={60} shape="square" />}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[23px] font-bold leading-tight tracking-tight text-ink">
                {maker.name}
              </h1>
              {maker.collabOpen && (
                <span className="inline-flex h-6 items-center rounded-pill bg-primary-pale px-2.5 text-xs font-medium text-primary-on">
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

      {/* 신뢰정보 칩 — 인스타·홈피는 링크 칩(새 탭), 주소는 텍스트 칩. 값 있을 때만. */}
      {hasTrust && (
        <div className="mt-4 flex flex-wrap gap-2">
          {instagram && (
            <TrustChip href={instagramUrl(instagram)}>{instagramHandle(instagram)}</TrustChip>
          )}
          {homepage && (
            <TrustChip href={normalizeUrl(homepage)}>{prettyUrl(homepage)}</TrustChip>
          )}
          {address && <TrustChip>{address}</TrustChip>}
        </div>
      )}
    </div>
  );
}

// 신뢰 칩 — href 있으면 연둣빛 링크 칩(새 탭), 없으면 중립 텍스트 칩(주소).
function TrustChip({ href, children }: { href?: string; children: React.ReactNode }) {
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="inline-flex items-center rounded-pill bg-primary-pale px-3.5 py-1.5 text-[13px] font-medium text-primary-on transition-colors hover:bg-primary-tint"
      >
        {children}
      </a>
    );
  }
  return (
    <span className="inline-flex items-center rounded-pill bg-surface-soft px-3.5 py-1.5 text-[13px] text-body">
      {children}
    </span>
  );
}
