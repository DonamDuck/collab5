// 홈 랜딩 — 콜라보 프레임(2026-07-31 개편, 대표 확정 · Obsidian [[홈-콜라보-프레임-개편]]).
// 위계: ①히어로(소개서 CTA + 분석 예시 링크) ②콜라보 가능한 브랜드 그리드 ③실물 구경(앵커 탭 + 목업 + 리포트)
//       ④DM비교 ⑤마무리 CTA. (3스텝은 08-02에 홈에서 내림 → 코드는 ./HomeSteps.tsx에 보관)
// 1차 관객 = 씨딩 링크 타고 온 사장님 — "안 읽고도 이해"가 성공 기준. 익명 방문자 퍼널은 포켓 후 P3.
import Link from "next/link";
import { PreviewPhones } from "./PreviewPhones";
import { HomeSectionTabs } from "./HomeSectionTabs";
import { HomeMenuBar } from "./HomeMenuBar";
import { HomeEnrichBanner } from "./HomeEnrichBanner";
import { Reveal } from "@/components/Reveal";
import { BrandGrid } from "@/components/BrandGrid";
import { SampleReportLink, SampleReportPeek } from "@/components/SampleReport";
import { TrackLink } from "@/components/TrackLink";
import { repo } from "@/lib/repo";
import { kstDateLabel } from "@/lib/magazine-format";

// n≤12 동안 전량 노출(대표 확정 07-31 — 상한+오래된 순이면 방금 등록한 씨딩 사장님이 자기 브랜드를 못 본다).
// 24는 "전량"의 방어적 상한 — 넘으면 P3 큐레이션 재론.
const GRID_LIMIT = 24;
const MIN_GRID = 3; // 이보다 적으면 섹션을 아예 안 그린다(디자인팀 07-27 규칙 승계).

// ⭐홈 그리드 노출 순서 — 대표가 직접 정한다(08-02). 2열이라 위→아래·왼→오른쪽으로 1,2 / 3,4 …
//   ⚠️ 이름이 아니라 **slug**로 잡는다 — 상호는 사장님이 바꿀 수 있지만 slug는 안 바뀐다.
//   여기 없는 브랜드(새로 등록된 곳)는 이 목록 **뒤에** repo 기본 정렬대로 붙는다.
//   순서를 바꾸려면 이 배열만 고치면 된다.
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

// ⚠️ 이 한 줄이 없으면 목록이 **배포 시점에 얼어붙는다**(서버 컴포넌트 프리렌더 함정, /search·/my와 동일).
// 다만 홈은 최다 트래픽 랜딩이라 매 요청 조회(force-dynamic) 대신 ISR로 둔다 —
// 캐러셀은 '등록 오래된 순 10개'라 신규 등록이 앞자리를 밀어내는 일이 거의 없어 5분 지연이 문제되지 않는다.
export const revalidate = 300;

