// MonitorAlign 상세 — 아홉 언어가 같은 틀을 쓴다. 한국어는 /sideproject/monitoralign,
// 나머지는 /sideproject/monitoralign/<언어>([lang]/page.tsx). 언어 목록·주소는 ./langs.ts, 문안은 ./_copy/에 있다.
//
// ⭐내려받기 주소·버전은 version.json 한 파일에서 온다(빌드 때 읽힌다). 앱 업데이터도 같은 파일을 읽으므로
//   ⛔키 이름·모양을 바꾸지 말 것. `url`이 비어 있으면 그 버튼은 「준비 중」으로 잠긴다.
// ⭐후원 창구는 version.json이 아니라 `../projects.ts`의 `support`에 있다(업데이터가 모르는 모양이라서).
//   앱의 [응원하기] 메뉴가 `#support`로 들어오므로 그 절의 id를 바꾸지 말 것.
// ⭐검색 노출(10-08): 페이지마다 hreflang 아홉 개+x-default, 그 언어 og 이미지, JSON-LD(앱·FAQ·사용법·빵부스러기)를 낸다.
//   JSON-LD의 문장은 화면 문안에서 바로 만든다(따로 적지 않는다) → 화면과 구조화 데이터가 어긋날 수 없다.
//   ⛔별점·리뷰·내려받기 수는 넣지 않는다. 없는 숫자를 구조화 데이터에 넣으면 검색엔진 벌점 대상이다.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import release from "../../../../public/sideproject/monitoralign/version.json";
import { getSideProject, type SupportLink } from "../projects";
import { COPY, type Copy, type Step } from "./_copy";
import { DownloadButtons, type DownloadItem } from "./DownloadButtons";
import { HtmlLang } from "./HtmlLang";
import { StepFigure, WhyFigure } from "./Illustrations";
import { FONT_STACK, HREFLANG, LANGS, NATIVE_NAME, OG_LOCALE, PATH, type Lang } from "./langs";

export type { Lang } from "./langs";

const NAME = "MonitorAlign";
const ICON = "/sideproject/monitoralign/icon.png";
const SHORTCUT = { align: { mac: "⌃⌥⌘A", win: "Ctrl+Alt+Shift+A" }, undo: { mac: "⌃⌥⌘Z", win: "Ctrl+Alt+Shift+Z" } };
// 띄어쓰기 없이 쓰는 언어. 줄바꿈 규칙(break-keep 해제)과 평문 이어 붙이기(공백·마침표)가 달라진다.
const NO_SPACES: ReadonlySet<Lang> = new Set<Lang>(["ja", "zh-cn", "zh-tw"]);

// ── 작은 표시 조각 ─────────────────────────────────────────
// 단축키·메뉴 이름. 화면 속 글자를 그대로 옮긴 것이라 따옴표 대신 칩·굵은 글씨로 구분한다.
function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="mx-[2px] inline-block whitespace-nowrap rounded-sm border border-hairline bg-surface-soft px-[6px] py-[1px] font-sans text-[14px] font-medium text-ink">
      {children}
    </kbd>
  );
}
function UiLabel({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}
// 맥·윈도우 단축키 한 줄. OS 이름과 키를 한 덩어리로 묶어 줄이 바뀌어도 떨어지지 않게 한다.
function Shortcuts({ lead, mac, win, macLabel, winLabel }: { lead?: string; mac: string; win: string; macLabel: string; winLabel: string }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-mute">
      {lead && <span>{lead}</span>}
      <span className="inline-flex items-center whitespace-nowrap">
        {macLabel} <Key>{mac}</Key>
      </span>
      <span className="inline-flex items-center whitespace-nowrap">
        {winLabel} <Key>{win}</Key>
      </span>
    </span>
  );
}

// 문안의 `**메뉴 이름**` → 화면에선 굵게(UiLabel), 구조화 데이터에선 별표만 벗긴 평문.
function rich(s: string): ReactNode {
  return s.split("**").map((part, i) => (i % 2 === 1 ? <UiLabel key={i}>{part}</UiLabel> : part));
}
const plain = (s: string) => s.replaceAll("**", "");

