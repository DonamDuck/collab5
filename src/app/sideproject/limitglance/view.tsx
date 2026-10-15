// LimitGlance 상세 — 한국어(/sideproject/limitglance)와 영어(/sideproject/limitglance/en)가 같은 틀을 쓴다.
// 언어 목록·주소는 ./langs.ts, 문안은 ./_copy/, 확장 스토어 주소는 ./stores.ts에 있다.
//
// ⭐앱 내려받기 주소·버전은 version.json 한 파일에서 온다. 깔린 앱의 업데이터도 같은 파일을 읽으므로
//   ⛔키 이름·모양을 바꾸지 말 것. `url`이 비어 있으면 그 버튼은 「준비 중」으로 잠긴다.
// ⭐확장 설치 절의 id(`extension`)는 앱 메뉴 「브라우저 확장 설치하기…」가 들어오는 자리다. 바꾸지 말 것.
// ⭐JSON-LD 문장은 화면 문안에서 바로 만든다(MonitorAlign과 같은 방식). 별점·리뷰·내려받기 수는 넣지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import release from "../../../../public/sideproject/limitglance/version.json";
import { DownloadButtons, type DownloadItem } from "../monitoralign/DownloadButtons";
import { HtmlLang } from "../monitoralign/HtmlLang";
import { koWrapDeep } from "../koWrap";
import { COPY } from "./_copy";
import { FlowFigure, MenuFigure, TrayFigure } from "./Illustrations";
import { HREFLANG, LANGS, NATIVE_NAME, OG_LOCALE, PATH, type Lang } from "./langs";
import { EXTENSION_STORES } from "./stores";

export type { Lang } from "./langs";

const NAME = "LimitGlance";
const ICON = "/sideproject/limitglance/icon.png";

function UiLabel({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}
// 문안의 `**메뉴 이름**` → 화면에선 굵게, 구조화 데이터에선 별표만 벗긴 평문.
function rich(s: string): ReactNode {
  return s.split("**").map((part, i) => (i % 2 === 1 ? <UiLabel key={i}>{part}</UiLabel> : part));
}
const plain = (s: string) => s.replaceAll("**", "");

// ── 메타데이터 ─────────────────────────────────────────────
export function limitGlanceMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [HREFLANG[l], PATH[l]]));
  languages["x-default"] = PATH.en;
  const og = `/sideproject/limitglance/og-${lang}.png`;
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
    twitter: { card: "summary_large_image", title: c.ogTitle, description: c.description, images: [og] },
  };
}

