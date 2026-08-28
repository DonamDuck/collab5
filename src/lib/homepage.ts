// 홈페이지 심층읽기(딥리드) — 사용자가 링크 단계에서 확약한 공식 홈페이지를 서버가 직접 순회해
// 생성 프롬프트용 발췌(digest)를 만든다. Gemini 호출 0 — 일반 HTTP fetch만(API 비용 없음).
// 안전: SSRF 가드(사설 IP·리다이렉트마다 재검증), robots 존중(하위 페이지), 크기·시간 상한.
// 실패는 전부 조용한 저하 — digest 없이 기존 생성 동작 그대로.
// 스펙: docs/superpowers/specs/2026-07-15-homepage-deep-read-design.md
import { lookup } from "node:dns/promises";

const UA = "collab5-bot/1.0 (+https://collab5.vercel.app; brand-intro on owner's request)";
const MAX_BYTES = 1_000_000; // 페이지당 1MB — 스트리밍 중 상한
const PAGE_TIMEOUT_MS = 4_000;
const TOTAL_BUDGET_MS = 8_000; // 전체 하드 예산 — 늦는 페이지는 포기
const MAX_PAGES = 10; // 홈 포함 (대표: 최소 4 최대 10)
const MAX_REDIRECTS = 3;
const PER_PAGE_CHARS = 3_500; // 본문 추출 "후" 자름
const TOTAL_CHARS = 18_000; // 다이제스트 총량 — 우선순위 순 트림
const MIN_DIGEST_CHARS = 200; // 이보다 작으면 ok:false — 빈 헤더를 프롬프트에 넣지 않는다

// 데이터센터 IP에서 못 읽거나(네이버 계열) 긁지 않을 호스트 — 시도 자체를 안 함(기존 동작 유지)
const SKIP_HOSTS =
  /(^|\.)(naver\.com|naver\.me|modoo\.at|instagram\.com|facebook\.com|youtube\.com|twitter\.com|x\.com|tiktok\.com)$/i;

/** 링크 허브(리틀리·링크트리·인포크) — 홈페이지 칸에 이게 적힌 브랜드가 실재한다(08-28 실측: 파랑~·방혜리·터).
 *  ⭐**08-28까지 이 셋이 SKIP_HOSTS에 있어서, 그런 브랜드는 홈페이지를 «한 글자도 안 읽고» 소개서를 썼다.**
 *  🪤그런데 SKIP에서 빼기만 하면 아무 일도 안 일어난다 — 두 겹으로 막혀 있었다:
 *    ①`harvestLinks`가 same-host만 받아 허브에 걸린 브런치·노션을 «남의 집»이라 버린다
 *    ②허브 본문은 링크 제목뿐이라 ~150자, `MIN_DIGEST_CHARS`(200)에 못 미쳐 ok:false로 떨어진다
 *  👉그래서 허브는 **「본문을 읽는 곳」이 아니라 「링크 목록을 얻는 곳」**으로 따로 다룬다(아래 harvestLinks의 hub 분기).
 *  ⛔새 호스트를 여기 더할 땐 **그 페이지가 「본인이 고른 링크 목록」인지** 확인할 것.
 *    쇼핑몰·포털처럼 남이 채운 링크가 섞이는 곳을 넣으면 엉뚱한 페이지를 브랜드 재료로 읽는다. */
const HUB_HOSTS = /(^|\.)(litt\.ly|linktr\.ee|inpock\.co\.kr)$/i;

/** 허브에서 링크를 주울 때 «우리 자신»은 제외 — 파랑~ 님 리틀리엔 실제로 collab5 소개서가 걸려 있다.
 *  읽으면 우리가 쓴 문장을 다시 읽어 재료로 삼는 자기참조가 된다. */
const SELF_HOST = /(^|\.)collab5\.(co\.kr|vercel\.app)$/i;

