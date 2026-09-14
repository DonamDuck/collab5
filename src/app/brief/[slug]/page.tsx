import { notFound } from "next/navigation";
import Link from "next/link";
import { markdownToBriefDoc } from "@/lib/brief-doc";
import { BRIEFS, BRIEF_BY_SLUG } from "@/lib/brief-samples/registry";
import { BriefBody } from "./BriefBody";

// 브리프 페이지 (2026-09-14) — 기획서 `docs/superpowers/specs/2026-09-14-brief-page-design.md`
//
// 🔑**주소가 소개서 slug와 같다** — `/brief/m-7wu2d0` ↔ `/m/m-7wu2d0`. 노출 수준을 새로 만들지 않는다.
//
// 🚨**접근 제어가 아직 없다.** 대표 확정은 「브리프 주인만」인데(기획서 §대표 확정),
//   `brand_briefs` 테이블과 계정 연결이 아직이라 지금은 «링크를 아는 사람»이 본다.
//   👉지금 노션 링크와 «같은 수준»이라 노출이 늘지는 않는다(09-14 로그아웃 브라우저로 8건 전수 확인).
//   ⏭넣을 자리는 여기다 — `owner_user_id`를 **서버에서** 세션과 대조하고 아니면 `notFound()`.
//   🔗매거진이 같은 구멍을 겪었다(`magazine-auth.ts`): *「클라이언트의 버튼 숨김은 UX일 뿐 보안이 아니다」*.

export function generateStaticParams() {
  return BRIEFS.map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brief = BRIEF_BY_SLUG.get(slug);
  if (!brief) return {};
  return {
    title: `[collab5] ${brief.brandName} 요약 리포트`,
    // ⛔검색엔진에 올리지 않는다 — 고객 문서다. 링크를 받은 사람만 본다.
    robots: { index: false, follow: false },
  };
}

export default async function BriefPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const brief = BRIEF_BY_SLUG.get(slug);
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
          href={`/m/${brief.slug}`}
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
