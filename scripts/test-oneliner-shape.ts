// oneLiner 문형 게이트 회귀 테스트 — 오프라인(Gemini 콜 0).
// `npx tsx scripts/test-oneliner-shape.ts`
//
// 왜 이 테스트가 있나 (2026-07-31 문형 확정):
//   oneLiner는 "~콜라보"로 끝나는 12~22자(최대 25자·공백 제외) 명사구 **헤드라인**이다.
//   프롬프트로 요청은 하지만, 형식을 보장하는 건 파서다(prompt-parser-contract).
//   모델은 압박이 오면 옛 문형(재료 4개 + "~만듭니다." 서술어 종결 설명문)으로 되돌아가는데,
//   그게 화면 최상단에 그대로 박히면 기능이 통째로 싸구려로 읽힌다.
//   탈락 시 폴백은 ideas[0].desc — 그 desc 자체가 "~하는 콜라보" 명사구라 문형이 자동으로 맞는다.
import { checkOneLiner, resolveOneLiner, ONELINER_MAX } from "../src/lib/collab-report";

const ideas = [
  {
    desc: "밑줄서점의 심야 낭독회에 모루초 스튜디오의 쌀 구움과자를 곁들여 문장과 맛을 함께 음미하는 콜라보",
  },
  { desc: "두 번째 아이디어 콜라보" },
];

// 대표가 직접 판정해 확정한 정답 세트 11개 — 이게 통과 못 하면 게이트가 잘못된 것이다.
const APPROVED = [
  "안 입던 옷으로 나의 수호 오브제를 만드는 콜라보",
  "성수 러닝 후, 테라스 와인 한 잔 콜라보",
  "진로 수다에 세계 각국 통조림을 곁들이는 콜라보",
  "진로 모임 뒤, 심야 요가로 이어지는 콜라보",
  "커피잔 아래에 헌 옷 코스터가 깔리는 콜라보",
  "내 헌 옷으로 만드는 직물 LP 커버 콜라보",
  "어제 마신 와인 코르크로 코스터를 만드는 콜라보",
  "휠체어로 떠나는 세부 호핑투어 콜라보",
  "말 못 한 이야기를 바느질로 꺼내는 콜라보",
  "세부 바닷속 영상으로 첫 숏폼을 만드는 콜라보",
  "내 손으로 나의 안정인형을 만드는 콜라보",
];

// 현재 prod에서 실제로 나온 옛 문형(재료 4개 + 서술어 종결)
const LEGACY = "버려지는 옷조각을 손으로 이어 붙이며 진로 전환기 청년들이 나만의 가치를 발견하는 시간을 만듭니다.";
// "콜라보"로는 끝나지만 상한을 넘긴 문장(ideas desc를 그대로 oneLiner에 넣은 형태)
const TOO_LONG = "콜렉트마이페이보릿의 드립커피를 내어줄 때 캔버스가든의 업사이클링 조각 코스터를 함께 제공하는 콜라보";
// 문형·길이는 맞지만 감성 추상어가 섞인 문장
const BANNED_WORD = "안 입던 옷으로 특별한 오브제를 만드는 콜라보";
const BANNED_META = "헌 옷과 드립커피의 조각 코스터 조합 콜라보";

const cases: [string, boolean, boolean][] = [
  [
    "① 대표 확정 11개 전부 통과",
    APPROVED.every((s) => checkOneLiner(s).ok),
    true,
  ],
  [
    "①-2 확정 11개 전부 공백 제외 25자 이하(길이 계산 규약 고정)",
    APPROVED.every((s) => [...s.replace(/\s+/g, "")].length <= ONELINER_MAX),
    true,
  ],
  [
    "①-3 정상 문장은 폴백 없이 원문 그대로",
    resolveOneLiner(APPROVED[0], ideas) === APPROVED[0],
    true,
  ],
  [
    "② ⭐서술어 종결(옛 문형) → 탈락",
    checkOneLiner(LEGACY).ok,
    false,
  ],
  [
    "②-2 서술어 종결 → ideas[0].desc로 폴백",
    resolveOneLiner(LEGACY, ideas) === ideas[0].desc,
    true,
  ],
  [
    "③ 25자 초과(공백 제외) → 탈락",
    checkOneLiner(TOO_LONG).ok,
    false,
  ],
  [
    "③-2 25자 초과 → ideas[0].desc로 폴백",
    resolveOneLiner(TOO_LONG, ideas) === ideas[0].desc,
    true,
  ],
  [
    "④ 감성 추상어(특별한) → 탈락 후 폴백",
    resolveOneLiner(BANNED_WORD, ideas) === ideas[0].desc,
    true,
  ],
  [
    "④-2 메타어(조합) → 탈락 후 폴백",
    resolveOneLiner(BANNED_META, ideas) === ideas[0].desc,
    true,
  ],
  [
    "④-3 대시(—) → 탈락",
    checkOneLiner("헌 옷 — 드립커피 코스터를 만드는 콜라보").ok,
    false,
  ],
  [
    "⑤ 빈 문자열 → 탈락 후 폴백",
    resolveOneLiner("", ideas) === ideas[0].desc,
    true,
  ],
  [
    "⑤-2 ideas가 비면 폴백 불가 → 원문 유지(리포트를 통째로 비우지 않는다)",
    resolveOneLiner(LEGACY, []) === LEGACY,
    true,
  ],
  [
    "⑥ 앞뒤 공백만 있는 정상 문장 → 트림 후 통과",
    resolveOneLiner(`  ${APPROVED[5]}  `, ideas) === APPROVED[5],
    true,
  ],
];

let failed = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got=${got} want=${want})`}`);
}
console.log(failed === 0 ? `\n✅ ${cases.length}건 전부 통과` : `\n❌ ${failed}건 실패`);
if (failed > 0) process.exit(1);
