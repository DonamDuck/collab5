import type { Metadata } from "next";
import Link from "next/link";
// ⭐내려받기 주소·버전·응원 링크는 전부 이 JSON 한 파일에서 온다(빌드 때 읽힌다).
//   앱의 자동 업데이트도 같은 파일(`/side/monitoralign/version.json`)을 읽으므로
//   ⛔키 이름을 바꾸지 말 것. 새 버전을 낼 땐 zip을 올리고 이 JSON만 고친 뒤 배포하면 된다.
//   `url`이 비어 있으면 그 버튼은 「준비 중」으로 잠기고, `support`가 비어 있으면 응원 절이 통째로 숨는다.
import release from "../../../../public/side/monitoralign/version.json";

const NAME = "MonitorAlign";
const LEAD = "자리를 옮길 때마다 틀어지는 듀얼 모니터 배치를 클릭 두 번으로 맞춰요. 무료예요.";
const ICON = "/side/monitoralign/icon.png";

export const metadata: Metadata = {
  title: `${NAME} — 사적인 프로젝트 · collab5`,
  description: LEAD,
  alternates: { canonical: "/side/monitoralign" },
  openGraph: {
    type: "website",
    siteName: "collab5",
    locale: "ko_KR",
    url: "/side/monitoralign",
    title: NAME,
    description: LEAD,
    images: [{ url: ICON, width: 1024, height: 1024 }],
  },
};

type Entry = { version: string; url: string };

const DOWNLOADS: { key: "mac" | "windows"; label: string; sub: string; entry: Entry }[] = [
  { key: "mac", label: "macOS용 내려받기", sub: "macOS 13 이상 · 인텔/애플 실리콘", entry: release.mac },
  { key: "windows", label: "Windows용 내려받기", sub: "Windows 10·11", entry: release.windows },
];

// 단축키·메뉴 이름 표시. 화면 속 글자를 그대로 옮긴 것이라 따옴표 대신 칩 모양으로 구분한다.
function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mx-[2px] inline-block whitespace-nowrap rounded-sm border border-hairline bg-surface-soft px-[6px] py-[1px] font-sans text-[14px] font-medium text-ink">
      {children}
    </kbd>
  );
}
// 맥·윈도우 단축키 한 줄. 「맥 [키]」「윈도우 [키]」를 한 덩어리씩 묶어 줄이 바뀌어도 키와 OS가 떨어지지 않게 한다.
function Shortcuts({ lead, mac, win }: { lead?: string; mac: string; win: string }) {
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[14px] text-mute">
      {lead && <span>{lead}</span>}
      <span className="inline-flex items-center whitespace-nowrap">
        맥 <Key>{mac}</Key>
      </span>
      <span className="inline-flex items-center whitespace-nowrap">
        윈도우 <Key>{win}</Key>
      </span>
    </span>
  );
}
function UiLabel({ children }: { children: React.ReactNode }) {
  return <span className="font-medium text-ink">{children}</span>;
}

const STEPS: React.ReactNode[] = [
  <>
    메뉴바 아이콘을 눌러 <UiLabel>모니터 정렬하기</UiLabel>를 골라요. 윈도우는 작업 표시줄 트레이에 아이콘이 있어요.
    <Shortcuts lead="단축키로도 열려요." mac="⌃⌥⌘A" win="Ctrl+Alt+Shift+A" />
  </>,
  <>다른 화면으로 넘어갈 자리를 가장자리 근처에서 클릭해요.</>,
  <>이번엔 그 화면에서 마우스가 들어올 자리를 클릭해요.</>,
  <>확인을 누르면 끝이에요.</>,
];

