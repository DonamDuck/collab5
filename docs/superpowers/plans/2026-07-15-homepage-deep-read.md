# Implementation Plan: 홈페이지 심층읽기 (딥리드) v1
Date: 2026-07-15
Spec: docs/superpowers/specs/2026-07-15-homepage-deep-read-design.md

## Goal
사용자가 확약한 홈페이지를 생성 요청 안에서 서버가 직접 순회(최대 10페이지)해 발췌를 만들고, 기존 생성 프롬프트에 합류시켜 소개서 품질을 올린다. Gemini 호출 수 불변.

## Architecture
```
EnrichWizard.generate() ──(homepage: hpChosen 추가)──▶ POST /api/enrich mode:"options"
  route.ts: fetchHomepageDigest(url) ← src/lib/homepage.ts (신규, 예산 8초, 실패 시 undefined)
  → enrichOptions({..., homepageDigest}) → provider.options(): 프롬프트에 [홈페이지 발췌] 블록
draft2(폼 초안받기 모달)도 동일하게 homepage 전달 → draftBoth 프롬프트 합류
```
- digest는 서버에서만 생성·소비 (클라이언트는 URL만 전달 — 주입 차단)
- 캐시·프리페치 없음 (서버리스 메모리 비공유 + 스키마 불변 → 요청 내 fetch, 레드팀 사인오프 조건 이행)
- options 모드는 digest fetch → 생성 순차 (worst +8s, 통상 +2~3s; generating 화면이 이미 있음)

## Tech Stack
Next.js 16 App Router / TS / 표준 fetch + node:dns / 신규 의존성 없음

## Files
```
CREATE src/lib/homepage.ts            — 딥리드 엔진 (가드·순회·추출·다이제스트)
CREATE scripts/test-homepage.ts       — 오프라인 유닛테스트 (픽스처 내장) + --live 모드
MODIFY src/app/api/enrich/route.ts    — options/draft2에 homepage 파라미터 + maxDuration
MODIFY src/lib/enrich.ts              — OptionsInput/DraftInput.homepageDigest + 프롬프트 블록
MODIFY src/app/register/EnrichWizard.tsx — generate()에 homepage 전달 + LinkPicker 확약 카피
```

---

## Task 1: homepage.ts — 안전 fetch 계층 (SSRF 가드)

**Goal:** URL 검증·사설 IP 차단·리다이렉트 재검증·크기 상한·charset 디코딩을 갖춘 `safeFetchHtml`.

