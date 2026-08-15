// 샘플 콜라보 리포트 1회 생성 — 무소개서 유저 티저용 고정본(src/lib/sample-report.json).
// 실행: set -a; source .env.local; set +a; npx tsx scripts/generate-sample-report.ts
//   (GEMINI_API_KEY 필수. SUPABASE 키 없으면 InMemory 시드의 데모 브랜드로 생성 — prod 데모의 동결 복제 내용과 동일 계열)
// 레드팀 Gate3-C2: 데모 쌍이 thin 가드에 걸리면 폴백 쌍으로 자동 전환.
// 리포트 양식·프롬프트·poolVersion급 변경 시 재실행해 덮어쓸 것(스펙 §4-④).
//
// 🚨 2026-08-01 — **지금 커밋된 sample-report.json은 이 스크립트가 만든 게 아니다.**
//    prod `collab_reports`의 실제 행(캔버스가든 × 호락호락도서관, 실제 등록 브랜드 쌍)을 그대로 옮겨 담았다.
//    ↳ 08-15 갱신: **id=65**(08-15 13:38 생성)로 교체. 08-14 프롬프트 사고 수정
//      (예시 어휘 가상화 + 「쓰임을 다한 ~」 문형 확정) 이후에 뽑은 첫 리포트라, 옛 샘플(id=37)에 있던
//      어색한 대체어가 사라지고 아이디어도 2 → 4장으로 늘었다. 옛 id=37 행은 08-14 정리 때 삭제됐다.
//    대표가 "실물로 보여주자"고 확정(홈 미리보기 2구간 = SampleReportPeek·SampleReportLink).
//    ⛔ 그러니 이 스크립트를 **생각 없이 재실행하면 실제 쌍이 데모 가상 쌍으로 되돌아간다.**
//    재실행 전에 반드시 (1) 실제 쌍을 계속 쓸지 대표에게 확인하고, (2) 쓸 거라면 이 스크립트 대신
//    해당 report 행을 다시 떠오는 쪽을 택한다. 가상 쌍으로 돌아갈 때는 SampleReport.tsx의
//    식별 캡션("실제 소개서로 만든 분석 예시예요")도 함께 되돌려야 문구가 거짓이 되지 않는다.
import { writeFileSync } from "node:fs";
import { repo } from "../src/lib/repo";
import { generateDna, generateReport, isThin } from "../src/lib/collab-report";
import { distinctTypeCount } from "../src/lib/dna-pool";
import type { BrandDna, Maker } from "../src/lib/types";

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY가 필요해요 (mock 샘플을 커밋하지 않기 위해 실키 필수).");
  process.exit(1);
}

// 우선순위 쌍: 데모 쌍 → 캔버스가든(리치 시드) 폴백
const PAIR_CANDIDATES: [string, string][] = [
  ["m-demo-photo", "m-demo-none"],
  ["canvasgarden", "m-demo-photo"],
  ["canvasgarden", "hidanglib"],
];

async function main() {
  const dnaCache = new Map<string, { m: Maker; dna: BrandDna }>();
  const load = async (slug: string) => {
    if (dnaCache.has(slug)) return dnaCache.get(slug)!;
    const m = await repo.getMakerBySlug(slug);
    if (!m) throw new Error(`브랜드 없음: ${slug}`);
    const t0 = Date.now();
    const dna = await generateDna(m);
    const entry = { m, dna };
    dnaCache.set(slug, entry);
    console.log(
      `· DNA ${slug}(${m.name}): items ${dna.items.length} / distinct types ${distinctTypeCount(dna.items)} / thin=${isThin(dna)} (${Date.now() - t0}ms)`
    );
    return entry;
  };

  for (const [fromSlug, toSlug] of PAIR_CANDIDATES) {
    console.log(`\n=== 쌍 시도: ${fromSlug} → ${toSlug} ===`);
    const [a, b] = [await load(fromSlug), await load(toSlug)];
    if (isThin(a.dna) || isThin(b.dna)) {
      console.log("  ↳ thin 가드 미통과 — 다음 쌍으로");
      continue;
    }
    const t0 = Date.now();
    const { report, candidates } = await generateReport(a.m, a.dna, b.m, b.dna);
    console.log(`  ↳ 리포트 콜 ${Date.now() - t0}ms / 후보 ${candidates?.length ?? 0}개`);
    if (!report) {
      console.log("  ↳ no_match — 다음 쌍으로");
      continue;
    }
    const out = { fromName: a.m.name, toName: b.m.name, report };
    writeFileSync("src/lib/sample-report.json", JSON.stringify(out, null, 2) + "\n", "utf8");
    console.log(`\n✅ 샘플 저장: ${a.m.name} × ${b.m.name}`);
    console.log(JSON.stringify(report, null, 2));
    return;
  }
  console.error("❌ 모든 후보 쌍이 thin/no_match — 시드 보강 필요");
  process.exit(1);
}

main().catch((e) => {
  console.error("❌ 실패:", e);
  process.exit(1);
});
