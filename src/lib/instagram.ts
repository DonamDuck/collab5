// 인스타그램 딥리드 — 사장님이 직접 쓴 글(바이오·캡션) 회수.
//
// 2026-07-21 실측 (캔앤코르크):
// · 일반 브라우저 UA로는 meta 태그를 안 준다. 링크 미리보기 봇 UA(facebookexternalhit)에는 준다.
// · 프로필: meta[name="description"]에 바이오 전문 (팔로워 수 + 사장님이 쓴 소개 원문).
// · 개별 게시물(/p/…): meta[property="og:title"]에 캡션 전문.
// · 게시물 URL 목록은 서버 HTML엔 없다(JS 렌더) — 조사 메모(그라운딩 검색 결과)에서 수확한다.
//
// 실패는 전부 조용한 저하(ok:false) — 파이프라인은 기존 동작 유지. digest 텍스트는
// 서버에서만 만든다(클라이언트 텍스트를 프롬프트에 넣지 않는다 — 주입 차단, homepage.ts와 동일 원칙).

const FB_UA = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
const FETCH_TIMEOUT_MS = 5_000;
const TOTAL_BUDGET_MS = 12_000;
const MAX_POSTS = 5;
const MAX_DIGEST_CHARS = 4_500;

export interface InstagramDigest {
  digest: string;
  posts: number; // 캡션을 읽어온 게시물 수
  ok: boolean;
  failReason?: string;
}

/** HTML 엔티티 최소 디코드 (&#x…; &#…; + 자주 나오는 명명형) */
function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ");
}

/** meta 태그 content 추출 — 속성 순서 양방향 지원 */
function metaContent(html: string, key: string): string | undefined {
  const esc = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m =
    html.match(new RegExp(`<meta[^>]*(?:name|property)="${esc}"[^>]*content="([^"]*)"`)) ??
    html.match(new RegExp(`<meta[^>]*content="([^"]*)"[^>]*(?:name|property)="${esc}"`));
  return m ? decodeEntities(m[1]).trim() : undefined;
}

async function fetchHtml(url: string, deadline: number): Promise<string> {
  const budget = Math.min(FETCH_TIMEOUT_MS, deadline - Date.now());
  if (budget <= 0) throw new Error("deadline");
  const res = await fetch(url, {
    signal: AbortSignal.timeout(budget),
    headers: { "User-Agent": FB_UA, "Accept-Language": "ko" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/** @핸들 정규화 — 인스타 허용 문자만. 벗어나면 undefined (SSRF·경로 주입 차단) */
export function sanitizeHandle(raw?: string): string | undefined {
  const h = raw?.trim().replace(/^@+/, "") ?? "";
  return /^[a-zA-Z0-9._]{1,30}$/.test(h) ? h : undefined;
}

/** 조사 메모에서 게시물 shortcode 수확 → 안전한 정식 URL로 재조립(임의 URL 페치 방지) */
export function extractPostUrls(memo: string | undefined, max = MAX_POSTS): string[] {
  if (!memo) return [];
  const codes = [...memo.matchAll(/instagram\.com\/(?:[a-zA-Z0-9._]+\/)?(?:p|reel)\/([A-Za-z0-9_-]{5,20})/g)]
    .map((m) => m[1]);
  return [...new Set(codes)].slice(0, max).map((c) => `https://www.instagram.com/p/${c}/`);
}

/** 프로필 바이오 + (메모에서 발견된) 게시물 캡션 → 사장님 글 발췌 다이제스트 */
export async function fetchInstagramDigest(
  rawHandle: string | undefined,
  researchMemo?: string
): Promise<InstagramDigest> {
  const handle = sanitizeHandle(rawHandle);
  if (!handle) return { digest: "", posts: 0, ok: false, failReason: "no-handle" };
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const lines: string[] = [];
  let posts = 0;

  // 프로필 바이오 — "N Followers, … : "바이오"" 형태에서 바이오만
  try {
    const html = await fetchHtml(`https://www.instagram.com/${handle}/`, deadline);
    const desc = metaContent(html, "description");
    if (desc) {
      const bio = desc.match(/Instagram(?: 계정)?:\s*['"“]?([\s\S]+?)['"”]?$/)?.[1] ?? desc;
      lines.push(`· 프로필 소개(바이오): ${bio.replace(/\s*\n\s*/g, " / ")}`);
    }
  } catch (e) {
    console.warn(`[enrich] instagram profile fetch failed (@${handle}):`, e);
  }

  // 게시물 캡션 — 조사 메모에 게시물 URL이 잡혀 있을 때만 (병렬, 늦는 것 포기)
  const postUrls = extractPostUrls(researchMemo);
  if (postUrls.length) {
    const settled = await Promise.allSettled(postUrls.map((u) => fetchHtml(u, deadline)));
    for (const s of settled) {
      if (s.status !== "fulfilled") continue;
      const t = metaContent(s.value, "og:title");
      // 'Instagram의 ○○님 : "캡션"' → 캡션만
      const cap = t?.match(/:\s*["“]([\s\S]+?)["”]\s*$/)?.[1]?.trim();
      if (cap) {
        lines.push(`· 게시물 캡션: ${cap.replace(/\s*\n\s*/g, " / ")}`);
        posts++;
      }
    }
  }

  if (!lines.length) return { digest: "", posts: 0, ok: false, failReason: "no-meta" };
  const digest = lines.join("\n").slice(0, MAX_DIGEST_CHARS);
  return { digest, posts, ok: true };
}
