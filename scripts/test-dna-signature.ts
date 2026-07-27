// signature(이 브랜드만의 것) 사실 게이트 회귀 테스트 — 오프라인(Gemini 콜 0).
// `npx tsx scripts/test-dna-signature.ts`
//
// 왜 이 테스트가 있나:
//   signature는 Pool 화이트리스트를 쓸 수 없는 **유일한 자유 서술 필드**다. 즉 "LP를 트는 카페"처럼
//   브랜드 고유성을 담는 대가로, 사실 방어선이 화이트리스트가 아니라 **원문 대조 하나뿐**이다.
//   이 게이트가 느슨해지면 signature는 곧바로 창작 허가증이 된다(리포트 전체의 신뢰가 여기 걸린다).
import { filterSignatures, SIGNATURE_MAX } from "../src/lib/dna-pool";
import type { DnaSignature } from "../src/lib/types";

const digest = `[one_liner]
LP를 직접 골라 틀어주는 동네 카페

[description]
버려지는 천에 새 이야기를 입히는 작업을 합니다.
주말에는 소품을 만드는 2시간 클래스를 엽니다.`;

const fields = ["one_liner", "description"];
const sig = (text: string, evidence: string, source = ["description"]): DnaSignature => ({
  text,
  evidence,
  source,
});

const run = (sigs: DnaSignature[]) => filterSignatures(sigs, fields, digest);

const cases: [string, boolean, boolean][] = [
  [
    "① 원문 그대로 인용 → 통과",
    run([sig("헌 옷 천을 이어 붙여 소품을 만드는 공방", "버려지는 천에 새 이야기를 입히는")]).length === 1,
    true,
  ],
  [
    "② ⭐소개서에 없는 문구를 인용(창작) → 폐기",
    run([sig("전국 최초 무인 LP 바", "국내 최초로 문을 연 무인 LP 바입니다")]).length === 0,
    true,
  ],
  [
    "③ 인용 안의 공백·줄바꿈만 다름 → 통과(정규화)",
    run([sig("LP를 골라 틀어주는 카페", "LP를  직접 골라\n틀어주는", ["one_liner"])]).length === 1,
    true,
  ],
  [
    "④ 입력에 없던 source 필드명 → 폐기",
    run([sig("소품 클래스를 여는 공방", "소품을 만드는 2시간 클래스", ["press"])]).length === 0,
    true,
  ],
  [
    "⑤ 너무 짧은 인용(아무 데나 걸림) → 폐기",
    run([sig("천을 다루는 곳", "천에")]).length === 0,
    true,
  ],
  [
    "⑤-2 ⭐두 필드에서 한 문장씩 이어 붙인 인용 → 통과(조각 전부 원문에 있음, 스톤브루 실측 케이스)",
    run([sig("직접 로스팅하는 동네 카페", "LP를 직접 골라 틀어주는 동네 카페. 주말에는 소품을 만드는 2시간 클래스를 엽니다")])
      .length === 1,
    true,
  ],
  [
    "⑤-3 ⭐진짜 인용 + 지어낸 문장 조합 → 폐기(조각 하나라도 없으면 탈락)",
    run([sig("전국 최초 LP 카페", "LP를 직접 골라 틀어주는 동네 카페. 전국에서 가장 오래된 LP 바입니다")]).length === 0,
    true,
  ],
  [
    "⑥ text 비어 있음 → 폐기",
    run([sig("", "버려지는 천에 새 이야기를 입히는")]).length === 0,
    true,
  ],
  [
    `⑦ 상한 ${SIGNATURE_MAX}개 초과 → 잘림`,
    run(Array.from({ length: 5 }, (_, i) => sig(`특징 ${i}`, "버려지는 천에 새 이야기를 입히는"))).length ===
      SIGNATURE_MAX,
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
process.exit(failed === 0 ? 0 : 1);