**Steps:**
1. `src/lib/homepage.ts` 생성. 상단:
```ts
// 홈페이지 심층읽기(딥리드) — 사용자가 확약한 공식 홈페이지를 서버가 직접 순회해
// 생성 프롬프트용 발췌(digest)를 만든다. Gemini 호출 0 — 일반 HTTP fetch만.
// 안전: SSRF 가드(사설 IP·리다이렉트 재검증), robots 존중(하위 페이지), 크기·시간 상한.
import { lookup } from "node:dns/promises";

const UA = "collab5-bot/1.0 (+https://collab5.vercel.app; brand-intro on owner's request)";
const MAX_BYTES = 1_000_000; // 페이지당 1MB
const PAGE_TIMEOUT_MS = 4_000;
const TOTAL_BUDGET_MS = 8_000;
const MAX_PAGES = 10; // 홈 포함 (대표: 최소 4 최대 10)
const MAX_REDIRECTS = 3;

// 데이터센터에서 못 읽거나(네이버 계열) TOS상 피할 호스트 — 시도 자체를 안 함(기존 동작 유지)
const SKIP_HOSTS = /(^|\.)(blog\.naver\.com|smartstore\.naver\.com|m\.blog\.naver\.com|naver\.me|modoo\.at|instagram\.com|facebook\.com|youtube\.com|twitter\.com|x\.com|litt\.ly|linktr\.ee)$/i;

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    return v6 === "::1" || v6.startsWith("fe80") || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("::ffff:127.") || v6.startsWith("::ffff:10.") || v6.startsWith("::ffff:192.168.");
  }
  const p = ip.split(".").map(Number);
  return (
    p[0] === 10 || p[0] === 127 || p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) || // 링크로컬·클라우드 메타데이터
    p[0] >= 224
  );
}

async function assertPublicHost(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme");
  if (SKIP_HOSTS.test(u.hostname)) throw new Error("skip-host");
  const res = await lookup(u.hostname, { all: true });
  if (!res.length || res.some((r) => isPrivateIp(r.address))) throw new Error("private-ip");
}
```
2. `safeFetchHtml` — 수동 리다이렉트 루프(매 hop 재검증), 스트리밍 크기 상한, charset 감지(EUC-KR 레거시 카페24):
```ts
async function safeFetchHtml(rawUrl: string, deadline: number): Promise<string> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const timeLeft = Math.min(PAGE_TIMEOUT_MS, deadline - Date.now());
    if (timeLeft <= 0) throw new Error("timeout");
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeLeft),
      headers: { "User-Agent": UA, Accept: "text/html" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      if (!loc) throw new Error(`http-${res.status}`);
      url = new URL(loc, url); // 상대 리다이렉트 대응, 다음 루프에서 재검증
      continue;
    }
    if (!res.ok) throw new Error(`http-${res.status}`);
    const ctype = res.headers.get("content-type") ?? "";
    if (!/text\/html|application\/xhtml/i.test(ctype)) throw new Error("non-html");
    // 스트리밍 중 크기 상한
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no-body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      chunks.push(value);
      if (size > MAX_BYTES) { reader.cancel(); break; }
    }
    const buf = Buffer.concat(chunks);
    // charset: 헤더 → meta 태그 → utf-8. 옛 카페24는 euc-kr.
    const headCs = /charset=([\w-]+)/i.exec(ctype)?.[1];
    const sniff = buf.subarray(0, 2048).toString("latin1");
    const metaCs = /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1];
    const cs = (headCs ?? metaCs ?? "utf-8").toLowerCase();
    try { return new TextDecoder(cs).decode(buf); }
    catch { return buf.toString("utf-8"); }
  }
  throw new Error("too-many-redirects");
}
```
3. Verify: `npx tsc --noEmit` 통과.
4. Commit: `feat(homepage): 딥리드 안전 fetch 계층 — SSRF 가드·리다이렉트 재검증·EUC-KR 대응`

---

## Task 2: homepage.ts — 링크 수확·본문 추출·다이제스트 조립

**Goal:** 홈 1장 → 내부 링크 점수화 → 병렬 fetch → 본문/메타/JSON-LD 추출 → 라벨 붙은 digest.

