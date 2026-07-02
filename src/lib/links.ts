// 신뢰 시그널(인스타·홈피) 링크/표시 유틸 — 카드·프로필 공용.

/** 인스타 핸들 → 실제 프로필 URL. 이미 URL이면 정규화. */
export function instagramUrl(handle: string): string {
  const h = handle
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return `https://instagram.com/${h}`;
}

/** 인스타 표시용 @핸들 */
export function instagramHandle(handle: string): string {
  const h = handle
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/+$/, "");
  return `@${h}`;
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
