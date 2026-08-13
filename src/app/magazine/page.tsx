import type { Metadata } from "next";
import Link from "next/link";
import { repo } from "@/lib/repo";
import type { MagazineListItem } from "@/lib/types";
import { kstDateLabel } from "@/lib/magazine-format";
import { isMagazineEditor } from "@/lib/magazine-auth";

// 매거진 목록 (2026-08-10 · 08-13 전면 리디자인)
//
// ⚠️`force-dynamic` — 발행하자마자 목록에 떠야 한다. 정적 프리렌더면 재배포 전까지 새 글이 안 보인다
//   (`/search`가 같은 이유로 이 설정을 쓴다). 글 수가 수백 건이 되면 그때 ISR을 고민한다.
//
// ── 08-13 리디자인 배경 (대표 요구 4가지 + 1팀 전달) ────────────────────────────
// ①지금 디자인이 마음에 안 든다 ②여러 편이 쌓이면 지금 구조로는 못 담는다 ③버튼 컬러가 싫다
// ④「collab5 매거진」 정도의 타이틀에, '있어 보이는' 화면. 레퍼런스 = 브런치 나우·책방.
//
// 🎯**최대 난제는 "1편일 때도 안 초라하고 20편이 돼도 안 무너지는" 레이아웃**이었다.
//   목록형 하나로는 1편일 때 텅 비고, 카드형 하나로는 20편일 때 스크롤 지옥이 된다.
//   → **최신호 히어로 + 그 아래 리스트**로 쪼갰다. 1편이면 히어로 하나로 화면이 서고,
//     20편이면 히어로 1 + 리스트 19가 된다. 둘 다 같은 레이아웃이 처리한다.
//
// 🎨'있어 보인다'의 정체는 컬러가 아니라 **잡지의 장치**로 봤다 —
//   국문/영문 2단 마스트헤드(책방에서 가져온 것) · 호수 넘버링 · 얇은 hairline 룰 · 넉넉한 여백.
//   ⛔ 책방의 **컬러 밴드 히어로는 안 가져왔다.** 대표가 순백을 확정해둔 상태라(07-31 웜톤 폐기)
//     색면을 깔면 그 결정과 정면으로 부딪힌다. 대신 타이포 위계로 무게를 만든다.
//   ⛔ 홈과 얼굴이 겹치지 않게 **좌측정렬**로 간다 — 홈은 전부 중앙정렬(`page.tsx` text-center)이라
//     정렬축만 갈라도 두 화면이 확실히 구분된다.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "매거진 — collab5",
  // ⚠️화면의 소개 문장과 같은 말을 유지한다 — 검색 결과에 뜨는 문장과 들어와서 보는 문장이
  //   다르면 "다른 데로 왔나" 싶어진다. 문구를 고칠 땐 아래 <p>와 같이 고칠 것.
  description:
    "브랜드들이 만나 만드는 콜라보 이야기를 기록합니다. 콜라보가 실제로 어떻게 굴러가는지 담은 현장 기록이에요.",
  // ⚠️필수 — 루트 layout의 `canonical: "/"`가 자식에 상속돼, 안 덮으면 이 페이지가 '홈의 사본'이 된다.
  alternates: { canonical: "/magazine" },
};

/** 호수 라벨 — `No. 03`. 잡지에서 '쌓인다'는 감각을 만드는 가장 싼 장치다.
 *  ⚠️**발행분 기준으로만 센다.** 편집자 화면엔 초안이 섞여 나오는데, 초안에 호수를 주면
 *  발행하는 순간 번호가 밀려 이미 나간 호수와 어긋난다. 초안은 번호 대신 「초안」 배지를 받는다. */
function issueLabel(published: MagazineListItem[], slug: string) {
  const i = published.findIndex((p) => p.slug === slug);
  return i === -1 ? null : `No. ${String(published.length - i).padStart(2, "0")}`;
}

/** 목록 썸네일 — 정사각. 상세는 원본 비율을 지키지만(08-13 대표 확정) 목록은 얼굴을 통일해야 한다.
 *  16:9 대신 1:1인 이유: **작고 정사각일수록 크롭이 덜 아프다.** 세로 사진이 올라와도
 *  16:9는 가운데 띠만 남지만 1:1은 대부분 살아남는다. 브랜드 카드(92px 정사각)와도 같은 어휘다. */
function Thumb({ src }: { src: string }) {
  return (
    // 폰에선 88px — 104px로 두면 375px 화면에서 텍스트에 200px밖에 안 남아 제목이 두 줄로 접히고
    // 메타 줄까지 깨졌다(실측). 데스크톱은 104px 유지.
    <div className="h-[88px] w-[88px] shrink-0 overflow-hidden rounded-md bg-surface-soft sm:h-[104px] sm:w-[104px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
    </div>
  );
}

function DraftBadge() {
  return (
    <span className="inline-block rounded-sm bg-surface-soft px-1.5 py-0.5 text-[12px] font-medium text-mute">
      초안
    </span>
  );
}

