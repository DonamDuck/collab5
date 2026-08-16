// 홈에서 내린 섹션 보관소 — 08-16 홈 개편(대표 지시)에서 첫 화면 위계를 ⓪매거진 ①브랜드 ②분석으로
// 다시 잡으면서 자리를 잃은 것들. **지우지 않고 옮겨둔다**(이 저장소 관례 — HomeSteps.tsx와 같은 처리).
//
// ⭐와사비클래스가 슬로건·철학 문단을 홈에서 '와사비클래스 소개' 페이지로 옮긴 것과 같은 발상이다.
//   버린 게 아니라 **이사 대기**다 — 우리도 '소개' 페이지가 생기면 여기 있는 것들이 그 페이지의 뼈대가 된다.
//
// 되살리는 법: page.tsx에서 import 후 원하는 자리에 <FlowStrip /> · <HomeCompareSection />.
// ⚠️단, 되살릴 땐 **왜 내렸는지**(각 주석의 ⛔)를 먼저 읽을 것. 자리만 되돌리면 같은 문제가 재발한다.
import { Reveal } from "@/components/Reveal";

/** 제품 여정 스트립 — ①소개서 3분 작성 ②콜라보 둘러보기 ③AI 추천 콜라보 분석 (대표 확정 07-31).
 *
 *  ⛔08-16에 홈에서 내린 이유 — 히어로를 **슬로건 한 방**으로 만드는 것과 정면 충돌한다.
 *     이 스트립이 히어로 안(부제와 CTA 사이)에 있었고, 그게 곧 "제일 큰 글자조차 조금 큰 문단으로
 *     읽히던" 원인의 한 축이었다(슬로건 44 → 부제 20 → 부제 17 → 스트립 14로 계단이 이어짐).
 *
 *  이전 이력 — v1은 맨숭맨숭한 점 3개였다("허접하다" 대표 QA) → soft 면 카드로 묶어 하나의 도식으로.
 *  ⚠️ 부연은 처음에 `hidden sm:block`으로 모바일에서 숨겼는데, 그게 곧 **주 사용 환경에서만 안 보이는**
 *     꼴이라 대표 QA에서 바로 걸렸다(07-31). 좁아도 보여주는 쪽이 맞다 — 폰트만 한 단 줄여 수용.
 *  ⚠️숫자 배지를 쓰지 않는다(08-14 대표 확정). redesign-skill 진단: "3등분 균등 칸을 기능 소개로
 *     쓰는 건 가장 흔한 AI 레이아웃." 원형 Kiwi 배지 3개가 나란한 게 '템플릿' 인상의 핵심이었다.
 *     순서는 화살표가 이미 말하므로 숫자는 같은 말을 두 번 하는 것이었다. */
export function FlowStrip() {
  const steps = [
    { label: "소개서 3분 작성" },
    { label: "콜라보 둘러보기" },
    { label: "AI 콜라보 추천" },
  ];
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

/** 「콜라보의 시작이 이렇게 달라져요」 — 혼자 시작할 때 vs collab5에서 시작할 때 (2칸 대조).
 *
 *  ⛔08-16에 홈에서 내린 이유 — 이 개편은 "설명을 줄이고 실물을 보여준다"가 전부인데, 이 섹션은
 *     홈에서 **가장 설명적인 덩어리**(6줄 텍스트)였다. 게다가 자리가 매거진 배너·브랜드 카드·분석
 *     세 구좌 사이라, 힘을 준 셋의 흐름을 글로 끊고 있었다.
 *  🏠제자리 후보 = '소개' 페이지(와사비의 「와사비클래스 소개」에 해당). 그 페이지가 생기면 여기가 뼈대.
 *
 *  ⚠️ 대조축을 함부로 「DM vs 소개서」로 되돌리지 말 것(08-03 대표 확정, 원래 그거였다).
 *     ①히어로가 콜라보 프레임인데 마지막 설명만 옛 웨지(소개서) 프레임으로 돌아갔고
 *     ②콜라보 리포트의 종착지가 **DM 문구 복사**라 우리가 만들어 주는 걸 우리가 깎는 꼴이었다.
 *     ③「이런 경험 있으셨나요?」는 콜라보 DM을 보내본 적 없는 1차 관객에게 "아니요"를 부른다.
 *  왼쪽 3줄 = 문제정의 P2 탐색 / P3 연락 / P1 상상과 1:1. 오른쪽은 **실재하는 기능만** — 없는 걸 넣지 말 것.
 *  ⚠️ 「프로필 링크에 걸어두면 포트폴리오가 돼요」는 08-03에 뺐다 — 여기서 유일한 M3(자산) 문장이라
 *     '시작'으로 통일한 축에서 혼자 미래를 말했다. 자산 이야기는 M3 실험이 붙을 때 별도 자리로. */
export function HomeCompareSection() {
  return (
    <section className="mt-12">
      <Reveal>
        <h2 className="text-balance break-keep text-center text-[24px] font-bold leading-[1.35] tracking-[-0.02em] text-ink sm:text-[28px]">
          콜라보의 시작이 이렇게 달라져요.
        </h2>
      </Reveal>
      {/* 그룹 리빌 — 모바일 1열에서 카드마다 따로 뜨지 않게(대표 QA 07-31) */}
      <Reveal className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        {/* 왼쪽 3줄과 **순서까지 1:1**(탐색/연락/상상). 줄을 늘리면 대조가 흐려진다. */}
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
  );
}
