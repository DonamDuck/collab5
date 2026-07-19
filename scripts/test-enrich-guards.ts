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

// ── 네이버+제미나이 칩 조합 (대표 지시 2026-07-19) ──
console.log("[네이버 칩 — 지도확인·후기흔적]");
const naverMemo = `[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(양주 광사동)과 일치 — 이 업체가 맞아요. 주소·업종은 신뢰.

[네이버 지역검색 — 주소·업종·전화]
· 피망당구클럽 | 업종:스포츠,오락>당구장 | 도로명:경기도 양주시 고읍남로 6-14 | 지번:경기도 양주시 광사동 651-5 | 전화: | 링크:
· 옆집당구장 | 업종:스포츠,오락>당구장 | 도로명:다른 주소 | 지번: | 전화: | 링크:

[네이버 블로그 — 소비자 후기·분위기 단서]
· 피망당구클럽 방문 후기 | 대형 당구장 피망당구클럽, 사장님이 친절해요. 동호회 모임도 열리고 심야까지 영업해요. 주차공간이 없어서 아쉽지만`;
const nChips = extractChipsFromResearch(naverMemo, "피망당구클럽", "당구장");
const nTexts = nChips.map((c) => `${c.section}:${c.text}`);
check("지도✅ → 업종 카테고리 칩(스포츠·오락)", nChips.some((c) => c.section === "지도확인" && c.text === "스포츠"), JSON.stringify(nTexts));
check("사용자 입력 업종('당구장')은 칩 제외", !nChips.some((c) => c.text === "당구장"));
check("브랜드명 없는 이웃 업체 행 무시(중복 카테고리만)", nChips.filter((c) => c.section === "지도확인").length <= 2);
check("후기 칩 은퇴(대표 지시 07-19): 블로그에 결 표현 있어도 후기흔적 칩 0", !nChips.some((c) => c.section === "후기흔적"), JSON.stringify(nTexts));

const noMapMemo = naverMemo.replace("[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(양주 광사동)과 일치 — 이 업체가 맞아요. 주소·업종은 신뢰.", "");
check("지도✅ 없으면 카테고리 칩 없음(오귀속 방지)", !extractChipsFromResearch(noMapMemo, "피망당구클럽", "당구장").some((c) => c.section === "지도확인"));

// 최상위 umbrella 제외 — 네이버 API "음식점>카페,디저트"에서 '음식점'은 브랜드 설명 못 함(레이지오터 사건)
const cafeMemo = `[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(서울 은평구 대조동)과 일치 — 이 업체가 맞아요. 주소·업종은 신뢰.

[네이버 지역검색 — 주소·업종·전화]
· 레이지오터 | 업종:음식점>카페,디저트 | 도로명:서울특별시 은평구 통일로71길 2 | 지번: | 전화: | 링크:`;
const cafeChips = extractChipsFromResearch(cafeMemo, "레이지오터", "카페, LP 카페");
const cafeMap = cafeChips.filter((c) => c.section === "지도확인").map((c) => c.text);
check("'음식점' 최상위 umbrella 제외", !cafeMap.includes("음식점"), JSON.stringify(cafeMap));
check("'카페'·'디저트' 리프는 유지", cafeMap.includes("카페") && cafeMap.includes("디저트"), JSON.stringify(cafeMap));
check("당구장 회귀: '스포츠'·'오락'은 그대로(umbrella 아님)", nChips.some((c) => c.text === "스포츠") && nChips.some((c) => c.text === "오락"));

console.log("[겹침 통일 — 뿌리 1 + 긍정 수식형 1 (대표 정책 07-19)]");
const dupMemo = `[출처 2 · 제미나이]
[키워드]
동호회, 당구 강습

[제품/특징]
동호회 모임`;
const dChips = extractChipsFromResearch(dupMemo, "가게");
const dongho = dChips.filter((c) => c.text.replace(/\s/g, "").includes("동호회"));
check("'동호회'(뿌리) + '동호회 모임'(수식형) → 둘 다 생존", dongho.length === 2, JSON.stringify(dChips.map((c) => c.text)));

