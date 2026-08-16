// 홈 최상단 매거진 배너 — 08-16 대표 지시로 **페이지 첫 화면**이 됐다(히어로 슬로건보다 위).
//
// ┌ 왜 여기, 왜 이 모양 ────────────────────────────────────────────────────────────
// │ 대표가 잡은 힘 주는 순서: ⓪매거진 ①브랜드 카드 ②분석. 매거진은 우리 사이트에서 유일하게
// │ "읽을거리"라 방문 이유를 만들 수 있는 물건인데, 08-13엔 페이지 맨 아래였다.
// │ ⭐레퍼런스 = 와사비클래스 상단 배너. 상품 2개짜리 사이트인데도 **프로덕션 배너 1장**이 첫
// │   화면을 채워 "지금 뭔가 일어나고 있다"를 말한다. 우리는 배너를 매번 만들 리소스가 없으니
// │   **매거진 커버를 그대로 쓴다** — 글이 하나 나올 때마다 자동 갱신, 운영비 0.
// └────────────────────────────────────────────────────────────────────────────────
//
// 🔻v1(스크림)에서 v2(면 분할)로 갈아엎은 이유 — 대표: *"검정 블러 말고 와사비처럼 완전 배너 형태로"*.
//   v1은 사진 위에 검은 그라데이션을 깔고 글자를 얹는 방식이었다. 문제가 둘이었다:
//     ① **사진을 우리가 못 고른다.** 커버는 사장님들이 올린 현장 사진이라 밝기·구도가 제각각이고,
//        글자를 얹으려면 스크림을 계속 진하게 깔아야 해서 결국 **사진이 반쯤 죽는다.**
//     ② 어두운 덩어리 하나가 순백 지면(대표 확정 07-31) 위에 떠서 "여기만 왜 검정?"으로 읽혔다.
//   → v2는 **면을 나눈다**: 왼쪽은 브랜드 면색 위의 글, 오른쪽은 사진 그대로. 겹치지 않으니
//     사진이 어떻든 글은 항상 읽히고, 사진도 안 죽는다. 와사비 배너가 정확히 이 구조다(글/캐릭터 분할).
//
// 📐**풀블리드다.** `<main>`(max-w-960) **밖**에 두어 화면 폭을 그대로 쓴다.
//   🪤`w-screen + left-1/2 + -translate-x-1/2` 같은 기법은 쓰지 않는다 — 스크롤바 폭만큼 넘쳐서
//     **전 페이지에 가로 스크롤**이 생긴다(이 저장소가 07-29 헤더에서 이미 당한 사고).
//     main 밖에 두면 그런 계산이 아예 필요 없다. 안쪽 내용만 같은 960으로 다시 가둔다.
//
// 🚨모바일에서 매거진에 닿는 **두 길 중 하나**다(다른 하나는 HomeMenuBar의 「콜라보 매거진」).
//    헤더의 매거진 링크는 `hidden sm:flex`라 폰에는 없다. 지우지 말 것.
import { TrackLink } from "@/components/TrackLink";
import { kstDateLabel } from "@/lib/magazine-format";
import type { MagazineListItem } from "@/lib/types";

/** 배경 시안 — 대표가 셋 다 보고 고른다(08-16). `/qa-banner`에서 나란히 볼 수 있다.
 *
 *  🔭이 자리는 매거진 전용이 아니다(대표): *"나중에 슬라이드로 업체 소개나 이벤트가 될 자리"*.
 *    그래서 배경을 **prop으로** 빼 뒀다 — 나중에 캐러셀이 되면 슬라이드마다 다른 안을 쓸 수 있고,
 *    이벤트 배너(커버 사진이 없을 수도 있는)에는 `ink`/`soft`가 맞는다.
 *    ⚠️`photo`는 커버 사진이 있어야 성립한다 — 없으면 자동으로 `ink`로 떨어진다(아래 참조). */
export type BannerBg = "photo" | "ink" | "soft";

