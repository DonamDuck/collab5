// 공용 빈 상태 — 아톰 글리프 + 제목 + 설명 + (선택) CTA + (선택) 보조 액션.
// design.md §9.5 Empty State 크래프트 패턴. 배경 보드 없이 페이지 캔버스에 얹는다.
// 아톰 글리프 = 빈 화면 전용 아이콘(로고 아톰의 느슨한 변형). 별도 파일: public/empty-atom.svg
import Link from "next/link";
import type { ReactNode } from "react";

export function EmptyState({
  title,
  desc,
  ctaLabel,
  ctaHref,
  children,
}: {
  title: string;
  desc?: ReactNode;
  ctaLabel?: string;
  ctaHref?: string;
  children?: ReactNode; // 보조 액션(예: 소개서 연결하기) — CTA 아래
}) {
  return (
    <div className="flex flex-col items-center px-6 py-16 text-center">
      <AtomGlyph />
      <p className="mt-5 text-[17px] font-bold break-keep text-ink">{title}</p>
      {desc && <p className="mt-2 text-[14px] leading-relaxed break-keep text-mute">{desc}</p>}
      {ctaLabel && ctaHref && (
        <Link
          href={ctaHref}
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-6 text-[16px] font-medium text-primary-on"
        >
          {ctaLabel}
        </Link>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
}

// 빈 화면 아톰 아이콘 — currentColor(text-faint)로 라이트·다크 자동 대응, 핵만 Kiwi 고정.
function AtomGlyph() {
  return (
    <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="text-faint" aria-hidden="true">
      <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(28 28 28)" />
      <ellipse cx="28" cy="28" rx="23" ry="9" stroke="currentColor" strokeWidth="2" opacity="0.45" transform="rotate(-28 28 28)" />
      <circle cx="28" cy="28" r="6" fill="#98ff5c" />
      <circle cx="6.5" cy="32" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="49.5" cy="24" r="2.4" fill="currentColor" opacity="0.55" />
      <circle cx="33" cy="6.5" r="2.2" fill="currentColor" opacity="0.55" />
    </svg>
  );
}
