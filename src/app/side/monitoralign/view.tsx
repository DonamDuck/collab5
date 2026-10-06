// MonitorAlign 상세 — 한국어(/side/monitoralign)와 영어(/side/monitoralign/en)가 같은 틀을 쓴다.
// 문안은 아래 COPY에 언어별로 있다. 영어는 직역이 아니라 영어권 독자에게 맞게 따로 썼다.
//
// ⭐내려받기 주소·버전은 version.json 한 파일에서 온다(빌드 때 읽힌다). 앱 업데이터도 같은 파일을 읽으므로
//   ⛔키 이름·모양을 바꾸지 말 것. `url`이 비어 있으면 그 버튼은 「준비 중」으로 잠긴다.
// ⭐후원 창구는 version.json이 아니라 `../projects.ts`의 `support`에 있다(업데이터가 모르는 모양이라서).
//   앱의 [응원하기] 메뉴가 `#support`로 들어오므로 그 절의 id를 바꾸지 말 것.
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import release from "../../../../public/side/monitoralign/version.json";
import { getSideProject, type SupportLink } from "../projects";
import { DownloadButtons, type DownloadItem } from "./DownloadButtons";
import { HtmlLang } from "./HtmlLang";

export type Lang = "ko" | "en";

const NAME = "MonitorAlign";
const ICON = "/side/monitoralign/icon.png";
const PATH: Record<Lang, string> = { ko: "/side/monitoralign", en: "/side/monitoralign/en" };

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

// ── 문안 ───────────────────────────────────────────────────
type Copy = {
  title: string;
  description: string;
  ogTitle: string;
  ogLocale: string;
  back: string;
  lead: string;
  downloads: { mac: [string, string]; windows: [string, string]; soon: string };
  free: string;
  autoUpdate: string;
  whyTitle: string;
  why: string[];
  howTitle: string;
  steps: ReactNode[];
  undo: { text: string; custom: string };
  featuresTitle: string;
  features: string[];
  firstTitle: string;
  firstIntro: string;
  firstMac: [string, ReactNode];
  firstWin: [string, ReactNode];
  faqTitle: string;
  faq: { q: string; a: string }[];
  supportTitle: string;
  supportText: string;
  supportAbroad?: string;
  footer: string;
  macLabel: string;
  winLabel: string;
};