**Steps:**
1. 링크 수확은 **원본 HTML에서** (본문 추출 전 — nav가 지워지기 전에). 점수 키워드:
```ts
// (경로+앵커텍스트, 점수) — 소개 계열 최우선
const PATH_SCORES: Array<[RegExp, number]> = [
  [/about|intro|company|story|brand|소개|스토리|이야기|철학|미션/i, 100],
  [/program|activit|market|class|service|menu|활동|프로그램|사업|서비스|메뉴|클래스/i, 60],
  [/partner|collab|together|파트너|협업|협력|콜라보|함께/i, 55],
  [/news|notice|press|event|소식|뉴스|언론|보도|이벤트/i, 30],
  [/team|people|팀|사람|멤버/i, 25],
];
const LINK_BLOCKLIST = /login|logout|cart|order|mypage|policy|약관|개인정보|배송|환불|faq|goods_search|shop_(cart|view|order)|#|mailto:|tel:|\.(jpg|png|pdf|zip)$/i;
```
`harvestLinks(html, base)`: `<a href>` 전부 → same-host만 → 블록리스트 제외 → 점수화(경로+앵커 각각 매칭, 합산) → 점수>0 상위 `MAX_PAGES-1`개, 앵커텍스트를 라벨로 (`≤20자`, 태그 제거, 중복 시 URL 슬러그 폴백).
2. `extractMainText(html)`: `<script|style|noscript|svg|iframe>` 및 `<nav|header|footer|aside>` 블록 제거(정규식, 중첩 1단계면 충분) → `<br|p|div|li|h\d>` 를 개행으로 → 태그 스트립 → HTML 엔티티 디코드(`&amp; &lt; &gt; &quot; &#39; &nbsp;`) → 공백 정리. **추출 후** 페이지당 3,500자 캡.
3. `extractMetaFallback(html)`: JS 전용 사이트 대비 — `<title>`, `og:title/description/site_name`, `meta[name=description]`, `<script type="application/ld+json">`의 name/description/address 계열만 추림 (대표 요청 "모든 형태의 홈페이지").
4. 메인 함수:
```ts
export interface HomepageDigest { digest: string; pages: number; ok: boolean; failReason?: string }
export async function fetchHomepageDigest(rawUrl: string): Promise<HomepageDigest>
```
흐름: URL 정규화(스킴 없으면 https:// 추가) → 홈 fetch → (robots.txt를 홈과 **병렬** fetch, `User-agent: *`의 `Disallow` 프리픽스 파싱 — 홈은 항상 허용, 하위 페이지만 필터) → harvestLinks → 후보 병렬 fetch(`Promise.allSettled`, 전체 `TOTAL_BUDGET_MS` 데드라인) → 각 페이지 `[홈페이지—${label}]\n본문` 블록 → 본문 빈약하면 meta 폴백 블록 `[홈페이지—기본정보]` → 점수순 이어붙여 **총 18,000자 캡**. digest가 200자 미만이면 `ok:false` (빈 헤더를 프롬프트에 넣지 않기 위해).
5. 로깅 (1주 리포트용): `console.log("[homepage-digest]", JSON.stringify({ host, pages, chars, ok, failReason }))`. 실패 사유 분류: `skip-host|private-ip|timeout|http-403|non-html|too-small|...`
6. Verify: `npx tsc --noEmit`.
7. Commit: `feat(homepage): 링크 수확·본문 추출·다이제스트 조립 — 라벨링·robots·메타 폴백`

---

## Task 3: 오프라인 유닛테스트 (픽스처 내장)

**Goal:** 네트워크 없이 추출 로직 검증. 레드팀 요구 픽스처 구성 준수.

**Steps:**
1. `homepage.ts`에서 `harvestLinks`, `extractMainText`, `extractMetaFallback` export (테스트용).
2. `scripts/test-homepage.ts` 생성 — 내장 픽스처 5종 + assert:
   - 아임웹풍 정상 HTML(nav+본문): harvestLinks가 /about·/market을 상위로, nav 텍스트가 본문에서 제거됨
   - EUC-KR 시나리오: TextDecoder("euc-kr") 디코딩 경로 (Buffer 픽스처)
   - JS 전용(본문 없음, og+JSON-LD만): extractMainText ≈ 빈 값 & extractMetaFallback이 description 건짐 → "깨끗한 빈 digest 또는 메타만" 단언
   - 대용량: 3,500자 캡 단언
   - 블록리스트: /login·/cart·약관이 후보에서 제외 단언
3. `--live` 모드: `npx tsx scripts/test-homepage.ts --live https://horakpotato.com/` → 실제 digest 출력(155명·파트너 감자 포함 여부 육안 확인).
4. Run: `npx tsx scripts/test-homepage.ts` → `ALL PASS` 출력.
5. Commit: `test(homepage): 오프라인 픽스처 테스트 + --live 모드`

---

## Task 4: enrich.ts — homepageDigest 프롬프트 합류

**Goal:** options·draftBoth 프롬프트에 [홈페이지 발췌] 블록 + 신뢰 규칙.

**Steps:**
1. `OptionsInput`(line ~67)과 `DraftInput`에 `homepageDigest?: string;` 추가 (주석: 서버에서 fetchHomepageDigest로 생성 — 클라이언트 텍스트 금지).
2. 공용 헬퍼:
```ts
const digestBlock = (d?: string) =>
  d?.trim()
    ? `[홈페이지 직접 읽기 — 사장이 확인한 공식 홈페이지 발췌]\n${d.trim()}\n\n⭐⭐홈페이지 발췌는 가장 신뢰할 1차 자료야. 숫자·미션·활동명·파트너명·연혁이 조사 자료와 다르면 홈페이지를 우선해. 단, 문장을 그대로 베끼지 말고 새로 써. "[홈페이지—라벨]"은 참고용 힌트야.\n\n`
    : "";
```
3. `options()` 프롬프트: `${verb}` 다음, `[조사 자료]` **앞**에 `${digestBlock(input.homepageDigest)}` 삽입. activityHints·collabHints 규칙 문구를 "조사 자료·홈페이지 발췌에 실제로 언급된"으로 확장.
4. `draftBoth()` 프롬프트: `[조사 자료]` 앞에 동일 블록 삽입.
5. Verify: `npx tsc --noEmit`.
6. Commit: `feat(enrich): 생성 프롬프트에 홈페이지 발췌 블록 — 1차 자료 우선·베끼기 금지`

---

## Task 5: route.ts — homepage 파라미터 배선 + maxDuration

**Goal:** options/draft2 모드가 확정 homepage URL을 받아 서버에서 digest 생성 후 전달.

**Steps:**
1. 상단 import에 `fetchHomepageDigest` 추가, body 타입에 `homepage`는 이미 있음(재사용). `export const maxDuration = 60;` 추가 (digest 8s + 생성 여유).
2. options 모드(~line 140): enrichOptions 호출 전에
```ts
let homepageDigest: string | undefined;
const hp = typeof body.homepage === "string" ? body.homepage.trim() : "";
if (hp) {
  try {
    const d = await fetchHomepageDigest(hp);
    if (d.ok) homepageDigest = d.digest;
  } catch (e) {
    console.warn("[enrich] homepage digest failed:", e); // 조용한 저하 — 기존 동작 그대로
  }
}
```
   → `enrichOptions({ ..., homepageDigest })`.
3. draft2 모드도 동일 패턴으로 `homepageDigest` 전달 (`enrichDraftBoth`).
4. Verify: `npx tsc --noEmit`.
5. Commit: `feat(enrich-api): options·draft2에 홈페이지 딥리드 배선 + maxDuration`

---

## Task 6: EnrichWizard — homepage 전달 + 확약 카피

**Goal:** 위저드 생성 요청에 확정 홈페이지 URL 포함, LinkPicker에 공식 확약 문구.

**Steps:**
1. `generate()`의 fetch body에 `homepage: hpChosen || undefined` 추가 (hpChosen은 이미 genKey에 포함 — 재생성 스킵 로직 무변).
2. LinkPicker 확인 카피(홈페이지 쪽): 단일 후보 질문/버튼 영역 문구를 "이 홈페이지가 **우리 브랜드의 공식 홈페이지가 맞아요**"가 드러나게 조정 (기존 톤 유지, 해요체). 직접입력 placeholder 하단 헬퍼에도 "공식 홈페이지 주소를 적어주세요" 반영. IG 쪽은 무변.
3. register 폼 쪽 draft2 호출부(초안받기 모달)에 `homepage:` 현재 폼 홈페이지 값 전달 (page.tsx에서 draft2 fetch하는 곳 확인 후 동일 패턴).
4. Verify: `npx tsc --noEmit && npm run build`.
5. Commit: `feat(wizard): 생성에 확정 홈페이지 전달 + 공식 홈페이지 확약 카피`

---

## Task 7: 검증 게이트 — 교차검증 + E2E + 배포

**Goal:** 프롬프트 대변경 관례 준수 + 실사이트 검증 후 배포.

**Steps:**
1. `npx tsx scripts/test-homepage.ts` (오프라인) → PASS.
2. `npx tsx scripts/test-homepage.ts --live https://horakpotato.com/` → digest에 미션·155명(또는 최신 숫자)·파트너 계열 포함 확인.
3. Gemini 교차검증 1회(관례): 임시 스크립트로 새 options 프롬프트+호락 digest를 Gemini에 1콜 → 한줄/소개 후보가 홈페이지 사실을 반영하고 베끼기 없는지 확인. (상시 호출 수 불변 — 검증용 단발)
4. dev 서버로 위저드 E2E: 호락호락감자 → 칩 → 링크 확정(직접입력 horakpotato.com) → 생성 → DOM에서 소개 후보에 홈페이지 사실 반영 확인.
5. `npx tsc --noEmit && npm run build` → `git push origin main` (상시 승인).
6. Vercel 로그에서 `[homepage-digest]` 라인 확인. Obsidian 프로젝트 노트 갱신 + 1주 뒤 성공률 리포트 예약 메모.
7. Commit(문서): `docs: 홈페이지 딥리드 v1 배포 기록`

**Expected output:** 프로드에서 호락 테스트 시 소개 후보에 홈페이지 1차 사실(미션·숫자·파트너)이 반영되고, 홈피 없는 브랜드는 기존과 동일 동작.
