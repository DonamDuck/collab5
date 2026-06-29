// 홈 랜딩 — 발신자(보내는 쪽) 여정 중심. MVP: 업체 리스트 노출 X (cold-start).
// 등록 → 카드 만들기 → 공유. design.md §9.6 온보딩 3스텝.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-12 sm:px-6">
      {/* Hero */}
      <section className="grid items-center gap-10 lg:grid-cols-2">
        {/* 왼쪽: 텍스트 */}
        <div className="text-center lg:text-left">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-pill bg-surface-soft px-3 py-1">
            <span className="h-2 w-2 rounded-pill bg-primary" />
            <span className="text-xs font-medium text-mute">잘 맞는 콜라보</span>
          </div>
          <h1 className="break-keep text-[32px] font-bold leading-tight tracking-[-0.02em] text-ink sm:text-[40px]">
            좋은 협업은,
            <br />
            좋은 소개에서 시작돼요.
          </h1>
          <p className="mt-4 text-lg font-bold leading-snug text-primary-on">
            콜라보를 제안하는 카드를
            <br />
            3분 만에 만들어보세요.
          </p>
          <p className="mt-3 break-keep text-base leading-relaxed text-body">
            작은 가게도, 1인 브랜드도 괜찮아요.
            <br />
            길게 설명하지 않아도 당신다운 첫인상을 전할 수 있어요.
          </p>
          <div className="mt-7 flex flex-col items-center justify-center gap-2.5 sm:flex-row lg:justify-start">
            <a
              href="/register"
              className="flex h-12 w-full items-center justify-center rounded-md bg-primary px-6 text-base font-medium text-primary-on sm:w-auto"
            >
              내 브랜드 등록하기
            </a>
            <a
              href="/c/canvasgarden-demo"
              className="flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface px-6 text-base font-medium text-ink sm:w-auto"
            >
              예시 카드 보기
            </a>
          </div>
        </div>

        {/* 오른쪽: 일러스트 (DM의 답답함 → 카드의 깔끔함) */}
        <div
          className="relative mx-auto h-[300px] w-full max-w-[360px]"
          aria-hidden="true"
        >
          {/* 긴 DM 말풍선 */}
          <div className="absolute left-0 top-2 w-[220px] rounded-[16px] rounded-bl-[4px] bg-surface-soft px-4 py-3">
            <p className="text-[13px] leading-relaxed text-mute">
              저희는 이런 브랜드이고, 이런 제품을 만들고 있고… 협업 어떠신가요?
            </p>
            <p className="mt-1 tracking-[3px] text-faint">···</p>
          </div>
          {/* 콜라보 카드 */}
          <div className="absolute bottom-2 right-0 w-[195px] rounded-[18px] border border-hairline bg-surface p-4 shadow-e3">
            <div className="mb-2.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-pill bg-primary" />
              <span className="text-[10px] tracking-wide text-mute">콜라보 제안</span>
            </div>
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-md bg-primary-pale text-base font-bold text-primary-on">
              캔
            </div>
            <p className="text-[13px] font-bold text-ink">캔버스가든</p>
            <div className="my-2 h-1.5 w-4/5 rounded-pill bg-surface-soft" />
            <div className="h-1.5 w-3/5 rounded-pill bg-surface-soft" />
            <div className="mt-3 rounded-md bg-primary py-1.5 text-center text-[11px] font-medium text-primary-on">
              관심 있어요
            </div>
          </div>
        </div>
      </section>

      {/* §9.6 온보딩 3스텝 */}
      <section className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight text-ink">
          이렇게 써요
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StepCard
            n={1}
            title="내 브랜드를 소개해요"
            desc="몇 번 누르면 끝나요. 나를 보여주는 공개 페이지가 생겨요."
            illu={<NodeIllu />}
          />
          <StepCard
            n={2}
            title="콜라보 카드를 만들어요"
            desc="보낼 상대와 하고 싶은 말만 적으면, 청첩장 같은 카드가 만들어져요."
            illu={<CardIllu />}
          />
          <StepCard
            n={3}
            title="공유하고 협업을 시작해요"
            desc="인스타 DM이나 이메일로 링크를 보내요. 받는 분은 로그인 없이 열어봐요."
            illu={<ConnectIllu />}
          />
        </div>
      </section>

      {/* 왜 카드? — DM vs 카드 */}
      <section className="mt-16">
        <h2 className="text-center text-xl font-bold tracking-tight text-ink">
          왜 카드가 더 효과적일까요?
        </h2>
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {/* 그냥 DM */}
          <div className="rounded-lg border border-hairline bg-surface-soft p-5">
            <p className="text-sm font-bold text-mute">이런 경험 있으셨나요?</p>
            <ul className="mt-3 space-y-2.5">
              {[
                "내가 어떤 브랜드인지 하나씩 설명해야 해요.",
                "상대는 내용을 이해하기 전부터 부담을 느껴요.",
                "다른 메시지 사이에 금방 묻혀버려요.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-sm text-body">
                  <span className="text-faint">·</span>
                  {t}
                </li>
              ))}
            </ul>
          </div>
          {/* 콜라보 카드 */}
          <div className="rounded-lg border border-primary bg-surface p-5 shadow-e1">
            <p className="flex items-center gap-1.5 text-sm font-bold text-ink">
              <span className="h-2 w-2 rounded-pill bg-primary" />
              이렇게 달라집니다.
            </p>
            <ul className="mt-3 space-y-2.5">
              {[
                "브랜드와 협업 제안을 한 번에 전달할 수 있어요.",
                "상대가 필요한 정보를 한눈에 이해할 수 있어요.",
                "더 편하게, 더 자신 있게 협업을 시작할 수 있어요.",
              ].map((t) => (
                <li key={t} className="flex gap-2 text-sm text-body">
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
        <a
          href="/register"
          className="inline-flex h-12 items-center justify-center rounded-md bg-primary px-7 text-base font-medium text-primary-on"
        >
          30초 만에 시작하기
        </a>
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
    <div className="rounded-lg border border-hairline bg-surface p-5">
      <div className="flex h-12 w-12 items-center justify-center text-ink">{illu}</div>
      <p className="mt-4 text-[11px] font-bold tracking-wide text-primary-on">
        STEP {n}
      </p>
      <h3 className="mt-1 text-[15px] font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs leading-relaxed text-mute">{desc}</p>
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