/** 발행 정보 한 줄 — 글쓴이 · 날짜 · 장소. `location`은 있을 때만(현장 기록이라 있으면 힘이 된다).
 *  ⚠️장소는 **폰에서 숨긴다.** 「@안톤 · 2026년 8월 13일 · 고양 일산동구 두더지요가원」은 375px에서
 *  두 줄로 접히는데, 하필 「고양 일산동 / 구 두더지요가원」처럼 지명 한가운데가 끊긴다. 셋 중
 *  가장 덜 중요한 항목을 빼는 게, 줄바꿈이 깨진 채 셋 다 남기는 것보다 낫다. */
function Meta({ a }: { a: MagazineListItem }) {
  return (
    <p className="text-[13px] text-faint">
      {a.editorName}
      {a.publishedAt && ` · ${kstDateLabel(a.publishedAt)}`}
      {a.location && <span className="hidden sm:inline"> · {a.location}</span>}
    </p>
  );
}

export default async function MagazinePage() {
  // 편집자에겐 초안까지 보인다. ⚠️판정은 서버에서 — 클라에 넘겨 숨기는 방식이 아니다.
  const editor = await isMagazineEditor();
  const articles = editor ? await repo.listAllArticles() : await repo.listPublishedArticles();
  const published = articles.filter((a) => a.status === "published");

  const [lead, ...rest] = articles;

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 py-10 sm:px-6 sm:py-14">
      {/* 편집 도구는 **독자 화면에 섞지 않고 위로 걷어낸다**(1팀 지적 ①).
          [새 글]은 편집자에게만 보이는 버튼인데 primary Kiwi를 입고 마스트헤드 옆에 서 있어서
          '이 페이지의 주 행동'처럼 보였다. 상세 페이지가 이미 쓰는 편집자 바와 **같은 얼굴**로 옮겨
          "여긴 편집 도구 영역"이라고 자리로 말하게 한다. 버튼도 고스트로 낮춘다(대표 요구 ③). */}
      {editor && (
        <div className="mb-8 flex items-center justify-between gap-3 rounded-md border border-hairline bg-surface-soft px-4 py-2.5">
          <span className="text-[13px] text-mute">편집자로 보고 있어요. 초안도 함께 보여요.</span>
          <Link
            href="/magazine/new"
            className="shrink-0 rounded-sm border border-border-strong bg-surface px-3 py-1.5 text-[13px] font-medium text-ink transition-colors hover:bg-surface-soft"
          >
            새 글
          </Link>
        </div>
      )}

      {/* ── 마스트헤드 ── 국문 + 영문 2단(브런치 책방). 대표가 말한 '있어 보인다'의 정체가 여기다.
           영문 줄은 **읽히라고 두는 게 아니라** 국문 제목에 무게를 실어주는 장치라, 자간을 넓게 벌리고
           faint까지 내려 '장식'임을 분명히 한다. 둘이 비슷한 밝기면 제목이 두 개로 읽힌다. */}
      <header>
        <h1 className="text-[32px] font-bold leading-none tracking-[-0.02em] text-ink sm:text-[38px]">
          collab5 매거진
        </h1>
        <p className="mt-2.5 text-[11px] font-medium uppercase tracking-[0.28em] text-faint">
          collab5 magazine
        </p>
        <div className="mt-5 border-t border-hairline" />
        <p className="mt-4 text-[15px] leading-relaxed break-keep text-mute">
          브랜드들이 만나 만드는 콜라보 이야기를 기록해요.
        </p>
      </header>

      {articles.length === 0 ? (
        // 빈 화면도 화면이다 — "곧 올라와요"가 없으면 고장난 페이지로 읽힌다.
        <p className="mt-10 rounded-lg border border-hairline bg-surface-soft px-5 py-10 text-center text-[15px] leading-relaxed break-keep text-mute">
          첫 번째 이야기를 준비하고 있어요.
          <br />
          곧 콜라보 현장의 기록을 들려드릴게요.
        </p>
      ) : (
        <>
          {/* ── 최신호 히어로 ──
               좌 텍스트 / 우 커버(책방 히어로의 구조). ⚠️모바일에선 커버를 **위로** 올린다
               (`order-first sm:order-last`) — 잡지는 사진이 먼저 붙잡고 글이 따라오는 매체다.
               커버 폭을 320px로 묶는 이유: 텍스트가 최소 500px는 남아야 제목이 3줄로 안 무너진다. */}
          <article className="mt-10">
            <Link href={`/magazine/${lead.slug}`} className="group block">
              <div className="grid items-start gap-6 sm:grid-cols-[1fr_320px] sm:gap-8">
                {lead.coverImage && (
                  <div className="order-first overflow-hidden rounded-lg bg-surface-soft sm:order-last">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={lead.coverImage}
                      alt=""
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {lead.status === "draft" ? (
                      <DraftBadge />
                    ) : (
                      <span className="text-[12px] font-medium tracking-[0.1em] text-faint">
                        {issueLabel(published, lead.slug)}
                      </span>
                    )}
                    {/* 1편뿐일 땐 「창간호」 — 흠이 아니라 사건으로 읽히게(1팀 제안, 08-13).
                        홈 매거진 구좌도 같은 규칙을 쓴다. 2편부터 자동으로 「최신호」. */}
                    <span className="text-[12px] font-medium tracking-[0.1em] text-faint">
                      {published.length === 1 ? "창간호" : "최신호"}
                    </span>
                  </div>
                  {lead.subtitle && (
                    <p className="mt-3 text-[13px] font-medium break-keep text-primary-on">
                      {lead.subtitle}
                    </p>
                  )}
                  <h2 className="mt-1.5 text-[26px] font-bold leading-[1.3] tracking-[-0.01em] text-balance break-keep text-ink sm:text-[30px]">
                    {lead.title}
                  </h2>
                  {lead.summary && (
                    <p className="mt-3 line-clamp-3 text-[15px] leading-relaxed break-keep text-body">
                      {lead.summary}
                    </p>
                  )}
                  <div className="mt-4">
                    <Meta a={lead} />
                  </div>
                </div>
              </div>
            </Link>
            {/* 수정은 카드 링크 **바깥**에 둔다 — 안에 넣으면 <a> 안의 <a>가 되어 마크업이 깨진다. */}
            {editor && (
              <Link
                href={`/magazine/${lead.slug}/edit`}
                className="mt-3 inline-block text-[13px] text-mute underline underline-offset-2 hover:text-ink"
              >
                수정
              </Link>
            )}
          </article>

          {/* ── 지난 호 리스트 ── 브런치 나우식: **카드 박스를 없애고 hairline 구분선만** 쓴다.
               박스를 지운 게 취향이 아니라 어휘 문제다 — 사이트에 이미 박스형 카드(BrandGrid)가
               '고르는 브랜드'라는 뜻으로 자리잡았다. 아티클까지 같은 박스를 입으면 뭘 누르는 건지
               헷갈린다. **박스는 고르는 것, 줄은 읽는 것**으로 가른다(디자인-시스템.md에 정본화).
               썸네일도 브랜드 카드는 왼쪽, 아티클은 오른쪽이라 훑을 때 한눈에 갈린다. */}
          {/* 지난 호가 아직 없을 때의 마무리 줄 — 창간호 하나만 있으면 히어로 아래가 통째로 비어
              페이지가 '끝난' 게 아니라 '끊긴' 것처럼 보인다(실측: 1편 상태에서 푸터까지 빈 화면 하나).
              한 줄이 바닥을 잡아주면서 **"쌓이는 중"이라는 약속**도 같이 한다. */}
          {rest.length === 0 && (
            <p className="mt-14 border-t border-hairline pt-6 text-[14px] leading-relaxed break-keep text-faint">
              다음 호를 준비하고 있어요. 콜라보 현장을 하나씩 찾아가 기록할게요.
            </p>
          )}

          {rest.length > 0 && (
            <section className="mt-14">
              {/* ⚠️자간은 **한글에 영문 값을 쓰지 않는다**(08-13 실측으로 잡음). 마스트헤드의
                  `tracking-[0.28em]`을 여기 그대로 옮겼더니 「지 난  호」로 벌어져 글자가 흩어졌다.
                  라틴 대문자는 자간을 벌려야 '캡션'으로 읽히지만, 한글은 이미 글자마다 네모칸을
                  차지해서 조금만 벌려도 단어가 깨진다. `uppercase`도 한글엔 아무 일도 안 한다. */}
              <h2 className="text-[13px] font-medium tracking-[0.02em] text-faint">지난 호</h2>
              <ul className="mt-4 border-b border-hairline">
                {rest.map((a) => (
                  <li key={a.slug} className="border-t border-hairline">
                    <Link
                      href={`/magazine/${a.slug}`}
                      className="group flex items-start gap-5 py-6 transition-opacity hover:opacity-70"
                    >
                      <div className="min-w-0 flex-1">
                        {a.status === "draft" ? (
                          <DraftBadge />
                        ) : (
                          <span className="text-[12px] font-medium tracking-[0.1em] text-faint">
                            {issueLabel(published, a.slug)}
                          </span>
                        )}
                        <h3 className="mt-1.5 text-[19px] font-bold leading-snug break-keep text-ink">
                          {a.title}
                        </h3>
                        {a.summary && (
                          <p className="mt-1.5 line-clamp-2 text-[14px] leading-relaxed break-keep text-mute">
                            {a.summary}
                          </p>
                        )}
                        <div className="mt-2.5">
                          <Meta a={a} />
                        </div>
                      </div>
                      {a.coverImage && <Thumb src={a.coverImage} />}
                    </Link>
                    {editor && (
                      <Link
                        href={`/magazine/${a.slug}/edit`}
                        className="mb-4 -mt-2 inline-block text-[13px] text-mute underline underline-offset-2 hover:text-ink"
                      >
                        수정
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </main>
  );
}
