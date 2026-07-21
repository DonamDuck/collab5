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
  sanitizeHttpUrl,
  sniffInstagramFromText,
  naverMapLink,
  stripDecorativeQuotes,
  tidyTypography,
  extractMapLinkFromResearch,
  searchLooksEmpty,
  isOwnerVoiceHost,
  isUsableOwnerVoice,
  CHIP_TARGET,
  sanitizeSearchText,
} from "../src/lib/enrich";
import { regionMatches, regionConflict } from "../src/lib/regionSynonyms";
import { mapLinkLabel, channelLabel } from "../src/lib/links";
import { sanitizeHandle, extractPostUrls } from "../src/lib/instagram";

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

// press 기사 URL 위생 (2026-07-19 press 링크 프리필 — 내 절반)
console.log("[press URL 위생]");
check("http(s) 통과", sanitizeHttpUrl("https://www.khan.co.kr/article/123") === "https://www.khan.co.kr/article/123");
check("빈값·undefined → undefined", sanitizeHttpUrl("") === undefined && sanitizeHttpUrl(undefined) === undefined);
check("잡값·상대경로 차단", sanitizeHttpUrl("확인 안 됨") === undefined && sanitizeHttpUrl("/article/123") === undefined);
check("javascript: 스킴 차단", sanitizeHttpUrl("javascript:alert(1)") === undefined);

// 웹 텍스트 인스타 수확 (2026-07-20 상왕제약 사례 — 홈페이지 없는 가게)
console.log("[웹 텍스트 인스타 수확]");
check(
  "블로그 본문의 @핸들 수확",
  sniffInstagramFromText("성수 상왕제약 다녀왔어요 인스타 @sangwang_espresso 확인하고 가세요").includes("@sangwang_espresso")
);
check(
  "instagram.com 링크 수확 + 링크 우선",
  sniffInstagramFromText("https://instagram.com/sangwang_espresso 참고 @otherguy")[0] === "@sangwang_espresso"
);
check(
  "서비스 경로(p·reel·explore) 제외",
  !sniffInstagramFromText("https://instagram.com/p/Cabc123 https://instagram.com/reel/xyz").length
);
check("이메일 오탐 방지: 숫자만 핸들 제외", !sniffInstagramFromText("@1234567").length);
check(
  "이미 홈페이지로 확인된 핸들은 중복 제외",
  !sniffInstagramFromText("인스타 @canga_studio 임", "@canga_studio").length
);
check("핸들 없으면 빈 배열", sniffInstagramFromText("그냥 맛있는 카페였어요").length === 0);

// 빈손 판정 (재시도 트리거)
console.log("[빈손 판정]");
check(
  "전부 '확인 안 됨' → 빈손",
  searchLooksEmpty(`[정체]\n확인 안 됨\n[제품/특징]\n확인 안 됨\n[활동]\n확인 안 됨\n[콜라보]\n확인 안 됨\n[원하는 협업]\n확인 안 됨\n[고객]\n확인 안 됨\n[알려짐]\n확인 안 됨`)
);
check("빈 문자열 → 빈손", searchLooksEmpty(""));
check(
  "알맹이 있으면 빈손 아님",
  !searchLooksEmpty(
    `[정체]\n성수동에서 에스프레소를 내리는 작은 카페. 2021년 문을 열었고 로스팅을 직접 한다.\n[제품/특징]\n시그니처는 크림이 올라간 아인슈페너, 원두는 주 2회 자가 로스팅.\n[활동]\n원데이 드립 클래스를 월 1회 운영하고 인근 편집숍과 팝업을 진행했다.\n[고객]\n20~30대 커피 애호가, 성수 나들이객이 주 고객층.`
  )
);

// 지도 링크 조립 (2026-07-20 — 네이버 좌표 기반, AI 개입 0)
console.log("[지도 링크]");
const sw = naverMapLink("<b>상왕제약 홍익점</b>", "1270332970", "375658472");
check("좌표 → 네이버 지도 링크", !!sw && sw.includes("map.naver.com/p/search/") && sw.includes("127.033297,37.565847"), String(sw));
check("<b> 태그 제거", !!sw && !sw.includes("%3Cb%3E"));
check("좌표 없으면 링크 안 만듦", naverMapLink("가게", undefined, undefined) === null);
check("한국 밖 좌표 차단", naverMapLink("가게", "1390000000", "356000000") === null);
check("상호 비면 null", naverMapLink("  ", "1270332970", "375658472") === null);
check(
  "메모에서 지도 링크 회수",
  extractMapLinkFromResearch("[지도 교차검증] ✅ 일치\n[지도 링크] https://map.naver.com/p/search/a?c=127.0,37.5,17,0,0,0,dh (⚠️홈페이지 아님)")
    === "https://map.naver.com/p/search/a?c=127.0,37.5,17,0,0,0,dh"
);
check("지도 링크 없으면 undefined", extractMapLinkFromResearch("[정체]\n확인 안 됨") === undefined);

