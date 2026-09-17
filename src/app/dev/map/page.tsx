import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRentMock } from "@/lib/rent-mock";
import { MOCK_CASES, MOCK_MAIL_KINDS } from "@/lib/rent-mock-data";
import { SITE_MAIL_KINDS } from "@/lib/site-mock-data";
import { RENT_GROUPS, RENT_POPUPS } from "./rent-rows";
import { SITE_GROUPS, SITE_POPUPS } from "./site-rows";
import type { Group, Popup, Row } from "./types";

// 🗺사이트 화면 지도 (2026-09-18) · 개발 빌드 전용
//
// 대표 09-18: *「map으로 만들면 디자인팀 검수 같은 것도 하기 편하고 나도 그냥 들어가서 막 볼 수 있기도 하고」*.
//   「화면 지도 띄워 줘」 = 이 한 장. 09-17 하루 가게 지도(`/dev/rent-map`)를 사이트 전체로 넓혔고, 옛 주소는 `#rent`로 보낸다.
//   링크는 전부 `/dev/mock`을 거쳐 케이스 쿠키를 넣고 들어간다. 로그인·결제·기다림 없이 모든 화면 × 모든 상태를 연다.
//
// 🚨**규칙 (대표 결정 09-18) — 화면을 새로 만들거나 상태를 늘리면 여기에 케이스도 같이 더한다.**
//   안 더하면 지도에서 조용히 빠지고, 디자인팀 검수에서도 같이 빠진다.
//   줄은 `site-rows.ts`(하루 가게 밖) · `rent-rows.ts`(하루 가게)에, 가상 데이터는 `lib/site-mock-data.ts` · `lib/rent-mock-data.ts`에.
// 🚨목 데이터에서 쓰기는 두 겹으로 막는다. 서버 액션 첫 줄(`rentMockOn()`) + 쓰기 함수 첫 줄(`site-mock-repo.ts`·`throwIfMock`).
//   새 쓰기 액션을 만들면 첫 줄 울타리도 같이 넣는다. 외부 AI(Gemini·Claude, 유료)와 메일(Resend)은 목 모드에서 절대 부르지 않는다.
// 🚨운영에선 404(미들웨어가 `/dev/*`를 막고, 여기서도 한 번 더). 검색에도 안 걸리게 noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "화면 지도 (개발용)",
  robots: { index: false, follow: false },
};

const go = (c: string, to: string) => `/dev/mock?case=${encodeURIComponent(c)}&to=${encodeURIComponent(to)}`;
const caseLabel = (c: string) => MOCK_CASES.find((x) => x.id === c)?.label ?? c;

const linkCls = "text-body underline underline-offset-2 hover:text-ink";

function CaseRow({ row }: { row: Row }) {
  return (
    <li className="flex flex-col gap-0.5 border-b border-hairline py-2.5 sm:flex-row sm:items-baseline sm:gap-4">
      <a href={go(row.c, row.to)} className={`${linkCls} min-w-0 flex-1 break-keep text-[15px]`}>
        {row.desc}
      </a>
      <span className="shrink-0 text-[13px] text-faint">
        {caseLabel(row.c)} · <code className="break-all">{row.to}</code>
      </span>
    </li>
  );
}

