import { normalizeUrl } from "@/lib/links";

// 항목 관련 링크(소개·아티클) — 눈에 띄게 클릭 가능한 칩(테두리·호버·↗ 아이콘). press·콜라보·활동 공용.
// 서버 컴포넌트(단순 <a>). 새 탭·nofollow, 인쇄엔 숨김.
export function ViewLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={normalizeUrl(href)}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-pill border border-border-strong bg-surface pl-3 pr-2.5 text-[13px] font-medium text-body transition-colors hover:border-primary hover:bg-primary-pale hover:text-primary-on print:hidden"
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M7 17 17 7M8 7h9v9" />
      </svg>
    </a>
  );
}