// 지도 링크 화이트리스트 (칩 라벨 = 실제 목적지 보장)
console.log("[지도 링크 화이트리스트]");
check("naver.me 축약 → 네이버 지도", mapLinkLabel("https://naver.me/FLyT1nM4") === "네이버 지도");
check("map.naver.com → 네이버 지도", mapLinkLabel("https://map.naver.com/p/search/x") === "네이버 지도");
check("kakao 계열 → 카카오맵", mapLinkLabel("https://place.map.kakao.com/123") === "카카오맵" && mapLinkLabel("https://kko.to/abc") === "카카오맵");
check("구글 지도 단축 → 구글 지도", mapLinkLabel("https://maps.app.goo.gl/abc") === "구글 지도");
check("프로토콜 없어도 인식", mapLinkLabel("naver.me/FLyT1nM4") === "네이버 지도");
check("⛔ 사칭 도메인 거부(naver.me.evil.com)", mapLinkLabel("https://naver.me.evil.com/x") === null);
check("⛔ 무관 링크 거부", mapLinkLabel("https://evil.example.com/pretend-map") === null);
check("빈값 → null", mapLinkLabel("") === null && mapLinkLabel(undefined) === null);

// 사장님 원문(플레이스 소개 신디케이션) — 2026-07-20 대표 발견
console.log("[사장님이 직접 쓴 소개]");
check("패스오더·오붓·카카오채널 = 사장님 목소리 출처", ["app.passorder.co.kr","www.obud.co","pf.kakao.com"].every(isOwnerVoiceHost));
check("⛔ 당근·태블링 제외(요약에 후기·평점 메타가 잡힘 — 07-20 회귀 수리)", !isOwnerVoiceHost("daangn.com") && !isOwnerVoiceHost("tabling.co.kr"));
check("⛔ 디렉토리는 사장님 목소리 아님", !isOwnerVoiceHost("moneypin.biz") && !isOwnerVoiceHost("www.114.co.kr"));
const ownerMemo = `[사장님이 직접 쓴 소개 — 신뢰도 최상 · 이 브랜드의 자기 표현]
· 맛있는 에스프레소로 인정받은 에스프레소바, 이탈리아 정통 라바짜 원두, 시그니처 치즈계란빵 (app.passorder.co.kr)
→ 브랜드가 스스로 고른 표현이다.

[네이버 지역검색 — 주소·업종·전화]
· 상왕제약 홍익점 | 업종:카페,디저트>카페 | 도로명:서울 성동구 왕십리로26길 32 | 지번: | 전화: | 링크:`;
const ownerChips = extractChipsFromResearch(ownerMemo, "상왕제약 홍익점", "카페").map((c) => c.text);
check("사장님 원문 → 칩 생성", ownerChips.length > 0, JSON.stringify(ownerChips));
check("구체 사실('라바짜'·'치즈계란빵') 칩화", ownerChips.some((t) => /라바짜|치즈계란빵/.test(t)), JSON.stringify(ownerChips));
check("출처 호스트는 칩에 안 섞임", !ownerChips.some((t) => t.includes("passorder")));
// 실제 산문형 소개(상왕제약 원문) — 상호 자기지칭·후기 메타 잔해가 칩이 되면 안 된다
const proseMemo = `[사장님이 직접 쓴 소개 — 신뢰도 최상 · 이 브랜드의 자기 표현]
· 맛있는 에스프레소로 인정받은 에스프레소바 상왕제약의 두번째 공간, 카페 상왕제약. 이탈리아 정통 라바짜 원두로 내린 커피와 시그니처 치즈계란빵이 대표메뉴인 카페 상왕제약. (app.passorder.co.kr)
→ 표현이다.`;
const proseChips = extractChipsFromResearch(proseMemo, "상왕제약 홍익점", "카페").map((c) => c.text);
check("상호 자기지칭('카페 상왕제약') 칩 차단", !proseChips.some((t) => t.includes("상왕제약")), JSON.stringify(proseChips));
check("후기 메타('포테토칩·인증 22회·5.0')는 사장님 소개로 인정 안 함", (() => {
  // gather 단계 가드 시뮬 — 후기 메타 패턴이 desc에 있으면 ownerVoice로 안 뽑힘
  const reviewDesc = "후기 2개 ; 포테토칩 · 서울시 성동구 홍익동 인증 22회·25일 전 작성 · 5.0 · 커피가 항상";
  return /후기\s*\d|리뷰\s*\d|인증\s*\d+\s*회|\d+일\s*전\s*작성|평점|별점/.test(reviewDesc);
})());
check("재시도 기준 상수 노출(조정 가능)", CHIP_TARGET === 10);

