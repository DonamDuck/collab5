// 후원하기 — 한국어(/sideproject/support)와 영어(/sideproject/support/en)가 같은 틀을 쓴다(10-15).
// 언어 목록·주소는 ./langs.ts, 문안은 ./_copy/, 창구 주소는 ./channels.ts 한 곳에 있다.
//
// ⭐앱 상세의 응원 절(`#support`)은 버튼 하나로 여기를 가리킨다. 앱의 [응원하기] 메뉴는 그 절로 들어오니
//   창구를 바꿀 땐 channels.ts만 고치면 앱·상세·이 페이지가 같이 따라온다.
// ⭐창구 칸은 산사 후원 창구 모양이다(11-05 대표): 계좌 카드(복사) → 카카오페이 줄 → Buy Me a Coffee 줄 → 작은 안내 한 줄.
//   계좌는 한국어에만, 주소가 빈 줄은 숨는다. 영어는 BMC 한 줄이라 그게 비면 「Coming soon」으로 잠가 둔다.
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
import { SUPPORT_ACCOUNT, SUPPORT_CHANNELS, type ChannelId } from "./channels";
import type { ChannelRow } from "./_copy/types";
import { AccountCard } from "./AccountCard";
import { HREFLANG, LANGS, NATIVE_NAME, OG_LOCALE, PATH, type Lang } from "./langs";

export type { Lang } from "./langs";

// 영어 페이지의 앱 한 줄 소개. projects.ts의 tagline은 한국어뿐이라 각 앱 영어 문안의 히어로 문장(lead)을 쓴다.
// 여기 없는 앱(새로 더한 앱)은 영어 페이지에도 한국어 tagline이 그대로 나온다. 앱을 더하면 한 줄 같이 더할 것.
const EN_TAGLINE: Partial<Record<string, string>> = {
  monitoralign: monitorAlignEn.lead,
  limitglance: limitGlanceEn.lead,
};

// 「후원받는 앱」에서 빼는 앱. 한마디는 나중에 유료로 갈 앱이라 후원을 받지 않는다(10-15 대표).
const NO_SUPPORT: ReadonlySet<string> = new Set(["hanmadi"]);

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

// 창구 줄의 색 — 카카오 공식 노랑, Buy Me a Coffee 공식 노랑. 글자는 둘 다 검정(각 브랜드 버튼 규격).
const ROW_TONE: Record<ChannelId, string> = {
  kakaopay: "bg-[#FEE500] text-[#191919] hover:bg-[#F2DA00]",
  buymeacoffee: "bg-[#FFDD00] text-[#0D0C22] hover:bg-[#F2D200]",
};

function RowIcon({ id }: { id: ChannelId }) {
  if (id === "kakaopay") {
    return (
      <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[20px] shrink-0" fill="currentColor">
        <path d="M10 3C5.6 3 2 5.8 2 9.2c0 2.2 1.5 4.1 3.7 5.2l-.8 2.9c-.1.3.2.5.4.3l3.4-2.3c.4 0 .9.1 1.3.1 4.4 0 8-2.8 8-6.2S14.4 3 10 3Z" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[20px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6">
      <path d="M4.5 6.5h11l-1.3 10a1.5 1.5 0 0 1-1.5 1.3H7.3a1.5 1.5 0 0 1-1.5-1.3l-1.3-10Z" strokeLinejoin="round" />
      <path d="M3.5 6.5h13M6 6.5 6.8 3h6.4l.8 3.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** 창구 한 줄 — 왼쪽 이름, 오른쪽 할 일(산사 후원 창구 모양). `soon`이 있으면 잠근 모양으로 그린다. */
function ChannelRowLink({ row, url, soon }: { row: ChannelRow; url: string; soon?: string }) {
  const inner = (
    <>
      <span className="flex min-w-0 items-center gap-2.5">
        <RowIcon id={row.id} />
        <span className="text-[16px] font-bold whitespace-nowrap">{row.label}</span>
        {row.sub && !soon && <span className="truncate text-[13px] opacity-70">{row.sub}</span>}
      </span>
      <span className="shrink-0 text-[15px] font-bold">{soon ?? row.action}</span>
    </>
  );
  const box = "flex min-h-[64px] items-center justify-between gap-3 rounded-[16px] px-5";
  if (soon) {
    return (
      <span aria-disabled="true" className={`${box} cursor-not-allowed bg-surface-soft text-mute`}>
        {inner}
      </span>
    );
  }
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`${box} transition-colors ${ROW_TONE[row.id]}`}>
      {inner}
    </a>
  );
}

export function SupportView({ lang }: { lang: Lang }) {
  // 한국어는 화면에 그릴 때만 덩어리 줄바꿈을 다듬는다(../koWrap.ts). 메타데이터는 원문 COPY를 쓴다.
  const c = lang === "ko" ? koWrapDeep(COPY.ko) : COPY[lang];
  const other = LANGS.find((l) => l !== lang) as Lang;
  const liveRows = c.rows.filter((r) => SUPPORT_CHANNELS[r.id].url.trim());
  // 계좌도 링크도 하나 없으면(영어 페이지에 BMC가 아직 없을 때) 첫 줄을 「준비 중」으로 잠가 둔다. 빈 칸으로 두지 않는다.
  const lockedRow = !c.account && liveRows.length === 0 ? c.rows[0] : null;

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
        <div className="mt-4 flex flex-col gap-3">
          {c.account && (
            <AccountCard
              bank={SUPPORT_ACCOUNT.bank}
              holder={SUPPORT_ACCOUNT.holder}
              number={SUPPORT_ACCOUNT.number}
              copy={c.account.copy}
              copied={c.account.copied}
            />
          )}
          {liveRows.map((r) => (
            <ChannelRowLink key={r.id} row={r} url={SUPPORT_CHANNELS[r.id].url.trim()} />
          ))}
          {lockedRow && <ChannelRowLink row={lockedRow} url="" soon={c.soon} />}
        </div>
        <p className="mt-4 text-[14px] leading-relaxed break-keep text-pretty text-mute">{c.note}</p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.appsTitle}</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {SIDE_PROJECTS.filter((p) => !NO_SUPPORT.has(p.slug)).map((p) => {
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
