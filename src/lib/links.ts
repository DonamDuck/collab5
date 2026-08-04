// 신뢰 시그널(인스타·홈피) 링크/표시 유틸 — 카드·프로필 공용.

/** 인스타 입력값 → 순수 핸들. @·URL·경로 순서에 무관하게 정규화.
 *  폼이 @를 고정 접두어로 붙이므로 프로필 URL을 붙여넣으면 "@https://instagram.com/handle"
 *  형태로 저장됨 → 선행 @를 먼저 걷어내야 URL 접두어 제거가 먹는다(안 그러면 링크가 깨짐). */
export function instagramSlug(input: string): string {
  return input
    .trim()
    .replace(/^@+/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?instagram\.com\//i, "")
    .replace(/^@+/, "")
    .split(/[/?#]/)[0]
    .trim();
}

/** 인스타 핸들 → 실제 프로필 URL. 이미 URL이면 정규화. */
export function instagramUrl(handle: string): string {
  return `https://instagram.com/${instagramSlug(handle)}`;
}

/** 인스타 표시용 @핸들 */
export function instagramHandle(handle: string): string {
  return `@${instagramSlug(handle)}`;
}

/** 인스타 DM 딥링크 — ig.me/m/{핸들}은 프로필이 아니라 DM 창을 연다(콜라보 연락용).
 *  ⚠️인스타는 DM 텍스트 프리필 파라미터가 없다 → 문구는 별도로 복사해 붙여넣어야 함. */
export function instagramDmUrl(handle: string): string {
  return `https://ig.me/m/${instagramSlug(handle)}`;
}

/** 콜라보 연락 채널 결정 — 인스타 DM 우선, 없으면 홈페이지/카톡채널 등, 둘 다 없으면 null.
 *  label은 버튼 문구, channel은 계측용 태그. */
export function resolveCollabChannel(trust?: { instagram?: string; homepage?: string }):
  | { label: string; url: string; channel: "instagram" | "homepage" }
  | null {
  const ig = trust?.instagram?.trim();
  if (ig) return { label: "인스타그램으로 연락하기", url: instagramDmUrl(ig), channel: "instagram" };
  const hp = trust?.homepage?.trim();
  if (hp) {
    const svc = channelLabel(hp);
    return { label: `${svc ?? "홈페이지"}로 연락하기`, url: normalizeUrl(hp), channel: "homepage" };
  }
  return null;
}

/** 홈페이지 href — 프로토콜 없으면 https 붙임 */
export function normalizeUrl(url: string): string {
  const u = url.trim();
  return /^https?:\/\//i.test(u) ? u : `https://${u}`;
}

/** 홈페이지 표시용 — 프로토콜·www·끝 슬래시 제거 */
export function prettyUrl(url: string): string {
  return url
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/+$/, "");
}

/** 대표 URL 표시 라벨 — 홈페이지가 없는 소상공인은 카톡 채널·링크트리 하나만 걸어두는 경우가
 *  많다(대표 확정 2026-07-20). URL 원문 대신 알아볼 수 있는 서비스명으로 보여준다.
 *  ⚠️여기 없는 도메인은 null → 호출부가 prettyUrl(도메인)로 폴백(진짜 홈페이지는 도메인이 더 정확). */
const CHANNEL_HOSTS: [RegExp, string][] = [
  [/^pf\.kakao\.com$/i, "카카오톡 채널"],
  [/^(open\.)?kakao\.com$/i, "카카오톡"],
  [/^litt\.ly$/i, "리틀리"],
  [/^linktr\.ee$/i, "링크트리"],
  [/^smartstore\.naver\.com$/i, "스마트스토어"],
  [/^blog\.naver\.com$/i, "네이버 블로그"],
  [/^(cafe\.naver\.com|cafe\.daum\.net)$/i, "카페"],
  [/^(www\.)?youtube\.com$|^youtu\.be$/i, "유튜브"],
  [/^(www\.)?threads\.(net|com)$/i, "스레드"],
];

/** 대표 URL을 사람이 읽는 라벨로. 알려진 채널이면 서비스명, 아니면 null(도메인 표시로 폴백). */
export function channelLabel(url?: string): string | null {
  if (!url?.trim()) return null;
  let host: string;
  try {
    host = new URL(normalizeUrl(url)).hostname;
  } catch {
    return null;
  }
  for (const [re, label] of CHANNEL_HOSTS) if (re.test(host)) return label;
  return null;
}

/** 허용 지도 서비스 — 칩에 "네이버 지도"라고 써놓고 딴 데로 가는 사고 방지용 화이트리스트.
 *  naver.me·kko.to는 각 사의 공식 축약 도메인(공유 버튼이 주는 형태). */
const MAP_HOSTS: [RegExp, string][] = [
  [/^(map\.|m\.map\.|m\.place\.|place\.)?naver\.com$/i, "네이버 지도"],
  [/^naver\.me$/i, "네이버 지도"],
  [/^(map\.|place\.map\.|m\.map\.)?kakao\.com$/i, "카카오맵"],
  [/^kko\.to$/i, "카카오맵"],
  [/^(www\.)?google\.[a-z.]+$/i, "구글 지도"],
  [/^maps\.app\.goo\.gl$|^goo\.gl$/i, "구글 지도"],
];

/** 지도 링크면 표시 라벨("네이버 지도" 등), 아니면 null. 저장 검증·칩 라벨 양쪽에서 쓴다. */
export function mapLinkLabel(url?: string): string | null {
  if (!url?.trim()) return null;
  let host: string;
  try {
    host = new URL(normalizeUrl(url)).hostname;
  } catch {
    return null;
  }
  for (const [re, label] of MAP_HOSTS) if (re.test(host)) return label;
  return null;
}

/** 우리가 만든 지도 링크(`?c=lng,lat,...`)에서 좌표를 되꺼낸다. 없으면 null.
 *
 *  ⭐ 08-02에 `naver-local.ts`에서 **여기로 이사**했다 — 그 파일은 네이버 키로 fetch하는
 *     서버 전용 모듈이라, 폼(클라이언트 컴포넌트)이 좌표만 뽑으려고 import하면 서버 코드가
 *     클라 번들에 딸려 들어간다. 이건 URL 문자열만 만지는 순수 함수라 여기가 제집.
 *
 *  ⚠️ **null이 정상 동작인 경우가 많다** — 사장님이 네이버 '공유'로 복사한 place 링크
 *     (`/p/entry/place/{id}`)는 좌표가 없거나 `?c=15.00,0,0,0,dh`처럼 **앞자리가 줌 레벨**이다.
 *     우리 링크(`?c=127.02,37.58,...`)와 생김새가 같아 위험한데, 아래 **대한민국 좌표 범위
 *     가드**가 그걸 걸러낸다(07-31 실측으로 잡은 사고 — 엉뚱한 위치에 핀 찍힐 뻔했다).
 *     좌표가 없는 건은 저장 시 상호명 재조회로 보충된다(`naver-local.ts` 상단 주석). */
export function parseLatLngFromMapUrl(url?: string): { lat: number; lng: number } | null {
  if (!url) return null;
  try {
    const c = new URL(url).searchParams.get("c"); // "lng,lat,level,..."
    if (!c) return null;
    const [lngStr, latStr] = c.split(",");
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
