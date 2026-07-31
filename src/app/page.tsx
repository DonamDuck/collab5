// 홈 랜딩 — 콜라보 프레임(2026-07-31 개편, 대표 확정 · Obsidian [[홈-콜라보-프레임-개편]]).
// 위계: ①히어로(소개서 CTA + 분석 예시 링크) ②콜라보 가능한 브랜드 그리드 ③실물 구경(목업+리포트)
//       ④3스텝 ⑤DM비교 ⑥마무리 CTA. (④⑤ 압축은 디자인팀 3자 기획 후 — 스텝카드 스크린샷 소유권)
// 1차 관객 = 씨딩 링크 타고 온 사장님 — "안 읽고도 이해"가 성공 기준. 익명 방문자 퍼널은 포켓 후 P3.
import Link from "next/link";
import { PreviewPhones } from "./PreviewPhones";
import { Reveal } from "@/components/Reveal";
import { BrandGrid } from "@/components/BrandGrid";
import { SampleReportLink, SampleReportPeek } from "@/components/SampleReport";
import { TrackLink } from "@/components/TrackLink";
import { repo } from "@/lib/repo";

// n≤12 동안 전량 노출(대표 확정 07-31 — 상한+오래된 순이면 방금 등록한 씨딩 사장님이 자기 브랜드를 못 본다).
// 24는 "전량"의 방어적 상한 — 넘으면 P3 큐레이션 재론.
const GRID_LIMIT = 24;
const MIN_GRID = 3; // 이보다 적으면 섹션을 아예 안 그린다(디자인팀 07-27 규칙 승계).

// ⚠️ 이 한 줄이 없으면 목록이 **배포 시점에 얼어붙는다**(서버 컴포넌트 프리렌더 함정, /search·/my와 동일).
// 다만 홈은 최다 트래픽 랜딩이라 매 요청 조회(force-dynamic) 대신 ISR로 둔다 —
// 캐러셀은 '등록 오래된 순 10개'라 신규 등록이 앞자리를 밀어내는 일이 거의 없어 5분 지연이 문제되지 않는다.
export const revalidate = 300;