// 뿌리 + 수식형 여러 개 → 뿌리 1 + 가장 긍정적인 수식형 1
const famMemo = `[출처 2 · 제미나이]
[키워드]
감자탕, 맛있는 감자탕, 얼큰 감자탕`;
const fChips = extractChipsFromResearch(famMemo, "가게", "국밥").map((c) => c.text);
check("뿌리 '감자탕' 생존", fChips.includes("감자탕"), JSON.stringify(fChips));
check("긍정 수식형 '맛있는 감자탕'만 생존('얼큰' 탈락)", fChips.includes("맛있는 감자탕") && !fChips.includes("얼큰 감자탕"));
// 사용자가 업종으로 뿌리를 입력한 경우 → 뿌리 칩은 입력 중복으로 빠지고, 수식형 긍정 1개만
const fChips2 = extractChipsFromResearch(famMemo, "가게", "감자탕").map((c) => c.text);
check("입력 업종=뿌리: 수식형 중 긍정 1개만", fChips2.filter((t) => t.includes("감자탕")).length === 1 && fChips2.includes("맛있는 감자탕"), JSON.stringify(fChips2));
// 카페+LP 카페 → 둘 다 / 디저트+LP 카페(문자열 무관) → 둘 다
const cafeFam = extractChipsFromResearch(`[출처 2 · 제미나이]\n[키워드]\n카페, LP 카페`, "가게", "식당").map((c) => c.text);
check("'카페'+'LP 카페' → 둘 다 생존", cafeFam.includes("카페") && cafeFam.includes("LP 카페"), JSON.stringify(cafeFam));
const dizFam = extractChipsFromResearch(`[출처 2 · 제미나이]\n[키워드]\n디저트, LP 카페`, "가게", "식당").map((c) => c.text);
check("'디저트'+'LP 카페' → 포함관계 아님, 둘 다", dizFam.includes("디저트") && dizFam.includes("LP 카페"));
const wizardSrc2 = readFileSync(join(__dirname, "../src/app/register/EnrichWizard.tsx"), "utf8");
check("위저드에 지도확인 등록 + 후기흔적 은퇴", wizardSrc2.includes('"지도확인"') && !wizardSrc2.includes('"후기흔적"'));

// ── 거래·운영 정보 제외 (대표 지시 2026-07-19 — 장모님해장국) ──
console.log("[거래·운영 정보 제외]");
const jangmoMemo = `[출처 2 · 제미나이]
[제품/특징]
설렁탕 11,000원
수육 40,000원
김치전 15,000원
부드러운 우거지
사장님이 직접 담근 배추김치
섞박지

[숫자]
운영 연차 30년 이상
전화번호 02-379-4294
영업시간 매일 06 00 - 21 00
메뉴 가격 (2023년 뽈레 기준) 해장국 11,000원
우거지탕 11,000원
간천엽 15,000원`;
const jChips = extractChipsFromResearch(jangmoMemo, "장모님해장국", "국밥, 해장국");
const jTexts = jChips.map((c) => c.text);
check("메뉴 가격 제외: '설렁탕 11,000원' 없음", !jTexts.some((t) => /원/.test(t)), JSON.stringify(jTexts));
check("메뉴 가격 제외: '해장국 11,000원'·'간천엽 15,000원' 없음", !jTexts.some((t) => /11,000원|15,000원|40,000원/.test(t)));
check("전화번호 제외: '전화번호 02-379-4294' 없음", !jTexts.some((t) => /02-379-4294|전화/.test(t)), JSON.stringify(jTexts));
check("영업시간 제외: '영업시간 매일 06 00 - 21 00' 없음", !jTexts.some((t) => /영업\s*시간|06 00/.test(t)));
check("숫자 칩 전면 제외(대표 07-19): '운영 연차 30년 이상' 없음", !jTexts.includes("운영 연차 30년 이상"), JSON.stringify(jTexts));
check("★유지: '사장님이 직접 담근 배추김치'(브랜드 성격)", jTexts.includes("사장님이 직접 담근 배추김치"));
check("★유지: '부드러운 우거지'·'섞박지'(맛 결)", jTexts.includes("부드러운 우거지") && jTexts.includes("섞박지"));
// 숫자 섹션은 칩 소스에서 완전 제외(CHIP_SECTIONS서 삭제 — 온라인 수치 신뢰불가, 고객 직접입력)
const numMemo = `[출처 2 · 제미나이]\n[숫자]\n인스타 팔로워 1.5만\n누적 방문객 5만 명\n제품/굿즈 종류 수 감자빵 외 다양한 굿즈 판매`;
check("[숫자] 섹션 칩 0(비숫자 잡문 포함 전부 소멸)", extractChipsFromResearch(numMemo, "가게").length === 0);

