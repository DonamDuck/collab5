// 온보딩 3스텝 — **홈에서 내려둔 보관 부품**(대표 지시 2026-08-02: "이 영역 홈에서 일단 삭제하자!
// 나중에 복권 할수도 있으니 코드에는 좀 남겨둬주라").
//
// 왜 내렸나: 섹션 ③이 앵커 탭 2구간(ⓐ 소개서 만들기 / ⓑ 콜라보 분석)으로 나뉘면서,
// 그 사이에 낀 3스텝이 "탭으로 오가는 두 덩어리" 사이의 군더더기가 됐다. 내용 자체도
// 바로 위 폰 목업(결과물)과 바로 아래 '브랜드 소개서 작성 예시'(실물)가 이미 보여주는 것과 겹친다.
//
// 왜 주석 처리가 아니라 별 파일인가: 주석 덩어리는 편집기에서 하이라이팅·타입체크가 죽어
// 되살릴 때쯤이면 이미 썩어 있다. 파일로 두면 tsc/eslint가 계속 봐주므로 API가 바뀌면 바로 깨진다.
// ⚠️ 지금 이 파일은 **아무 데서도 임포트하지 않는다**(죽은 파일이라 lint에 안 걸린다).
//
// 되살리는 법: `src/app/page.tsx` 섹션 ③에서
//   1) `import { HomeSteps } from "./HomeSteps";`
//   2) `<PreviewPhones />` 블록과 '브랜드 소개서 작성 예시' 링크 **사이**에 `<HomeSteps />`
// 그 자리가 제자리인 이유는 아래 원본 주석(08-01 통합 기록)에 그대로 남겨뒀다.
import { Reveal } from "@/components/Reveal";

export function HomeSteps() {
  return (
    /* 온보딩 3스텝 — 원래는 "브랜드 소개서, 이렇게 만들어요" 제목을 단 **별도 섹션**이었다(08-01 통합).
       ① 그 제목이 바로 위 h2("3분이면 브랜드 소개서가 완성돼요")와 같은 말을 두 번 하고 있었다(대표 QA).
       ② 3스텝은 그 자체가 "어떻게 만드는지"의 답이라, 결과물(목업)과 예시 CTA **사이**가 제자리다 —
          결과를 보고 → 만드는 과정을 읽고 → 예시로 들어간다. 제목 없이도 순서가 설명을 대신한다.
       ⚠️ Reveal은 **그룹 하나**로 건다(07-31 대표 QA). 카드마다 개별 Reveal이면 데스크탑(3열)은
          같이 뜨지만 모바일(1열)은 카드마다 따로 스크롤해야 하나씩 나타난다. */
    <Reveal className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3">
      <StepCard
        n={1}
        title="브랜드 이름을 알려주세요"
        desc="흩어져 있던 우리 브랜드의 이야기를 먼저 찾아 모아드려요."
        illu={<NodeIllu />}
      />
      <StepCard
        n={2}
        title="마음에 드는 소개를 골라 다듬어요"
        desc="몇 번의 선택이면 소개서가 완성돼요. 언제든 다시 고칠 수 있어요."
        illu={<CardIllu />}
      />
      <StepCard
        n={3}
        title="소개서 링크를 활용해요"
        desc="협업 파트너에게 전달하거나, 개인 포트폴리오 페이지로 쓸 수 있어요."
        illu={<ConnectIllu />}
      />
    </Reveal>
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