export default async function Home() {
  const fetched = await repo.listHomeMakers(GRID_LIMIT);
  // 매거진 구좌용 — 최신 1편만 쓴다.
  // ⚠️홈은 ISR 300초라 새 글이 여기 뜨기까지 최대 5분 걸린다. `/magazine`은 force-dynamic이라
  //   즉시 뜨므로, 발행 직후 두 화면이 잠깐 어긋나는 건 **버그가 아니라 설계**다.
  const articles = await repo.listPublishedArticles();
  const leadArticle = articles[0];
  // HOME_ORDER에 있는 것부터 그 순서대로, 없는 건 뒤에 원래 순서 그대로(Array#sort는 안정 정렬).
  const rank = (slug: string) => {
    const i = HOME_ORDER.indexOf(slug);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const collabBrands = [...fetched].sort((a, b) => rank(a.slug) - rank(b.slug));

  return (
    // ⚠️ 메뉴바는 `<main>` **밖**에 둔다 — main엔 `py-12`(=51px) 상단 패딩이 있어서 안에 넣으면
    //    스크롤 0에서 헤더와 바 사이가 51px 벌어진다. 밖에 두면 헤더에 딱 붙고, 바가 흐름에서
    //    차지하는 높이만큼 아래 콘텐츠가 자연히 내려간다(= 대표가 말한 "메뉴바만큼 살짝 아래로").
    //    sticky 기준 조상은 layout의 `<div className="flex-1">`이라 페이지 끝까지 따라온다.
    <>
      <HomeMenuBar />
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
      {/* Hero — 온로드 라이즈 1번(순차의 첫 블록) */}
      <section className="home-rise mx-auto max-w-[600px] text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1">
          <span className="h-2 w-2 rounded-pill bg-primary" />
          <span className="text-[12px] font-medium text-mute">잘 맞는 콜라보</span>
        </div>
        {/* 타이포 스케일 — 계단뿌셔클럽 fresh-load 실측 기준(대표 QA 07-31).
            ⚠️ Framer 사이트는 브레이크포인트 변형을 **로드 시점에** 확정한다. 창만 리사이즈하면
               이전 변형이 남은 채 줌으로 우겨넣어져 DevTools에 엉뚱한 px가 찍힌다 — 반드시 새로고침 후 측정.
            실측: 모바일 타이틀 24~28 / 본문 16, 데스크탑 타이틀 36~44 / 본문 20~22.
            핵심은 **모바일→데스크탑에서 타이틀만 1.6배로 키우고 본문은 1.3배만** 키워
            넓은 화면일수록 위계 대비를 벌리는 것(모바일 1.5~1.75배 → 데스크탑 2.0배). */}
        {/* 슬로건 B′ — 콜라보 프레임(대표 확정 07-31 아침, "변경" 지시). '시작'만 약속(11곳으로도 이행 가능).
            디자인팀 차별화 변형이 나오면 2안 비교로 교체 가능. */}
        <h1 className="break-keep text-[30px] font-bold leading-[1.28] tracking-[-0.032em] text-ink sm:text-[44px]">
          우리 브랜드,
          <br />
          이제는 콜라보할 차례예요.
        </h1>
        {/* 서브가 기능 전달 담당 — 소개서→분석 흐름을 한 문장에. AI 언급은 히어로 1곳 원칙 유지. */}
        <p className="mx-auto mt-4 max-w-[460px] break-keep text-[18px] font-bold leading-[1.5] text-primary-on sm:text-[20px]">
          AI와 함께 3분 만에 소개서를 만들고,
          <br />
          추천 콜라보 아이디어까지 받아보세요.
        </p>
        <p className="mx-auto mt-3 max-w-[460px] break-keep text-[16px] leading-[1.65] text-body sm:text-[17px]">
          작은 가게도, 1인 브랜드도 괜찮아요. 무료로 시작해보세요.
        </p>
        {/* 제품 여정 — 카피와 CTA **사이**(대표 제안 07-31). 여기가 맞는 자리인 이유:
            "무료로 시작해보세요"를 읽은 직후 = 뭘 하게 되는지 궁금한 순간이고,
            버튼을 누르기 직전에 기대치를 맞춰준다. 아래에 두면 CTA 뒤라 아무도 안 본다. */}
        <FlowStrip />
        <div className="mx-auto mt-7 flex max-w-[420px] flex-col items-stretch gap-2">
          <TrackLink
            href="/register"
            event="home_hero_register_click"
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-[16px] font-medium text-primary-on"
          >
            브랜드 소개서 등록하기(3분)
          </TrackLink>
          {/* 분석 진입은 보더 버튼으로 승격(대표 07-31 "텍스트 링크는 안 보인다") —
              단 1번 CTA는 여전히 소개서(레드팀 R1: 분석 1번은 콜드스타트 절벽). 라벨 정직: 목적지=예시 시트. */}
          <SampleReportLink />
        </div>
      </section>

      {/* ② 콜라보 가능한 브랜드 — 히어로 바로 다음(07-31 개편: "여기 어떤 브랜드들이 있나"가
          씨딩 사장님·소개서 수신 브랜드의 첫 질문). 그리드 전량 노출, 정렬 최신순(repo).
          soft 밴드·통째 리빌·풀블리드 box-shadow 기법은 캐러셀 시절(07-27~29) 그대로 승계. */}
      {collabBrands.length >= MIN_GRID && (
        // ⭐등장은 **히어로와 한 몸**이다(08-14 대표 지시) — `home-rise`를 딜레이 없이 같이 태운다.
        //    ⚠️`Reveal`(IntersectionObserver)은 여기서 못 쓴다. 07-31에 한 번 붙였다가 뺐는데,
        //      threshold 0.15는 이 섹션(높이 738px)의 **110px이 보여야** 터지는데 스크롤 0에서는
        //      82px만 보여 안 터졌고, 첫 화면 바로 아래에 **738px 투명 구멍**이 남았다.
        //      (`eager`로 하단 컷을 없애도 threshold는 그대로라 해결 안 됨 — 실측)
        //    → `home-rise`는 **온로드 CSS 애니메이션**이라 스크롤 위치와 무관하게 항상 재생된다.
        //      그래서 "안 터지는" 사고가 구조적으로 불가능하다. 아래 섹션 ③이 쓰는 것과 같은 장치인데,
        //      거긴 `animationDelay: 600ms`로 순차를 만들고 **여기는 딜레이 0** — 히어로와 동시에 뜬다.
        // ⭐밴드(회색 면) 제거 — 08-14 대표 확정. 순백 페이지 한가운데에 회색 섹션 하나만 있으면
        //   "왜 여기만?"으로 읽힌다(redesign-skill: 라이트 페이지의 이질적 섹션 = 복붙 사고처럼 보임).
        //   섹션 구분은 제목과 여백이 맡는다. 풀블리드 box-shadow/clip-path 기법도 같이 걷어냈다.
        <section className="home-rise mt-14 -mx-4 px-4 py-4 sm:-mx-6 sm:px-6">
          <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            지금, 콜라보 가능한 브랜드예요.
          </h2>
          <p className="mx-auto mt-2 max-w-[440px] break-keep text-center text-[16px] leading-[1.65] text-body sm:text-[17px]">
            지금 함께할 콜라보를 찾고 있는 브랜드예요.
          </p>
          <div className="mt-8">
            <BrandGrid brands={collabBrands} />
          </div>
        </section>
      )}

      {/* ③ 실물 구경 — 소개서 목업 + 분석 리포트 축약. 제품의 두 얼굴을 한 스크롤에(07-31).
          목업은 실제 데모 소개서 2종(사진 있는/없는), 디자인팀 브라우저 카드(de9d6c5) 그대로.
          온로드 라이즈 2번은 유지 — 폴드 아래면 안 보이는 채 재생이 끝나 정적으로 보인다(무해). */}
      <section className="home-rise mt-10" style={{ animationDelay: "600ms" }}>
        {/* 앵커 탭 — 섹션 ③은 ⓐ소개서 만들기 / ⓑ콜라보 분석 두 덩어리라, 맨 위에 목차를 세워
            "다른 하나도 있다"를 먼저 알린다(대표 지시 08-02). 섹션 안에서만 sticky. 상세는 HomeSectionTabs.tsx. */}
        <HomeSectionTabs />
        {/* ⚠️ id는 HomeSectionTabs.tsx의 TABS·HomeMenuBar의 REPORT_ANCHOR와 짝. 바꾸면 셋 다.
            🔢 152px = **헤더 59.5 + HomeMenuBar 밴드 70 = 129.5** + 숨 쉴 틈 22.5(실측 08-14).
               08-14에 상단 메뉴바가 생기고 폰트가 커지면서 가려야 할 높이가 125.25 → 129.5로 올랐다.
               옛 값 `scroll-mt-32`(=8rem, 루트 17px라 136px)로 두면 여유가 6.5px밖에 안 남아,
               폰트 로드·기기 배율로 서브픽셀이 반대로 떨어지면 **제목이 바 밑에 깔린다.**
            ⚠️ rem 유틸을 쓰지 않고 px를 박은 이유 — 이 저장소는 루트 폰트가 17px이라 `scroll-mt-*`가
               16 기준이 아니다(8rem이 128이 아니라 136). 실측값을 그대로 쓰는 편이 안 헷갈린다.
            ⚠️ HomeSectionTabs의 ANCHOR_LINE_PX와 **같은 값**이어야 한다. 바꾸면 둘 다. */}
        <h2
          id="home-brandpage"
          className="mt-7 scroll-mt-[152px] text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:mt-9 sm:text-[28px]"
        >
          3분이면 브랜드 소개서가 완성돼요.
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] break-keep text-center text-[16px] leading-[1.65] text-body sm:text-[17px]">
          몇 가지만 알려주시면, AI가 소개에 필요한 내용을 먼저 정리해드려요.
        </p>
        <div className="mt-8">
          <PreviewPhones />
        </div>

        {/* 여기 있던 온보딩 3스텝은 홈에서 내렸다(대표 지시 08-02). 코드는 지우지 않고
            `./HomeSteps.tsx`로 통째로 옮겨뒀다 — 되살리려면 그 파일 머리말대로 이 자리에 <HomeSteps />. */}

        <div className="mt-8 flex justify-center">
          <Link
            href="/preview"
            className="flex h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-[16px] font-medium text-ink"
          >
            브랜드 소개서 작성 예시
          </Link>
        </div>

        {/* 보강 서비스 안내 — 예시 버튼 바로 아래(대표 지시 08-02). 위 버튼은 보더(보조),
            이건 키위 면(주)이라 시선 순서가 '구경 → 신청'으로 이어진다.
            보는 사람에 따라 문구·목적지가 갈린다 — 상세는 HomeEnrichBanner.tsx. */}
        <HomeEnrichBanner />

        {/* 분석 리포트 축약 — 소개서 실물 바로 아래(같은 '실물 구경' 섹션). sample-report.json 재사용.
            "소개서를 만들면 이런 것도 받는다"가 소개서 CTA의 두 번째 근거가 된다(대표: 기능을 더 잘 쓰게). */}
        <div className="mt-12 text-center">
          {/* h3 → h2 승격 + 크기도 형제 제목과 동일(08-02). 원래 이것만 h3/20px이라 "혼자 작아 보인다"(대표 QA).
              단순히 크기만 키우고 h3를 두면 안 된다 — 앵커 탭의 목적지가 되면서 이 구간은
              '소개서 구간의 하위 설명'이 아니라 **동급 섹션**이 됐다. 마크업이 보이는 위계를 따라가야 한다.
              ⚠️ id/scroll-mt-[152px]는 위 h2와 같은 규칙(HomeSectionTabs.tsx의 TABS·ANCHOR_LINE_PX와 짝). */}
          <h2
            id="home-collab-report"
            className="scroll-mt-[152px] text-balance break-keep text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]"
          >
            소개서를 만들면 이런 콜라보 리포트를 받아볼 수 있어요.
          </h2>
          <p className="mx-auto mt-2 max-w-[440px] break-keep text-[16px] leading-[1.65] text-body sm:text-[17px]">
            두 브랜드가 왜 함께하면 좋을지, 함께 하면 좋을 만한 콜라보 아이디어를 알려드려요.
          </p>
          <div className="mt-6">
            <SampleReportPeek />
          </div>
        </div>
      </section>

      {/* 콜라보의 시작 — 「혼자 시작할 때 vs collab5에서 시작할 때」
          ⚠️ 대조축을 함부로 「DM vs 소개서」로 되돌리지 말 것(08-03 대표 확정, 원래 그거였다).
             ①히어로가 콜라보 프레임인데 마지막 설명만 옛 웨지(소개서) 프레임으로 돌아갔고
             ②콜라보 리포트의 종착지가 **DM 문구 복사**라 우리가 만들어 주는 걸 우리가 깎는 꼴이었다.
             ③「이런 경험 있으셨나요?」는 콜라보 DM을 보내본 적 없는 1차 관객에게 "아니요"를 부른다(P1에 있는 사람에게 P3의 고통을 물음).
          왼쪽 3줄 = 문제정의 P2 탐색 / P3 연락 / P1 상상과 1:1. 오른쪽은 **실재하는 기능만** — 없는 걸 넣지 말 것.
          ⛔ 여정 3칸(찾기→제안→기록) 안은 기각 — 히어로 FlowStrip과 정면으로 겹친다.
             역할 분담: FlowStrip=사이트에서 뭘 하나 / 이 섹션=내 브랜드에 뭐가 달라지나. */}
      <section className="mt-12">
        <Reveal>
          <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            콜라보의 시작이 이렇게 달라져요.
          </h2>
        </Reveal>
        {/* 위 3스텝과 같은 이유로 그룹 리빌 — 모바일 1열에서 카드마다 따로 뜨지 않게(대표 QA 07-31) */}
        <Reveal className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 혼자 시작할 때 */}
          <div className="h-full rounded-xl border border-hairline bg-surface-soft p-6">
            <p className="text-[16px] font-bold text-mute sm:text-[17px]">혼자 시작하려면</p>
            <ul className="mt-4 space-y-3">
              {[
                "어디에 어떤 브랜드가 있는지 알기 어려워요.",
                "먼저 연락하기가 늘 조심스러워요.",
                "무엇을 같이 하자고 해야 할지 막막해요.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-[16px] leading-[1.65] text-body sm:text-[17px]">
                  <span className="text-faint">·</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          {/* collab5에서 시작할 때 — 왼쪽 3줄과 **순서까지 1:1**(탐색/연락/상상). 줄을 늘리면 대조가 흐려진다.
              ⚠️ 「프로필 링크에 걸어두면 포트폴리오가 돼요」는 08-03에 뺐다 — 여기서 유일한 M3(자산) 문장이라
                 '시작'으로 통일한 축에서 혼자 미래를 말했다. 자산 이야기는 M3 실험이 붙을 때 별도 자리로. */}
          <div className="h-full rounded-xl border border-primary bg-surface p-6 shadow-e1">
            <p className="flex items-center gap-1.5 text-[16px] font-bold text-ink sm:text-[17px]">
              <span className="h-2 w-2 rounded-pill bg-primary" />
              collab5에서는
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "콜라보를 기다리는 브랜드를 먼저 둘러볼 수 있어요.",
                "소개서 링크 하나로 우리 브랜드를 설명할 수 있어요.",
                "AI가 두 브랜드의 콜라보 아이디어를 먼저 정리해줘요.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-[16px] leading-[1.65] text-body sm:text-[17px]">
                  <span className="font-bold text-primary-on">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* ── 매거진 구좌 (2026-08-13, 1팀 요청 → 디자인팀) ──
           🚨**이 자리는 장식이 아니라 유일한 진입로다.** 헤더의 「매거진」은 데스크톱에만 있다 —
             375px에서 로고+우측메뉴가 306px를 먹어 남는 폭이 35px뿐이라 텍스트 링크(66px)도
             아이콘(38px)도 안 들어간다(1팀 실측). 「콜라보 찾기」 칩을 아이콘으로 되돌리면 자리가
             나지만 그건 07-29 가로 스크롤 사고로 겨우 회수한 자리라 되돌릴 수 없다. 풋터에도
             넣었지만 끝까지 스크롤해야 나오니 진입로 구실을 못 한다.
             → **모바일에서 매거진에 닿는 길은 지금 여기뿐이다. 지우거나 아래로 밀지 말 것.**

           자리 = 「콜라보의 시작이 이렇게 달라져요」 **바로 다음**(1팀 제안 채택). 설명을 다 읽고
             "진짜?" 싶어지는 순간에 실물 증거가 나오는 자리다.

           ⭐어휘 — **섹션 헤더는 홈 어휘(중앙정렬), 카드 안쪽은 매거진 어휘(좌측정렬)**로 섞었다.
             홈은 전부 중앙정렬이라 헤더까지 좌측정렬로 하면 이 구좌만 홈에서 떠 보이고, 반대로
             카드 안까지 중앙정렬하면 매거진에 도착했을 때 얼굴이 안 이어진다. 지면 한 장을 홈에
             인용해 붙인 꼴로 읽히게 한 것.
           ⛔박스로 감싸지 않는다 — 「박스는 고르는 것, 줄은 읽는 것」(디자인-시스템 § 카드 어휘).
             박스를 입히면 바로 위 BrandGrid의 '고르는 브랜드'와 같은 옷이 된다. 대신 위아래
             hairline 룰로 '지면'임을 표시한다. */}
      {leadArticle && (
        <Reveal as="section" className="mt-12">
          {/* 카피 = 대표 확정(08-14). 제목이 **질문형**인 게 핵심 — 이 섹션은 기능 설명이 아니라
              "궁금하면 읽어보세요"라 물음표가 자연스럽다(위 섹션들은 전부 서술형이라 대비도 된다).
              부제는 매거진의 **이름을 대는 자리**라 문장을 안 닫고 고유명사로 끝낸다. */}
          <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            두 브랜드가 만나면, 어떤 이야기가 생길까요?
          </h2>
          <p className="mx-auto mt-2 max-w-[460px] break-keep text-center text-[16px] leading-[1.65] text-body sm:text-[17px]">
            브랜드들이 만나 만드는 콜라보 이야기를 기록하는 ‘collab5 매거진’
          </p>

          <div className="mt-8 border-y border-hairline">
            <Link
              href={`/magazine/${leadArticle.slug}`}
              className="block py-6 transition-opacity hover:opacity-70 sm:py-8"
            >
              <div className="grid items-center gap-5 sm:grid-cols-[1fr_280px] sm:gap-8">
                {leadArticle.coverImage && (
                  // 폰에선 사진이 먼저 — 잡지는 사진이 붙잡고 글이 따라오는 매체다(목록 히어로와 같은 규칙).
                  <div className="order-first overflow-hidden rounded-lg bg-surface-soft sm:order-last">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={leadArticle.coverImage}
                      alt=""
                      loading="lazy"
                      className="aspect-[4/3] w-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0 text-left">
                  {/* 「창간호」 — 1편뿐인 게 흠이 아니라 **사건**으로 읽히게 하는 프레이밍(1팀 제안).
                      2편부터는 자동으로 「최신호」가 된다. 매거진 목록 히어로도 같은 규칙을 쓴다. */}
                  <span className="text-[12px] font-medium tracking-[0.1em] text-faint">
                    {articles.length === 1 ? "창간호" : "최신호"}
                  </span>
                  {leadArticle.subtitle && (
                    <p className="mt-2.5 text-[13px] font-medium break-keep text-primary-on">
                      {leadArticle.subtitle}
                    </p>
                  )}
                  <h3 className="mt-1.5 text-[22px] font-bold leading-[1.3] tracking-[-0.01em] text-balance break-keep text-ink sm:text-[26px]">
                    {leadArticle.title}
                  </h3>
                  {leadArticle.summary && (
                    <p className="mt-2.5 line-clamp-2 text-[15px] leading-relaxed break-keep text-body">
                      {leadArticle.summary}
                    </p>
                  )}
                  <p className="mt-3 text-[13px] text-faint">
                    {leadArticle.editorName}
                    {leadArticle.publishedAt && ` · ${kstDateLabel(leadArticle.publishedAt)}`}
                  </p>
                </div>
              </div>
            </Link>
          </div>

          {/* 고스트 — 아래 마무리 CTA가 primary Kiwi라, 여기까지 primary면 진짜 CTA와 경쟁한다. */}
          <div className="mt-6 text-center">
            <Link
              href="/magazine"
              className="inline-flex h-11 items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
            >
              매거진 더 보기
            </Link>
          </div>
        </Reveal>
      )}

      {/* 마무리 CTA — eager 필수: 페이지 맨 마지막 요소라 하단 -22% 데드존을 못 벗어나 리빌이 영영 안 터짐 */}
      <Reveal as="section" eager className="mt-12 text-center">
        {/* 미션 한 줄 — 소개서가 쌓이면 발견으로 이어진다(BM 발굴 방향을 고객 언어로, 대표 확정 2026-07-23) */}
        <p className="mx-auto max-w-[440px] break-keep text-[20px] font-bold leading-[1.4] tracking-[-0.02em] text-ink sm:text-[24px]">
          지금 바로 콜라보를 시작해보세요 :)
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-[16px] font-medium text-primary-on"
        >
          지금 시작하기
        </Link>
      </Reveal>
      {/* ⚠️ main 안쪽은 일부러 **재들여쓰기하지 않았다** — 프래그먼트 하나 때문에 340줄을 밀면
          지금 같은 홈을 만지고 있을 수 있는 옆 세션과 통째로 충돌한다(한 작업트리 공유). */}
      </main>
    </>
  );
}

/** 제품 여정 스트립 — ①소개서 3분 작성 ②콜라보 둘러보기 ③AI 추천 콜라보 분석 (대표 확정 07-31).
 *  ⚠️ v1은 맨숭맨숭한 점 3개였다("허접하다" 대표 QA) → soft 면 카드로 묶어 **하나의 도식**으로 읽히게.
 *  문장 설명이 아니라 그림이다 — 안 읽고도 이해가 목표.
 *  ⚠️ 부연은 처음에 `hidden sm:block`으로 모바일에서 숨겼는데, 그게 곧 **주 사용 환경에서만 안 보이는**
 *     꼴이라 대표 QA에서 바로 걸렸다(07-31). 좁아도 보여주는 쪽이 맞다 — 폰트만 한 단 줄여 수용.
 *  라벨이 길어져(최대 10자) 375px에서 열당 ~90px → `break-keep`으로 두 줄까지 허용. */
function FlowStrip() {
  const steps = [
    { label: "소개서 3분 작성" },
    { label: "콜라보 둘러보기" },
    { label: "AI 콜라보 추천" },
  ];
  // ⭐숫자 배지를 쓰지 않는다(08-14 대표 확정).
  //   redesign-skill 진단: "3등분 균등 칸을 기능 소개로 쓰는 건 가장 흔한 AI 레이아웃."
  //   원형 Kiwi 배지 3개가 나란한 게 '템플릿' 인상의 핵심이었다. 순서는 화살표가 이미 말하므로
  //   숫자는 같은 말을 두 번 하는 것이었고, 빼고 나니 라벨만 남아 훨씬 조용해졌다.
  //   ⚠️부제("AI가 작성 도움" 등)도 같이 뺐다 — 라벨만으로 흐름이 읽히고, 부제까지 두면
  //     칸마다 줄 수가 달라져 세 칸의 바닥선이 어긋난다(3번 칸만 두 줄이던 문제).
  return (
    <div className="mx-auto mt-7 flex max-w-[460px] items-center justify-center gap-1.5 rounded-lg bg-surface-faint px-3 py-3.5 sm:gap-2.5 sm:px-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2.5">
          {i > 0 && (
            <svg viewBox="0 0 20 20" className="h-3.5 w-3.5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <p className="min-w-0 flex-1 break-keep text-center text-[12.5px] font-bold leading-[1.3] text-ink sm:text-[14px]">
            {s.label}
          </p>
        </div>
      ))}
    </div>
  );
}

