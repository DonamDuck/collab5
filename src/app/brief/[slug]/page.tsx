import { notFound } from "next/navigation";
import Link from "next/link";
import { markdownToBriefDoc } from "@/lib/brief-doc";
import { RAPHA_BRIEF } from "@/lib/brief-samples/rapha";
import { BriefBody } from "./BriefBody";

// 브리프 페이지 (2026-09-14) — 기획서 `docs/superpowers/specs/2026-09-14-brief-page-design.md`
//
// ⚠️**아직 로컬 테스트다.** 대표 지시(09-14): *"라파의 숲만 테스트 작업으로 하고 로컬에만"*.
//    그래서 DB를 안 만들고 표본 파일 하나를 읽는다. 배포 전에 해야 할 것 둘 —
//    ① `brand_briefs` 테이블(기획서 §데이터 모델)
//    ② 🚨**접근 제어** — 대표 확정 = 「브리프 주인만」. `owner_user_id`를 **서버에서** 세션과 대조하고
//       아니면 `notFound()`. 지금은 표본이라 그 분기가 «없다».
//       🔗매거진이 같은 자리에서 겪었다(`magazine-auth.ts`) — *"클라이언트의 버튼 숨김은 UX일 뿐 보안이 아니다"*,
//       `/magazine/new`에 주소를 직접 치고 들어오는 경로가 열려 있었다.

const SAMPLES = { [RAPHA_BRIEF.slug]: RAPHA_BRIEF } as const;

export function generateStaticParams() {
  return Object.keys(SAMPLES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brief = SAMPLES[slug as keyof typeof SAMPLES];
  if (!brief) return {};
  return { title: `[collab5] ${brief.brandName} 요약 리포트` };
}

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brief = SAMPLES[slug as keyof typeof SAMPLES];
  if (!brief) notFound();

  const doc = markdownToBriefDoc(brief.markdown);

  return (
    // 폭 680 — 매거진 아티클과 같은 사다리. 읽는 글이라 같은 자를 쓴다.
    <main className="mx-auto w-full max-w-[680px] px-4 pt-10 pb-28 sm:px-6">
      <header className="border-b border-hairline pb-6">
        <p className="text-[14px] font-medium text-primary-on">collab5 요약 리포트</p>
        {/* 🪤`text-balance`를 쓰지 않는다 — 줄을 «고르게» 맞추느라 좌우 여백을 안 채우고 일찍 꺾인다.
            09-14 대표: *「좌우여백까지 다 채우고 넘어가면 되는데」*. 제목 전부에 같은 규칙. */}
        <h1 className="mt-2 text-[28px] font-bold leading-tight break-keep text-ink sm:text-[32px]">
          {brief.brandName}
        </h1>
        <p className="mt-2 text-[14px] text-faint">{brief.publishedAt.replace(/-/g, ". ")}</p>
        {/* 🔗소개서로 가는 길. 09-14 대표: *「연결된 소개서 link ui 좀만 더 명확히」* —
            날짜 옆에 같은 회색(#9a9a9a)으로 붙어 있어 «메타 정보»로 읽혔다. 누를 것처럼 보이게 카드로 뺀다.
            모양은 매거진의 「이 이야기의 브랜드」 카드를 그대로 따랐다(테두리·bg-surface·hover primary-pale·화살표). */}
        <Link
          href={`/m/${brief.brandSlug}`}
          className="mt-4 flex items-center justify-between gap-3 rounded-lg border border-hairline bg-surface px-4 py-3 transition-colors hover:bg-primary-pale">
          <span className="min-w-0">
            <span className="block text-[12px] text-faint">이 리포트가 함께 만든</span>
            <span className="mt-0.5 block text-[15px] font-semibold text-ink">
              {brief.brandName} 소개서
            </span>
          </span>
          <svg
            viewBox="0 0 20 20"
            className="h-4 w-4 shrink-0 text-faint"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            aria-hidden="true">
            <path d="M7.5 4.5 13 10l-5.5 5.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </header>

      {/* 09-14 대표: *「여기 텍스트 바로 위 여백이 조금 넓어」*. header `pb-7`(29.75px) + `mt-9`(38.25px) = 68px였다.
          ⚠️루트가 17px이라 rem 유틸이 6.25% 부풀어 있어 이름값보다 크다(볼트 [[디자인-시스템]] §함정1). */}
      <article className="mt-6">
        <BriefBody doc={doc} />
      </article>
    </main>
  );
}