/** 🚨허브에만 적용하는 제외 — **남의 물건을 파는 링크**를 브랜드 재료로 읽지 않기 위한 것.
 *  08-28 실측: 터 님 리틀리에 `미트리 닭가슴살 저렴하게 구매하기!`(metree.co.kr) 제휴 링크가 걸려 있었다.
 *  그대로 읽으면 **닭가슴살 판매 문구가 「터」의 브랜드 재료로 들어간다.**
 *  ⚠️**이 필터는 완전하지 않다** — 「이 링크가 이 사람 것인가」는 의미 판정이라 패턴으로 다 못 잡는다.
 *    앵커에 유도 문구가 없는 제휴 링크는 그대로 통과한다. **여기서 막는 건 명백한 것뿐이고,
 *    나머지는 위저드 결과를 사람이 검수하는 층에 맡긴다.** 못 잡는다는 걸 알고 쓸 것.
 *  📌본인 물건은 대개 제목으로 걸린다(파랑~ 님 책 = 「박물관은 조용하지 않다」) — 그건 안 걸린다. */
const HUB_LINK_EXCLUDE = {
  /** 내용이 없는 곳(상담 버튼·채팅방) — 열어도 다이제스트에 넣을 글이 없다 */
  hosts: /(^|\.)(open\.kakao\.com|pf\.kakao\.com|kakao\.com|band\.us|forms\.gle|docs\.google\.com)$/i,
  /** 판매·제휴 유도 문구 */
  anchor: /구매하기|최저가|할인가|공동구매|제휴|쿠폰받기|적립|추천인|바로가기 링크/i,
};

// ── SSRF 가드 ──────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  if (ip.includes(":")) {
    const v6 = ip.toLowerCase();
    if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7)); // IPv4-mapped
    return (
      v6 === "::1" ||
      v6 === "::" ||
      v6.startsWith("fe80") ||
      v6.startsWith("fc") ||
      v6.startsWith("fd")
    );
  }
  const p = ip.split(".").map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true; // 못 읽으면 막는다
  return (
    p[0] === 10 ||
    p[0] === 127 ||
    p[0] === 0 ||
    (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
    (p[0] === 192 && p[1] === 168) ||
    (p[0] === 169 && p[1] === 254) || // 링크로컬·클라우드 메타데이터(169.254.169.254)
    (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || // CGNAT
    p[0] >= 224
  );
}

async function assertPublicHost(u: URL): Promise<void> {
  if (u.protocol !== "http:" && u.protocol !== "https:") throw new Error("scheme");
  if (SKIP_HOSTS.test(u.hostname)) throw new Error("skip-host");
  // 호스트가 IP 리터럴이면 DNS 없이 바로 검사
  if (/^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) {
    if (isPrivateIp(u.hostname.replace(/^\[|\]$/g, ""))) throw new Error("private-ip");
    return;
  }
  const res = await lookup(u.hostname, { all: true }).catch(() => []);
  if (!res.length || res.some((r) => isPrivateIp(r.address))) throw new Error("private-ip");
}

// ── 안전 fetch — 수동 리다이렉트(매 hop 재검증)·스트리밍 크기 상한·charset 감지 ──

export async function safeFetchHtml(rawUrl: string, deadline: number): Promise<string> {
  let url = new URL(rawUrl);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    const timeLeft = Math.min(PAGE_TIMEOUT_MS, deadline - Date.now());
    if (timeLeft <= 0) throw new Error("timeout");
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(timeLeft),
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    });
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location");
      res.body?.cancel().catch(() => {});
      if (!loc) throw new Error(`http-${res.status}`);
      url = new URL(loc, url); // 상대 리다이렉트 대응 — 다음 루프에서 재검증
      continue;
    }
    if (!res.ok) {
      res.body?.cancel().catch(() => {});
      throw new Error(`http-${res.status}`);
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (ctype && !/text\/html|application\/xhtml/i.test(ctype)) {
      res.body?.cancel().catch(() => {});
      throw new Error("non-html");
    }
    const reader = res.body?.getReader();
    if (!reader) throw new Error("no-body");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      chunks.push(value);
      if (size > MAX_BYTES) {
        await reader.cancel().catch(() => {});
        break;
      }
    }
    const buf = Buffer.concat(chunks);
    return decodeHtml(buf, ctype);
  }
  throw new Error("too-many-redirects");
}

