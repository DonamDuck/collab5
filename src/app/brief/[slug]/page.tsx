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
      <header className="border-b border-hairline pb-7">
        <p className="text-[14px] font-medium text-primary-on">collab5 요약 리포트</p>
        <h1 className="mt-2 text-[28px] font-bold leading-tight text-balance break-keep text-ink sm:text-[32px]">
          {brief.brandName}
        </h1>
        <p className="mt-3 text-[14px] text-faint">
          {brief.publishedAt.replace(/-/g, ". ")}
          <span className="mx-1.5 text-hairline">·</span>
          <Link
            href={`/m/${brief.brandSlug}`}
            className="underline underline-offset-2 hover:text-mute">
            소개서 보러 가기
          </Link>
        </p>
      </header>

      <article className="mt-9">
        <BriefBody doc={doc} />
      </article>
    </main>
  );
}
