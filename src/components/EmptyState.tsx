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
    // 08-16 로고 교체에 맞춰 형상을 새 마크로 갈았다 — 궤도점 3개를 빼고 2타원 + 가운데 점.
    // 여기는 **뮤트 변형**이다: 형상은 로고와 완전히 같고 톤만 낮춘다(text-faint + opacity .45).
    // 로고만 바꾸고 이걸 두면 빈 화면들만 옛 아이덴티티로 남는다.
    //
    // 🔒 좌표는 [[아톰 마크 정본]] — 앱 안에 인라인으로 박힌 아톰 4곳(여기·ReportSheet·
    //    EnrichWizard·c/[slug] 풋터)이 **모두 이 숫자를 그대로** 쓴다. 예전엔 곳마다 rx/각도가
    //    달라(20/7@30°, 23/9@28°) 한쪽만 고치면 갈라졌다. 크기는 좌표가 아니라 className으로만 준다.
    // 🚨 정사각 클래스(w-11 등) 금지 — 비율이 1.285라 폭을 높이와 같게 박으면 찌그러진다.
    <svg viewBox="0 0 128.32 100.05" fill="none" className="h-[34px] w-auto text-faint" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="8.45" opacity="0.45">
        <ellipse cx="64.16" cy="50.03" rx="70.78" ry="23.97" transform="rotate(35.25 64.16 50.03)" />
        <ellipse cx="64.16" cy="50.03" rx="70.78" ry="23.97" transform="rotate(-35.25 64.16 50.03)" />
      </g>
      <circle cx="64.16" cy="50.03" r="14.27" fill="var(--primary)" />
    </svg>
  );
}