/** 쓰는 법 한 단계의 평문 — HowTo 구조화 데이터용. 화면에 그리는 것과 같은 조각을 같은 순서로 잇는다. */
function stepText(step: Step, c: Copy, lang: Lang): string {
  const cjk = NO_SPACES.has(lang);
  const parts = [plain(step.text)];
  if (step.shortcutLead !== undefined) {
    parts.push(
      cjk
        ? `${step.shortcutLead}${SHORTCUT.align.mac}（${c.macLabel}）/ ${SHORTCUT.align.win}（${c.winLabel}）。`
        : `${step.shortcutLead} ${SHORTCUT.align.mac} (${c.macLabel}) / ${SHORTCUT.align.win} (${c.winLabel}).`,
    );
  }
  if (step.note) parts.push(plain(step.note));
  return parts.join(cjk ? "" : " ");
}

// ── 메타데이터 ─────────────────────────────────────────────
export function monitorAlignMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  // hreflang — 아홉 언어가 서로를 가리키고, 어느 쪽에도 안 맞는 방문자는 영어로.
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [HREFLANG[l], PATH[l]]));
  languages["x-default"] = PATH.en;
  const og = `/sideproject/monitoralign/og-${lang}.png`;
  return {
    title: c.title,
    description: c.description,
    keywords: c.keywords,
    alternates: { canonical: PATH[lang], languages },
    openGraph: {
      type: "website",
      siteName: "collab5",
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      url: PATH[lang],
      title: c.ogTitle,
      description: c.description,
      images: [{ url: og, width: 1200, height: 630, alt: c.ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.ogTitle,
      description: c.description,
      images: [og],
    },
  };
}

// ── 구조화 데이터(JSON-LD) ─────────────────────────────────
function structuredData(lang: Lang) {
  const c = COPY[lang];
  const url = `${SITE_URL}${PATH[lang]}`;
  const inLanguage = HREFLANG[lang];
  // 윈도우 주소가 비어 있는 동안(준비 중)은 맥 파일만 내려받기 주소로 낸다.
  const downloadUrl = release.windows.url ? [release.mac.url, release.windows.url] : release.mac.url;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: NAME,
        description: c.description,
        url,
        image: `${SITE_URL}${ICON}`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "macOS 13 or later, Windows 10, Windows 11",
        softwareVersion: release.mac.version,
        downloadUrl,
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        inLanguage,
        publisher: { "@type": "Organization", name: "collab5", url: SITE_URL },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage,
        mainEntity: c.faq.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: c.howToName,
        inLanguage,
        step: c.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: stepText(s, c, lang) })),
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "collab5", item: SITE_URL },
          { "@type": "ListItem", position: 2, name: c.back, item: `${SITE_URL}/sideproject` },
          { "@type": "ListItem", position: 3, name: NAME, item: url },
        ],
      },
    ],
  };
}

// ── 화면 ───────────────────────────────────────────────────
const H2 = "text-[19px] font-bold leading-snug tracking-tight text-ink";
const SECTION = "mt-10 border-t border-hairline pt-7";

function SupportButtons({ links }: { links: SupportLink[] }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-[44px] items-center justify-center rounded-md border border-border-strong px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
        >
          {l.label}
          {l.note && <span className="ml-2 text-[13px] font-normal text-mute">{l.note}</span>}
        </a>
      ))}
    </div>
  );
}

