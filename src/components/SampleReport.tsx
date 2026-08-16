// 홈 "콜라보 분석 실물" — 예시 리포트 **풀버전** 카드.
// 스펙 = Obsidian [[홈-콜라보-프레임-개편]] · 08-16 대표 지시로 축약 → 풀버전 전환.
//
// ⚠️ 리포트를 새로 만들지 않는다 — `sample-report.json`을 /m 잠금 티저와 공유한다.
//    손으로 쓴 가짜 예시는 금지(신뢰 폭탄) — 반드시 실제 파이프라인 산출물이어야 한다.
// ⚠️ 실제 쌍이다(캔버스가든 × 호락호락도서관, collab_reports id=37). 실제 브랜드라
//    캡션에서 "가상"이라고 말하면 거짓이 된다 — 아래 식별 캡션 참조.
// ⚠️ 톤은 '재미'가 아니라 '안목'(왜 맞는지의 근거) — MD·기관이 봐도 장난감으로 안 읽히게.
//
// ┌ 08-16 개편: 축약(`SampleReportPeek`) → 풀버전(`SampleReportCard`) ───────────────
// │ 대표 지시: *"아이디어 + 아이디어 하단의 어떤 점인지까지 풀버전으로 넣고, 실행플랜도 넣고,
// │            미리보기 버튼은 삭제"*.
// │ ⭐근거 — 예전 구조는 **축약 카드 + [미리보기] 버튼 + 시트**였다. 즉 제품의 얼굴을 보려면
// │   클릭이 한 번 더 필요했는데, 홈에서 제일 반응이 좋은 게 바로 이 리포트다("분석이 재밌다").
// │   훅을 문 뒤에 두고 있었던 셈 → **문을 없애고 물건을 꺼내 놨다.**
// │ 🔻그래서 `ReportSheet` 포털·`useState`·`createPortal`이 전부 사라졌다. 홈 번들에서
// │   리포트 시트 전체가 빠진다(부수적 이득).
// │ 🔻`SampleReportPeek` → **이름도 바꿨다.** 더 이상 peek(엿보기)이 아니다.
// │   되살릴 일이 생기면 git에서 꺼낸다(이 파일 08-16 이전 리비전).
// └─────────────────────────────────────────────────────────────────────────────────
import { collabMethodLabel } from "@/lib/dna-pool";
import sampleData from "@/lib/sample-report.json";

/** 홈 예시에 보여줄 개수 — 아이디어·어울리는 점 **둘 다** 이 값으로 자른다(대표 지시 08-16).
 *  🔻08-16 오전엔 전량(아이디어 4 · 어울림 4)을 폈다가 대표 지적으로 되돌렸다: *"지금 4개 하니깐 좀 많다"*.
 *  ⭐풀버전으로 바꾼 목적은 **개수**가 아니라 **깊이**였다 — 아이디어에 「이런 점이 좋아요」 불릿과
 *    실행 플랜이 붙어 "여기까지 해준다"가 보이는 것. 개수는 오히려 스크롤만 늘렸다.
 *    그래서 깊이(불릿·실행플랜)는 유지하고 **장수만 줄인다.**
 *  ⚠️`실행 플랜`은 자르지 않는다 — 순서가 있는 목록이라 중간에서 끊으면 말이 안 된다. */
const PEEK = 2;

