// 후원하기 — 한국어(/sideproject/support)와 영어(/sideproject/support/en)가 같은 틀을 쓴다(10-15).
// 언어 목록·주소는 ./langs.ts, 문안은 ./_copy/, 창구 주소는 ./channels.ts 한 곳에 있다.
//
// ⭐앱 상세의 응원 절(`#support`)은 버튼 하나로 여기를 가리킨다. 앱의 [응원하기] 메뉴는 그 절로 들어오니
//   창구를 바꿀 땐 channels.ts만 고치면 앱·상세·이 페이지가 같이 따라온다.
// ⭐공유 카드(og) 그림은 따로 굽지 않았다. 사적인 프로젝트 목록처럼 사이트 기본 그림(OG_IMAGE)을 쓴다.
import type { Metadata } from "next";
import Link from "next/link";
import { OG_IMAGE, SITE_URL } from "@/lib/site";
import { koWrap, koWrapDeep } from "../koWrap";
import { en as limitGlanceEn } from "../limitglance/_copy/en";
import { HtmlLang } from "../monitoralign/HtmlLang";
import { en as monitorAlignEn } from "../monitoralign/_copy/en";
import { SIDE_PROJECTS } from "../projects";
import { COPY } from "./_copy";
import { SUPPORT_CHANNELS } from "./channels";
import { HREFLANG, LANGS, NATIVE_NAME, OG_LOCALE, PATH, type Lang } from "./langs";

export type { Lang } from "./langs";

// 영어 페이지의 앱 한 줄 소개. projects.ts의 tagline은 한국어뿐이라 각 앱 영어 문안의 히어로 문장(lead)을 쓴다.
// 여기 없는 앱(새로 더한 앱)은 영어 페이지에도 한국어 tagline이 그대로 나온다. 앱을 더하면 한 줄 같이 더할 것.
const EN_TAGLINE: Partial<Record<string, string>> = {
  monitoralign: monitorAlignEn.lead,
  limitglance: limitGlanceEn.lead,
};

const pageTitle = (lang: Lang) => `${COPY[lang].title} — ${COPY[lang].eyebrow} · collab5`;

// ── 메타데이터 ─────────────────────────────────────────────
export function supportMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  const languages: Record<string, string> = Object.fromEntries(LANGS.map((l) => [HREFLANG[l], PATH[l]]));
  languages["x-default"] = PATH.en;
  const title = pageTitle(lang);
  return {
    title,
    description: c.lead,
    alternates: { canonical: PATH[lang], languages },
    openGraph: {
      type: "website",
      siteName: "collab5",
      locale: OG_LOCALE[lang],
      alternateLocale: LANGS.filter((l) => l !== lang).map((l) => OG_LOCALE[l]),
      url: PATH[lang],
      title,
      description: c.lead,
      images: [{ url: OG_IMAGE, width: 1200, height: 630 }],
    },
    twitter: { card: "summary_large_image", title, description: c.lead, images: [OG_IMAGE] },
  };
}

// ── 구조화 데이터(JSON-LD) — 빵부스러기만 ─────────────────
function structuredData(lang: Lang) {
  const c = COPY[lang];
  const url = `${SITE_URL}${PATH[lang]}`;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "@id": `${url}#breadcrumb`,
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "collab5", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: c.eyebrow, item: `${SITE_URL}/sideproject` },
      { "@type": "ListItem", position: 3, name: c.title, item: url },
    ],
  };
}

// ── 화면 ───────────────────────────────────────────────────
const H2 = "text-[19px] font-bold leading-snug tracking-tight text-ink";
const SECTION = "mt-10 border-t border-hairline pt-7";

/** 주 후원 버튼. 주소가 비어 있으면 내려받기 버튼의 「준비 중」과 같은 모양으로 잠근다. */
function ChannelLink({ label, sub, url, soon }: { label: string; sub: string; url: string; soon: string }) {
  if (!url) {
    return (
      <span
        aria-disabled="true"
        className="flex min-h-[64px] cursor-not-allowed flex-col items-center justify-center rounded-md bg-surface-soft px-4 py-3 text-center text-mute"
      >
        <span className="text-[16px] font-bold">{label}</span>
        <span className="mt-0.5 text-[13px]">{soon}</span>
      </span>
    );
  }
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="flex min-h-[64px] flex-col items-center justify-center rounded-md bg-primary px-4 py-3 text-center text-primary-on transition-colors hover:bg-primary-strong"
    >
      <span className="text-[16px] font-bold">{label}</span>
      <span className="mt-0.5 text-[13px]">{sub}</span>
    </a>
  );
}

export function SupportView({ lang }: { lang: Lang }) {
  // 한국어는 화면에 그릴 때만 덩어리 줄바꿈을 다듬는다(../koWrap.ts). 메타데이터는 원문 COPY를 쓴다.
  const c = lang === "ko" ? koWrapDeep(COPY.ko) : COPY[lang];
  const other = LANGS.find((l) => l !== lang) as Lang;
  const overseasUrl = c.overseas ? SUPPORT_CHANNELS[c.overseas.id].url.trim() : "";

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
          <span className="truncate">{c.eyebrow}</span>
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

      <div className="mt-4">
        <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{c.title}</h1>
        {/* 문장마다 줄을 새로 시작하고 문장 안은 고르게 나눈다(앱 상세와 같은 방식). */}
        <p className="mt-2 text-[17px] leading-relaxed break-keep text-balance text-body">
          {c.lead.split(/(?<=[.?!。])\s+/).map((sentence, i) => (
            <span key={i} className="block">
              {sentence}
            </span>
          ))}
        </p>
      </div>

      <section className={SECTION}>
        <h2 className={H2}>{c.channelsTitle}</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {c.buttons.map((b) => (
            <ChannelLink key={b.id} label={b.label} sub={b.sub} url={SUPPORT_CHANNELS[b.id].url.trim()} soon={c.soon} />
          ))}
        </div>
        {c.overseas && (
          <p className="mt-3 text-[14px] leading-relaxed text-mute">
            {c.overseas.text}{" "}
            {overseasUrl ? (
              <a
                href={overseasUrl}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-body underline underline-offset-4 hover:text-ink"
              >
                {c.overseas.link}
              </a>
            ) : (
              <span>
                {c.overseas.link} · {c.soon}
              </span>
            )}
          </p>
        )}
        <p className="mt-5 rounded-md bg-surface-faint px-4 py-3 text-[15px] leading-relaxed break-keep text-pretty text-body">{c.note}</p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.appsTitle}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {SIDE_PROJECTS.map((p) => {
            const tagline = lang === "en" ? (EN_TAGLINE[p.slug] ?? p.tagline) : koWrap(p.tagline);
            return (
              <li key={p.slug}>
                <Link
                  href={lang === "ko" ? `/sideproject/${p.slug}` : `/sideproject/${p.slug}/${lang}`}
                  className="flex items-center gap-4 rounded-lg border border-hairline bg-surface p-4 transition-colors hover:bg-surface-faint"
                >
                  {/* 아이콘 파일이 자체 라운드와 투명 여백을 갖고 있어 여기서 더 깎지 않는다(목록 카드와 같다). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.icon} alt="" aria-hidden="true" width={64} height={64} className="size-[64px] shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-[17px] font-bold leading-snug text-ink">{p.name}</p>
                    <p className="mt-1 text-[15px] leading-relaxed break-keep text-pretty text-body">{tagline}</p>
                  </div>
                  <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px] shrink-0 text-mute" fill="none" stroke="currentColor" strokeWidth="1.9">
                    <path d="m8 5 5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed break-keep text-pretty text-mute">{c.footer}</p>
    </main>
  );
}
