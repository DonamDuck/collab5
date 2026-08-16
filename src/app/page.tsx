// 홈 랜딩 — **08-16 개편 v2(대표 지시)**. 레퍼런스 = 와사비클래스(wasabiclass.com) · 리틀리(start.litt.ly).
//
// ┌ 왜 갈아엎었나 ─────────────────────────────────────────────────────────────────
// │ 대표 관찰: 피드백에서 제일 많이 나온 두 마디가 ①"소개서가 너무 이쁘다"(완성본)
// │ ②"콜라보 분석이 재밌다"(리포트)였다. 그런데 홈 첫 화면은 **소개서를 만들라는 요구**였다.
// │ 칭찬받는 건 '구경거리'인데 첫 화면은 '일 시키는 곳'이었던 것 — 이게 개편의 전부다.
// └───────────────────────────────────────────────────────────────────────────────
//
// ⭐위계 — **힘 주는 3개와 그 순서는 대표가 직접 잡았다**(바꾸지 말 것):
//    ⓪ 매거진 배너  풀블리드, `<main>` **밖**. 첫 화면을 여는 훅 (와사비 상단 배너 자리)
//    ① 히어로       슬로건 **한 방**. 중앙정렬 (와사비도 히어로만 중앙)
//    ② 브랜드 카드  "지금, 콜라보 가능한 브랜드예요"
//    ③ 분석 안내    리포트 **풀버전** + 「콜라보 아이디어 추천 받기」(3분기 게이트)
//    ④ 마무리 CTA
//    ＋ 상시 플로팅 CTA(`HomeFloatingCta`)
//
// ⭐**정렬 규칙**(대표 지시 08-16, 와사비 구조 차용):
//    · 히어로 = **중앙정렬** — 페이지에 하나뿐인 선언이라 가운데가 맞다.
//    · 그 아래 모든 섹션 제목 = **왼쪽정렬** — 목록·카드를 여는 '구획 이름'이지 선언이 아니다.
//    🪤예전엔 전부 중앙이었다. 그러면 제목과 본문이 같은 무게로 읽혀 **어디서 섹션이 시작하는지**가
//      안 보인다. 왼쪽으로 모으면 눈이 왼쪽 세로선을 따라 내려가며 구획을 센다.
//
// 🚨히어로에서 CTA를 뺀 게 이 개편의 유일한 도박이다. 전환 경로는 **네 곳**으로 유지된다:
//   HomeMenuBar 3번칸 / 플로팅 알약 / ③의 아이디어 CTA / 마무리 CTA.
//   → GA로 `home_hero_register_click`(사라짐) 대신 `home_floating_cta_click` +
//     `home_idea_cta_click` 합계가 이전 히어로 클릭 수를 넘는지 2주 볼 것.
//     안 넘으면 히어로 CTA를 되살린다(아래 ①에 되살릴 코드 주석으로 남겨둠).
//
// 📦홈에서 내린 것들 — **파일은 지우지 않았다**(이 저장소 관례, HomeSteps.tsx와 동일):
//   · `PreviewPhones`   소개서 실물 캐러셀 → 대표가 잡은 3개에 없어 홈에서 뺐다.
//                        되살리려면 ③ 아래에 <PreviewPhones />. **파일은 그대로 있다.**
//   · `HomeSectionTabs` 섹션 앵커 탭 → 목차 대상이던 섹션 구조 자체가 사라졌다.
//   · `HomeEnrichBanner` 보강 서비스 안내 → 소개서 구간과 한 몸이라 같이 내려갔다.
//   · `FlowStrip` 여정 3칸 · 「콜라보의 시작이 달라져요」 대조 2칸
//     → `./HomeRetiredSections.tsx`로 통째 이사(왜 내렸는지까지 주석에 붙여둠).
//     ⭐와사비가 슬로건·철학 문단을 '와사비클래스 소개' 페이지로 옮긴 것과 같은 처리 —
//       **버린 게 아니라 이사 대기**다. 우리도 '소개' 페이지가 생기면 그게 저것들의 제자리다.
// 🔻`Link`·`Reveal` import 제거(08-16) — 마무리 CTA 섹션이 사라지면서 홈에서 쓰는 곳이 없어졌다.
//    ⚠️`Reveal` 컴포넌트 자체는 남아 있다(다른 페이지가 쓴다). 홈만 안 쓰는 것.
import { HomeMenuBar } from "./HomeMenuBar";
import { HomeMagazineBanner } from "./HomeMagazineBanner";
import { HomeIdeaCta, IDEA_CTA_ANCHOR } from "./HomeIdeaCta";
import { HomeFloatingCta } from "./HomeFloatingCta";
import { BrandGrid } from "@/components/BrandGrid";
import { SampleReportCard } from "@/components/SampleReport";
import { repo } from "@/lib/repo";

