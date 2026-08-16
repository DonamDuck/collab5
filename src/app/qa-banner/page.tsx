// 배너 배경 시안 비교 화면 — 08-16 대표 지시(*"A/B/C 모두 볼 수 있어? 각각 url 띄워줄래"*).
//
// 📍`/qa-banner`          세 안을 위에서부터 나란히 (한 화면에서 비교)
// 📍`/qa-banner?bg=photo` 커버 사진 블러 (지금 홈에 적용된 것)
// 📍`/qa-banner?bg=ink`   잉크 단색
// 📍`/qa-banner?bg=soft`  중성 그레이 단색
//
// ⚠️폴더 이름에 `_`를 붙이지 않는다 — Next는 `_`로 시작하는 디렉터리를 **라우팅에서 제외**한다.
//   08-15에 `__qa`로 만들었다가 404가 나서 배운 것. QA 라우트는 평범한 이름으로.
// ⚠️`noindex` — 내부 확인용 화면이라 검색에 뜨면 안 된다.
//
// 🗑️쓸모가 끝나면 이 폴더째 지우면 된다. 다른 코드가 여기를 참조하지 않는다.
import type { Metadata } from "next";
import { repo } from "@/lib/repo";
import { HomeMagazineBanner, type BannerBg } from "../HomeMagazineBanner";

export const metadata: Metadata = {
  title: "배너 시안 비교 — collab5",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

const OPTIONS: { bg: BannerBg; name: string; why: string }[] = [
  {
    bg: "photo",
    name: "C · 커버 사진 블러",
    why: "글이 바뀌면 배너 색도 바뀐다 — 운영비 0으로 매번 새 배너. 잡지 표지 문법. 다만 커버가 흐릿한 글에선 배경도 흐릿하다.",
  },
  {
    bg: "ink",
    name: "A · 잉크 단색",
    why: "첫 화면이 확 닫히며 지면이 뒤집히는 임팩트. 사진이 없는 이벤트 배너에도 그대로 쓸 수 있다. 사이트에서 다크 톤을 처음 쓰는 게 부담.",
  },
  {
    bg: "soft",
    name: "B · 중성 그레이",
    why: "순백+중성 그레이 취향에 정확히 맞고 사진이 제일 살아난다. 대신 '배너'보다 '섹션'으로 읽힐 수 있다.",
  },
];

export default async function QaBannerPage({
  searchParams,
}: {
  searchParams: Promise<{ bg?: string }>;
}) {
  const { bg } = await searchParams;
  const articles = await repo.listPublishedArticles();
  const article = articles[0];
  const isFirst = articles.length === 1;

  if (!article) {
    return (
      <main className="mx-auto max-w-[640px] px-4 py-16 text-center">
        <p className="text-[16px] text-mute">발행된 매거진 글이 없어 배너를 그릴 수 없어요.</p>
      </main>
    );
  }

  // 쿼리로 하나만 보기 — 실제 홈과 같은 조건(풀블리드·주변 여백 없음)으로 확인하려는 용도.
  const only = OPTIONS.find((o) => o.bg === bg);
  if (only) {
    return (
      <>
        <HomeMagazineBanner article={article} isFirstIssue={isFirst} bg={only.bg} />
        <main className="mx-auto max-w-[640px] px-4 py-10">
          <p className="text-[15px] font-bold text-ink">{only.name}</p>
          <p className="mt-1.5 text-[14px] leading-relaxed text-body">{only.why}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {OPTIONS.filter((o) => o.bg !== only.bg).map((o) => (
              <a
                key={o.bg}
                href={`/qa-banner?bg=${o.bg}`}
                className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
              >
                {o.name} 보기
              </a>
            ))}
            <a
              href="/qa-banner"
              className="inline-flex h-10 items-center rounded-md border border-border-strong bg-surface px-4 text-[14px] font-medium text-ink"
            >
              셋 다 보기
            </a>
          </div>
        </main>
      </>
    );
  }

  return (
    <div>
      <main className="mx-auto max-w-[640px] px-4 pb-6 pt-10">
        <h1 className="text-[24px] font-bold text-ink">배너 배경 시안</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-body">
          같은 글, 배경만 다릅니다. 하나만 크게 보려면 각 시안의 주소로 들어가세요.
        </p>
      </main>
      {OPTIONS.map((o) => (
        <section key={o.bg}>
          {/* 라벨은 배너 **밖 위쪽**에 둔다 — 배너 안에 넣으면 그것도 디자인의 일부처럼 보여
              비교가 흐려진다. 지금 보는 게 무엇인지만 말하고 물러난다. */}
          <div className="mx-auto max-w-[960px] px-4 pb-2 pt-8 sm:px-6">
            <p className="text-[13px] font-bold tracking-wide text-mute">{o.name}</p>
          </div>
          <HomeMagazineBanner article={article} isFirstIssue={isFirst} bg={o.bg} />
          <div className="mx-auto max-w-[960px] px-4 pt-3 sm:px-6">
            <p className="max-w-[560px] text-[13px] leading-relaxed text-mute">{o.why}</p>
            <a
              href={`/qa-banner?bg=${o.bg}`}
              className="mt-2 inline-block text-[13px] font-medium text-ink underline underline-offset-2"
            >
              이 안만 크게 보기 →
            </a>
          </div>
        </section>
      ))}
      <div className="h-16" />
    </div>
  );
}