// 홈페이지 후보 소스 제한 (대표 확정 2026-07-20 — 아티클 오염 차단)
console.log("[홈페이지 후보 소스 제한]");
// ⚠️combineResearch의 출처1 헤더를 반드시 포함할 것 — 헤더 설명문에 "[네이버 지역검색]" 같은
//   섹션명이 들어 있어, 헤더를 섹션으로 오인하면 본문을 통째로 놓친다(2026-07-20 실제 회귀).
const SRC1 = `[출처 1 · 네이버 검색 API — 실측 데이터라 사실성 최상. 특히 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색] 블록은 최상위 신뢰]\n`;
const hpMemo = SRC1 + `[홈페이지 직접 확인 — 신뢰도 높음]
· 홈페이지: https://canvasgarden.shop
· 인스타그램: 홈페이지 정적 HTML에서 링크 확인 안 됨(추측하지 말 것)

[네이버 지역검색 — 주소·업종·전화]
· 상왕제약 홍익점 | 업종:카페 | 도로명:서울 | 지번: | 전화: | 링크:https://인스타없는공식홈피.com

[네이버 웹문서 — 홈페이지·SNS 단서]
· 이음가게 소개 | 복지관 갤러리 | 링크:https://omni.or.kr/gallery/x
· 당근 프로필 | 후기 | 링크:https://www.daangn.com/kr/local-profile/x
· 패스오더 | 주문 | 링크:https://app.passorder.co.kr/normal/x`;
const hpLinks = extractLinksFromResearch(hpMemo);
check("직접확인 홈피가 1순위", hpLinks.homepageCandidates[0] === "https://canvasgarden.shop", JSON.stringify(hpLinks.homepageCandidates));
check("지역검색 링크(사업자 등록)는 후보 포함", hpLinks.homepageCandidates.some((u) => u.includes("인스타없는공식홈피")));
check("⛔ 웹문서 아티클(복지관·당근·패스오더)은 후보 제외", !hpLinks.homepageCandidates.some((u) => /omni\.or\.kr|daangn|passorder/.test(u)), JSON.stringify(hpLinks.homepageCandidates));
// 출처1 헤더 오인 회귀 방지 — 홈피 검증 실패(블록 없음) + 한글 도메인 케이스(상왕제약 실사례)
const noVerifiedMemo = SRC1 + `[지도 교차검증] ✅ 일치

[네이버 지역검색 — 주소·업종·전화]
· 상왕제약 홍익점 | 업종:카페 | 도로명:서울 성동구 왕십리로26길 32 | 지번: | 전화: | 링크:https://100원커피이벤트-선착순주문하기.com

[네이버 웹문서 — 홈페이지·SNS 단서]
· 이음가게 | 복지관 | 링크:https://omni.or.kr/gallery/x`;
const nv = extractLinksFromResearch(noVerifiedMemo);
check("출처1 헤더를 섹션으로 오인하지 않음(한글 도메인 홈피 생존)", nv.homepageCandidates.some((u) => u.includes("100")), JSON.stringify(nv.homepageCandidates));
check("그 경우에도 아티클은 제외", !nv.homepageCandidates.some((u) => u.includes("omni")));

// 장식 따옴표 해제 (대표 QA 2026-07-20 — 상왕제약 소개글 라벨 스팸)
console.log("[장식 따옴표]");
const quoted = `저희는 성동구 왕십리 오래된 동네의 정취를 담고 있습니다. 이곳이 "동네 사랑방"이 되기를 바랐어요. 카페로 운영하던 공간을 "동네도서관"이라 부르며 "누구에게나 열려있는 공간"으로 만들고 있습니다.`;
const stripped = stripDecorativeQuotes(quoted);
check("따옴표 2개↑ → 전부 해제", !stripped.includes('"'), stripped);
check("본문 단어는 보존", stripped.includes("동네 사랑방") && stripped.includes("동네도서관") && stripped.includes("누구에게나 열려있는 공간"));
check("따옴표 1개는 보존(실제 인용일 수 있음)", stripDecorativeQuotes('올해 "베스트 로컬상"을 받았어요.').includes('"'));
check("긴 인용(15자 초과)은 개수에서 제외 → 보존", stripDecorativeQuotes('사장님은 "오래 남을 것을 만들고 싶었다고 말합니다"고 했어요.').includes('"'));
check("따옴표 없으면 그대로", stripDecorativeQuotes("담백한 문장이에요.") === "담백한 문장이에요.");
check("빈 값 안전", stripDecorativeQuotes("") === "");