export function SampleReportCard() {
  const report = sampleData.report;

  return (
    // 📐560 → **640**. 담는 내용이 축약 3덩어리에서 풀버전 3섹션으로 늘었는데 폭이 그대로면
    //    데스크톱에서 카드가 세로로만 길어져 두루마리처럼 읽힌다.
    // ⬅️`mx-auto` **제거**(대표 지적 08-16 — *"왼쪽 타이틀인데 예시가 중앙이라 충돌한다"*).
    //    섹션 제목이 왼쪽으로 갔는데 카드만 가운데면 데스크톱에서 축이 둘로 갈린다.
    //    ⚠️모바일은 폭이 640보다 좁아 어차피 꽉 차므로 **보이는 변화가 없다** — 대표가 "모바일은
    //      괜찮다"고 한 것과 일치한다. 이 한 줄은 데스크톱만 고치는 수정이다.
    <div className="max-w-[640px]">
      <div className="rounded-xl border border-hairline bg-surface p-5 text-left shadow-e1 sm:p-7">
        {/* 식별 캡션 — 예시임을 정직하게 밝힌다(과장 금지).
            실제 등록 브랜드 쌍이라 "가상"이라고 쓸 수 없다. 대신 **실제 소개서로 만든 것**임을 밝혀
            "손으로 쓴 홍보 문구가 아니다"라는 신뢰 신호로 쓴다.
            🔻08-16 ①한 줄 12px 회색 텍스트 → ②칩 + 브랜드쌍 두 덩어리 → ③칩+볼드쌍 →
              ④**브랜드 쌍까지 칩 안으로**(대표 지시: *"chip으로 그냥 다 몰아넣는 거지"*).
              ⭐③이 여전히 두 덩어리였다 — 칩은 성격을, 아래 볼드는 대상을 말하는데 둘이 서로를
                안 가리켜서 눈이 두 번 멈췄다. **한 문장에 대상(브랜드 쌍) + 성격(추천 예시)**을
                다 넣으니 한 번에 끝난다.
              ⭐실제 쌍을 밝히는 건 "가짜 예시 금지"(07-31)의 핵심 신뢰 신호라 **지울 수 없다** —
                지운 게 아니라 **자리를 옮긴 것**이다. 그래서 `sampleData`에서 그대로 읽어 쓴다
                (하드코딩하면 나중에 예시 쌍을 바꿀 때 칩만 옛 이름으로 남는다).
              📐12px → **16px**(대표 지시). 이제 이 칩이 카드의 **머리글**이라 본문(15px)보다
                작으면 안 된다. 12px은 각주 크기였고, 그때는 아래 볼드가 머리글 역할을 했다.
            ✍️맞춤법 — 대표 초안은 「예시**에요**」였는데 **「예시예요」가 맞다.**
              받침 없는 말 뒤에는 '예요'(이에요의 준말), 받침 있는 말 뒤에는 '이에요'다.
              (예시**예요** / 소개서**예요** ↔ 책**이에요** / 브랜드**예요**)
            📐칩이 한 문장이라 `rounded-pill`이 아니라 `rounded-md`다 — 알약은 짧은 라벨의 모양이고,
              문장을 넣으면 좁은 화면에서 두 줄이 되며 알약 곡률이 깨져 보인다.
            ⚠️break-keep 필수 — 브랜드명이 길어 두 줄이 된다. 없으면 어절 한가운데서 끊긴다(08-01). */}
        <span className="inline-flex rounded-md bg-surface-soft px-3 py-2 text-[16px] font-medium break-keep text-mute">
          {sampleData.fromName} <span className="mx-1 text-faint">×</span> {sampleData.toName} 콜라보
          추천 예시예요.
        </span>

        {/* ① 추천 콜라보 아이디어 — 리포트의 얼굴.
            ⚠️섹션 순서(①아이디어 ②어울려요 ③실행플랜)는 리포트 시트와 **같아야 한다**(08-01 확정).
              홈에서 본 순서와 실제로 받는 리포트의 순서가 다르면 "다른 물건"으로 읽힌다. */}
        <p className="mt-4 text-[15px] font-bold text-ink">추천 콜라보 아이디어</p>
        {/* 🔢카운트 문구 — **`ideas.length`(4)가 아니라 `PEEK`(2)를 쓴다.** 예전엔 전체 개수를
            말하면서 2개만 보여줘서 "나머지는?"이 남았다. 여기 적힌 수와 눈에 보이는 카드 수가
            같아야 문장이 거짓이 아니게 된다.
            ⚠️실제 리포트는 4가지를 다 준다 — 그건 받는 화면(ReportSheet)에서 전부 보인다.
              여기는 **예시**라 두 장만 보여주는 것이고, 그 사실을 숫자로 속이지 않는 게 요점이다. */}
        <p className="mt-1 text-[13px] text-mute">
          두 소개서를 분석해 {PEEK}가지 콜라보 아이디어를 찾았어요.
        </p>
        <div className="mt-3 space-y-3">
          {report.ideas.slice(0, PEEK).map((idea, i) => {
            // gainA/gainB는 비어 있을 수 있다 — 빈 문자열이 불릿으로 찍히면 점만 남는다.
            const gains = [idea.gainA, idea.gainB].filter(Boolean);
            return (
              // shadow-e1은 **리포트에서 이 카드만** — "우리가 파는 물건"이라 유일하게 살짝 뜬다.
              <div key={i} className="rounded-lg border border-hairline bg-surface p-4 shadow-e1">
                {/* 아이브로 — method를 제목 오른쪽 칩이 아니라 윗줄에(07-31 제목 4줄 사고 재발 방지).
                    제목과 폭을 다투지 않고 번호가 공짜로 생긴다.
                    ⚠️method는 반드시 `collabMethodLabel()`을 거친다 — 원문은 Pool 내부 어휘다. */}
                <p className="text-[12px] font-medium tracking-wide text-faint">
                  아이디어 {i + 1}
                  {idea.method ? ` · ${collabMethodLabel(idea.method)}` : ""}
                </p>
                <p className="mt-1.5 text-[16px] font-bold leading-snug break-keep text-ink">
                  {idea.title}
                </p>
                <p className="mt-1.5 text-[14px] leading-relaxed break-keep text-body">
                  {idea.desc}
                </p>
                {/* 양쪽에 남는 것 — ⚠️"우리가 얻는 것/상대가 얻는 것" 라벨은 쓰지 않는다(대표 08-06).
                    주어를 지우고 기대 효과와 같은 불릿 문형으로 — 이익을 나열하면 노골적으로 읽힌다. */}
                {gains.length > 0 && (
                  <ul className="mt-3 space-y-1 border-t border-hairline pt-2.5">
                    {gains.map((g, gi) => (
                      <li key={gi} className="flex gap-1.5 text-[13px] leading-relaxed text-mute">
                        <span className="shrink-0 text-faint">•</span>
                        <span className="break-keep">{g}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>

        {/* ② 이런 점이 잘 어울려요 — ✔ 리스트. 아이디어(결과)를 보여준 뒤 근거를 대는 순서다. */}
        <p className="mt-7 text-[15px] font-bold text-ink">이런 점이 잘 어울려요</p>
        <ul className="mt-2 space-y-2">
          {report.matchPoints.slice(0, PEEK).map((p, i) => (
            <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-body">
              <span className="shrink-0">✔</span>
              <span className="break-keep">{p.text}</span>
            </li>
          ))}
        </ul>

        {/* ③ 실행 플랜 — 번호 스텝(대표 지시로 08-16에 홈에 추가).
            ⭐이게 들어오면서 이 카드의 뜻이 바뀐다: "이런 게 나와요"(구경) → **"여기까지 해줘요"(약속)**.
              아이디어만 있으면 감상이지만, 실행 순서까지 있으면 내일 할 일이 된다. */}
        <p className="mt-7 text-[15px] font-bold text-ink">실행 플랜</p>
        <ol className="mt-2 space-y-2">
          {report.steps.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-body">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-pill bg-primary text-[11px] font-bold text-primary-on">
                {i + 1}
              </span>
              <span className="break-keep">{s}</span>
            </li>
          ))}
        </ol>
      </div>
      {/* 🔻08-16 「분석 결과는 요청한 분만 볼 수 있어요」 **제거**(대표 지시).
          07-31에 "내 분석이 남한테 전시되나?" 오해 방지용으로 넣었던 줄인데, 지금 구조에선
          카드 바로 아래에 진짜 CTA(「콜라보 아이디어 추천 받기」)가 붙어서 **버튼 직전의 마지막 말이
          안심 문구**가 돼 있었다. 누르기 직전에 프라이버시 이야기를 꺼내면 없던 걱정이 생긴다.
          🔖되살릴 자리가 필요하면 여기가 아니라 **분석을 실제로 요청하는 화면**이 맞다. */}
    </div>
  );
}
