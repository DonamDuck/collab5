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
