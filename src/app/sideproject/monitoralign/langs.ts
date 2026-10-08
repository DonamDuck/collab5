// MonitorAlign 상세의 언어 목록 한 곳 — 주소·hreflang·og:locale·언어 메뉴 이름이 전부 여기서 나온다.
// 사이트맵(src/app/sitemap.ts)도 이 파일을 읽으므로 언어를 더하거나 뺄 땐 여기만 고친다.
//
// ⭐한국어만 접미사 없는 주소(/sideproject/monitoralign)다. 나머지는 /sideproject/monitoralign/<세그먼트>.
//   세그먼트는 소문자(zh-cn·pt-br), hreflang은 BCP 47 표기(zh-Hans·pt-BR)라 둘을 따로 둔다.
export const LANGS = ["ko", "en", "ja", "zh-cn", "zh-tw", "es", "de", "fr", "pt-br"] as const;
export type Lang = (typeof LANGS)[number];

/** 한국어를 뺀 나머지 — `[lang]` 동적 경로가 미리 굽는 목록. */
export const SUB_LANGS = LANGS.filter((l): l is Exclude<Lang, "ko"> => l !== "ko");

export function isLang(x: string): x is Lang {
  return (LANGS as readonly string[]).includes(x);
}

export const BASE_PATH = "/sideproject/monitoralign";

export const PATH = Object.fromEntries(LANGS.map((l) => [l, l === "ko" ? BASE_PATH : `${BASE_PATH}/${l}`])) as Record<Lang, string>;

/** hreflang = <html lang>·<main lang>에도 같은 값을 쓴다. */
export const HREFLANG: Record<Lang, string> = {
  ko: "ko",
  en: "en",
  ja: "ja",
  "zh-cn": "zh-Hans",
  "zh-tw": "zh-Hant",
  es: "es",
  de: "de",
  fr: "fr",
  "pt-br": "pt-BR",
};

// 스페인어 문안은 중남미에서도 읽히게 썼지만 og:locale은 소비처가 다 아는 es_ES로 둔다(es_419는 페이스북 목록에 없다).
export const OG_LOCALE: Record<Lang, string> = {
  ko: "ko_KR",
  en: "en_US",
  ja: "ja_JP",
  "zh-cn": "zh_CN",
  "zh-tw": "zh_TW",
  es: "es_ES",
  de: "de_DE",
  fr: "fr_FR",
  "pt-br": "pt_BR",
};

/** 언어 메뉴에 그 언어 자신의 글자로 적는 이름. */
export const NATIVE_NAME: Record<Lang, string> = {
  ko: "한국어",
  en: "English",
  ja: "日本語",
  "zh-cn": "简体中文",
  "zh-tw": "繁體中文",
  es: "Español",
  de: "Deutsch",
  fr: "Français",
  "pt-br": "Português",
};

// 사이트 기본 글꼴(Pretendard)은 한글·라틴용이라 가나·한자가 시스템 글꼴로 한 자씩 빠진다.
// 일본어·중국어 페이지는 그 언어 글꼴을 앞에 세워 한 문장 안에서 글꼴이 섞이지 않게 한다.
export const FONT_STACK: Partial<Record<Lang, string>> = {
  ja: '"Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", "Yu Gothic", Meiryo, system-ui, sans-serif',
  "zh-cn": '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans SC", system-ui, sans-serif',
  "zh-tw": '"PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif',
};