// n≤12 동안 전량 노출(대표 확정 07-31 — 상한+오래된 순이면 방금 등록한 씨딩 사장님이 자기 브랜드를 못 본다).
const GRID_LIMIT = 24;
const MIN_GRID = 3; // 이보다 적으면 섹션을 아예 안 그린다(디자인팀 07-27 규칙 승계).

// ⭐홈 그리드 노출 순서 — 대표가 직접 정한다(08-02). 2열이라 위→아래·왼→오른쪽으로 1,2 / 3,4 …
//   ⚠️이름이 아니라 **slug**로 잡는다 — 상호는 사장님이 바꿀 수 있지만 slug는 안 바뀐다.
const HOME_ORDER: string[] = [
  "m-ofjghi", // 캔버스가든
  "m-vs9xzg", // 호락호락도서관
  "m-uako9s", // 아그레아블
  "m-oblejt", // 계단뿌셔클럽
  "m-irywef", // 두더지요가원
  "m-8r5gep", // 콜렉트마이페이보릿
  "m-u8y5i3", // 캔앤코르크
  "m-x3djf8", // 레이지오터
  "m-1vv8kj", // 로컬페이지
];

// ⚠️이 한 줄이 없으면 목록이 **배포 시점에 얼어붙는다**(서버 컴포넌트 프리렌더 함정, /search·/my와 동일).
export const revalidate = 300;

