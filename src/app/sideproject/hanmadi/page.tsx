// 한마디 상세(/sideproject/hanmadi). 한국어만이다(10-19). 문안은 ./copy.ts, 그림은 ./Illustrations.tsx.
//
// ⭐내려받기 주소·버전은 public/sideproject/hanmadi/version.json 한 파일에서 온다. 깔린 앱의 업데이터도
//   같은 파일을 읽으므로 ⛔키 이름·모양을 바꾸지 말 것. `url`이 비어 있으면 버튼은 「준비 중」으로 잠긴다.
// ⭐JSON-LD 문장은 화면 문안에서 바로 만든다(MonitorAlign·LimitGlance와 같은 방식). 별점·리뷰·내려받기 수는 넣지 않는다.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { SITE_URL } from "@/lib/site";
import release from "../../../../public/sideproject/hanmadi/version.json";
import { koWrapDeep } from "../koWrap";
import { DownloadButtons } from "../monitoralign/DownloadButtons";
import { HANMADI } from "./copy";
import { CardFigure, ListFigure } from "./Illustrations";

const NAME = "Hanmadi";
const PATH = "/sideproject/hanmadi";
const ICON = "/sideproject/hanmadi/icon.png";
const OG = "/sideproject/hanmadi/og-ko.png";

function UiLabel({ children }: { children: ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}
// 문안의 `**메뉴 이름**` → 화면에선 굵게, 구조화 데이터에선 별표만 벗긴 평문.
function rich(s: string): ReactNode {
  return s.split("**").map((part, i) => (i % 2 === 1 ? <UiLabel key={i}>{part}</UiLabel> : part));
}
const plain = (s: string) => s.replaceAll("**", "");

export const metadata: Metadata = {
  title: HANMADI.title,
  description: HANMADI.description,
  keywords: HANMADI.keywords,
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: PATH,
    title: HANMADI.ogTitle,
    description: HANMADI.description,
    images: [{ url: OG, width: 1200, height: 630, alt: HANMADI.ogTitle }],
  },
  twitter: { card: "summary_large_image", title: HANMADI.ogTitle, description: HANMADI.description, images: [OG] },
};

function structuredData() {
  const c = HANMADI;
  const url = `${SITE_URL}${PATH}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        "@id": `${url}#app`,
        name: NAME,
        alternateName: "한마디",
        description: c.description,
        url,
        image: `${SITE_URL}${ICON}`,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "macOS 13 or later",
        softwareVersion: release.mac.version,
        ...(release.mac.url ? { downloadUrl: release.mac.url } : {}),
        offers: { "@type": "Offer", price: "0", priceCurrency: "KRW" },
        inLanguage: "ko",
        publisher: { "@type": "Organization", name: "collab5", url: SITE_URL },
      },
      {
        "@type": "FAQPage",
        "@id": `${url}#faq`,
        inLanguage: "ko",
        mainEntity: c.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: plain(f.a) } })),
      },
      {
        "@type": "HowTo",
        "@id": `${url}#howto`,
        name: c.howToName,
        inLanguage: "ko",
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

const H2 = "text-[19px] font-bold leading-snug tracking-tight text-ink";
const SECTION = "mt-10 border-t border-hairline pt-7";
const P = "mt-3 text-[16px] leading-relaxed break-keep text-pretty text-body";

export default function HanmadiPage() {
  // 화면에 그릴 때만 덩어리 줄바꿈을 다듬는다(../koWrap.ts). 구조화 데이터는 원문을 쓴다.
  const c = koWrapDeep(HANMADI);

  return (
    <main lang="ko" className="mx-auto w-full max-w-[720px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData()).replace(/</g, "\\u003c") }}
      />

      <Link
        href="/sideproject"
        className="-ml-2 inline-flex h-[44px] min-w-0 items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px] shrink-0" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="truncate">{c.back}</span>
      </Link>

      {/* 히어로 — 아이콘 파일이 자체 라운드와 투명 여백을 갖고 있어 모서리를 더 깎지 않는다. */}
      <div className="mt-4 flex flex-col items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON} alt={`${NAME} 아이콘`} width={96} height={96} className="size-[96px]" />
        <div>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{NAME}</h1>
          <p className="mt-2 text-[17px] leading-relaxed break-keep text-balance text-body">
            {c.lead.split(/(?<=[.?!])\s+/).map((sentence, i) => (
              <span key={i} className="block">
                {sentence}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <DownloadButtons
          items={[{ os: "mac", label: c.download[0], sub: c.download[1], url: release.mac.url, version: release.mac.version, soon: c.soon }]}
        />
      </div>
      <p className="mt-3 text-[14px] leading-relaxed break-keep text-pretty text-mute">
        <span className="font-medium text-body">{c.free}</span> {c.autoUpdate}
      </p>

      <section className={SECTION}>
        <h2 className={H2}>{c.whyTitle}</h2>
        {c.why.map((p, i) => (
          <p key={i} className={P}>
            {p}
          </p>
        ))}
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
                {i === 1 && <CardFigure t={HANMADI.fig} />}
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-5 rounded-md bg-surface-faint px-4 py-3 text-[15px] leading-relaxed break-keep text-pretty text-body">{c.keys}</p>
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.listTitle}</h2>
        {c.list.map((p, i) => (
          <p key={i} className={P}>
            {rich(p)}
          </p>
        ))}
        <ListFigure t={HANMADI.fig} />
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.importTitle}</h2>
        {c.imports.map((p, i) => (
          <p key={i} className={P}>
            {rich(p)}
          </p>
        ))}
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.firstTitle}</h2>
        {c.first.map((p, i) => (
          <p key={i} className={P}>
            {rich(p)}
          </p>
        ))}
      </section>

      <section className={SECTION}>
        <h2 className={H2}>{c.faqTitle}</h2>
        <dl className="mt-4 flex flex-col gap-5">
          {c.faq.map((f) => (
            <div key={f.q}>
              <dt className="text-[16px] font-bold leading-snug break-keep text-pretty text-ink">{f.q}</dt>
              <dd className="mt-1.5 text-[15px] leading-relaxed break-keep text-pretty text-body">{rich(f.a)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed break-keep text-pretty text-mute">{c.footer}</p>
    </main>
  );
}
