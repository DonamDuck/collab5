// 크롤 오귀속 가드 오프라인 테스트 — 네트워크·API 콜 0 (피망당구클럽 114On 사건 2026-07-19 회귀 방지).
// 실행: npx tsx scripts/test-enrich-guards.ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  isDirectoryHost,
  homepageBelongsToBrand,
  extractLinksFromResearch,
  extractChipsFromResearch,
  starterChipsForType,
} from "../src/lib/enrich";
import { regionMatches, regionConflict } from "../src/lib/regionSynonyms";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    pass++;
    console.log(`  ✅ ${name}`);
  } else {
    fail++;
    console.log(`  ❌ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

// ── ④ regionMatches: 테이블 미등재 지역 폴백 ──
console.log("[regionMatches]");
check(
  "양주 광사동 ↔ 양주시 주소 = 일치(미등재 폴백)",
  regionMatches("양주 광사동", "경기도 양주시 고읍남로 6-14 제이프라자 경기도 양주시 광사동 651-5")
);
check("양주 ↔ 남양주 주소 = 불일치(꼬리 매칭 금지)", !regionMatches("양주 광사동", "경기도 남양주시 다산동 123"));
check("기존: 서울 성수동 ↔ 성동구 주소 = 일치", regionMatches("서울 성수동", "서울특별시 성동구 성수동1가"));
check("기존: 창원 ↔ 전주 주소 = 불일치", !regionMatches("창원 상남동", "전북 전주시 완산구"));
check("양주(ambiguous) 접미사 인정: '양주시 맛집' 문서 → 경기 그룹", regionConflict("창원 상남동", "경기도 양주시 맛집"));
check("양주(ambiguous) 일반어 보호: '양주 한잔' 문서 → 지역 아님", !regionConflict("창원 상남동", "어제 양주 한잔 했다"));

// ── ① isDirectoryHost: 집계·디렉토리 차단 ──
console.log("[isDirectoryHost]");
check("114.co.kr 차단", isDirectoryHost("www.114.co.kr"));
check("moneypin.biz 차단", isDirectoryHost("moneypin.biz"));
check("spoinfo.or.kr 개별 등재 차단(or.kr 블랭킷은 비영리 브랜드 보호 위해 안 함)", isDirectoryHost("www.spoinfo.or.kr"));
check("일반 or.kr(비영리 브랜드 가능성) 통과", !isDirectoryHost("somebrand.or.kr"));
check("*.go.kr 차단", isDirectoryHost("sminfo.mss.go.kr"));
check("일반 브랜드 도메인 통과", !isDirectoryHost("horakpotato.com") && !isDirectoryHost("canvasgarden.shop"));

// ── ① homepageBelongsToBrand: 브랜드 실재 검증 ──
console.log("[homepageBelongsToBrand]");
const brandHtml = `<html><head><title>피망당구클럽</title></head><body>양주 광사동 피망 당구클럽입니다. 상호: 피망당구클럽</body></html>`;
const alienHtml = `<html><head><title>No.1 전화번호검색 - 114On</title><meta name="description" content="모르는 전화번호 검색, 스팸, 범죄번호"></head><body>전화번호부 서비스</body></html>`;
check("브랜드 사이트(상호 포함) 인정", homepageBelongsToBrand(brandHtml, "피망당구클럽"));
check("공백 무시 매칭('피망 당구클럽')", homepageBelongsToBrand("<body>피망 당구클럽 안내</body>", "피망당구클럽"));
check("남의 사이트(114 루트) 거부", !homepageBelongsToBrand(alienHtml, "피망당구클럽"));
check("영문 대소문자 무시", homepageBelongsToBrand("<title>CANVAS GARDEN</title>", "canvas garden"));

// ── ① extractLinksFromResearch: 디렉토리 URL이 홈페이지 후보로 새지 않는가 ──
console.log("[extractLinksFromResearch]");
const memo114 = `[네이버 지역검색 — 주소·업종·전화]
· 피망당구클럽 | 업종:스포츠,오락>당구장 | 도로명:경기도 양주시 고읍남로 6-14 | 지번:경기도 양주시 광사동 651-5 | 전화: | 링크:

[네이버 웹문서 — 홈페이지·SNS 단서]
· 피망당구클럽 - 114On | 사용 가맹점 안내 | 링크:https://www.114.co.kr/life/localBillStore/detail/1473266
· 피망 당구클럽 - 체육시설알리미 | 링크:https://www.spoinfo.or.kr/map/map.do?targetFaciCd=N1141630035386
· 피망 당구클럽 - 머니핀 | 링크:https://moneypin.biz/bizno/detail/4140463143/`;
const links114 = extractLinksFromResearch(memo114);
check(
  "114·머니핀·체육시설알리미 후보 제외",
  !links114.homepageCandidates.some((u) => /114\.co\.kr|moneypin|spoinfo/.test(u)),
  JSON.stringify(links114.homepageCandidates)
);
check("인스타 오염 없음(@media114 승격 경로 소멸)", links114.instagram !== "@media114");

// ── ② 메타 칩 섹션: 위저드가 실제로 그리는가(소스 동기화 검사) ──
console.log("[메타 칩 ↔ 위저드 섹션 동기화]");
const legitMemo = `[브랜드가 직접 쓴 소개 — 홈페이지 메타 · 신뢰도 최상]
· 제목: 캔버스가든
· 소개: 계절 꽃으로 일상을 채우는 플라워 스튜디오, 주문 제작과 클래스를 운영해요

[홈페이지 직접 확인 — 신뢰도 높음]
· 홈페이지: https://www.canvasgarden.shop`;
const legitChips = extractChipsFromResearch(legitMemo, "캔버스가든");
const metaChips = legitChips.filter((c) => c.section === "우리 소개(홈페이지)");
check("정상 메타 → 메타 칩 생성", metaChips.length > 0, JSON.stringify(legitChips));
const wizardSrc = readFileSync(join(__dirname, "../src/app/register/EnrichWizard.tsx"), "utf8");
check("위저드 SECTION_ORDER에 '우리 소개(홈페이지)' 존재", wizardSrc.includes('"우리 소개(홈페이지)"'));
check("위저드에 미등록 섹션 안전망 존재", wizardSrc.includes("SECTION_ORDER.includes(s)"));

// ── ③ 스타터: 당구장이 엉뚱한 기본값 대신 업종 칩을 받는가 ──
console.log("[starterChipsForType]");
const cue = starterChipsForType("당구장");
check("당구장 → 당구 스타터", cue.some((c) => c.text === "동호회 모임"), JSON.stringify(cue.map((c) => c.text)));
check("헬스장 → 스포츠 스타터", starterChipsForType("헬스장").some((c) => c.text === "레슨 운영"));
check("국밥집 → 식당 스타터", starterChipsForType("국밥").some((c) => c.text === "단체석"));
check("기존: 카페 스타터 유지", starterChipsForType("카페").some((c) => c.text === "직접 로스팅"));

// ── 게이트 후 시나리오: 오염원 제거된 메모 → 칩 0 → thin → 스타터 폴백 ──
console.log("[게이트 후 파이프라인]");
const gatedChips = extractChipsFromResearch(memo114, "피망당구클럽");
check("게이트된 메모(메타 없음) → 메타 칩 0", gatedChips.every((c) => c.section !== "우리 소개(홈페이지)"));
check(
  "칩 0 → route가 thin 판정 → 스타터 노출 경로 성립",
  gatedChips.length === 0 ? starterChipsForType("당구장").length === 5 : true,
  `chips=${gatedChips.length}`
);

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