// ── 구조화 데이터(JSON-LD) ─────────────────────────────────
function structuredData(lang: Lang) {
  const c = COPY[lang];
  const url = `${SITE_URL}${PATH[lang]}`;
  const inLanguage = HREFLANG[lang];
  const downloadUrl = [release.mac.url, release.windows.url].filter(Boolean);
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
        ...(downloadUrl.length ? { downloadUrl: downloadUrl.length === 1 ? downloadUrl[0] : downloadUrl } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
        inLanguage,
        publisher: { "@type": "Organization", name: "collab5", url: SITE_URL },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage,
        mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
      },
      {
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: c.howToName,
        inLanguage,
        step: c.steps.map((s, i) => ({ "@type": "HowToStep", position: i + 1, text: plain(s) })),
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

function StoreButton({ label, url, soon }: { label: string; url: string; soon: string }) {
  if (!url) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-[52px] cursor-not-allowed flex-col items-center justify-center rounded-md bg-surface-soft px-3 py-2 text-center text-mute"
      >
        <span className="text-[15px] font-bold">{label}</span>
        <span className="text-[12px]">{soon}</span>
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-[52px] items-center justify-center rounded-md border border-border-strong bg-surface px-3 py-2 text-center text-[15px] font-bold text-ink transition-colors hover:bg-surface-soft"
    >
      {label}
    </a>
  );
}

export function LimitGlanceView({ lang }: { lang: Lang }) {
  // 한국어는 화면에 그릴 때만 덩어리 줄바꿈을 다듬는다(../koWrap.ts). 구조화 데이터는 원문 COPY를 쓴다.
  const c = lang === "ko" ? koWrapDeep(COPY.ko) : COPY[lang];
  const other = LANGS.find((l) => l !== lang) as Lang;

  const downloads: DownloadItem[] = [
    { os: "mac", label: c.downloads.mac[0], sub: c.downloads.mac[1], url: release.mac.url, version: release.mac.version, soon: c.downloads.soon },
    { os: "windows", label: c.downloads.windows[0], sub: c.downloads.windows[1], url: release.windows.url, version: release.windows.version, soon: c.downloads.soon },
  ];

  return (
    <main lang={HREFLANG[lang]} className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      {lang !== "ko" && <HtmlLang lang={HREFLANG[lang]} />}
      <script
        type="application/ld+json"
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
        <Link
          href={PATH[other]}
          hrefLang={HREFLANG[other]}
          lang={HREFLANG[other]}
          className="-mr-2 inline-flex h-[44px] shrink-0 items-center rounded-md px-2 text-[14px] text-mute hover:text-ink"
        >
          {NATIVE_NAME[other]}
        </Link>
      </div>

      {/* 히어로 — 아이콘 파일이 자체 라운드와 투명 여백을 갖고 있어 모서리를 더 깎지 않는다. */}
      <div className="mt-4 flex flex-col items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON} alt={`${NAME} icon`} width={96} height={96} className="size-[96px]" />
        <div>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{NAME}</h1>
          {/* 문장마다 줄을 새로 시작하고 문장 안은 고르게 나눈다(10-14 대표: 줄바꿈이 어색함). */}
          <p className="mt-2 text-[17px] leading-relaxed break-keep text-balance text-body">
            {c.lead.split(/(?<=[.?!。])\s+/).map((sentence, i) => (
              <span key={i} className="block">
                {sentence}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <DownloadButtons items={downloads} />
      </div>

      <div id="extension" className="mt-4 scroll-mt-[72px] rounded-md border border-hairline px-4 py-4">
        <p className="text-[16px] font-bold text-ink">{c.extension.title}</p>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-pretty text-body">{c.extension.text}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <StoreButton label={c.extension.chrome} url={EXTENSION_STORES.chrome} soon={c.extension.soon} />
          <StoreButton label={c.extension.edge} url={EXTENSION_STORES.edge} soon={c.extension.soon} />
          <StoreButton label={c.extension.whale} url={EXTENSION_STORES.whale} soon={c.extension.soon} />
        </div>
        {c.extension.note && (
          <p className="mt-2.5 text-[13px] leading-relaxed break-keep text-pretty text-mute">{c.extension.note}</p>
        )}
      </div>

      <p className="mt-3 text-[14px] leading-relaxed break-keep text-pretty text-mute">
        <span className="font-medium text-body">{c.free}</span> {c.autoUpdate}
      </p>

      <section className={SECTION}>
        <h2 className={H2}>{c.whyTitle}</h2>
        {c.why.map((p, i) => (
          <p key={i} className="mt-3 text-[16px] leading-relaxed break-keep text-pretty text-body">
            {p}
          </p>
        ))}
        <MenuFigure t={c.fig} />
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.howTitle}</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {c.steps.map((step, i) => (
            <li key={i} className="flex gap-3 text-[16px] leading-relaxed break-keep text-pretty text-body">
              <span
                aria-hidden="true"
                className="mt-[2px] flex size-[24px] shrink-0 items-center justify-center rounded-pill bg-primary-pale text-[13px] font-bold text-primary-on"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                {rich(step)}
                {i === 0 && <TrayFigure t={c.fig} />}
                {i === 2 && <FlowFigure t={c.fig} />}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-md bg-surface-faint px-4 py-3 text-[15px] leading-relaxed break-keep text-pretty text-body">{c.menuNote}</p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.firstTitle}</h2>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-pretty text-body">{c.firstIntro}</p>
        <dl className="mt-4 flex flex-col gap-3">
          {[c.firstMac, c.firstWin].map(([label, body]) => (
            <div key={label} className="rounded-md border border-hairline px-4 py-3">
              <dt className="text-[14px] font-bold text-ink">{label}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed break-keep text-pretty text-body">{rich(body)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.faqTitle}</h2>
        <dl className="mt-4 flex flex-col gap-5">
          {c.faq.map((f) => (
            <div key={f.q}>
              <dt className="text-[16px] font-bold leading-snug break-keep text-pretty text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed break-keep text-pretty text-body">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed break-keep text-pretty text-mute">{c.footer}</p>
    </main>
  );
}
