// 홈 랜딩 — 발신자(보내는 쪽) 여정 중심. MVP: 업체 리스트 노출 X (cold-start).
// 등록 → 카드 만들기 → 공유. design.md §9.6 온보딩 3스텝.
import Link from "next/link";
import { PreviewPhones } from "./PreviewPhones";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
      {/* Hero */}
      <section className="mx-auto max-w-[600px] text-center">
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
          길게 설명하지 않아도 당신다운 첫인상을 전할 수 있어요.
          <br />
          무료로 시작할 수 있어요.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row">
          <Link
            href="/register"
            className="flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-on sm:w-auto"
          >
            브랜드 소개서 만들기
          </Link>
          <Link
            href="/preview"
            className="flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface px-6 text-base font-medium text-ink sm:w-auto"
          >
            소개서 미리보기
          </Link>
        </div>
      </section>

      {/* 미리보기 — 실제 데모 소개서 2종(사진 있는/없는) 폰 프레임. 결과물 먼저 → 과정 설명 순서 */}
      <section className="mt-16 rounded-2xl bg-surface-soft px-4 py-10 sm:px-8">
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          이런 소개서가 만들어져요
        </h2>
        <p className="mx-auto mt-2 max-w-[440px] break-keep text-center text-base leading-relaxed text-body">
          아래 예시 소개서를 확인해 보세요
        </p>
        <div className="mt-8">
          <PreviewPhones />
        </div>
      </section>

      {/* §9.6 온보딩 3스텝 */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          브랜드 소개서, 이렇게 만들어요
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StepCard
            n={1}
            title="내 브랜드를 소개해요"
            desc="AI가 온라인 정보를 찾아, 초안 작성을 도와드려요."
            illu={<NodeIllu />}
          />
          <StepCard
            n={2}
            title="소개서를 만들고 저장해요"
            desc="만든 소개서는 언제든 링크로 공유할 수 있어요."
            illu={<CardIllu />}
          />
          <StepCard
            n={3}
            title="소개서를 협업 파트너에게 전달해요"
            desc="링크 하나만 보내면, 상대는 로그인 없이 바로 볼 수 있어요."
            illu={<ConnectIllu />}
          />
        </div>
      </section>

      {/* 왜 소개서? — DM vs 소개서 */}
      <section className="mt-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
          긴 DM보다, 한 장의 소개서
        </h2>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* 그냥 DM */}
          <div className="rounded-xl border border-hairline bg-surface-soft p-6">
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
          {/* 브랜드 소개서 */}
          <div className="rounded-xl border border-primary bg-surface p-6 shadow-e1">
            <p className="flex items-center gap-1.5 text-[17px] font-bold text-ink">
              <span className="h-2 w-2 rounded-pill bg-primary" />
              이렇게 달라져요
            </p>
            <ul className="mt-4 space-y-3">
              {[
                "브랜드와 협업 제안을 한 번에 전달할 수 있어요.",
                "상대가 필요한 정보를 한눈에 이해할 수 있어요.",
                "더 편하게, 더 자신 있게 협업을 시작할 수 있어요.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-base leading-relaxed text-body">
                  <span className="font-bold text-primary-on">✓</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* 마무리 CTA */}
      <section className="mt-12 text-center">
        <Link
          href="/register"
          className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on"
        >
          지금 시작하기
        </Link>
      </section>
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
    <div className="rounded-xl border border-hairline bg-surface p-6">
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