export function HomeMagazineBanner({
  article,
  isFirstIssue,
  bg = "photo",
}: {
  article: MagazineListItem;
  isFirstIssue: boolean;
  bg?: BannerBg;
}) {
  // 사진 배경인데 커버가 없으면 성립하지 않는다 → 잉크로 떨어뜨린다(빈 회색 면이 뜨는 것보다 낫다).
  const mode: BannerBg = bg === "photo" && !article.coverImage ? "ink" : bg;
  const dark = mode !== "soft"; // 글자색을 뒤집을지 — soft(밝은 회색)만 어두운 글자다.

  return (
    // 🎨배경 = **커버 사진을 크게 키워 흐린 것 + 어두운 막**(C안, 08-16 대표 지적으로 교체).
    //   🔻v2는 `primary-pale`(#ecffe0) 연두 면이었다 → 대표 *"연두색 배경 완전 별루"*.
    //     원인은 색 선택이 아니라 **브랜드 색을 큰 면으로 쓴 것**이다. Kiwi는 버튼에서 "눌러라"를
    //     뜻하는 색인데 배경으로 깔리면 뜻이 흐려지고, 면적이 커서 순백+중성 그레이 지면과도 안 맞는다.
    //   ⭐C안의 이점 — **글이 바뀌면 배너 색도 바뀐다.** 커버가 배경이라 새 글이 나올 때마다
    //     저절로 다른 배너가 된다(운영비 0으로 "매번 새 배너"). 잡지 표지 문법이기도 하다.
    //   ⚠️v1(사진 위에 스크림 깔고 글 얹기)과 **다른 것**이다. 여기서 글은 사진 **옆**에 있고,
    //     배경으로 깔린 사진은 blur라 원본 사진(오른쪽 카드)은 하나도 안 죽는다.
    //   🔁세 안은 `bg` prop으로 고른다(위 `BannerBg` 주석 참조) — `/qa-banner`에서 비교 가능.
    <section
      className={`relative overflow-hidden ${
        mode === "ink" ? "bg-ink" : mode === "soft" ? "bg-surface-soft" : "bg-surface-dark"
      }`}
    >
      {mode === "photo" && article.coverImage && (
        // 🖼️배경 레이어 — `scale-110`이 필수다. blur는 가장자리를 투명하게 번지게 해서
        //   확대 없이 쓰면 배너 네 변에 **뿌연 테두리**가 생긴다(실측). 10% 키워 그 띠를 밖으로 밀어낸다.
        //   `aria-hidden` — 같은 사진이 오른쪽에 이미 있다. 스크린리더에 두 번 들릴 이유가 없다.
        <div aria-hidden="true" className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImage}
            alt=""
            className="h-full w-full scale-110 object-cover blur-2xl"
          />
          {/* 🚨어두운 막이 **없으면 못 쓴다.** 커버는 사장님들이 올린 현장 사진이라 밝기를 우리가
              통제할 수 없다 — 흰 벽 사진 한 장이면 흰 글씨가 통째로 사라진다.
              `/80`은 최악의 경우(밝은 사진)를 기준으로 잡은 값이다. 낮추면 어떤 글에서는 안 읽힌다. */}
          <div className="absolute inset-0 bg-ink/80" />
        </div>
      )}
      <TrackLink
        href={`/magazine/${article.slug}`}
        event="home_magazine_banner_click"
        params={{ slug: article.slug }}
        // `relative` 필수 — 위 배경 레이어(absolute)보다 위에 와야 글이 막에 안 묻힌다.
        className="relative mx-auto block w-full max-w-[960px] px-4 py-7 sm:px-6 sm:py-10"
      >
        {/* 📐모바일 1열(사진 위·글 아래) / 데스크톱 2열(글 왼쪽·사진 오른쪽).
            ⚠️모바일에서 사진을 **위**로 올린 건 잡지의 규칙이다 — 사진이 붙잡고 글이 따라온다.
              (매거진 목록 히어로도 같은 규칙이라 도착했을 때 얼굴이 이어진다) */}
        <div className="group grid items-center gap-5 sm:grid-cols-[1fr_46%] sm:gap-9">
          {article.coverImage && (
            <div className="order-first overflow-hidden rounded-lg bg-surface-soft sm:order-last">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={article.coverImage}
                alt=""
                // 📐16:10 — 커버가 콜라보 현장 사진(대체로 4:3)이라 이보다 납작하게 자르면
                //   인물 머리가 날아간다. 세로로 더 두면 배너가 첫 화면을 다 먹는다.
                className="aspect-[16/10] w-full object-cover transition-transform duration-[var(--dur-slow)] ease-[var(--ease)] group-hover:scale-[1.03]"
              />
            </div>
          )}
          {/* 글은 **왼쪽 정렬**이다 — 와사비 배너도, 우리 매거진 지면도 좌측정렬이라
              여기서 가운데로 모으면 아래 히어로(중앙정렬)와 성격이 섞인다.
              위계 = 배지 → 부제 → 제목 → 요약 → 버튼. */}
          <div className="min-w-0">
            {/* 「창간호」 — 1편뿐인 게 흠이 아니라 **사건**으로 읽히게 하는 프레이밍(1팀, 08-13).
                2편부터는 자동으로 「최신호」. 매거진 목록 히어로도 같은 규칙. */}
            {/* 배지는 어느 배경에서든 **흰 알약 + 초록 글자** — 밝은 회색 면(soft)에서도 흰색이
                한 단 밝아서 구분되고, 어두운 면에서는 가장 잘 튄다. 유일하게 안 바뀌는 조각. */}
            <span className="inline-flex items-center rounded-pill bg-surface px-2.5 py-1 text-[11px] font-bold tracking-[0.06em] text-primary-on">
              collab5 매거진 · {isFirstIssue ? "창간호" : "최신호"}
            </span>
            {/* 🎨어두운 배경(photo·ink)에서는 글자가 전부 흰 계열이다.
                ⚠️`text-white/70`처럼 **투명도로** 위계를 만든다 — `text-mute` 같은 회색 토큰은
                  흰 지면 기준으로 잡힌 값이라 어두운 배경에서 대비가 무너진다.
                  반대로 밝은 면(soft)에서는 그 토큰들이 정상 동작하므로 그대로 쓴다. */}
            {article.subtitle && (
              <p
                className={`mt-3 text-[13px] font-medium break-keep sm:text-[14px] ${
                  dark ? "text-white/70" : "text-primary-on"
                }`}
              >
                {article.subtitle}
              </p>
            )}
            {/* 📏배너 안에서는 제목이 주인공 — 아래 히어로 슬로건(32/48)보다는 **작아야** 한다.
                여기가 더 크면 페이지의 목소리가 매거진 제목으로 넘어간다. */}
            <h2
              className={`mt-1.5 text-balance text-[24px] font-bold leading-[1.25] tracking-[-0.025em] break-keep sm:text-[34px] ${
                dark ? "text-white" : "text-ink"
              }`}
            >
              {article.title}
            </h2>
            {article.summary && (
              // 모바일에선 숨긴다 — 배지·부제·제목·버튼만으로도 첫 화면이 꽉 찬다.
              // 요약까지 넣으면 배너가 폰 한 화면을 통째로 먹어 아래 슬로건이 안 보인다.
              <p
                className={`mt-3 hidden line-clamp-2 text-[15px] leading-relaxed break-keep sm:block ${
                  dark ? "text-white/75" : "text-body"
                }`}
              >
                {article.summary}
              </p>
            )}
            <div className="mt-5 flex items-center gap-3">
              {/* 진짜 버튼이 아니라 **버튼처럼 보이는 표식**이다 — 배너 전체가 이미 링크라
                  안에 또 링크를 두면 중첩 앵커(HTML 위반)가 된다. `<span>`인 이유.
                  🎨와사비의 「자세히 보기」와 같은 자리·같은 무게. 다만 그쪽은 밝은 배경이라 검정
                     알약이고, 우리는 배경이 어두워졌으니(C안) **흰 알약**이 같은 역할을 한다. */}
              <span
                className={`inline-flex h-11 items-center rounded-pill px-5 text-[14px] font-medium ${
                  dark ? "bg-white text-ink" : "bg-ink text-on-dark"
                }`}
              >
                읽어보기
              </span>
              <span
                className={`text-[12px] sm:text-[13px] ${dark ? "text-white/55" : "text-mute"}`}
              >
                {article.editorName}
                {article.publishedAt && ` · ${kstDateLabel(article.publishedAt)}`}
              </span>
            </div>
          </div>
        </div>
      </TrackLink>
    </section>
  );
}
