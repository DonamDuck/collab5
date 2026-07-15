// 홈페이지 딥리드 오프라인 유닛테스트 — 네트워크 없이 추출 로직 검증.
// 실행: npx tsx scripts/test-homepage.ts
// 라이브: npx tsx scripts/test-homepage.ts --live https://horakpotato.com/
import {
  harvestLinks,
  extractMainText,
  extractMetaFallback,
  parseRobotsDisallow,
  decodeHtml,
  fetchHomepageDigest,
} from "../src/lib/homepage";

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

// ── 픽스처 1: 아임웹풍 정상 HTML (nav + 본문) ──
const IMWEB = `<!doctype html><html><head><title>호락호락감자</title></head><body>
<nav><a href="/about">브랜드 소개</a><a href="/market">감자시장</a><a href="/42">파트너 감자</a>
<a href="/login">로그인</a><a href="/shop_cart">장바구니</a><a href="/policy">이용약관</a></nav>
<div><p>싹이 나고 물렁해져도, 당신은 여전히 만능 감자입니다.</p>
<p>2025년 6월 기준 누적 참여자 155명, 진행 프로그램 35개</p></div>
<a href="https://other-site.com/about">외부 소개</a>
<footer>고유번호 254-80-03611 · 이용약관 · 개인정보처리방침</footer>
<script>console.log("nav junk")</script></body></html>`;

console.log("픽스처 1 — 아임웹풍 정상");
{
  const base = new URL("https://horakpotato.com/");
  const links = harvestLinks(IMWEB, base);
  const paths = links.map((l) => new URL(l.url).pathname);
  check("about·market·42(앵커로) 수확", ["/about", "/market", "/42"].every((p) => paths.includes(p)), paths.join(","));
  check("about이 최상위 점수", paths[0] === "/about");
  check("숫자 경로 /42의 라벨=앵커텍스트", links.find((l) => l.url.endsWith("/42"))?.label === "파트너 감자");
  check("로그인·장바구니·약관·외부링크 제외", !paths.some((p) => /login|cart|policy/.test(p)) && !links.some((l) => l.url.includes("other-site")));
  const text = extractMainText(IMWEB);
  check("본문에 핵심 문장 보존", text.includes("만능 감자") && text.includes("155명"));
  check("nav·footer·script 제거", !text.includes("장바구니") && !text.includes("이용약관") && !text.includes("nav junk"));
}

// ── 픽스처 2: EUC-KR 디코딩 (옛 카페24) ──
console.log("픽스처 2 — EUC-KR");
{
  const html = `<html><head><meta charset="euc-kr"></head><body><p>감자 공방</p></body></html>`;
  const buf = Buffer.from(new TextDecoder().decode(new TextEncoder().encode(html))); // 골격
  // 실제 euc-kr 바이트: "감자" = beb0 c0da
  const eucBody = Buffer.concat([
    Buffer.from(`<html><head><meta charset="euc-kr"></head><body><p>`, "latin1"),
    Buffer.from([0xb0, 0xa8, 0xc0, 0xda]), // "감자"
    Buffer.from(`</p></body></html>`, "latin1"),
  ]);
  void buf;
  const decoded = decodeHtml(eucBody, "text/html");
  check("meta charset=euc-kr 감지·디코딩", decoded.includes("감자"), JSON.stringify(decoded.slice(50, 70)));
  const decoded2 = decodeHtml(eucBody, "text/html; charset=euc-kr");
  check("헤더 charset 우선 디코딩", decoded2.includes("감자"));
}

// ── 픽스처 3: JS 전용 사이트 (본문 없음, og+JSON-LD만) ──
console.log("픽스처 3 — JS 전용(메타 폴백)");
{
  const JSONLY = `<!doctype html><html><head><title>캔버스가든</title>
<meta property="og:description" content="꽃과 정원을 담은 플라워 스튜디오">
<script type="application/ld+json">{"@type":"LocalBusiness","name":"캔버스가든","description":"성수동 플라워 클래스","address":{"addressLocality":"서울 성동구","streetAddress":"금호로 66"}}</script>
</head><body><div id="root"></div><script src="/app.js"></script></body></html>`;
  const text = extractMainText(JSONLY);
  check("본문 추출은 빈약(쓰레기 없음)", text.length < 80, `len=${text.length}`);
  const meta = extractMetaFallback(JSONLY);
  check("og:description 건짐", meta.includes("플라워 스튜디오"));
  check("JSON-LD name·description·주소 건짐", meta.includes("캔버스가든") && meta.includes("성수동") && meta.includes("금호로 66"));
}

// ── 픽스처 4: 대용량 — 페이지당 캡 ──
console.log("픽스처 4 — 대용량 캡");
{
  const HUGE = `<html><body><p>${"내용 ".repeat(5000)}</p></body></html>`;
  const text = extractMainText(HUGE);
  check("본문 3,500자 캡", text.length <= 3500, `len=${text.length}`);
}

// ── 픽스처 5: robots.txt 파싱 ──
console.log("픽스처 5 — robots");
{
  const robots = `# comment\nUser-agent: Googlebot\nDisallow: /google-only\n\nUser-agent: *\nDisallow: /admin\nDisallow: /private/*\nAllow: /\n`;
  const dis = parseRobotsDisallow(robots);
  check("User-agent:* 그룹만 파싱", dis.includes("/admin") && !dis.includes("/google-only"));
  check("와일드카드 프리픽스", dis.includes("/private/*"));
}

// ── 픽스처 6: 앵커 정크 → 슬러그 폴백 + 라벨 캡 ──
console.log("픽스처 6 — 라벨 폴백");
{
  const html = `<html><body><a href="/about-our-brand-story"><img src="x.png"></a>
<a href="/program">지금 바로 확인해보세요 아주 긴 프로모션 문구입니다 정말 깁니다</a></body></html>`;
  const links = harvestLinks(html, new URL("https://ex.com/"));
  const aboutLink = links.find((l) => l.url.includes("about"));
  check("이미지 앵커 → 슬러그 라벨(20자 캡)", !!aboutLink && aboutLink.label === "about-our-brand-stor", aboutLink?.label);
  const progLink = links.find((l) => l.url.includes("program"));
  check("라벨 20자 캡", !!progLink && progLink.label.length <= 20, progLink?.label);
}

console.log(`\n${fail === 0 ? "ALL PASS" : "FAIL"} — pass ${pass} / fail ${fail}`);
if (fail > 0) process.exit(1);

// ── --live 모드: 실제 사이트 다이제스트 ──
const liveIdx = process.argv.indexOf("--live");
if (liveIdx !== -1) {
  const url = process.argv[liveIdx + 1];
  if (!url) {
    console.error("사용법: --live <url>");
    process.exit(1);
  }
  fetchHomepageDigest(url).then((d) => {
    console.log(`\n=== LIVE ${url} — ok=${d.ok} pages=${d.pages} chars=${d.digest.length} ${d.failReason ?? ""}`);
    console.log(d.digest.slice(0, 4000));
  });
}
