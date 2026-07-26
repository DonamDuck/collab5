// DNA stale 판정 회귀 테스트 — 오프라인(Gemini 콜 0). `npx tsx scripts/test-dna-stale.ts`
//
// 왜 이 테스트가 있나 (2026-07-26 실장애):
//   stale 판정이 "brands.updated_at > dna.updated_at"이던 시절, setBrandDna의 update가
//   brands의 updated_at 트리거를 발화시켜 **모든 DNA가 영구 stale**이 됐다.
//   → 매 요청 DNA 2콜 재생성 → dna.updated_at이 항상 now → 리포트 캐시도 영구 미스
//   → 같은 쌍인데 리포트 행이 계속 새로 쌓임(13번 다음 14번) + 생성 30~60초.
//   지금은 시각이 아니라 **소개서 내용 지문(input_hash)**으로 판정한다. ⑥이 그 회귀 가드다.
import { digestHash, isDnaStale } from "../src/lib/collab-report";
import type { BrandDna, Maker } from "../src/lib/types";

const brand = {
  id: 1, slug: "t", name: "테스트", oneLiner: "한 줄 소개",
  keywords: ["수제"], offers: ["팝업"], seeks: [], targetAudience: [],
  activities: [], collabHistory: [], showcases: [], story: "브랜드 이야기",
  updatedAt: "2026-07-26T00:00:00.000Z",
} as unknown as Maker;

/** generateDna가 저장하는 것과 동일한 지문 — 재구현하지 않고 실제 함수를 그대로 쓴다(로직 이탈 방지) */
const hashOf = (m: Maker) => digestHash(m);

const dna = (input_hash: string | undefined, updated = "2026-07-26T10:00:00.000Z"): BrandDna =>
  ({ summary: "s", items: [], input_fields: [], input_hash, created_at: updated, updated_at: updated });

const fresh = dna(hashOf(brand));
const bumped = { ...brand, updatedAt: "2026-07-26T09:00:00.000Z" } as Maker; // 트리거로 시각만 밀림
const edited = { ...brand, oneLiner: "소개서를 실제로 고쳤다" } as Maker;
// 공백만 달라진 수정 — 뒤 공백·이중 공백·줄바꿈 추가 (내용은 동일)
const spacey = { ...brand, oneLiner: "한 줄  소개 \n", story: "브랜드 이야기  " } as Maker;

const cases: [string, boolean, boolean][] = [
  ["① DNA 없음 → stale", isDnaStale(null, brand), true],
  ["② 지문 불일치 → stale", isDnaStale(dna("deadbeefdeadbeef"), brand), true],
  ["③ 지문 없는 구버전 → stale(1회 재생성 후 안정화)", isDnaStale(dna(undefined), brand), true],
  ["④ Pool 대개정 이전 생성분 → stale", isDnaStale(dna(hashOf(brand), "2026-07-01T00:00:00.000Z"), brand), true],
  ["⑤ 내용 동일 → not stale", isDnaStale(fresh, brand), false],
  ["⑥ ⭐트리거로 brands.updated_at만 밀림 → not stale", isDnaStale(fresh, bumped), false],
  ["⑦ 소개서 실제 수정 → stale", isDnaStale(fresh, edited), true],
  ["⑧ 공백·줄바꿈만 변경 → not stale(정규화)", isDnaStale(fresh, spacey), false],
];

let failed = 0;
for (const [name, got, want] of cases) {
  const ok = got === want;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : `  (got=${got} want=${want})`}`);
}
console.log(failed === 0 ? `\n✅ ${cases.length}건 전부 통과` : `\n❌ ${failed}건 실패`);
process.exit(failed === 0 ? 0 : 1);