// charset: 헤더 → meta 태그 → utf-8. 옛 카페24는 euc-kr.
export function decodeHtml(buf: Buffer, contentType: string): string {
  const headCs = /charset=([\w-]+)/i.exec(contentType)?.[1];
  const sniff = buf.subarray(0, 2048).toString("latin1");
  const metaCs =
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(sniff)?.[1] ??
    /content=["'][^"']*charset=([\w-]+)/i.exec(sniff)?.[1];
  const cs = (headCs ?? metaCs ?? "utf-8").toLowerCase();
  try {
    return new TextDecoder(cs).decode(buf);
  } catch {
    return buf.toString("utf-8");
  }
}

// ── 링크 수확(원본 HTML에서 — 본문 추출로 nav가 지워지기 전) + 점수화 ──

// 경로·앵커텍스트 키워드 점수 — 소개 계열 최우선(양질 정보가 몰려 있는 곳)
const PATH_SCORES: Array<[RegExp, number]> = [
  [/about|intro(?!uce)|company|story|brand|philosophy|소개|스토리|이야기|철학|미션|비전/i, 100],
  [/program|activit|market|class|service|menu|project|활동|프로그램|사업|서비스|메뉴|클래스|프로젝트|공간/i, 60],
  [/partner|collab|together|coop|파트너|협업|협력|콜라보|함께/i, 65], // 콜라보 서비스 — 파트너 정보가 핵심 재료
  [/news|notice|press|event|history|소식|뉴스|언론|보도|이벤트|연혁/i, 30],
  [/team|people|member|팀|사람|멤버|사장|대표/i, 25],
];
const LINK_BLOCKLIST =
  /login|logout|join|signup|cart|order|mypage|search|policy|terms|privacy|agreement|약관|개인정보|배송|환불|교환|반품|faq|고객센터|장바구니|주문|리뷰|review|board_|shop_(cart|order|search|mypage)|\.(jpe?g|png|gif|webp|pdf|zip|mp4)(\?|$)/i;

export interface PageCandidate {
  url: string;
  label: string;
  score: number;
}

const stripTags = (s: string) => s.replace(/<[^>]*>/g, " ");
const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => {
      const c = Number(n);
      return c > 31 && c < 65536 ? String.fromCharCode(c) : " ";
    });
const tidy = (s: string) => decodeEntities(stripTags(s)).replace(/\s+/g, " ").trim();