export default async function Home() {
  const fetched = await repo.listHomeMakers(GRID_LIMIT);
  // 매거진 배너용 — 최신 1편만 쓴다.
  // ⚠️홈은 ISR 300초라 새 글이 배너에 뜨기까지 최대 5분 걸린다. `/magazine`은 force-dynamic이라
  //   즉시 뜨므로, 발행 직후 두 화면이 잠깐 어긋나는 건 **버그가 아니라 설계**다.
  const articles = await repo.listPublishedArticles();
  const leadArticle = articles[0];
  const rank = (slug: string) => {
    const i = HOME_ORDER.indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const collabBrands = [...fetched].sort((a, b) => rank(a.slug) - rank(b.slug));

  return (
    // 🎨홈만 지면을 한 단 낮춘다(대표 확정 08-14 — `surface-faint` #fafafb). 이유는 메뉴바다:
    //    흰 알약을 흰 지면에 올려두니 "메뉴로 안 보인다"(대표). 밝기차 2%가 알약을 띄운다.
    //    ⚠️전 페이지가 아니라 **홈만**이다. `--canvas`를 바꾸면 전 페이지의 surface-soft 칩이 다 죽는다.
    <div className="bg-surface-faint">
      <HomeMenuBar />

      {/* ═══ ⓪ 매거진 배너 — 첫 화면 훅 ═══════════════════════════════════════════
          🚨`<main>` **밖**에 있다. 풀블리드(화면 폭 전체)여야 하는데, main은 max-w-960 + mx-auto라
            안에서 폭을 넘기려면 `w-screen + left-1/2 + -translate-x-1/2` 같은 기법이 필요하고
            그건 **스크롤바 폭만큼 넘쳐 전 페이지에 가로 스크롤**을 만든다(07-29 헤더 사고와 같은 함정).
            밖에 두면 그 계산이 아예 필요 없다 — 배너가 알아서 안쪽 내용만 960으로 다시 가둔다.
          ⭐대표 지시로 **히어로보다 위**로 올렸다(v1은 아래였다). 와사비 구조 그대로다:
            배너 → 슬로건 → 상품 카드.
          ⚠️`home-rise`(온로드 라이즈)를 안 태운다 — 페이지 최상단이라 애니메이션이 끝나기 전에
            사람이 이미 보고 있다. 첫 화면 요소는 처음부터 떠 있어야 한다. */}
      {leadArticle && (
        // 🎨배경 **A안(잉크 단색)** 확정(대표 08-16, `/qa-banner`에서 셋 비교 후 선택).
        //    ⭐A를 고른 이유는 이 자리의 미래에도 맞다 — 대표: *"나중에 슬라이드로 업체 소개나
        //      이벤트가 될 자리"*. C안(커버 블러)은 **사진이 있어야 성립**하지만 A는 사진이 없는
        //      이벤트·공지 배너에도 그대로 쓰인다. 캐러셀이 되면 슬라이드마다 배경이 달라지는 것보다
        //      **한 배경 위에서 내용만 바뀌는** 쪽이 배너 띠로 읽힌다.
        //    🔁다른 안: `bg="photo"`(커버 블러) · `bg="soft"`(중성 그레이) — /qa-banner 참조.
        <HomeMagazineBanner article={leadArticle} isFirstIssue={articles.length === 1} bg="ink" />
      )}

      <main className="mx-auto w-full max-w-[960px] px-4 pb-12 pt-6 sm:px-6">
      {/* 온로드 라이즈 키프레임 — 서버가 <style>로 직접 렌더(React 19 head 호이스트).
          ⚠️Tailwind v4(Lightning CSS)가 유틸로 안 잡히는 raw @keyframes를 제거해서 globals.css엔 못 둠 → 여기 인라인.
          순수 CSS라 JS 하이드레이션 전에도 재생 → 히어로가 안 보이는 위화감 없음(Reveal의 opacity-0 문제 회피). */}
      <style>{`
        /* ⚠️ to는 translateY(0)이 아니라 **none** — fill-mode:both가 끝값을 영구 유지하는데,
           transform이 남은 섹션은 fixed 자손(시트·모달)의 컨테이닝 블록이 돼 오버레이가 섹션 안에 갇힌다(실측 07-31). */
        @keyframes home-rise { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: none; } }
        .home-rise { animation: home-rise 0.95s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .home-rise { animation: none; } }
      `}</style>

      {/* ═══ ① 히어로 — 슬로건 한 방(중앙정렬) ══════════════════════════════════════
          🔤크기 30/44 → **32/48**(대표: 와사비는 시원한데 그쪽 폰트는 너무 크다).
             와사비 실측이 ~52px이라 그보다 한 단 아래로 잡았다.
             ⭐"시원함"의 실체는 절대 크기가 아니라 **대비**다 — 부제 스택(18 볼드 + 16 + 여정 3칸)을
               걷어내면서 48 vs 16의 대비가 생겼다. 크기를 4px 올린 것보다 **아래를 비운 게** 크다.
          ⛔여기에 버튼·배지·스트립을 다시 넣지 말 것. 넣는 순간 "한 방"이 아니라 다시 스택이 된다.
          🔖되살리기 — GA에서 전환이 빠지면 부제 아래에 예전 CTA를 되돌린다:
             <div className="mx-auto mt-7 max-w-[420px]"><TrackLink href="/register"
               event="home_hero_register_click" className="flex h-12 w-full items-center
               justify-center rounded-md bg-primary px-6 text-[16px] font-medium text-primary-on">
               브랜드 소개서 등록하기(3분)</TrackLink></div>  ※ TrackLink import 필요 */}
      <section className="home-rise mx-auto max-w-[640px] pt-6 pb-2 text-center sm:pt-10">
        <h1 className="break-keep text-[32px] font-bold leading-[1.24] tracking-[-0.035em] text-ink sm:text-[48px]">
          우리 브랜드,
          <br />
          이제는 콜라보할 차례예요.
        </h1>
        {/* 부제는 **한 줄**. 예전엔 세 덩어리였고, 그게 슬로건의 목소리를 나눠 갖던 원인이다. */}
        <p className="mx-auto mt-5 max-w-[480px] break-keep text-[16px] leading-[1.6] text-body sm:text-[18px]">
          작은 가게도, 1인 브랜드도 괜찮아요. 무료로 시작해보세요.
        </p>
      </section>

      {/* ═══ ② 콜라보 가능한 브랜드 ════════════════════════════════════════════════
          씨딩 사장님·소개서 수신 브랜드의 첫 질문이 "여기 어떤 브랜드들이 있나"다(07-31 근거 승계).
          ⚠️`Reveal`(IntersectionObserver)은 여기서 못 쓴다 — 07-31에 붙였다가 뺐다. threshold 0.15가
            이 섹션 높이(738px)의 110px을 요구하는데 스크롤 0에서는 82px만 보여 안 터졌고,
            첫 화면 바로 아래에 **738px 투명 구멍**이 남았다. `home-rise`는 온로드 CSS라 그 사고가
            구조적으로 불가능하다.
          📏간격은 「무엇을 썼나」가 아니라 **getBoundingClientRect로 잰 두 박스 사이 거리**로 확인한다
            (08-15 사고: mt-12로 적어놓고 실제로는 py-4가 얹혀 68px이었다). */}
      {collabBrands.length >= MIN_GRID && (
        // 📏간격 — **모바일 `mt-16`(68) / 데스크톱 `sm:mt-24`(102)**.
        //    🔬와사비 실측(1280px): 히어로 서브 끝 720.8 → 섹션 제목 top 848.8 = **128px**.
        //      히어로(중앙)와 이 제목(왼쪽)이 가까우면 "왜 정렬이 다르지?"가 눈에 걸린다 —
        //      멀어지면 두 덩어리가 **별개 구획**으로 읽혀 축이 안 싸운다.
        //    🪤그런데 102를 모바일에도 그대로 먹였더니 대표 지적 *"모바일 마진이 너무 크다"*.
        //      **간격은 화면 폭에 비례해야 한다** — 데스크톱 1280에서 102px은 8%지만 375에서는 27%다.
        //      같은 절대값이 좁은 화면에선 "덩어리 사이"가 아니라 "빈 화면"으로 읽힌다.
        //    🔻08-16 2차 조정 — 68/102 → **51/85**(대표: *"히어로랑 좀만 더 가깝게"*).
        //      와사비 실측 128px을 목표로 잡았었는데, 그쪽은 히어로 서브가 2줄이라 덩어리가 더 크다.
        //      우리 히어로는 슬로건 2줄 + 서브 1줄이라 같은 간격이 상대적으로 더 비어 보인다.
        //      **간격은 절대값이 아니라 위 덩어리의 크기에 맞춰 잡는다.**
        <section className="home-rise mt-12 sm:mt-20" style={{ animationDelay: "260ms" }}>
          {/* 🏷️「콜라보 ON」칩 — 08-14에 히어로에서 걷어냈던 그 칩 UI를 여기로 되살렸다(대표 지시 08-16).
              ⭐히어로에선 슬로건 위 장식이라 뺐지만, 여기서는 **목록의 상태 표시**라 일이 있다:
                아래 카드들이 왜 "지금 가능한"지를 한 단어로 말한다(초록 점 = 켜져 있음).
                그래서 서브 문장(「지금 함께할 콜라보를 찾고 있는 브랜드예요」)을 지울 수 있었다 —
                칩이 같은 말을 더 짧게 한다(대표 지시: 타이틀 하나만).
              🎨점은 `bg-primary`(Kiwi) — 사이트에서 '켜짐/살아있음'을 뜻하는 유일한 색이다. */}
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1.5">
            <span className="h-2 w-2 rounded-pill bg-primary" />
            <span className="text-[12px] font-bold tracking-wide text-mute">콜라보 ON</span>
          </div>
          {/* ⬅️왼쪽정렬(대표 지시 08-16). 위 히어로만 중앙이고 여기부터는 전부 왼쪽이다.
              🔤크기 30 → **28**. 와사비 섹션 제목이 정확히 28px이고, 히어로 48과의 비가 1.71배다.
                30이면 1.6배라 히어로와 너무 가까워 "둘 다 제목"으로 읽힌다. */}
          <h2 className="break-keep text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            지금, 콜라보 가능한 브랜드예요.
          </h2>
          <div className="mt-7">
            <BrandGrid brands={collabBrands} />
          </div>
        </section>
      )}

      {/* ═══ ③ 콜라보 아이디어 추천 — 리포트 풀버전 + 게이트 CTA ═════════════════════
          ⭐대표가 잡은 3개 중 마지막이자 **전환을 실제로 만드는 자리**다.
            흐름: 브랜드 카드를 구경한 직후 → "고른 브랜드와 뭘 할 수 있는지 알려드려요" →
                  리포트 실물(풀버전)로 증명 → 「콜라보 아이디어 추천 받기」.
          🔻08-16에 [미리보기] 버튼 + 시트를 없앴다 — 홈에서 반응이 제일 좋은 물건을 문 뒤에
            두고 있었다. 문을 없애고 물건을 꺼내 놓는다(SampleReport.tsx 주석 참조).
          🚨`scroll-mt-[152px]` + 앵커는 `HomeIdeaCta` 안에 있다(`IDEA_CTA_ANCHOR`).
            HomeMenuBar 3번칸이 거기로 점프한다 — 지우면 메뉴가 깨진다.
          ⚠️등장은 `Reveal`이 아니라 `home-rise`다. 메뉴바에서 앵커로 뛰어 들어오면
            IntersectionObserver가 "안보임→안보임"을 못 잡아 **섹션이 통째로 opacity 0**으로 남는다
            (실측으로 걸렸다 — 07-31 브랜드 그리드가 당한 것과 같은 사고). */}
      {/* 🎯이 섹션만 **데스크톱에서 중앙정렬**이다(대표 지시 08-16, 스샷 대조).
          ⭐왜 여기만 예외인가 — 위 브랜드 섹션은 **카드가 화면 폭을 꽉 채우는 그리드**라 왼쪽 축이
            자연히 생긴다. 반면 여기는 **가운데 놓인 카드 한 장(640px)** 이라, 제목만 왼쪽이면
            제목과 카드가 서로 다른 축을 갖는다(실측 178 vs 498 — 대표가 스샷으로 잡아낸 그 어긋남).
            👉규칙: **왼쪽정렬은 왼쪽부터 채워지는 목록에만.** 가운데 한 덩어리면 제목도 가운데.
          ⚠️모바일은 `text-left` — 폭이 좁아 카드가 어차피 꽉 차므로 왼쪽 축이 살아 있고,
            중앙정렬하면 두 줄짜리 제목이 계단처럼 들쭉날쭉해진다. */}
      {/* ⚓**앵커가 여기 있다**(08-16 대표 지시로 CTA 버튼 → 섹션 제목으로 이동).
          메뉴바 「콜라보 아이디어 만들기」를 누르면 이 섹션 **제목부터** 보인다.
          🔻처음엔 앵커가 아래 CTA 버튼에 붙어 있었는데, 그러면 페이지 거의 끝으로 순간이동해
            **리포트 실물을 통째로 건너뛰고 버튼만** 보게 된다. 이 구좌의 설득은 리포트가 하고
            버튼은 그 결론이라, 결론만 보여주면 왜 눌러야 하는지가 없다.
          🔢`scroll-mt-[152px]` = 헤더 59.5 + 메뉴바 밴드 70 + 숨 쉴 틈 22.5(실측 08-14).
            ⚠️rem 유틸을 안 쓴 이유 — 루트 폰트가 17px이라 `scroll-mt-32`가 128이 아니라 136px이다. */}
      <section
        id={IDEA_CTA_ANCHOR}
        className="home-rise mt-16 scroll-mt-[152px] text-left sm:mt-24 sm:text-center"
        style={{ animationDelay: "420ms" }}
      >
        {/* 📝제목 교체(대표 08-16): ~~"어느 브랜드와 맞을지, AI가 먼저 찾아드려요"~~
            → **"선택한 브랜드와의 콜라보 아이디어를 추천해드려요."**
            ⭐바뀐 건 주어다. 옛 문장은 **우리가 찾아주는 것**(우리 자랑)이었고, 새 문장은
              **당신이 고른 상대와 무엇을 할지**(사용자 행동)를 말한다. */}
        <h2 className="break-keep text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
          선택한 브랜드와의
          {/* 🔻`hidden sm:inline`을 뺐다 — 대표 제보 *"모바일에서 「선택한 브랜드와의」 다음 줄바꿈이
              안 된다"*. 원래는 좁은 화면에서 3줄이 될까 봐 막았는데, 실제로는 375px에서 이 문장이
              자연 줄바꿈으로도 딱 2줄이라 **끊는 자리만 우리가 못 정하고 있었다.**
              지금은 모바일·데스크톱 모두 같은 자리에서 끊는다. */}
          <br />
          콜라보 아이디어를 추천해드려요.
        </h2>
        {/* 🔻모바일에서는 **숨긴다**(대표 지시 08-16). 바로 아래 카드가 같은 말을 실물로 하고 있어서,
            좁은 화면에서는 이 문장이 카드에 닿기까지의 스크롤만 늘렸다.
            📐`sm:mx-auto` — 섹션이 데스크톱에서 중앙정렬이라 이 문단도 가운데로 와야 축이 맞는다. */}
        <p className="mt-2.5 hidden max-w-[560px] break-keep text-[16px] leading-[1.65] text-body sm:mx-auto sm:block sm:text-[17px]">
          두 브랜드가 왜 함께하면 좋을지, 무엇을 어떻게 하면 될지까지 정리해드려요.
        </p>

        {/* 실물 먼저, 버튼은 그다음 — "재밌다"는 반응은 **리포트를 본 뒤에** 생긴다.
            ⚠️리포트는 손으로 쓴 가짜가 아니라 실제 파이프라인 산출물이다(캔버스가든 × 호락호락도서관,
              collab_reports id=37). 가짜 예시는 금지 — 신뢰 폭탄(SampleReport.tsx 주석).
            📐`sm:mx-auto` — 카드(640px)를 데스크톱에서 가운데로. 모바일은 꽉 차서 영향 없다. */}
        <div className="mt-7 max-w-[640px] sm:mx-auto">
          <SampleReportCard />
        </div>

        {/* 3분기 게이트 — 비로그인 / 소개서 없음 / 소개서 있음. 상세는 HomeIdeaCta.tsx */}
        <HomeIdeaCta />
      </section>

      {/* 🔻08-16 「지금 바로 콜라보를 시작해보세요 :)」 마무리 CTA 섹션 **삭제**(대표 지시).
          ⭐없앤 게 맞는 이유 — 바로 위 「콜라보 아이디어 추천 받기」가 이미 이 페이지의 결론이다.
            그 아래에 또 「지금 시작하기」(=/register)를 두면 **결론이 둘**이 되고, 방금 게이트로
            "소개서가 필요하다"를 설명해 놓고 바로 밑에서 같은 곳으로 가는 버튼을 또 보여주는 꼴이었다.
          🔗`data-home-end` 감지점은 **풋터로 옮겼다** — 그게 없으면 플로팅 알약이 풋터를 덮는다.
             (HomeFloatingCta가 이 속성을 찾는다. 지우면 그 가드가 죽는다) */}
      <div aria-hidden="true" data-home-end className="mt-16 h-0" />
      </main>
      {/* 🚨main **밖**에 둔다 — main엔 `home-rise`(transform)를 쓰는 자손이 있는데, transform이 있는
          조상은 fixed의 컨테이닝 블록이 되어 알약이 그 섹션 안에 갇힌다(07-31 시트 사고와 같은 함정). */}
      <HomeFloatingCta />
    </div>
  );
}