// 기계적 교정 (대표 지시 2026-07-20 — 맞춤법·띄어쓰기 기본 점검)
console.log("[기계적 교정]");
check("중복 공백 → 한 칸", tidyTypography("저희는  성수동에서   굽고 있어요.") === "저희는 성수동에서 굽고 있어요.");
check("마침표 앞 공백 제거", tidyTypography("굽고 있어요 .") === "굽고 있어요.");
check("문장부호 뒤 공백 보정", tidyTypography("굽고 있어요.매주 목요일에 열어요.") === "굽고 있어요. 매주 목요일에 열어요.");
check("괄호 안쪽 공백 정리", tidyTypography("원두( 라바짜 )를 씁니다.") === "원두(라바짜)를 씁니다.");
check("정상 문장은 안 건드림", tidyTypography("매주 목요일, 그 주의 곡물로 굽습니다.") === "매주 목요일, 그 주의 곡물로 굽습니다.");
check("소수점·숫자 보존", tidyTypography("문은 8.5시간 열려 있어요.") === "문은 8.5시간 열려 있어요.");
check("빈 값 안전", tidyTypography("") === "");
check("⛔ 도메인 안 깨짐(canvasgarden.shop)", tidyTypography("홈페이지는 canvasgarden.shop 이에요.") === "홈페이지는 canvasgarden.shop 이에요.");
check("⛔ URL 안 깨짐", tidyTypography("https://map.naver.com/p/search/x 를 보세요.") === "https://map.naver.com/p/search/x 를 보세요.");
// 맞춤법 조항이 보이스 헌법(모든 생성 경로 공유)에 실렸는지
const enrichSrc = readFileSync(join(__dirname, "../src/lib/enrich.ts"), "utf8");
check("보이스 헌법에 맞춤법·띄어쓰기 조항 존재", /맞춤법·띄어쓰기 \(출력 전 반드시 자기 점검\)/.test(enrichSrc));
check("의존명사 띄어쓰기 예시 포함", /할수\(X\)→할 수/.test(enrichSrc));

// press 매체명 창작 금지 (대표 QA 2026-07-20 — 성동매거진 사례)
// 배경: 지류 지역신문(성동매거진)은 실재하나 웹 색인이 없어 url이 비는 게 정상.
//       링크 없는 press 항목은 계속 허용하고, '매체명 창작'만 프롬프트로 차단한다.
console.log("[press 매체명 정책]");
const es = readFileSync(join(__dirname, "../src/lib/enrich.ts"), "utf8");
check("매체명 글자 그대로 옮기라는 지시 존재", /label\(매체명\)은 조사 자료의 표기를 글자 그대로/.test(es));
check("그럴싸한 이름 창작 금지 명시", /그럴싸한 이름을 지어내지 마라/.test(es));
check("모르면 항목 자체를 빼라", /매체명을 정확히 모르면 그 항목 자체를 빼라/.test(es));
check("⭐지류신문=url 없어도 정상(항목 유지) 정책 명시", /지류신문·사보처럼 웹 링크가 없는 매체도 많다/.test(es));
check("스키마 label에도 창작 금지", /비슷하게 바꾸거나 그럴싸한 이름을 만들지 마라/.test(es));

// 잘린 검색 요약 방어 (대표 QA 2026-07-20 — 두더지요가원 무의미 칩)
console.log("[잘린 스니펫 방어]");
const obud = `소개 ; "두더지 요가원"으로 하게 된 이유 1. 기억에 남는 강렬한 이름. 영어나 산스크리트어도 고민했지만, 한 번 들으면 잊히지`;
check("⛔ 오붓 잘린 스니펫 = 사장님 소개로 인정 안 함", !isUsableOwnerVoice(obud));
check("⛔ 섹션 라벨 시작 배제", !isUsableOwnerVoice("소개 ; 우리는 요가를 합니다 그리고 또 무언가를 합니다"));
check("⛔ 번호 목록 배제", !isUsableOwnerVoice("우리가 시작한 이유 1. 첫째 이유는 이것이고 둘째는 저것입니다"));
check("⛔ 연결어미로 잘린 문장 배제", !isUsableOwnerVoice("정성껏 굽는 빵을 만들며 매일 아침 문을 열고 있지만"));
check("✅ 정상 사장님 소개는 통과", isUsableOwnerVoice("이탈리아 정통 라바짜 원두로 내린 커피와 시그니처 치즈계란빵이 대표메뉴인 카페입니다."));

const obudMemo = `[사장님이 직접 쓴 소개 — 신뢰도 최상 · 이 브랜드의 자기 표현]
· ${obud} (www.obud.co)

[지도 교차검증] ✅ 네이버 지도 주소가 입력 지역(경기도 고양시 일산동구)과 일치 — 이 업체가 맞아요.

[네이버 지역검색 — 주소·업종·전화]
· 두더지요가원 | 업종:스포츠,오락>요가 | 도로명:경기 고양시 일산동구 | 지번: | 전화: | 링크:`;
const obudChips = extractChipsFromResearch(obudMemo, "두더지요가원", "요가원, 요가").map((c) => c.text);
check("무의미 칩('소개'·'고민했지만'·'잊히지') 0개", !obudChips.some((t) => /^소개$|고민했지만|잊히지|기억에 남는/.test(t)), JSON.stringify(obudChips));
check("지도 칩은 정상 유지", obudChips.includes("요가"), JSON.stringify(obudChips));
check("조각 단위 방어: 연결어미 종결 칩 배제", !extractChipsFromResearch("[출처 2 · 제미나이]\n[키워드]\n고민했지만, 좋은 원두", "가게").some((c) => c.text === "고민했지만"));