export function harvestLinks(html: string, base: URL): PageCandidate[] {
  const seen = new Map<string, PageCandidate>();
  const hub = HUB_HOSTS.test(base.hostname);
  let order = 0; // 허브에서만 씀 — 문서에 나온 차례
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try {
      // 🪤href는 HTML 속성값이라 `&`가 `&amp;`로 인코딩돼 있다. 종전엔 쿼리를 통째로 버려서 안 드러났는데,
      //   허브 링크는 쿼리를 살리므로 여기서 풀지 않으면 `?a=1&amp;b=2`인 죽은 주소를 받는다(08-28 1hows.com 실측).
      u = new URL(decodeEntities(m[1]), base);
    } catch {
      continue;
    }
    if (hub) {
      // 허브는 «밖으로 내보내는 것»이 일이라 same-host 규칙을 뒤집는다 — 내부 링크가 오히려 잡음이다
      // (「MY 페이지 무료로 만들기」 같은 서비스 자체 링크).
      if (HUB_HOSTS.test(u.hostname)) continue;
      if (SKIP_HOSTS.test(u.hostname)) continue; // 어차피 assertPublicHost가 막지만, 10칸을 낭비하지 않는다
      if (SELF_HOST.test(u.hostname)) continue; // 자기참조 방지
      if (HUB_LINK_EXCLUDE.hosts.test(u.hostname)) continue; // 내용 없는 곳
      if (HUB_LINK_EXCLUDE.anchor.test(tidy(m[2]))) continue; // 남의 물건 파는 링크
    } else if (u.hostname !== base.hostname) {
      continue; // 일반 홈페이지는 종전대로 same-host만
    }
    const path = u.pathname + u.search;
    if (!hub && (path === "/" || path === base.pathname)) continue; // 홈 자신 제외
    if (LINK_BLOCKLIST.test(path)) continue;
    const anchor = tidy(m[2]);
    if (LINK_BLOCKLIST.test(anchor)) continue;
    // 점수: 경로 + 앵커텍스트 각각 매칭해 합산
    let score = 0;
    for (const [rx, pts] of PATH_SCORES) {
      if (rx.test(path)) score += pts;
      if (anchor && rx.test(anchor)) score += pts;
    }
    // ⭐허브는 점수 대신 «순서»를 쓴다. 링크 제목이 「11월 애매한 연말모임」·「박물관은 조용하지 않다」처럼
    //   PATH_SCORES의 어휘(소개·스토리·프로그램…)와 안 겹쳐 점수가 0으로 떨어지는데,
    //   허브는 애초에 **본인이 순서를 매겨 둔 목록**이라 위에 있을수록 지금 중요한 것이다(08-28 실측: 파랑~ 님은 최신 모집이 위).
    if (hub) score = Math.max(100 - order++ * 5, 10);
    // 아임웹류 숫자 경로(/42)는 경로 점수가 안 잡혀도 앵커("파트너 감자")로 잡힌다.
    if (score <= 0) continue;
    // 라벨: 앵커텍스트(≤20자, 텍스트만) → 정크면 URL 슬러그 폴백
    const slug = decodeURIComponent(u.pathname.replace(/^\/|\/$/g, "")).slice(0, 20);
    const label =
      anchor && /[가-힣a-zA-Z]/.test(anchor) ? anchor.slice(0, 20) : slug || "페이지";
    // 🪤허브는 «쿼리를 버리면 안 된다» — 걸린 링크가 `1hows.com/PEOPLE/?idx=17545793` 처럼
    //   쿼리에 글 번호를 담는 경우가 실재한다(파랑~ 님 인터뷰). 떼면 목록 첫 화면으로 간다.
    //   중복 제거 키도 호스트를 포함해야 한다 — 서로 다른 사이트의 루트(`/`)끼리 충돌한다.
    const url = hub ? u.origin + u.pathname + u.search : u.origin + u.pathname;
    const key = hub ? url : u.pathname;
    const prev = seen.get(key);
    if (!prev || score > prev.score) seen.set(key, { url, label, score });
  }
  return [...seen.values()].sort((a, b) => b.score - a.score).slice(0, MAX_PAGES - 1);
}

// ── 본문 추출 — script/nav류 제거 → 블록 태그를 개행으로 → 텍스트화 ──

// 쇼핑몰·플랫폼 공통 UI 문구 — 정보가 아니라 캡 낭비 (다이제스트에서 제외)
const JUNK_LINES =
  /^(로그인|로그아웃|회원가입|닫기|메뉴|검색|더보기|목록|이전|다음|공유하기|장바구니|바로구매|구매하기|찜하기|등록순|인기순|이름순|이름역순|낮은가격순|높은가격순|상품평 많은순|AI 추천순|신상품순|판매량순|리뷰|상품 요약설명|옵션 선택|수량|배송비|배송조회|로그인이 필요합니다\.?|TOP|맨위로)$/;

export function extractMainText(html: string): string {
  const cleaned = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style|noscript|svg|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(nav|header|footer|aside)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article)\b[^>]*>/gi, "\n");
  const seen = new Set<string>(); // 페이지 내 완전 중복 라인 제거(반복 nav·상품명 2중 노출)
  const text = decodeEntities(stripTags(cleaned))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => {
      if (l.length <= 1 || JUNK_LINES.test(l)) return false;
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n");
  return text.slice(0, PER_PAGE_CHARS); // 추출 "후" 자름
}

// ── JS 전용 사이트 폴백 — title·og·meta description·JSON-LD는 정적 HTML에 있다 ──

