// 공용 빈 상태 — 아톰 글리프 + 제목 + 설명 + (선택) CTA + (선택) 보조 액션.
// design.md §9.5 Empty State 크래프트 패턴. 배경 보드 없이 페이지 캔버스에 얹는다.
// 아톰 글리프 = 로고 마크(`public/logo-mark.png`)를 흐리게 쓴 것. 08-16 전엔 '느슨한 변형'을
// 따로 그려 뒀었는데(궤도점 3개짜리 옛 아톰), 로고가 바뀌자 여기만 옛 얼굴로 남아 통일했다.
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

// 빈 화면 아톰 아이콘 — 08-16 대표 지정 로고 마크로 교체.
// 전엔 인라인 SVG(궤도점 3개짜리 옛 아톰)였다. 로고 파일만 바꾸고 이걸 두면 **빈 화면들만
// 옛 아이덴티티로 남는다** — 실제로 앱 안에 이런 인라인 아톰이 4곳 있었다(여기 · ReportSheet
// 대기 · EnrichWizard 대기 · c/[slug] 풋터). 전부 같은 파일을 보게 통일했다.
//
// ⚠️PNG라 `currentColor`를 못 쓴다. 그래서 뮤트 톤을 **opacity로** 낸다 — 검정 마크 40%는
//   흰 배경에서 #999 근처로, 예전 text-faint + opacity .45와 거의 같은 무게다.
//   사이트가 전부 흰 배경이라 성립하는 방식이다. 어두운 화면이 생기면 흰색 파일이 따로 필요하다.
// 🚨정사각 클래스 금지 — 비율이 1.28이라 `w-*`를 높이와 같게 박으면 찌그러진다.
function AtomGlyph() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-[34px] w-auto opacity-40" />
  );
}
