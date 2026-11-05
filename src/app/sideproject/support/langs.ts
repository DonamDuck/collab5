// 후원하기 페이지의 언어 목록 한 곳 — 주소·hreflang·og:locale·언어 링크 이름이 전부 여기서 나온다.
// 사이트맵(src/app/sitemap.ts)과 앱 상세의 응원 절(MonitorAlign·LimitGlance `#support`)도 이 파일을 읽는다.
// ⭐한국어만 접미사 없는 주소(/sideproject/support)다. 영어는 /sideproject/support/en.
//   다른 언어 방문자는 영어 페이지로 보낸다(해외 창구가 Buy Me a Coffee 하나라서 영어 한 벌이면 된다).
// ⭐영어는 Buy Me a Coffee 주소가 channels.ts에 들어와야 문을 연다(11-05 대표 「계정 없으니 빼고 고고」).
//   그전엔 /en이 404이고, 사이트맵·언어 링크·hreflang에서 빠지고, 한국어 아닌 앱 상세엔 응원 절이 안 나온다.
import { SUPPORT_CHANNELS } from "./channels";

export const LANGS = ["ko", "en"] as const;
export type Lang = (typeof LANGS)[number];

/** 한국어를 뺀 나머지 — `[lang]` 동적 경로가 미리 굽는 목록. */
export const SUB_LANGS = LANGS.filter((l): l is Exclude<Lang, "ko"> => l !== "ko");

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

/** 지금 문을 연 언어. 한국어는 계좌가 있어 늘 열려 있다. */
export const OPEN_LANGS: Lang[] = LANGS.filter((l) => l === "ko" || SUPPORT_CHANNELS.buymeacoffee.url.trim() !== "");

export function isOpen(lang: Lang): boolean {
  return OPEN_LANGS.includes(lang);
}

/** hreflang x-default가 가리킬 언어 — 영어가 열렸으면 영어, 아니면 한국어. */
export const DEFAULT_LANG: Lang = isOpen("en") ? "en" : "ko";

export const BASE_PATH = "/sideproject/support";

export const PATH = Object.fromEntries(LANGS.map((l) => [l, l === "ko" ? BASE_PATH : `${BASE_PATH}/${l}`])) as Record<Lang, string>;

export const HREFLANG: Record<Lang, string> = { ko: "ko", en: "en" };
export const OG_LOCALE: Record<Lang, string> = { ko: "ko_KR", en: "en_US" };
/** 언어 링크에 그 언어 자신의 글자로 적는 이름. */
export const NATIVE_NAME: Record<Lang, string> = { ko: "한국어", en: "English" };

/** 앱 상세의 응원 절이 거는 주소 — 한국어 페이지는 한국어 후원 페이지로, 나머지 언어는 전부 영어 후원 페이지로.
 *  영어가 아직 안 열렸으면 null(그 페이지는 응원 절을 그리지 않는다). */
export function supportPathFor(pageLang: string): string | null {
  if (pageLang === "ko") return PATH.ko;
  return isOpen("en") ? PATH.en : null;
}