const COPY: Record<Lang, Copy> = {
  ko: {
    title: `${NAME} — 듀얼 모니터 배치를 클릭 두 번으로 (맥·윈도우 무료)`,
    description: "자리를 옮길 때마다 틀어지는 듀얼 모니터 배치를 클릭 두 번으로 맞춰요. 맥과 윈도우에서 무료로 쓸 수 있어요.",
    ogTitle: `${NAME} — 듀얼 모니터 배치를 클릭 두 번으로`,
    ogLocale: "ko_KR",
    back: "사적인 프로젝트",
    lead: "자리를 옮길 때마다 틀어지는 듀얼 모니터 배치를 클릭 두 번으로 맞춰요.",
    downloads: {
      mac: ["macOS용 내려받기", "macOS 13 이상 · 인텔/애플 실리콘"],
      windows: ["Windows용 내려받기", "Windows 10·11"],
      soon: "준비 중",
    },
    free: "무료예요. 가입은 필요 없어요.",
    autoUpdate: "새 버전이 나오면 앱이 알려 줘요. 그 자리에서 바로 업데이트돼요.",
    whyTitle: "왜 만들었냐면요",
    why: [
      "노트북을 들고 집 책상, 카페, 사무실을 오가다 보면 모니터가 놓이는 쪽이 매번 달라져요.",
      "그런데 컴퓨터는 예전 배치를 그대로 기억하고 있어서 마우스가 엉뚱한 가장자리로 빠져나가거든요. 설정 창에서 네모를 끌어다 맞추는 대신, 넘어갈 자리와 들어올 자리만 찍으면 되게 만들었어요.",
    ],
    howTitle: "쓰는 법",
    steps: [
      <>
        메뉴바 아이콘을 눌러 <UiLabel>모니터 정렬하기</UiLabel>를 골라요. 윈도우는 작업 표시줄 트레이에 아이콘이 있어요.
        <Shortcuts lead="단축키로도 열려요." mac="⌃⌥⌘A" win="Ctrl+Alt+Shift+A" macLabel="맥" winLabel="윈도우" />
      </>,
      <>다른 화면으로 넘어갈 자리를 가장자리 근처에서 클릭해요.</>,
      <>이번엔 그 화면에서 마우스가 들어올 자리를 찍어요.</>,
      <>확인을 누르면 두 자리가 맞닿게 정렬돼요.</>,
    ],
    undo: { text: "잘못 맞췄다면 되돌리기 단축키로 직전 배치로 돌아가요.", custom: "단축키는 설정에서 바꿔요." },
    featuresTitle: "이런 앱이에요",
    features: [
      "무료로 내려받아 바로 써요.",
      "압축 파일이 맥은 약 430KB, 윈도우는 약 60KB밖에 안 돼요.",
      "맥에서 손쉬운 사용 같은 특별한 권한을 달라고 하지 않아요.",
      "잘못 맞췄으면 단축키 하나로 되돌려요.",
      "단축키를 손에 익은 조합으로 바꿔 쓰고 새 버전도 앱 안에서 받아요.",
    ],
    firstTitle: "처음 열 때",
    firstIntro: "아직 애플과 마이크로소프트의 서명을 받지 않은 앱이라서 처음 한 번은 안내 창이 떠요.",
    firstMac: [
      "맥",
      <>
        확인되지 않은 개발자라는 안내가 보이면 <UiLabel>시스템 설정 › 개인정보 보호 및 보안</UiLabel>으로 가서{" "}
        <UiLabel>그래도 열기</UiLabel>를 눌러 주세요.
      </>,
    ],
    firstWin: [
      "윈도우",
      <>
        <UiLabel>Windows의 PC 보호</UiLabel> 창이 뜨면 <UiLabel>추가 정보</UiLabel>를 누른 다음 <UiLabel>실행</UiLabel>을 고르면 돼요.
      </>,
    ],
    faqTitle: "자주 묻는 질문",
    faq: [
      {
        q: "안전한가요? 컴퓨터의 무엇을 바꾸나요?",
        a: "디스플레이 배치 설정 하나만 바꿔요. 시스템 설정(윈도우는 디스플레이 설정)에서 화면 네모를 끌어 옮기는 것과 같은 일이에요. 마음에 안 들면 되돌리기 단축키로 돌아가요.",
      },
      { q: "모니터가 세 대여도 되나요?", a: "아직은 두 대까지만 돼요." },
      {
        q: "제 정보를 모으나요?",
        a: "아니요. 계정이 없고 앱 안에 분석 도구도 넣지 않았어요. 새 버전이 있는지 보려고 collab5.co.kr에서 작은 파일 하나를 받아 올 뿐이에요.",
      },
      {
        q: "어떤 컴퓨터에서 돌아가나요?",
        a: "맥은 macOS 13 이상이면 인텔과 애플 실리콘 둘 다 돌아가요. 윈도우는 10과 11에서 써요.",
      },
    ],
    supportTitle: "응원하기",
    supportText: "쓰다가 마음에 드셨다면 응원해 주세요. 다음 도구를 만드는 힘이 돼요.",
    supportAbroad: "해외에서는",
    footer: "collab5를 만드는 사람이 개인적으로 만든 도구예요. collab5 서비스와는 별개예요.",
    macLabel: "맥",
    winLabel: "윈도우",
  },
  en: {
    title: `${NAME} — Fix your dual-monitor layout in two clicks (macOS & Windows)`,
    description:
      "Moved your laptop and now the pointer leaves the wrong edge? MonitorAlign lines your two displays back up in two clicks. Free for macOS and Windows.",
    ogTitle: `${NAME} — Fix your dual-monitor layout in two clicks`,
    ogLocale: "en_US",
    back: "Side projects",
    lead: "Your monitors end up in a new spot every time you change desks. MonitorAlign lines them back up in two clicks.",
    downloads: {
      mac: ["Download for macOS", "macOS 13+ · Intel & Apple silicon"],
      windows: ["Download for Windows", "Windows 10 & 11"],
      soon: "Coming soon",
    },
    free: "Free, no account needed.",
    autoUpdate: "When there's a new version, the app lets you know and you can update right away.",
    whyTitle: "Why it exists",
    why: [
      "Home desk on Monday, a café on Tuesday, the office on Wednesday. Your external monitor lands on a different side each time, but your computer still remembers the old arrangement, so the pointer slides off the wrong edge.",
      "Instead of dragging rectangles around in display settings, you just click where you want to cross.",
    ],
    howTitle: "How it works",
    steps: [
      <>
        Click the menu bar icon and choose <UiLabel>Align Monitors</UiLabel>. On Windows, the icon sits in the system tray.
        <Shortcuts lead="Or press" mac="⌃⌥⌘A" win="Ctrl+Alt+Shift+A" macLabel="Mac" winLabel="Windows" />
      </>,
      <>On this screen, click near the edge where the pointer should cross over.</>,
      <>Move to the other screen and click where it should come in.</>,
      <>Confirm, and the two points snap together.</>,
    ],
    undo: { text: "Got it wrong? The undo shortcut puts the previous layout back.", custom: "You can change both shortcuts in Settings." },
    featuresTitle: "What you get",
    features: [
      "Free to download and use.",
      "Tiny: about 430 KB zipped on Mac, about 60 KB on Windows.",
      "No special permissions on Mac. It never asks for Accessibility access.",
      "A single shortcut undoes a layout that came out wrong.",
      "Shortcuts you can remap, and updates that install from inside the app.",
    ],
    firstTitle: "Opening it the first time",
    firstIntro: "The app isn't signed by Apple or Microsoft yet, so you'll see a warning the first time you open it.",
    firstMac: [
      "Mac",
      <>
        If macOS says the developer can&apos;t be verified, go to <UiLabel>System Settings › Privacy &amp; Security</UiLabel> and
        click <UiLabel>Open Anyway</UiLabel>.
      </>,
    ],
    firstWin: [
      "Windows",
      <>
        If you see <UiLabel>Windows protected your PC</UiLabel>, click <UiLabel>More info</UiLabel>, then <UiLabel>Run anyway</UiLabel>.
      </>,
    ],
    faqTitle: "FAQ",
    faq: [
      {
        q: "Is it safe? What does it actually change?",
        a: "Only your display arrangement setting. It's the same change you'd make by dragging the screens around in System Settings or Windows display settings, and the undo shortcut restores the previous layout.",
      },
      { q: "Does it work with three monitors?", a: "Not yet. Two displays only for now." },
      {
        q: "Does it collect any data?",
        a: "No. There's no account and no analytics in the app. The only network request is a small update file it fetches from collab5.co.kr.",
      },
      {
        q: "What do I need to run it?",
        a: "macOS 13 or later on Intel or Apple silicon, or Windows 10 or 11.",
      },
    ],
    supportTitle: "Support",
    supportText: "If it saves you a bit of hassle, you can chip in. It helps me keep building small tools like this.",
    footer: "A personal project by the maker of collab5. It isn't part of the collab5 service.",
    macLabel: "Mac",
    winLabel: "Windows",
  },
};