export function extractMetaFallback(html: string): string {
  const bits: string[] = [];
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  if (title) bits.push(tidy(title));
  const metas = [
    /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    // content가 property/name보다 먼저 오는 변형
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i,
  ];
  for (const rx of metas) {
    const v = rx.exec(html)?.[1];
    if (v) bits.push(decodeEntities(v).trim());
  }
  // JSON-LD: Organization/LocalBusiness 계열의 name·description·address만
  const ldRe = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = ldRe.exec(html))) {
    try {
      const nodes = [JSON.parse(m[1])].flat(2) as Array<Record<string, unknown>>;
      for (const node of nodes) {
        if (!node || typeof node !== "object") continue;
        for (const k of ["name", "alternateName", "description", "slogan"] as const) {
          if (typeof node[k] === "string" && (node[k] as string).trim())
            bits.push((node[k] as string).trim());
        }
        const addr = node["address"] as Record<string, unknown> | string | undefined;
        if (typeof addr === "string") bits.push(addr);
        else if (addr && typeof addr === "object") {
          const line = ["addressRegion", "addressLocality", "streetAddress"]
            .map((k) => (typeof addr[k] === "string" ? (addr[k] as string) : ""))
            .filter(Boolean)
            .join(" ");
          if (line) bits.push(line);
        }
      }
    } catch {
      // 깨진 JSON-LD는 무시
    }
  }
  return [...new Set(bits.filter((b) => b.length > 1))].join("\n").slice(0, PER_PAGE_CHARS);
}

// ── robots.txt — User-agent: * 그룹의 Disallow 프리픽스만 (하위 페이지에만 적용) ──

export function parseRobotsDisallow(robotsTxt: string): string[] {
  const out: string[] = [];
  let inStar = false;
  for (const raw of robotsTxt.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    const ua = /^user-agent:\s*(.+)$/i.exec(line);
    if (ua) {
      inStar = ua[1].trim() === "*";
      continue;
    }
    if (!inStar) continue;
    const dis = /^disallow:\s*(\S*)$/i.exec(line);
    if (dis && dis[1]) out.push(dis[1]);
  }
  return out;
}

const robotsBlocked = (path: string, disallow: string[]) =>
  disallow.some((p) => path.startsWith(p.replace(/\*.*$/, "")));

// ── 메인: 홈 → 링크 수확 → 병렬 순회 → 라벨 붙은 다이제스트 ──

export interface HomepageDigest {
  digest: string;
  pages: number;
  ok: boolean;
  failReason?: string;
}

/** 조사 메모 속 보도기사류 URL(최대 2개)을 골라 본문 발췌 — '소개된 곳' 설명·사실 보강용.
 *  (2026-07-21 로직 업그레이드 ②: 크롤이 기사 URL만 얻고 본문은 안 읽어 소개 설명이 범용문장이 되던 문제)
 *  실패는 전부 조용한 저하("") — 기존 동작 유지. SSRF 가드는 safeFetchHtml이 담당. */