export default function MonitorAlignPage() {
  const support = release.support.trim();

  return (
    <main className="mx-auto w-full max-w-[560px] px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
      <Link
        href="/side"
        className="-ml-2 inline-flex h-[44px] items-center gap-1 rounded-md px-2 text-[14px] text-mute hover:text-ink"
      >
        <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[16px]" fill="none" stroke="currentColor" strokeWidth="1.9">
          <path d="m12 5-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        사적인 프로젝트
      </Link>

      {/* 히어로 — 아이콘 파일이 자체 라운드와 투명 여백을 갖고 있어 모서리를 더 깎지 않는다. */}
      <div className="mt-4 flex flex-col items-start gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={ICON} alt={`${NAME} 아이콘`} width={96} height={96} className="size-[96px]" />
        <div>
          <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">{NAME}</h1>
          <p className="mt-2 text-[17px] leading-relaxed break-keep text-body">{LEAD}</p>
        </div>
      </div>

      {/* 내려받기 — 버튼 두 개가 이 화면의 주 버튼이다. url이 비면 잠근 모양으로 「준비 중」. */}
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {DOWNLOADS.map(({ key, label, sub, entry }) =>
          entry.url ? (
            <a
              key={key}
              href={entry.url}
              className="flex min-h-[64px] flex-col items-center justify-center rounded-md bg-primary px-4 py-3 text-center text-primary-on transition-colors hover:bg-primary-strong"
            >
              <span className="text-[16px] font-bold">{label}</span>
              <span className="mt-0.5 text-[13px]">
                {sub} · v{entry.version}
              </span>
            </a>
          ) : (
            <span
              key={key}
              aria-disabled="true"
              className="flex min-h-[64px] cursor-not-allowed flex-col items-center justify-center rounded-md bg-surface-soft px-4 py-3 text-center text-mute"
            >
              <span className="text-[16px] font-bold">{label}</span>
              <span className="mt-0.5 text-[13px]">준비 중</span>
            </span>
          ),
        )}
      </div>
      <p className="mt-3 text-[14px] leading-relaxed break-keep text-mute">
        새 버전이 나오면 앱이 알려 주고 바로 업데이트할 수 있어요.
      </p>

      <section className="mt-10 border-t border-hairline pt-7">
        <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">쓰는 법</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {STEPS.map((step, i) => (
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
          <p>잘못 맞췄다면 되돌리기 단축키로 직전 배치로 돌아가요.</p>
          <Shortcuts mac="⌃⌥⌘Z" win="Ctrl+Alt+Shift+Z" />
          <p className="mt-2 text-[14px] text-mute">단축키는 설정에서 바꿀 수 있어요.</p>
        </div>
      </section>

      <section className="mt-10 border-t border-hairline pt-7">
        <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">처음 열 때</h2>
        <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
          아직 애플과 마이크로소프트의 서명을 받지 않은 앱이라서, 처음 한 번은 안내 창이 떠요.
        </p>
        <dl className="mt-4 flex flex-col gap-3">
          <div className="rounded-md border border-hairline px-4 py-3">
            <dt className="text-[14px] font-bold text-ink">맥</dt>
            <dd className="mt-1 text-[15px] leading-relaxed break-keep text-body">
              확인되지 않은 개발자라는 안내가 보이면 <UiLabel>시스템 설정 › 개인정보 보호 및 보안</UiLabel>으로 가서{" "}
              <UiLabel>그래도 열기</UiLabel>를 눌러 주세요.
            </dd>
          </div>
          <div className="rounded-md border border-hairline px-4 py-3">
            <dt className="text-[14px] font-bold text-ink">윈도우</dt>
            <dd className="mt-1 text-[15px] leading-relaxed break-keep text-body">
              <UiLabel>Windows의 PC 보호</UiLabel> 창이 뜨면 <UiLabel>추가 정보</UiLabel>를 누른 다음{" "}
              <UiLabel>실행</UiLabel>을 고르면 돼요.
            </dd>
          </div>
        </dl>
      </section>

      {/* 응원하기 — version.json의 support가 비어 있으면 절 전체를 그리지 않는다. */}
      {support && (
        <section className="mt-10 border-t border-hairline pt-7">
          <h2 className="text-[19px] font-bold leading-snug tracking-tight text-ink">응원하기</h2>
          <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
            쓰다가 마음에 드셨다면 응원해 주세요. 다음 도구를 만드는 힘이 돼요.
          </p>
          <a
            href={support}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex h-[44px] items-center justify-center rounded-md border border-border-strong px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
          >
            응원하기
          </a>
        </section>
      )}

      <p className="mt-12 border-t border-hairline pt-5 text-[13px] leading-relaxed break-keep text-mute">
        collab5를 만드는 사람이 개인적으로 만든 도구예요. collab5 서비스와는 별개예요.
      </p>
    </main>
  );
}