function Screens({ group, level }: { group: Group; level: 2 | 3 }) {
  const H = level === 2 ? "h2" : "h3";
  return (
    <section id={group.id} className={`${level === 2 ? "mt-12" : "mt-9"} scroll-mt-20`}>
      <H className={level === 2 ? "text-[22px] font-bold leading-snug tracking-tight text-ink" : "text-[19px] font-bold text-ink"}>
        {group.title}
      </H>
      {group.screens.map((sc) => (
        <div key={sc.title} className="mt-7">
          <p className="text-[17px] font-bold text-ink">
            {sc.title}
            {sc.path && <code className="ml-2 text-[14px] font-normal text-faint">{sc.path}</code>}
          </p>
          {sc.note && <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">{sc.note}</p>}
          <ul className="mt-2">
            {sc.rows.map((r) => (
              <CaseRow key={`${r.c}-${r.to}`} row={r} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function PopupList({ items }: { items: Popup[] }) {
  return (
    <ul className="mt-2">
      {items.map((p) => (
        <li key={`${p.where.c}-${p.where.to}-${p.title}`} className="border-b border-hairline py-2.5 text-[15px] leading-relaxed break-keep text-body">
          <a href={go(p.where.c, p.where.to)} className={linkCls}>
            {p.where.desc}
          </a>
          에서 {p.button}를 누르면 <b className="font-medium text-ink">{p.title}</b>
        </li>
      ))}
    </ul>
  );
}

export default async function SiteMapPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const current = await getRentMock();

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">화면 지도</h1>
      <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
        링크를 누르면 그 케이스의 가짜 데이터로 화면이 열려요. 로그인도 결제도 필요 없어요. 버튼을 눌러도 저장하지 않고
        「목 데이터 보기 중이라 저장하지 않았어요」가 떠요.
      </p>
      <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">
        폰 폭은 크롬 개발자도구의 기기 모드에서 375×812로, 데스크톱은 1440 폭으로 봐 주세요. 가짜 데이터가 켜진 동안엔
        화면 왼쪽 아래에 까만 띠가 떠요. 다 보셨으면 띠의 「끄기」를 눌러 주세요.
      </p>
      <p className="mt-4 rounded-lg bg-surface-soft px-4 py-3 text-[15px] leading-relaxed break-keep text-body">
        {current ? (
          <>
            지금 켜진 케이스는 <b className="font-medium text-ink">{current.label}</b>예요.{" "}
            <a href="/dev/mock?off=1" className={linkCls}>
              끄기
            </a>
          </>
        ) : (
          "지금은 실제 데이터로 보고 있어요."
        )}
      </p>

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
        {SITE_GROUPS.map((g) => (
          <a key={g.id} href={`#${g.id}`} className={linkCls}>
            {g.title}
          </a>
        ))}
        <a href="#rent" className={linkCls}>하루 가게</a>
        <a href="#popup" className={linkCls}>팝업</a>
        <a href="#mail" className={linkCls}>메일</a>
        <a href="#cases" className={linkCls}>케이스 전체</a>
      </nav>

      {SITE_GROUPS.map((g) => (
        <Screens key={g.id} group={g} level={2} />
      ))}

      <section id="rent" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">하루 가게</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          09-17에 만든 하루 가게 지도를 그대로 옮겼어요. 예전 주소 /dev/rent-map으로 들어와도 여기로 와요.
        </p>
        {RENT_GROUPS.map((g) => (
          <Screens key={g.id} group={g} level={3} />
        ))}
      </section>

      <section id="popup" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">팝업 · 상태</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          주소로 열 수 없는 것들이에요. 화면을 연 뒤 버튼을 눌러 주세요. 팝업 안의 확인 버튼도 저장은 하지 않아요.
        </p>
        <h3 className="mt-6 text-[17px] font-bold text-ink">사이트</h3>
        <PopupList items={SITE_POPUPS} />
        <h3 className="mt-6 text-[17px] font-bold text-ink">하루 가게</h3>
        <PopupList items={RENT_POPUPS} />
      </section>

      <section id="mail" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">메일</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          실제로 보내는 함수와 같은 글을 만들어 화면에만 띄워요. 케이스 쿠키와 상관없이 열려요.
        </p>
        <h3 className="mt-6 text-[17px] font-bold text-ink">사이트</h3>
        <ul className="mt-2">
          {SITE_MAIL_KINDS.map((k) => (
            <li key={k.kind} className="border-b border-hairline py-2.5">
              <Link href={`/dev/mail/${k.kind}`} className={`${linkCls} text-[15px] break-keep`}>
                {k.label}
              </Link>
            </li>
          ))}
        </ul>
        <h3 className="mt-6 text-[17px] font-bold text-ink">하루 가게</h3>
        <ul className="mt-2">
          {MOCK_MAIL_KINDS.map((k) => (
            <li key={k.kind} className="border-b border-hairline py-2.5">
              <Link href={`/dev/mail/${k.kind}`} className={`${linkCls} text-[15px] break-keep`}>
                {k.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="cases" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">케이스 전체</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          케이스만 켜고 주소는 직접 치고 싶을 때 써요. 누르면 홈으로 들어가요.
        </p>
        <ul className="mt-2">
          {MOCK_CASES.map((c) => (
            <CaseRow key={c.id} row={{ desc: c.label, c: c.id, to: "/" }} />
          ))}
        </ul>
      </section>
    </main>
  );
}