// ── 감자탕 케이스 (대표 QA 2026-07-19 — 푸짐한감자탕) ──
console.log("[감자탕 — 요리 umbrella·탕류 스타터·후기 노이즈]");
const gamjaMemo = `[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(서울 종로구 평창동)과 일치 — 이 업체가 맞아요. 주소·업종은 신뢰.

[네이버 지역검색 — 주소·업종·전화]
· 푸짐한감자탕 | 업종:한식>감자탕 | 도로명:서울특별시 종로구 평창문화로 19 | 지번: | 전화: | 링크:

[네이버 블로그 — 소비자 후기·분위기 단서]
· 감자탕 솔직 후기 | 푸짐한감자탕 24시간 영업이라 심야에 배달 시켜먹기 좋아요. 성수동에서 팝업 투어나 데이트하기 전에 딴 데서 든든하게`;
const gChips = extractChipsFromResearch(gamjaMemo, "푸짐한감자탕", "감자탕");
const gMap = gChips.filter((c) => c.section === "지도확인").map((c) => c.text);
const gTex = gChips.filter((c) => c.section === "후기흔적").map((c) => c.text);
check("요리 umbrella '한식' 제외", !gMap.includes("한식"), JSON.stringify(gMap));
check("입력 업종 '감자탕' 제외 → 지도확인 비거나 리프만", !gMap.includes("감자탕"));
check("후기 칩 전면 은퇴: 블로그 줄에서 어떤 칩도 안 만듦", gTex.length === 0, JSON.stringify(gTex));
check("탕류 스타터: 감자탕 → 식당 스타터(단체석)", starterChipsForType("감자탕").some((c) => c.text === "단체석"), JSON.stringify(starterChipsForType("감자탕").map((c) => c.text)));
check("탕류 스타터: 해장국·설렁탕도 식당", starterChipsForType("해장국").some((c) => c.text === "포장 가능") && starterChipsForType("설렁탕집").some((c) => c.text === "단체석"));
check("오탐 방지: 목욕탕은 식당 스타터 아님", !starterChipsForType("목욕탕").some((c) => c.text === "단체석"));
check("표적검색 텍스트도 칩 소스 아님", !extractChipsFromResearch(
  `[네이버 표적검색 — 콜라보·팝업·워크숍 흔적]\n· (팝업) 브랜드 성수동 역대급 웨이팅 팝업`, "브랜드", "카페"
).some((c) => c.section === "후기흔적"));

// 고아 조사 조각 배제 (레이지오터 라이브서 발견 — "운영 연차 으로 운영 중")
console.log("[고아 조사 조각]");
const orphanChips = extractChipsFromResearch(`[출처 2 · 제미나이]\n[정체]\n동네 사랑방 으로 운영 중\n오래된 단골 가게`, "가게");
check("고아 조사('~ 으로 운영 중') 배제", !orphanChips.some((c) => c.text.includes("으로")), JSON.stringify(orphanChips.map((c) => c.text)));
check("정상 칩('오래된 단골 가게')은 유지", orphanChips.some((c) => c.text === "오래된 단골 가게"));

// 프롬프트 잔향(echo) 배제 (lite 병합 QA에서 발견 — 콜렉트마이페이보릿)
console.log("[프롬프트 잔향 배제]");
const echoChips = extractChipsFromResearch(
  `[출처 2 · 제미나이]\n[콜라보]\n다른 브랜드\n[숫자]\n펀딩 달성액\n인스타그램 팔로워 수\n[활동]\n워크숍\n가죽지갑 원데이 클래스 운영`,
  "가게"
).map((c) => c.text);
check("잔향 단독('다른 브랜드'·'펀딩 달성액'·'워크숍') 배제", !echoChips.some((t) => ["다른 브랜드", "펀딩 달성액", "인스타그램 팔로워 수", "워크숍"].includes(t)), JSON.stringify(echoChips));
check("구체 활동('가죽지갑 원데이 클래스 운영')은 유지", echoChips.includes("가죽지갑 원데이 클래스 운영"));

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