export default async function Home() {
  const collabBrands = await repo.listCollabOpenMakers(GRID_LIMIT);

  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
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
        <h1 className="break-keep text-[28px] font-bold leading-[1.3] tracking-[-0.03em] text-ink sm:text-[40px]">
          우리 브랜드의 콜라보,
          <br />
          여기서 시작해요.
        </h1>
        {/* 서브가 기능 전달 담당 — 소개서→분석 흐름을 한 문장에. AI 언급은 히어로 1곳 원칙 유지. */}
        <p className="mx-auto mt-4 max-w-[460px] break-keep text-[18px] font-bold leading-[1.5] text-primary-on sm:text-[20px]">
          AI와 함께 3분 만에 소개서를 만들고,
          <br />
          추천 콜라보 분석까지 받아보세요.
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
        // ⚠️ **Reveal을 쓰지 않는다**(07-31 대표 "최상단이 어색하다" 실측 결과).
        //    히어로 바로 다음 섹션인데 높이가 738px이라, Reveal의 threshold 0.15는 **110px이 보여야** 터진다.
        //    스크롤 0에서 이 밴드는 82px만 보이므로 안 터지고 → 첫 화면 바로 아래에 **738px 투명 구멍**이 남았다.
        //    (`eager`로 하단 컷을 없애도 threshold는 그대로라 해결 안 됨 — 실측 확인)
        //    이 섹션은 홈의 주 콘텐츠다. 등장 연출보다 "바로 보이는 것"이 우선.
        <section
          className="mt-16 -mx-4 bg-surface-soft px-4 py-14 [box-shadow:0_0_0_100vmax_var(--surface-soft)] [clip-path:inset(0_-100vmax)] sm:-mx-6 sm:px-6"
        >
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
      <section className="home-rise mt-16" style={{ animationDelay: "600ms" }}>
        <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
          3분이면 브랜드 소개서가 완성돼요.
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] break-keep text-center text-[16px] leading-[1.65] text-body sm:text-[17px]">
          몇 가지만 알려주시면, AI가 소개에 필요한 내용을 먼저 정리해드려요.
        </p>
        <div className="mt-8">
          <PreviewPhones />
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/preview"
            className="flex h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-[16px] font-medium text-ink"
          >
            브랜드 소개서 작성 예시
          </Link>
        </div>

        {/* 분석 리포트 축약 — 소개서 실물 바로 아래(같은 '실물 구경' 섹션). sample-report.json 재사용.
            "소개서를 만들면 이런 것도 받는다"가 소개서 CTA의 두 번째 근거가 된다(대표: 기능을 더 잘 쓰게). */}
        <div className="mt-14 text-center">
          <h3 className="text-balance break-keep text-[20px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[24px]">
            소개서를 만들면 이런 콜라보 분석이 가능해요
          </h3>
          <p className="mx-auto mt-2 max-w-[440px] break-keep text-[16px] leading-[1.65] text-body sm:text-[17px]">
            두 브랜드가 왜 함께하면 좋을지, 함께 하면 좋을 만한 콜라보 아이디어를 알려드려요.
          </p>
          <div className="mt-6">
            <SampleReportPeek />
          </div>
        </div>
      </section>

      {/* §9.6 온보딩 3스텝 */}
      <section className="mt-16">
        <Reveal>
          <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            브랜드 소개서, 이렇게 만들어요
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* 카드 스태거 — 순차 등장(90ms 간격) */}
          <Reveal delay={0} className="h-full">
            <StepCard
              n={1}
              title="브랜드 이름을 알려주세요"
              desc="흩어져 있던 우리 브랜드의 이야기를 먼저 찾아 모아드려요."
              illu={<NodeIllu />}
            />
          </Reveal>
          <Reveal delay={90} className="h-full">
            <StepCard
              n={2}
              title="마음에 드는 소개를 골라 다듬어요"
              desc="몇 번의 선택이면 소개서가 완성돼요. 언제든 다시 고칠 수 있어요."
              illu={<CardIllu />}
            />
          </Reveal>
          <Reveal delay={180} className="h-full">
            <StepCard
              n={3}
              title="소개서 링크를 활용해요"
              desc="협업 파트너에게 전달하거나, 개인 포트폴리오 페이지로 쓸 수 있어요."
              illu={<ConnectIllu />}
            />
          </Reveal>
        </div>
      </section>

      {/* 왜 소개서? — DM vs 소개서 */}
      <section className="mt-16">
        <Reveal>
          <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
            브랜드 소개서는 이렇게 활용할 수 있어요.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 그냥 DM */}
          <Reveal delay={0} className="h-full">
            <div className="h-full rounded-xl border border-hairline bg-surface-soft p-6">
              <p className="text-[16px] font-bold text-mute sm:text-[17px]">이런 경험 있으셨나요?</p>
              <ul className="mt-4 space-y-3">
                {[
                  "내가 어떤 브랜드인지 하나씩 설명해야 해요.",
                  "상대는 내용을 이해하기 전부터 부담을 느껴요.",
                  "다른 메시지 사이에 금방 묻혀버려요.",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-[16px] leading-[1.65] text-body sm:text-[17px]">
                    <span className="text-faint">·</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
          {/* 브랜드 소개서 */}
          <Reveal delay={110} className="h-full">
            <div className="h-full rounded-xl border border-primary bg-surface p-6 shadow-e1">
              <p className="flex items-center gap-1.5 text-[16px] font-bold text-ink sm:text-[17px]">
                <span className="h-2 w-2 rounded-pill bg-primary" />
                이렇게 달라져요
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "브랜드와 협업 제안을 한 번에 전달할 수 있어요.",
                  "상대가 필요한 정보를 한눈에 이해할 수 있어요.",
                  "프로필 링크에 걸어두면 우리 브랜드의 포트폴리오가 돼요.",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-[16px] leading-[1.65] text-body sm:text-[17px]">
                    <span className="font-bold text-primary-on">✓</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* 마무리 CTA — eager 필수: 페이지 맨 마지막 요소라 하단 -22% 데드존을 못 벗어나 리빌이 영영 안 터짐 */}
      <Reveal as="section" eager className="mt-14 text-center">
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
    </main>
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
    { label: "소개서 3분 작성", desc: "AI가 작성 도움" },
    { label: "콜라보 둘러보기", desc: "등록 브랜드 서칭" },
    { label: "AI 추천 콜라보 분석", desc: "콜라보 아이템 확인!" },
  ];
  return (
    <div className="mx-auto mt-7 flex max-w-[460px] items-start justify-center rounded-lg bg-surface-soft px-2 py-4 sm:px-4">
      {steps.map((s, i) => (
        <div key={s.label} className="flex flex-1 items-start">
          {i > 0 && (
            <svg
              viewBox="0 0 20 20"
              className="mt-2 h-4 w-4 shrink-0 text-faint"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              aria-hidden="true"
            >
              <path d="M7 4l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <div className="flex-1 px-0.5 text-center">
            <span className="mx-auto flex h-7 w-7 items-center justify-center rounded-pill bg-primary text-[13px] font-bold text-primary-on">
              {i + 1}
            </span>
            <p className="mt-2 break-keep text-[12.5px] font-bold leading-[1.35] text-ink sm:text-[14px]">
              {s.label}
            </p>
            <p className="mt-1 break-keep text-[11px] leading-[1.35] text-mute sm:text-[12px]">
              {s.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

function StepCard({
  n,
  title,
  desc,
  illu,
}: {
  n: number;
  title: string;
  desc: string;
  illu: React.ReactNode;
}) {
  return (
    // h-full = Reveal 래퍼가 그리드 아이템이 돼도 카드 높이를 셀에 맞춰 균등하게(스태거 도입 후)
    <div className="h-full rounded-xl border border-hairline bg-surface p-6">
      <div className="flex h-12 w-12 items-center justify-center text-ink">{illu}</div>
      <p className="mt-4 text-[12px] font-bold tracking-wide text-primary-on">
        STEP {n}
      </p>
      <h3 className="mt-1.5 text-[17px] font-bold leading-snug tracking-[-0.01em] text-ink">{title}</h3>
      <p className="mt-2 text-[14px] leading-[1.6] text-mute sm:text-[15px]">{desc}</p>
    </div>
  );
}

/* ── 아톰 라인 일러스트 (design.md §9.7: 잉크선 + 키위 핵 1점) ── */
function NodeIllu() {
  // 노드 형성
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" aria-hidden="true">
      <ellipse
        cx="24"
        cy="24"
        rx="16"
        ry="6"
        transform="rotate(-25 24 24)"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="24" cy="24" r="5.5" fill="var(--primary)" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
function CardIllu() {
  // 카드 + 아톰
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" aria-hidden="true">
      <rect x="9" y="7" width="30" height="34" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <line x1="15" y1="30" x2="33" y2="30" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="15" y1="35" x2="27" y2="35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="24" cy="18" r="4.5" fill="var(--primary)" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function ConnectIllu() {
  // 두 노드 점선 연결
  return (
    <svg viewBox="0 0 48 48" className="h-11 w-11" fill="none" aria-hidden="true">
      <line
        x1="14"
        y1="24"
        x2="34"
        y2="24"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray="3 3.5"
      />
      <circle cx="12" cy="24" r="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="36" cy="24" r="5" fill="var(--primary)" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}