export async function fetchArticleExcerpts(memo: string | undefined, max = 2): Promise<string> {
  if (!memo?.trim()) return "";
  const urls = [...new Set([...memo.matchAll(/https?:\/\/[^\s"'<>)|\]]+/g)].map((m) => m[0]))]
    .filter((u) => {
      try {
        const { hostname, pathname } = new URL(u);
        if (SKIP_HOSTS.test(hostname)) return false; // SNS·네이버 등은 별도 경로가 담당
        return /news|article|press|magazine|journal/i.test(hostname + pathname);
      } catch {
        return false;
      }
    })
    .slice(0, max);
  if (!urls.length) return "";
  const deadline = Date.now() + 6_000;
  const settled = await Promise.allSettled(urls.map((u) => safeFetchHtml(u, deadline)));
  const parts: string[] = [];
  settled.forEach((s, i) => {
    if (s.status !== "fulfilled") return;
    const text = extractMainText(s.value).slice(0, 2_500);
    if (text.length > 200) parts.push(`[기사—${new URL(urls[i]).hostname}]\n${text}`);
  });
  if (parts.length) console.log("[article-excerpts]", JSON.stringify({ urls: urls.length, got: parts.length }));
  return parts.join("\n\n");
}

export async function fetchHomepageDigest(rawUrl: string): Promise<HomepageDigest> {
  const started = Date.now();
  const deadline = started + TOTAL_BUDGET_MS;
  let host = "?";
  try {
    const normalized = /^https?:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
    const base = new URL(normalized);
    host = base.hostname;

    // 홈 + robots.txt 병렬 (robots는 실패해도 무시 — 홈은 사용자 확약이라 항상 허용)
    const [homeHtml, robotsTxt] = await Promise.all([
      safeFetchHtml(base.href, deadline),
      fetch(`${base.origin}/robots.txt`, {
        signal: AbortSignal.timeout(2000),
        headers: { "User-Agent": UA },
      })
        .then((r) => (r.ok ? r.text() : ""))
        .catch(() => ""),
    ]);
    const disallow = parseRobotsDisallow(robotsTxt);

    // 링크 수확은 원본 HTML에서(본문 추출 전) → robots 필터(하위 페이지만)
    // ⚠️robots는 **그 호스트의 것**이다 — 허브에서 주운 링크는 남의 사이트라 base(리틀리)의 robots를 대면 안 된다.
    //   각자의 robots를 받아오려면 요청이 배로 드는데 8초 예산 안에선 무리라, 같은 호스트일 때만 적용한다.
    //   (허브에 걸린 링크는 브랜드가 스스로 공개한 자기 채널이고, 페이지 단위 취득이라 부담도 작다.)
    const candidates = harvestLinks(homeHtml, base).filter((c) => {
      const cu = new URL(c.url);
      return cu.hostname !== base.hostname || !robotsBlocked(cu.pathname, disallow);
    });

    // 하위 페이지 병렬 fetch — 전체 데드라인 공유, 늦는 페이지 포기
    const settled = await Promise.allSettled(
      candidates.map(async (c) => ({ c, text: extractMainText(await safeFetchHtml(c.url, deadline)) }))
    );

    type Block = { label: string; text: string; score: number };
    const blocks: Block[] = [];
    const homeText = extractMainText(homeHtml);
    if (homeText.length > 80) blocks.push({ label: "메인", text: homeText, score: 70 });
    for (const s of settled) {
      if (s.status === "fulfilled" && s.value.text.length > 80) {
        blocks.push({ label: s.value.c.label, text: s.value.text, score: s.value.c.score });
      }
    }
    // JS 전용 사이트 폴백 — 본문이 빈약하면 메타·JSON-LD라도 건진다("모든 형태의 홈페이지")
    if (blocks.reduce((n, b) => n + b.text.length, 0) < 600) {
      const meta = extractMetaFallback(homeHtml);
      if (meta.length > 40) blocks.push({ label: "기본정보", text: meta, score: 90 });
    }

    // 점수순으로 이어붙여 총량 캡 — 알짜(소개 계열)부터
    blocks.sort((a, b) => b.score - a.score);
    let digest = "";
    for (const b of blocks) {
      if (digest.length >= TOTAL_CHARS) break;
      const room = TOTAL_CHARS - digest.length;
      digest += `[홈페이지—${b.label}]\n${b.text.slice(0, room)}\n\n`;
    }
    digest = digest.trim();

    const ok = digest.length >= MIN_DIGEST_CHARS;
    const result: HomepageDigest = ok
      ? { digest, pages: blocks.length, ok: true }
      : { digest: "", pages: blocks.length, ok: false, failReason: "too-small" };
    console.log(
      "[homepage-digest]",
      JSON.stringify({ host, pages: result.pages, chars: digest.length, ok, ms: Date.now() - started })
    );
    return result;
  } catch (e) {
    const failReason = e instanceof Error ? e.message : "unknown";
    console.log(
      "[homepage-digest]",
      JSON.stringify({ host, pages: 0, chars: 0, ok: false, failReason, ms: Date.now() - started })
    );
    return { digest: "", pages: 0, ok: false, failReason };
  }
}
