// 홈 랜딩 — 발신자(보내는 쪽) 여정 중심. MVP: 업체 리스트 노출 X (cold-start).
// 등록 → 카드 만들기 → 공유. design.md §9.6 온보딩 3스텝.
import Link from "next/link";
import { PreviewPhones } from "./PreviewPhones";
import { Reveal } from "@/components/Reveal";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
      {/* 온로드 라이즈 키프레임 — 서버가 <style>로 직접 렌더(React 19 head 호이스트).
          ⚠️Tailwind v4(Lightning CSS)가 유틸로 안 잡히는 raw @keyframes를 제거해서 globals.css엔 못 둠 → 여기 인라인.
          순수 CSS라 JS 하이드레이션 전에도 재생 → 히어로가 안 보이는 위화감 없음(Reveal의 opacity-0 문제 회피). */}
      <style>{`
        @keyframes home-rise { from { opacity: 0; transform: translateY(40px); } to { opacity: 1; transform: translateY(0); } }
        .home-rise { animation: home-rise 0.95s ease-out both; }
        @media (prefers-reduced-motion: reduce) { .home-rise { animation: none; } }
      `}</style>
      {/* Hero — 온로드 라이즈 1번(순차의 첫 블록) */}
      <section className="home-rise mx-auto max-w-[600px] text-center">
        <div className="mb-4 inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1">
          <span className="h-2 w-2 rounded-pill bg-primary" />
          <span className="text-xs font-medium text-mute">잘 맞는 콜라보</span>
        </div>
        <h1 className="break-keep text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">
          좋은 협업은,
          <br />
          좋은 소개에서 시작돼요.
        </h1>
        <p className="mx-auto mt-4 max-w-[460px] text-lg font-bold leading-snug text-primary-on">
          AI와 함께 브랜드 소개서를 만들어보세요.
          <br />
          3분이면 충분해요.
        </p>
        <p className="mx-auto mt-3 max-w-[460px] break-keep text-base leading-relaxed text-body">
          작은 가게도, 1인 브랜드도 괜찮아요.
          <br />
          몇 줄이면 소개서가 완성돼요. 무료로 시작해보세요.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href="/register"
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-on sm:w-auto"
          >
            브랜드 소개서 만들기
          </Link>
        </div>
      </section>

      {/* 미리보기 — 실제 데모 소개서 2종(사진 있는/없는) 폰 프레임. 결과물 먼저 → 과정 설명 순서.
          온로드 라이즈 2번(제목·섭타이틀·목업 통째로 세트). delay로 히어로(1번) 뒤에 이어 올라온다.
          데스크탑·모바일 동일 대응(스크롤 위치 무관, 로드 시 순차 재생). 대표 지시 2026-07-22. */}
      <section className="home-rise mt-16" style={{ animationDelay: "600ms" }}>
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          3분이면 브랜드 소개서가 완성돼요.
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] break-keep text-center text-base leading-relaxed text-body">
          몇 가지만 알려주시면, AI가 소개에 필요한 내용을 먼저 정리해드려요.
        </p>
        <div className="mt-8">
          <PreviewPhones />
        </div>
        <div className="mt-8 flex justify-center">
          <Link
            href="/preview"
            className="flex h-12 items-center justify-center rounded-md border border-border-strong bg-surface px-7 text-base font-medium text-ink"
          >
            브랜드 소개서 둘러보기
          </Link>
        </div>
      </section>

      {/* §9.6 온보딩 3스텝 */}
      <section className="mt-16">
        <Reveal>
          <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
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
          <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            브랜드 소개서는 이렇게 활용할 수 있어요.
          </h2>
        </Reveal>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 그냥 DM */}
          <Reveal delay={0} className="h-full">
            <div className="h-full rounded-xl border border-hairline bg-surface-soft p-6">
              <p className="text-[17px] font-bold text-mute">이런 경험 있으셨나요?</p>
              <ul className="mt-4 space-y-3">
                {[
                  "내가 어떤 브랜드인지 하나씩 설명해야 해요.",
                  "상대는 내용을 이해하기 전부터 부담을 느껴요.",
                  "다른 메시지 사이에 금방 묻혀버려요.",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-base leading-relaxed text-body">
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
              <p className="flex items-center gap-1.5 text-[17px] font-bold text-ink">
                <span className="h-2 w-2 rounded-pill bg-primary" />
                이렇게 달라져요
              </p>
              <ul className="mt-4 space-y-3">
                {[
                  "브랜드와 협업 제안을 한 번에 전달할 수 있어요.",
                  "상대가 필요한 정보를 한눈에 이해할 수 있어요.",
                  "프로필 링크에 걸어두면 우리 브랜드의 포트폴리오가 돼요.",
                ].map((t) => (
                  <li key={t} className="flex gap-2 text-base leading-relaxed text-body">
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
        <p className="mx-auto max-w-[440px] break-keep text-xl font-bold leading-snug tracking-tight text-ink">
          좋은 소개는 쌓일수록 힘이 돼요.
          <br />
          다음 콜라보가 우리를 먼저 찾아오도록.
        </p>
        <Link
          href="/register"
          className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on"
        >
          지금 시작하기
        </Link>
      </Reveal>
    </main>
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
      <p className="mt-4 text-xs font-bold tracking-wide text-primary-on">
        STEP {n}
      </p>
      <h3 className="mt-1.5 text-[18px] font-bold leading-snug text-ink">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-mute">{desc}</p>
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