// [이용] 섹션 + 자세히 소개 6개 (대표 확정 2026-07-20 — 구글 AI 개요 참고)
console.log("[이용 섹션 · 소개 6개]");
const src2 = readFileSync(join(__dirname, "../src/lib/enrich.ts"), "utf8");
const wz2 = readFileSync(join(__dirname, "../src/app/register/EnrichWizard.tsx"), "utf8");
check("조사 소제목에 [이용/편의시설] 추가", /\[이용\/편의시설\] 그 공간을 쓰는 방식/.test(src2));
check("브랜드 성격 드러나는 것만 제약", /브랜드 성격이 드러나는 것만/.test(src2));
check("⛔ 가격·전화·영업시간 제외 명시(어제 정책 유지)", /가격·전화·영업시간은 여기 쓰지 마라/.test(src2));
check("⛔ 와이파이·정수기류 제외", /와이파이·정수기·화장실처럼/.test(src2));
check("CHIP_SECTIONS에 이용 매핑", /이용: \{ label: "이용"/.test(src2));
check("위저드 SECTION_ORDER에 '이용' 존재(미노출 방지)", /"공간", "이용"/.test(wz2));
const 이용Chips = extractChipsFromResearch("[출처 2 · 제미나이]\n[이용]\n요가 매트 대여\n반려동물 동반", "가게");
check("이용 칩 생성됨", 이용Chips.some((c) => c.section === "이용" && c.text === "요가 매트 대여"), JSON.stringify(이용Chips));
// 개수 상한이 한 군데라도 5로 남아 있으면 6번째가 조용히 잘린다
check("normalizeOptions 캡 6", /descriptions: \(o\.descriptions \?\? \[\]\)\.filter\(Boolean\)\.slice\(0, 6\)/.test(src2));
check("스키마·프롬프트에 5개 잔존 없음", !/'브랜드 소개' 후보 5개|descriptions 5개|브랜드 소개 후보 5개/.test(src2));
check("6번째 = 사실 정리형 정의 존재", /6번째 = '사실 정리형'/.test(src2));

// 제품·서비스 / 특장점 분리 + 주소 파편 차단 + 칩 뷰 한 판 (대표 확정 2026-07-20)
console.log("[특장점 분리 · 주소 파편 · 한 판 뷰]");
const src3 = readFileSync(join(__dirname, "../src/lib/enrich.ts"), "utf8");
const wz3 = readFileSync(join(__dirname, "../src/app/register/EnrichWizard.tsx"), "utf8");
check("[제품·서비스]로 분리", /\[제품·서비스\] 주력 제품·서비스의 이름·종류/.test(src3));
check("[특장점] 신설(차이만 적기)", /\[특장점\] ⭐다른 곳과 무엇이 다른가/.test(src3));
check("업종별 예시 포함(요가원·송금·카페)", /요가원이면 프로그램\(하타·빈야사·테라피\)/.test(src3));
check("CHIP_SECTIONS에 특장점", /특장점: \{ label: "특장점"/.test(src3));
check("구버전 메모 호환 유지([제품\/특징])", /"제품\/특징": \{ label: "제품"/.test(src3));

// 센트비 실사례 — 주소 파편은 전멸, 특장점만 생존
const sentbe = extractChipsFromResearch(`[출처 2 · 제미나이]
[공간]
서울 법인(본사): 서울시 영등포구 여의대로 70
원센트럴 8F
10-01
UIC Building
해외 법인(싱가포르): 5 Shenton Way
1F
[특장점]
은행 대비 낮은 수수료
싱가포르 MAS 라이선스 보유`, "센트비", "핀테크").map((c) => c.text);
check("주소 파편 전멸(10-01·1F·UIC Building·8F)", !sentbe.some((t) => /10-01|^1F$|UIC Building|8F|여의대로|Shenton/.test(t)), JSON.stringify(sentbe));
check("특장점 칩은 생존", sentbe.includes("은행 대비 낮은 수수료") && sentbe.includes("싱가포르 MAS 라이선스 보유"));
check("일반 주소 표기도 차단", !extractChipsFromResearch("[출처 2 · 제미나이]\n[공간]\n경상남도 김해시 분성로 332", "가게").length);

// 뷰 한 판 — 섹션 라벨 헤더가 칩 목록에서 사라졌는가(순서 소스로는 계속 사용)
check("칩 화면에서 섹션 라벨 헤더 제거", !/mb-1\.5 text-\[13px\] font-medium text-faint">\{SECTION_LABELS/.test(wz3));
check("SECTION_ORDER는 순서 소스로 유지", /SECTION_ORDER\.filter\(\(s\) => allChips\.some/.test(wz3));
check("SECTION_ORDER에 특장점 반영", /"제품", "특장점"/.test(wz3));

// 한국어 라벨 인스타 핸들 (대표 QA 2026-07-20 두더지요가원 — 당근 본문 "인스타그램-moleyoga")
console.log("[한국어 라벨 인스타]");
check("당근 실물: 인스타그램-moleyoga", sniffInstagramFromText("정발산동 | 요가 카카오채널로 부탁드립니다 인스타그램-moleyoga https://www.daangn.com/x").includes("@moleyoga"));
check("콜론 표기", sniffInstagramFromText("문의는 인스타 : canga_studio 로").includes("@canga_studio"));
check("공백 표기", sniffInstagramFromText("인스타그램 sangwang_espresso 에서").includes("@sangwang_espresso"));
check("영문 IG 표기", sniffInstagramFromText("IG: horak_lib 팔로우").includes("@horak_lib"));
check("⛔ 'instagram.com'이 @gram.com으로 재매칭되지 않음", !sniffInstagramFromText("https://instagram.com/canvasgarden 참고").includes("@gram.com"));
check("링크 케이스는 핸들만", JSON.stringify(sniffInstagramFromText("https://instagram.com/canvasgarden 참고")) === JSON.stringify(["@canvasgarden"]));
check("⛔ 오탐: '인스타그램 마케팅 대행사'", sniffInstagramFromText("인스타그램 마케팅 대행사입니다").length === 0);
check("⛔ 오탐: 무관 문장", sniffInstagramFromText("요가원에서 수련을 합니다").length === 0);

// 대표 URL 확장 (대표 확정 2026-07-20 — 홈페이지 없는 가게가 카톡 채널만 거는 경우)
console.log("[대표 URL — 브랜드 채널 포용]");
const SRC1b = `[출처 1 · 네이버 검색 API — 특히 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색] 블록은 최상위 신뢰]\n`;
const mkMemo = (link: string) => SRC1b + `[네이버 지역검색 — 주소·업종·전화]\n· 가게 | 업종:요가 | 도로명:서울 | 지번: | 전화: | 링크:${link}`;
const passes = (u: string) => extractLinksFromResearch(mkMemo(u)).homepageCandidates.length > 0;
check("✅ 카카오톡 채널 후보 통과", passes("http://pf.kakao.com/_rgAlX/chat"));
check("✅ 리틀리·링크트리 통과", passes("https://litt.ly/x") && passes("https://linktr.ee/x"));
check("✅ 스마트스토어·네이버블로그 통과", passes("https://smartstore.naver.com/x") && passes("https://blog.naver.com/x"));
check("✅ 진짜 홈페이지는 그대로", passes("https://canvasgarden.shop"));
check("⛔ 인스타·페북은 계속 차단(별도 칸 있음)", !passes("https://www.instagram.com/brand") && !passes("https://www.facebook.com/brand"));
check("⛔ 오픈마켓 계속 차단(브랜드 채널 아님)", !passes("https://www.coupang.com/x") && !passes("https://smartstore.11st.co.kr/x"));
check("⛔ 디렉토리 계속 차단(오귀속 방지)", !passes("https://www.114.co.kr/x") && !passes("https://moneypin.biz/x"));
check("칩 라벨: 카카오톡 채널", channelLabel("http://pf.kakao.com/_rgAlX/chat") === "카카오톡 채널");
check("칩 라벨: 리틀리·링크트리", channelLabel("https://litt.ly/x") === "리틀리" && channelLabel("https://linktr.ee/x") === "링크트리");
check("일반 도메인은 null → 도메인 표시로 폴백", channelLabel("https://canvasgarden.shop") === null);

// ── 07-21 실크롤 10곳 QA에서 나온 칩 오염 (대표 확정) ──
console.log("[07-21 칩 오염 회귀]");
const SRC1c = `[출처 1 · 네이버 검색 API — 특히 [브랜드가 직접 쓴 소개]·[지도 교차검증]·[네이버 지역검색] 블록은 최상위 신뢰]\n`;
const gemMemo = (name: string, body: string) => SRC1c + `[출처 2 · 제미나이 웹 조사]\n${body}`;
const chipTexts = (memo: string, name: string, type?: string) =>
  extractChipsFromResearch(memo, name, type).map((c) => c.text);

// 🔴1 오귀속 — 지역검색은 이웃 업체 줄도 준다(속초옥수수소금빵 ← 달달공장 booking 링크)
const neighborMemo =
  SRC1c +
  `[네이버 지역검색 — 주소·업종·전화]\n` +
  `· 속초옥수수소금빵 | 업종:카페,디저트>베이커리 | 도로명:강원 속초시 수복로187번길 1 | 지번: | 전화: | 링크:https://www.instagram.com/sokcho_cornsaltbread\n` +
  `· 달달공장 속초본점 | 업종:카페,디저트>베이커리 | 도로명:강원 속초시 동해대로 4339 | 지번: | 전화: | 링크:https://booking.naver.com/booking/6/bizes/786371`;
const neighborLinks = extractLinksFromResearch(neighborMemo, "속초옥수수소금빵");
check("⛔ 이웃 업체 링크가 대표 URL로 새지 않음", !JSON.stringify(neighborLinks.homepageCandidates).includes("786371"), JSON.stringify(neighborLinks.homepageCandidates));
check("⛔ 예약 플랫폼 호스트에서 '@booking' 인스타 후보 파생 안 됨", !neighborLinks.instagramCandidates.includes("@booking"), JSON.stringify(neighborLinks.instagramCandidates));
check("✅ 상호 일치 줄은 그대로 수집(인스타는 hp 아님 → 후보 비어도 인스타로는 잡힘)", neighborLinks.instagramCandidates.includes("@sokcho_cornsaltbread"));
check("구버전 호출(상호 미전달)도 첫 줄만", extractLinksFromResearch(neighborMemo).homepageCandidates.length <= 1);

// 🔴2/(c) 칩 0개 폴백 — 제미나이 전 섹션 "확인 안 됨"인데 지역검색 상호 완전일치가 있으면 업종 칩
const zeroMemo =
  SRC1c +
  `[네이버 지역검색 — 주소·업종·전화]\n` +
  `· 필라테스숲 서면점 | 업종:스포츠시설>필라테스 | 도로명:부산 부산진구 가야대로 779 | 지번: | 전화: | 링크:https://www.instagram.com/forest_pilates_sm\n` +
  `· 온리바레 서면점 | 업종:스포츠시설>요가 | 도로명:부산 부산진구 | 지번: | 전화: | 링크:https://example.com\n` +
  `[출처 2 · 제미나이 웹 조사]\n[정체]\n확인 안 됨\n[제품·서비스]\n확인 안 됨\n[키워드]\n확인 안 됨`;
// 사용자가 입력한 업종("필라테스")과 다른 업종 표기일 때 회복되는지가 폴백의 요점.
const zeroChips = chipTexts(zeroMemo, "필라테스숲 서면점", "운동");
check("✅ 칩 0개였던 케이스가 업종 칩으로 회복", zeroChips.includes("필라테스"), JSON.stringify(zeroChips));
check("⛔ 폴백은 이웃 업체(온리바레) 업종을 물어오지 않음", !zeroChips.includes("요가"), JSON.stringify(zeroChips));
check("⛔ 폴백에서도 최상위 뭉텅이는 제외", !zeroChips.includes("스포츠시설") && !zeroChips.includes("스포츠"));
// ⚠️한계(대표 보고 07-21): 지역검색 업종이 사용자가 친 업종과 '같은 단어'면 중복이라 제거된다.
//   즉 '필라테스숲 서면점 + 업종 필라테스'는 폴백해도 여전히 0칩 → route.ts의 업종 스타터가 받는다.
check("한계 명시: 업종이 사용자 입력과 동일하면 폴백해도 0칩", chipTexts(zeroMemo, "필라테스숲 서면점", "필라테스").length === 0);
check("→ 그 경우 업종 스타터가 화면을 채운다", starterChipsForType("필라테스").length === 5);
// 칩이 있는 정상 케이스엔 폴백이 끼어들지 않는다
const richMemo = zeroMemo.replace("[정체]\n확인 안 됨", "[정체]\n동네 사람들이 편히 오는 소규모 스튜디오");
check("⛔ 칩이 있으면 폴백 미발동(지도 ✅ 없는 업종 칩 안 붙음)", !chipTexts(richMemo, "필라테스숲 서면점").includes("필라테스"));

// (b) [알려짐] 칩 은퇴 — press blockHints로만 간다
const pressMemo = gemMemo("한담누리", `[알려짐]\n* 뉴스렙 2019년 1월 29일 기사 "제주도 게스트하우스 핫플 한담누리\n[제품·서비스]\n* 도미토리`);
check("⛔ [알려짐]은 더 이상 칩이 아님(따옴표 깨진 기사 제목 포함)", !chipTexts(pressMemo, "한담누리").some((t) => t.includes("뉴스렙")), JSON.stringify(chipTexts(pressMemo, "한담누리")));
check("✅ 같은 메모의 다른 섹션은 정상 수집", chipTexts(pressMemo, "한담누리").includes("도미토리"));

// (a) 금지·제약 문구 차단
const banMemo = gemMemo("한담누리", `[이용/편의시설]\n* 조식 제공\n* 객실 내 육류, 튀김류 조리 불가\n* 멤버십 회원만 이용 가능\n* 웨이팅 없음`);
const banChips = chipTexts(banMemo, "한담누리");
check("⛔ '~조리 불가' 차단", !banChips.some((t) => t.includes("불가")), JSON.stringify(banChips));
check("⛔ '회원만 이용 가능' 차단", !banChips.some((t) => t.includes("회원만")));
check("✅ '조식 제공'은 살아남음", banChips.includes("조식 제공"));
check("✅ 오탐 방지: '웨이팅 없음'은 장점이라 통과", banChips.includes("웨이팅 없음"), JSON.stringify(banChips));

// '등' 꼬리 (짧은 줄이 통째로 들어오는 경로)
const etcMemo = gemMemo("어페어커피", `[제품·서비스]\n* 아메리카노 등\n* 까눌레 등`);
check("⛔ '등' 꼬리 제거", chipTexts(etcMemo, "어페어커피").includes("아메리카노") && !chipTexts(etcMemo, "어페어커피").some((t) => t.endsWith(" 등")), JSON.stringify(chipTexts(etcMemo, "어페어커피")));

// 날짜 단독 조각 (노아동물병원 [콜라보])
const dateMemo = gemMemo("노아", `[콜라보]\n* 2024년 8월 16일, 우치공원관리사무소와 업무협약을 체결했다.`);
check("⛔ 날짜만 남은 조각 차단", !chipTexts(dateMemo, "24시 노아동물메디컬센터").includes("2024년 8월 16일"), JSON.stringify(chipTexts(dateMemo, "24시 노아동물메디컬센터")));

// 브랜드 토큰 주어 문장 (아뜰리에호수)
const subjMemo = gemMemo("아뜰리에호수", `[정체]\n아뜰리에호수는 커플링, 우정링 등 세상에 단 하나뿐인 반지를 직접 제작할 수 있는 공방이다.`);
const subjChips = chipTexts(subjMemo, "아뜰리에호수 전주한옥마을");
check("⛔ 브랜드 토큰+조사로 시작하는 잘린 조각 차단", !subjChips.some((t) => t.startsWith("아뜰리에호수는")), JSON.stringify(subjChips));

// 따옴표 짝 (알려짐 밖의 섹션에서도 방어)
const quoteMemo = gemMemo("너의 작업실", `[활동]\n* "북토크\n* 독서 모임`);
check("✅ 짝 안 맞는 따옴표는 벗겨서 살림", chipTexts(quoteMemo, "너의 작업실").includes("북토크"), JSON.stringify(chipTexts(quoteMemo, "너의 작업실")));

// 검색 응답 폭주(degeneration) 방어 — 07-21 필라테스숲 서면점
console.log("[검색 응답 폭주 방어]");
const junk = ` {"answer":"The current time in Seoul, South Korea is 12:48:38 on Tuesday, July 23, 2024."}`;
const runaway = `**[정체]** 확인 안 됨\n**[키워드]** 확인 안 됨\n` + Array(1300).fill(junk).join("\n");
const cleaned = sanitizeSearchText(runaway, "flash", "테스트");
check("✅ 반복 폭주 절단", cleaned.length < 500, `${runaway.length}자 → ${cleaned.length}자`);
check("✅ 폭주 앞의 정상 내용은 보존", cleaned.includes("**[정체]** 확인 안 됨"));
check("⛔ 절단 후 쓰레기 칩이 안 나옴", !extractChipsFromResearch(`[출처 2]\n${cleaned}`, "필라테스숲 서면점", "필라테스").some((c) => /July|2024\.\}/.test(c.text)));
check("✅ 정상 메모는 손대지 않음", sanitizeSearchText("[정체]\n동네 스튜디오\n[키워드]\n필라테스, 소도구") === "[정체]\n동네 스튜디오\n[키워드]\n필라테스, 소도구");
check("✅ 빈 줄 반복은 폭주가 아님", sanitizeSearchText("가\n\n\n\n나").includes("나"));
check("✅ 하드 상한(24,000자)", sanitizeSearchText("가".repeat(30_000)).length <= 24_000);

// 인스타 딥리드 헬퍼 — 07-21 로직 업그레이드 ① (캔앤코르크 실측 기반)
console.log("[인스타 딥리드 헬퍼]");
check("✅ 핸들 정규화(@ 제거)", sanitizeHandle("@can.n.cork") === "can.n.cork");
check("✅ 핸들 밑줄·숫자 허용", sanitizeHandle("cafe_2go") === "cafe_2go");
check("⛔ 경로 주입 차단(슬래시)", sanitizeHandle("a/../../etc") === undefined);
check("⛔ 한글·공백 핸들 거부", sanitizeHandle("캔앤코르크") === undefined && sanitizeHandle("a b") === undefined);
check("⛔ 빈 핸들 거부", sanitizeHandle("") === undefined && sanitizeHandle(undefined) === undefined);
const igMemo = `조사: https://www.instagram.com/can.n.cork/p/Da9yjh0PDvB/ 그리고 https://instagram.com/p/DWOtTtYj03L 및 릴스 https://www.instagram.com/can.n.cork/reel/Xy12345678a/`;
const postUrls = extractPostUrls(igMemo);
check("✅ 메모에서 포스트 shortcode 수확(계정경로·reel 포함)", postUrls.length === 3, JSON.stringify(postUrls));
check("✅ 정식 URL로 재조립(임의 URL 페치 방지)", postUrls.every((u) => /^https:\/\/www\.instagram\.com\/p\/[A-Za-z0-9_-]+\/$/.test(u)), JSON.stringify(postUrls));
check("✅ 중복 shortcode 제거", extractPostUrls(`${igMemo}\n${igMemo}`).length === 3);
check("✅ 상한 5개", extractPostUrls(Array.from({ length: 9 }, (_, i) => `https://instagram.com/p/AbCdEf${i}gHi/`).join(" ")).length === 5);
check("✅ 포스트 URL 없으면 빈 배열", extractPostUrls("인스타 @can.n.cork 만 언급") .length === 0);

console.log(`\n결과: ${pass} pass / ${fail} fail`);
process.exit(fail ? 1 : 0);
