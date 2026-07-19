// /m 상단 브랜드 요약 카드 — 정체성(로고+이름) + 소개 + 신뢰 링크 칩(인스타·홈피).
// 주소는 카드에서 빼고 최하단 '상세 주소' 섹션으로(참고 수준·지도용). 스펙: docs/superpowers/specs/2026-07-13-m-brand-summary-card-design.md
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
  const { instagram, homepage } = maker.trust;

  return (
    <div className="rounded-[18px] border border-hairline bg-surface p-5 shadow-e1">
      {/* 정체성 존 — 로고+이름+뱃지(한 줄) / 수정은 타이틀과 수직 중앙 정렬(로고 높이에 맞춰 내려옴) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          {/* 로고 = 계정 프로필 이미지. 없으면 렌더 안 함(이니셜 폴백 미사용) → 텍스트 타이틀만. */}
          {logoUrl && <Avatar image={logoUrl} name={maker.name} size={56} shape="square" />}
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">
              {maker.name}
            </h1>
            {maker.collabOpen && (
              <span className="inline-flex h-6 items-center rounded-pill bg-primary-pale px-2.5 text-xs font-medium text-primary-on">
                콜라보 받는 중
              </span>
            )}
          </div>
        </div>
        <div className="shrink-0">
          <EditButton slug={maker.slug} isOwner={isOwner} hasPassword={!!maker.editPasswordHash} />
        </div>
      </div>

      {/* 소개·지역 — 카드 전체 폭(로고 옆 좁은 컬럼 문제 해소) */}
      {maker.oneLiner && (
        <p className="mt-3 text-[15px] leading-relaxed text-body">{maker.oneLiner}</p>
      )}
      {maker.region && <p className="mt-1 text-[13px] text-faint">{maker.region}</p>}

      {/* 신뢰 링크 칩 — 인스타·홈피(아이콘 + 값, 새 탭). 주소는 최하단 섹션으로 이동. */}
      {(instagram || homepage) && (
        <div className="mt-4 flex flex-wrap gap-2">
          {instagram && (
            <TrustChip href={instagramUrl(instagram)} icon={<InstagramIcon />}>
              {instagramHandle(instagram).replace(/^@/, "")}
            </TrustChip>
          )}
          {homepage && (
            <TrustChip href={normalizeUrl(homepage)} icon={<HomeIcon />}>
              {prettyUrl(homepage)}
            </TrustChip>
          )}
        </div>
      )}
    </div>
  );
}

// 신뢰 링크 칩 — 아이콘 + 값, 새 탭. 클릭 가능함을 아이콘·호버로 신호.
function TrustChip({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-1 rounded-pill bg-primary-pale py-1.5 pl-2.5 pr-3.5 text-[13px] font-medium text-primary-on transition-colors hover:bg-primary-tint"
    >
      <span className="shrink-0 text-primary-on">{icon}</span>
      {children}
    </a>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-[15px] w-[15px]">
      <rect x="3" y="3" width="18" height="18" rx="5.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[15px] w-[15px]"
    >
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.8V19a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}
