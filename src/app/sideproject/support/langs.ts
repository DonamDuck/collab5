// 후원하기 페이지의 언어 목록 한 곳 — 주소·hreflang·og:locale·언어 링크 이름이 전부 여기서 나온다.
// 사이트맵(src/app/sitemap.ts)과 앱 상세의 응원 절(MonitorAlign·LimitGlance `#support`)도 이 파일을 읽는다.
// ⭐한국어만 접미사 없는 주소(/sideproject/support)다. 영어는 /sideproject/support/en.
//   다른 언어 방문자는 영어 페이지로 보낸다(해외 창구가 Buy Me a Coffee 하나라서 영어 한 벌이면 된다).
export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** 한국어를 뺀 나머지 — `[lang]` 동적 경로가 미리 굽는 목록. */
export const SUB_LANGS = LANGS.filter((l): l is Exclude<Lang, "ko"> => l !== "ko");

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

export const BASE_PATH = "/sideproject/support";

export const PATH = Object.fromEntries(LANGS.map((l) => [l, l === "ko" ? BASE_PATH : `${BASE_PATH}/${l}`])) as Record<Lang, string>;

export const HREFLANG: Record<Lang, string> = { ko: "ko", en: "en" };
export const OG_LOCALE: Record<Lang, string> = { ko: "ko_KR", en: "en_US" };
/** 언어 링크에 그 언어 자신의 글자로 적는 이름. */
export const NATIVE_NAME: Record<Lang, string> = { ko: "한국어", en: "English" };

/** 앱 상세의 응원 절이 거는 주소 — 한국어 페이지는 한국어 후원 페이지로, 나머지 언어는 전부 영어 후원 페이지로. */
export function supportPathFor(pageLang: string): string {
  return pageLang === "ko" ? PATH.ko : PATH.en;
}
