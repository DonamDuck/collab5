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
  /(^|\.)(naver\.com|naver\.me|modoo\.at|instagram\.com|facebook\.com|youtube\.com|twitter\.com|x\.com|tiktok\.com|litt\.ly|linktr\.ee|inpock\.co\.kr)$/i;

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
  const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let u: URL;
    try {
      u = new URL(m[1], base);
    } catch {
      continue;
    }
    if (u.hostname !== base.hostname) continue; // same-host만
    const path = u.pathname + u.search;
    if (path === "/" || path === base.pathname) continue; // 홈 자신 제외
    if (LINK_BLOCKLIST.test(path)) continue;
    const anchor = tidy(m[2]);
    if (LINK_BLOCKLIST.test(anchor)) continue;
    // 점수: 경로 + 앵커텍스트 각각 매칭해 합산
    let score = 0;
    for (const [rx, pts] of PATH_SCORES) {
      if (rx.test(path)) score += pts;
      if (anchor && rx.test(anchor)) score += pts;
    }
    // 아임웹류 숫자 경로(/42)는 경로 점수가 안 잡혀도 앵커("파트너 감자")로 잡힌다.
    if (score <= 0) continue;
    // 라벨: 앵커텍스트(≤20자, 텍스트만) → 정크면 URL 슬러그 폴백
    const slug = decodeURIComponent(u.pathname.replace(/^\/|\/$/g, "")).slice(0, 20);
    const label =
      anchor && /[가-힣a-zA-Z]/.test(anchor) ? anchor.slice(0, 20) : slug || "페이지";
    const key = u.pathname; // pathname 기준 중복 제거(쿼리 변형 무시)
    const prev = seen.get(key);
    if (!prev || score > prev.score) seen.set(key, { url: u.origin + u.pathname, label, score });
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
    const candidates = harvestLinks(homeHtml, base).filter(
      (c) => !robotsBlocked(new URL(c.url).pathname, disallow)
    );

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