// 언어 바꾸기 — 아홉 개라 한 줄에 못 늘어놓는다. JS 없이 열리는 <details> 메뉴에 링크를 담는다.
// 닫혀 있어도 링크는 HTML에 그대로 있어서 크롤러가 따라간다. 언어마다 그 언어 글자로 적는다.
// `key={lang}` — 다른 언어로 옮겨 가면 메뉴를 새로 그려 열린 채로 남지 않게 한다.
function LanguageMenu({ lang }: { lang: Lang }) {
  return (
    <details key={lang} className="group relative -mr-2">
      <summary className="flex h-[44px] cursor-pointer list-none items-center gap-1.5 rounded-md px-2 text-[14px] text-mute hover:text-ink [&::-webkit-details-marker]:hidden">
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
          <circle cx="10" cy="10" r="7.25" />
          <path d="M2.75 10h14.5M10 2.75c2 2.1 3 4.5 3 7.25s-1 5.15-3 7.25c-2-2.1-3-4.5-3-7.25s1-5.15 3-7.25Z" strokeLinejoin="round" />
        </svg>
        <span lang={HREFLANG[lang]}>{NATIVE_NAME[lang]}</span>
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[14px] shrink-0 transition-transform group-open:rotate-180" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <ul className="absolute top-full right-0 z-20 mt-1 w-[168px] rounded-md border border-hairline bg-surface py-1 shadow-e2">
        {LANGS.map((l) => (
          <li key={l}>
            {l === lang ? (
              <span aria-current="page" lang={HREFLANG[l]} className="flex h-[44px] items-center px-4 text-[15px] font-bold text-ink">
                {NATIVE_NAME[l]}
              </span>
            ) : (
              <Link
                href={PATH[l]}
                hrefLang={HREFLANG[l]}
                lang={HREFLANG[l]}
                className="flex h-[44px] items-center px-4 text-[15px] text-body hover:bg-surface-soft hover:text-ink"
              >
                {NATIVE_NAME[l]}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function MonitorAlignView({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const project = getSideProject("monitoralign");
  const live = (xs: SupportLink[] | undefined) => (xs ?? []).filter((x) => x.url.trim());
  // 후원 창구는 한국 것(ko)과 해외 것(en) 두 벌이다. 한국어가 아닌 페이지는 모두 해외 창구를 쓴다.
  const supportMain = live(lang === "ko" ? project.support?.ko : project.support?.en);
  // 한국어 페이지는 해외 창구도 「해외에서는」 아래 작게 보여 준다. 다른 언어 페이지엔 한국 창구를 안 띄운다.
  const supportAbroad = lang === "ko" ? live(project.support?.en) : [];
  const hasSupport = supportMain.length > 0 || supportAbroad.length > 0;
  const font = FONT_STACK[lang];
  // 일본어·중국어는 띄어쓰기가 없어서 `break-keep`(띄어쓰기에서만 줄바꿈)이면 한 문장이 한 덩어리가 되어
  // 좁은 폰에서 옆으로 넘친다. 이 두 언어에선 글자 사이 줄바꿈을 되살린다.
  const noSpaces = NO_SPACES.has(lang);

  const downloads: DownloadItem[] = [
    { os: "mac", label: c.downloads.mac[0], sub: c.downloads.mac[1], url: release.mac.url, version: release.mac.version, soon: c.downloads.soon },
    { os: "windows", label: c.downloads.windows[0], sub: c.downloads.windows[1], url: release.windows.url, version: release.windows.version, soon: c.downloads.soon },
  ];

  return (
    <main
      lang={HREFLANG[lang]}
      style={font ? { fontFamily: font } : undefined}
      className={`mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12${noSpaces ? " [&_.break-keep]:break-normal" : ""}`}
    >
      {lang !== "ko" && <HtmlLang lang={HREFLANG[lang]} />}
      <script
        type="application/ld+json"
        // `<`를 <로 바꿔 문안 속 글자가 스크립트 태그를 닫지 못하게 한다(Next 공식 권고).
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData(lang)).replace(/</g, "\\u003c") }}
      />

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/sideproject"
          className="-ml-2 inline-flex h-[44px] min-w-0 items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span className="truncate">{c.back}</span>
        </Link>
        <nav aria-label="Language" className="shrink-0">
          <LanguageMenu lang={lang} />
        </nav>
      </div>

      {/* 히어로 — 아이콘 파일이 자체 라운드와 투명 여백을 갖고 있어 모서리를 더 깎지 않는다. */}
      <div className="mt-4 flex flex-col items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON} alt={`${NAME} icon`} width={96} height={96} className="size-[96px]" />
        <div>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{NAME}</h1>
          <p className="mt-2 text-[17px] leading-relaxed break-keep text-body">{c.lead}</p>
        </div>
      </div>

      <div className="mt-8">
        <DownloadButtons items={downloads} />
      </div>
      <p className="mt-3 text-[14px] leading-relaxed break-keep text-mute">
        <span className="font-medium text-body">{c.free}</span> {c.autoUpdate}
      </p>

      <section className={SECTION}>
        <h2 className={H2}>{c.whyTitle}</h2>
        {c.why.map((p, i) => (
          <p key={i} className="mt-3 text-[16px] leading-relaxed break-keep text-body">
            {p}
          </p>
        ))}
        <WhyFigure t={c.fig} font={font} />
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.howTitle}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {c.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[16px] leading-relaxed break-keep text-body">
              <span
                aria-hidden="true"
                className="mt-[2px] flex size-[24px] shrink-0 items-center justify-center rounded-pill bg-primary-pale text-[13px] font-bold text-primary-on"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {rich(step.text)}
                {step.shortcutLead !== undefined && (
                  <Shortcuts lead={step.shortcutLead} mac={SHORTCUT.align.mac} win={SHORTCUT.align.win} macLabel={c.macLabel} winLabel={c.winLabel} />
                )}
                {step.note && <span className="mt-1.5 block">{rich(step.note)}</span>}
                <StepFigure step={i} t={c.fig} font={font} />
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-md bg-surface-faint px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
          <p>{c.undo.text}</p>
          <Shortcuts mac={SHORTCUT.undo.mac} win={SHORTCUT.undo.win} macLabel={c.macLabel} winLabel={c.winLabel} />
          {c.undo.custom && <p className="mt-2 text-[14px] text-mute">{c.undo.custom}</p>}
        </div>
      </section>

      {c.features.length > 0 && (
        <section className={SECTION}>
          <h2 className={H2}>{c.featuresTitle}</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {c.features.map((f) => (
              <li key={f} className="flex gap-2.5 text-[16px] leading-relaxed break-keep text-body">
                <svg aria-hidden="true" viewBox="0 0 20 20" className="mt-[5px] size-[16px] shrink-0 text-primary-on" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="m4.5 10.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="min-w-0 flex-1">{f}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={SECTION}>
        <h2 className={H2}>{c.firstTitle}</h2>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">{c.firstIntro}</p>
        <dl className="mt-4 flex flex-col gap-3">
          {[c.firstMac, c.firstWin].map(([label, body]) => (
            <div key={label} className="rounded-md border border-hairline px-4 py-3">
              <dt className="text-[14px] font-bold text-ink">{label}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed break-keep text-body">{rich(body)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.faqTitle}</h2>
        <dl className="mt-4 flex flex-col gap-5">
          {c.faq.map((f) => (
            <div key={f.q}>
              <dt className="text-[16px] font-bold leading-snug break-keep text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed break-keep text-body">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* 응원하기 — 앱의 [응원하기] 메뉴가 `#support`로 들어온다. 보여 줄 창구가 없으면 절을 그리지 않는다. */}
      {hasSupport && (
        <section id="support" className={`${SECTION} scroll-mt-[72px]`}>
          <h2 className={H2}>{c.supportTitle}</h2>
          <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">{c.supportText}</p>
          {supportMain.length > 0 && <SupportButtons links={supportMain} />}
          {supportAbroad.length > 0 && (
            <>
              <p className="mt-5 text-[14px] text-mute">{c.supportAbroad}</p>
              <SupportButtons links={supportAbroad} />
            </>
          )}
        </section>
      )}

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed break-keep text-mute">{c.footer}</p>
    </main>
  );
}