// ── 메타데이터 ─────────────────────────────────────────────
export function monitorAlignMetadata(lang: Lang): Metadata {
  const c = COPY[lang];
  return {
    title: c.title,
    description: c.description,
    alternates: {
      canonical: PATH[lang],
      // hreflang — 서로를 가리키고, 어느 쪽에도 안 맞는 방문자는 영어로.
      languages: { ko: PATH.ko, en: PATH.en, "x-default": PATH.en },
    },
    openGraph: {
      type: "website",
      siteName: "collab5",
      locale: c.ogLocale,
      alternateLocale: lang === "ko" ? ["en_US"] : ["ko_KR"],
      url: PATH[lang],
      title: c.ogTitle,
      description: c.description,
      images: [{ url: `/side/monitoralign/og-${lang}.png`, width: 1200, height: 630, alt: c.ogTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: c.ogTitle,
      description: c.description,
      images: [`/side/monitoralign/og-${lang}.png`],
    },
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

export function MonitorAlignView({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  const project = getSideProject("monitoralign");
  const live = (xs: SupportLink[] | undefined) => (xs ?? []).filter((x) => x.url.trim());
  const supportMain = live(project.support?.[lang]);
  // 한국어 페이지는 해외 창구도 「해외에서는」 아래 작게 보여 준다. 영어 페이지엔 한국 창구를 안 띄운다.
  const supportAbroad = lang === "ko" ? live(project.support?.en) : [];
  const hasSupport = supportMain.length > 0 || supportAbroad.length > 0;

  const downloads: DownloadItem[] = [
    { os: "mac", label: c.downloads.mac[0], sub: c.downloads.mac[1], url: release.mac.url, version: release.mac.version, soon: c.downloads.soon },
    { os: "windows", label: c.downloads.windows[0], sub: c.downloads.windows[1], url: release.windows.url, version: release.windows.version, soon: c.downloads.soon },
  ];

  return (
    <main lang={lang} className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      {lang !== "ko" && <HtmlLang lang={lang} />}

      <div className="flex items-center justify-between gap-3">
        <Link
          href="/side"
          className="-ml-2 inline-flex h-[44px] items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
        >
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px]" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {c.back}
        </Link>
        {/* 언어 바꾸기 — 지금 언어는 굵게, 링크는 다른 언어로만. */}
        <nav aria-label="Language" className="-mr-2 flex items-center text-[14px]">
          {(["ko", "en"] as const).map((l, i) => (
            <span key={l} className="flex items-center">
              {i > 0 && <span aria-hidden="true" className="text-hairline">|</span>}
              {l === lang ? (
                <span aria-current="page" lang={l} className="inline-flex h-[44px] items-center px-2 font-bold text-ink">
                  {l === "ko" ? "한국어" : "English"}
                </span>
              ) : (
                <Link href={PATH[l]} hrefLang={l} lang={l} className="inline-flex h-[44px] items-center rounded-md px-2 text-mute hover:text-ink">
                  {l === "ko" ? "한국어" : "English"}
                </Link>
              )}
            </span>
          ))}
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
              <span className="min-w-0 flex-1">{step}</span>
            </li>
          ))}
        </ol>
        <div className="mt-5 rounded-md bg-surface-faint px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
          <p>{c.undo.text}</p>
          <Shortcuts mac="⌃⌥⌘Z" win="Ctrl+Alt+Shift+Z" macLabel={c.macLabel} winLabel={c.winLabel} />
          <p className="mt-2 text-[14px] text-mute">{c.undo.custom}</p>
        </div>
      </section>

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

      <section className={SECTION}>
        <h2 className={H2}>{c.firstTitle}</h2>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">{c.firstIntro}</p>
        <dl className="mt-4 flex flex-col gap-3">
          {[c.firstMac, c.firstWin].map(([label, body]) => (
            <div key={label} className="rounded-md border border-hairline px-4 py-3">
              <dt className="text-[14px] font-bold text-ink">{label}</dt>
              <dd className="mt-1 text-[15px] leading-relaxed break-keep text-body">{body}</dd>
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
