// LimitGlance 상세의 언어 목록 한 곳 — 주소·hreflang·og:locale·언어 링크 이름이 전부 여기서 나온다.
// 사이트맵(src/app/sitemap.ts)도 이 파일을 읽는다. 지금은 한국어·영어 둘이다(앱 화면도 이 둘뿐이다).
// ⭐한국어만 접미사 없는 주소(/sideproject/limitglance)다. 영어는 /sideproject/limitglance/en.
export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** 한국어를 뺀 나머지 — `[lang]` 동적 경로가 미리 굽는 목록. */
export const SUB_LANGS = LANGS.filter((l): l is Exclude<Lang, "ko"> => l !== "ko");

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

export const BASE_PATH = "/sideproject/limitglance";

export const PATH = Object.fromEntries(LANGS.map((l) => [l, l === "ko" ? BASE_PATH : `${BASE_PATH}/${l}`])) as Record<Lang, string>;

export const HREFLANG: Record<Lang, string> = { ko: "ko", en: "en" };
export const OG_LOCALE: Record<Lang, string> = { ko: "ko_KR", en: "en_US" };
/** 언어 링크에 그 언어 자신의 글자로 적는 이름. */
export const NATIVE_NAME: Record<Lang, string> = { ko: "한국어", en: "English" };
