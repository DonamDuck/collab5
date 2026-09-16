import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRentMock } from "@/lib/rent-mock";
import { MOCK_CASES, MOCK_IDS, MOCK_MAIL_KINDS } from "@/lib/rent-mock-data";

// 🗺하루 가게 화면 지도 (2026-09-17) · 개발 빌드 전용
//
// 대표 09-17: *「그 url 리스트가 있으면 나도 들어가서 쭉 보고 싶어」*. 디자인팀과 대표가 로그인·결제·기다림 없이
//   모든 화면 × 모든 상태를 링크 하나씩으로 연다. 링크는 전부 `/dev/rent-mock`을 거쳐 케이스 쿠키를 넣고 들어간다.
// ⭐이 목록은 코드의 실제 분기를 읽고 만들었다. 화면에 갈래가 늘면 여기에도 줄을 더한다.
// 🚨운영에선 404. 검색에도 안 걸리게 noindex.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "하루 가게 화면 지도 (개발용)",
  robots: { index: false, follow: false },
};

type Row = { desc: string; c: string; to: string };
type Screen = { title: string; path: string; note?: string; rows: Row[] };
type Group = { id: string; title: string; intro?: string; screens: Screen[] };

const S = MOCK_IDS.space;
const B = MOCK_IDS.booking;
const M = MOCK_IDS.maker;

const GROUPS: Group[] = [
  {
    id: "guest",
    title: "손님",
    screens: [
      {
        title: "목록",
        path: "/rent",
        rows: [
          { desc: "공간 여럿 (공개 중인 곳만 카드로)", c: "guest-full", to: "/rent" },
          { desc: "업종으로 거른 결과", c: "guest-full", to: "/rent?category=cafe" },
          { desc: "거르기 결과 0건", c: "guest-full", to: "/rent?area=제주" },
          { desc: "공간이 한 곳도 없을 때", c: "guest-empty", to: "/rent" },
          { desc: "긴 이름 카드", c: "stress-guest", to: "/rent" },
          { desc: "사진·업종 없는 카드", c: "minimal-guest", to: "/rent" },
        ],
      },
      {
        title: "공간 상세와 신청 폼",
        path: "/rent/[slug]",
        note: "신청 폼은 상세 맨 아래에 있어요. 날짜를 고르면 시간이, 시간을 고르면 아래 바에 금액이 떠요. 전화번호를 지우고 「신청하기」를 누르면 번호 오류 줄을 볼 수 있어요.",
        rows: [
          { desc: "모든 칸이 찬 공간 · 신청 폼 · 커피챗 · 소개서 링크", c: "guest-full", to: `/rent/${S.full}` },
          { desc: "같은 공간을 로그인 안 하고 볼 때", c: "anon", to: `/rent/${S.full}` },
          { desc: "열린 시간이 없는 공간", c: "guest-full", to: `/rent/${S.noSlots}` },
          { desc: "커피챗·소개서 없는 공간", c: "guest-full", to: `/rent/${S.other}` },
          { desc: "긴 글 (사진 12장, 유의 사항 12줄, 주제 8줄)", c: "stress-guest", to: `/rent/${S.stress}` },
          { desc: "최소 입력 (사진·소개·설비·전화 없음), 번호 없는 손님", c: "minimal-guest", to: `/rent/${S.minimal}` },
          { desc: "검토 대기 공간을 남이 열면 404", c: "guest-full", to: `/rent/${S.pending}` },
        ],
      },
      {
        title: "결제",
        path: "/rent/pay/[orderId]",
        note: "결제창은 이 컴퓨터에 넣어 둔 토스 키로 떠요. 끝까지 눌러도 돈을 확정하는 단계(승인)를 막아 두어서 실패 화면으로 가요.",
        rows: [
          { desc: "결제 전 신청 (커피챗 담음, 취소 규정 한 줄)", c: "guest-full", to: `/rent/pay/mock-order-${B.pending}` },
          { desc: "긴 글 · 큰 금액", c: "stress-guest", to: `/rent/pay/mock-order-${B.stressPending}` },
          { desc: "결제 실패 화면", c: "guest-full", to: "/rent/pay/fail?message=사용자가 결제를 취소했어요" },
        ],
      },
      {
        title: "예약 한 건",
        path: "/rent/done/[bookingId]",
        rows: [
          { desc: "결제 완료, 이용일 전, 커피챗 담음, 사장님 연락처 열림", c: "guest-full", to: `/rent/done/${B.paid}` },
          { desc: "확정된 예약, 이용일 전, 사장님 말씀 있음", c: "guest-full", to: `/rent/done/${B.confirmed}` },
          { desc: "확정된 예약, 커피챗·소개서 없는 공간", c: "guest-full", to: `/rent/done/${B.confirmedOther}` },
          { desc: "다녀온 예약 (연락처 가림)", c: "guest-full", to: `/rent/done/${B.done}` },
          { desc: "사장님 거절, 환불이 아직 안 끝남", c: "guest-full", to: `/rent/done/${B.rejected}` },
          { desc: "사장님 거절 뒤 환불 완료", c: "guest-full", to: `/rent/done/${B.refunded}` },
          { desc: "손님 취소, 일부 돌려받음", c: "guest-full", to: `/rent/done/${B.cancelledFuture}` },
          { desc: "손님 취소, 이용일 지남", c: "guest-full", to: `/rent/done/${B.cancelledPast}` },
          { desc: "결제 시간이 지난 신청", c: "guest-full", to: `/rent/done/${B.expired}` },
          { desc: "결제 전 신청을 열면 신청 목록으로 넘어가요", c: "guest-full", to: `/rent/done/${B.pending}` },
          { desc: "남의 예약이나 없는 번호 (404)", c: "guest-full", to: `/rent/done/${B.refundReq}` },
          { desc: "긴 글 · 확정", c: "stress-guest", to: `/rent/done/${B.stressConfirmed}` },
          { desc: "최소 입력 · 결제 완료 (사장님 이름·번호 없음)", c: "minimal-guest", to: `/rent/done/${B.minimalPaid}` },
        ],
      },
      {
        title: "내가 보낸 신청",
        path: "/rent/requests",
        note: "결제 안 한 신청 세 건은 맨 아래에 접혀 있어요. 날짜가 지난 결제 전 신청도 한 줄 있어요.",
        rows: [
          { desc: "앞으로 갈 곳, 지난 신청, 접힌 결제 안 한 신청", c: "guest-full", to: "/rent/requests" },
          { desc: "빈 목록", c: "guest-empty", to: "/rent/requests" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/requests" },
          { desc: "긴 글", c: "stress-guest", to: "/rent/requests" },
          { desc: "최소 입력", c: "minimal-guest", to: "/rent/requests" },
        ],
      },
    ],
  },
  {
    id: "host",
    title: "사장님",
    screens: [
      {
        title: "내 하루 가게",
        path: "/rent/my",
        note: "공간 넷은 공개 중·검토 대기·쉬는 중·초안이에요. 들어온 요청은 새 요청(수락 전 손님 정보), 이용 시간이 시작된 결제 완료, 확정(연락처 열림), 환불 신청 중, 다녀감(가림), 거절, 환불, 손님 취소 둘이에요. 맨 아래 「내가 빌린 공간」도 한 건 있어요. 「알림」 줄은 맨 위에 한 번 뜨고 주소에서 지워져요. 다시 보려면 링크를 한 번 더 누르면 돼요.",
        rows: [
          { desc: "모든 상태, 정산 계좌 있음", c: "host-full", to: "/rent/my" },
          { desc: "같은 화면, 정산 계좌 없음 (확정 줄마다 계좌 등록 한 줄)", c: "host-noaccount", to: "/rent/my" },
          { desc: "관리자이기도 한 사장님 (정산하기 링크, 검토 대기 공간에 공개하기 버튼)", c: "host-admin", to: "/rent/my" },
          { desc: "올린 공간이 없을 때", c: "host-empty", to: "/rent/my" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/my" },
          { desc: "알림 · 처음 올린 뒤", c: "host-full", to: "/rent/my?saved=new" },
          { desc: "알림 · 이름이나 주소를 바꿔 검토로 다시 갈 때", c: "host-full", to: "/rent/my?saved=review" },
          { desc: "알림 · 검토 중에 고침", c: "host-full", to: "/rent/my?saved=pending" },
          { desc: "알림 · 공개 중에 고침", c: "host-full", to: "/rent/my?saved=ok" },
          { desc: "알림 · 쉬는 동안 고친 경우", c: "host-full", to: "/rent/my?saved=kept" },
          { desc: "알림 · 수락 직후", c: "host-full", to: `/rent/my?did=accept&b=${B.confirmed}` },
          { desc: "알림 · 거절하고 환불까지 끝남", c: "host-full", to: `/rent/my?did=reject&b=${B.refunded}` },
          { desc: "알림 · 거절했는데 환불이 늦어질 때", c: "host-full", to: `/rent/my?did=reject&b=${B.rejected}` },
          { desc: "긴 글", c: "stress-host", to: "/rent/my" },
          { desc: "최소 입력 (손님 이름·번호 없음)", c: "minimal-host", to: "/rent/my" },
        ],
      },
      {
        title: "사장님이 보는 내 공간 상세",
        path: "/rent/[slug]",
        rows: [
          { desc: "공개 중인 내 공간 (신청 대신 안내 한 줄)", c: "host-full", to: `/rent/${S.full}` },
          { desc: "검토 대기 중인 내 공간", c: "host-full", to: `/rent/${S.pending}` },
          { desc: "쉬는 중인 내 공간", c: "host-full", to: `/rent/${S.paused}` },
        ],
      },
      {
        title: "공간 올리기",
        path: "/rent/new",
        note: "임시 저장 복원은 링크로 못 열어요. 폼에 몇 칸 적고 새로고침하면 복원 안내가 떠요. 저장은 계정마다 따로 브라우저에 남아요.",
        rows: [
          { desc: "빈 폼 (가입 때 적은 이름·번호, 첫 소개서가 미리 채워짐)", c: "host-full", to: "/rent/new" },
          { desc: "이름·번호·소개서가 없는 사장님의 빈 폼", c: "minimal-host", to: "/rent/new" },
          { desc: "로그인 안 했을 때", c: "anon", to: "/rent/new" },
        ],
      },
      {
        title: "공간 고치기",
        path: "/rent/[slug]/edit",
        rows: [
          { desc: "공개 중인 공간", c: "host-full", to: `/rent/${S.full}/edit` },
          { desc: "검토 중인 공간", c: "host-full", to: `/rent/${S.pending}/edit` },
          { desc: "쉬는 중인 공간", c: "host-full", to: `/rent/${S.paused}/edit` },
          { desc: "초안", c: "host-full", to: `/rent/${S.draft}/edit` },
          { desc: "긴 글", c: "stress-host", to: `/rent/${S.stress}/edit` },
          { desc: "최소 입력", c: "minimal-host", to: `/rent/${S.minimal}/edit` },
        ],
      },
    ],
  },
  {
    id: "admin",
    title: "관리자",
    screens: [
      {
        title: "정산",
        path: "/rent/payouts",
        note: "보낼 돈은 계좌가 있는 사장님과 없는 사장님 두 묶음이에요. 보내는 중(요청함·실패), 손이 필요한 예약 둘, 보낸 돈까지 한 화면에 있어요.",
        rows: [
          { desc: "환불 신청, 보낼 돈, 보내는 중, 손이 필요한 예약, 보낸 돈", c: "admin-full", to: "/rent/payouts" },
          { desc: "처리할 것이 없을 때", c: "admin-empty", to: "/rent/payouts" },
          { desc: "긴 글 (긴 사유, 긴 예금주)", c: "stress-admin", to: "/rent/payouts" },
          { desc: "관리자가 아닌 사람이 열면 404", c: "host-full", to: "/rent/payouts" },
        ],
      },
    ],
  },
  {
    id: "common",
    title: "공통",
    screens: [
      {
        title: "하루 가게 밖에서 이어지는 화면",
        path: "",
        rows: [
          { desc: "홈 (오른쪽 아래 카카오톡 버튼)", c: "guest-full", to: "/" },
          { desc: "고객센터", c: "guest-full", to: "/help" },
          { desc: "이용약관 · 하루 가게 조항", c: "guest-full", to: "/terms#rent" },
          { desc: "호스트 약관", c: "guest-full", to: "/terms/host" },
          { desc: "개인정보처리방침", c: "guest-full", to: "/privacy" },
          { desc: "사장님 소개서 (하루 가게로 돌아가기 버튼)", c: "guest-full", to: `/m/${M.host}?back=/rent/${S.full}` },
          { desc: "긴 이름 소개서 (돌아가기 버튼)", c: "stress-guest", to: `/m/${M.stress}?back=/rent/${S.stress}` },
          { desc: "없는 예약 번호 (하루 가게 404)", c: "guest-full", to: "/rent/done/99999999" },
        ],
      },
    ],
  },
];

/** 팝업은 주소로 못 연다. 어느 화면에서 무엇을 누르면 뜨는지만 적는다. */
const POPUPS: { where: Row; button: string; title: string }[] = [
  { where: { desc: "공간 상세", c: "guest-full", to: `/rent/${S.full}` }, button: "날짜·시간을 고르고 「신청하기」", title: "이대로 신청할까요?" },
  { where: { desc: "예약 한 건", c: "guest-full", to: `/rent/done/${B.confirmed}` }, button: "「예약 취소하기」", title: "예약을 취소할까요?" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "새 요청 줄의 「거절」", title: "이 요청을 거절할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "이용 시간이 시작된 줄의 「관리자에게 환불 신청하기」", title: "관리자에게 환불을 신청할까요" },
  { where: { desc: "내 하루 가게", c: "host-full", to: "/rent/my" }, button: "공개 중인 공간 줄의 「잠시 쉬기」", title: "잠시 쉴까요?" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「승인하고 환불」", title: "환불을 승인할까요" },
  { where: { desc: "정산", c: "admin-full", to: "/rent/payouts" }, button: "환불 신청 줄의 「신청 닫기」", title: "환불 신청을 닫을까요" },
];

const go = (c: string, to: string) => `/dev/rent-mock?case=${encodeURIComponent(c)}&to=${encodeURIComponent(to)}`;
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

export default async function RentMapPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  const current = await getRentMock();

  return (
    <main className="mx-auto w-full max-w-[880px] px-4 pb-24 pt-8 sm:px-6">
      <h1 className="text-[28px] font-bold leading-[1.25] tracking-[-0.02em] text-ink">하루 가게 화면 지도</h1>
      <p className="mt-3 text-[16px] leading-relaxed break-keep text-body">
        링크를 누르면 그 케이스의 가짜 데이터로 화면이 열려요. 로그인도 결제도 필요 없어요. 버튼을 눌러도 저장되지 않고
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
            <a href="/dev/rent-mock?off=1" className={linkCls}>
              끄기
            </a>
          </>
        ) : (
          "지금은 실제 데이터로 보고 있어요."
        )}
      </p>

      <nav className="mt-6 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
        {GROUPS.map((g) => (
          <a key={g.id} href={`#${g.id}`} className={linkCls}>
            {g.title}
          </a>
        ))}
        <a href="#popup" className={linkCls}>팝업</a>
        <a href="#mail" className={linkCls}>메일</a>
        <a href="#cases" className={linkCls}>케이스 전체</a>
      </nav>

      {GROUPS.map((g) => (
        <section key={g.id} id={g.id} className="mt-12 scroll-mt-20">
          <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">{g.title}</h2>
          {g.screens.map((sc) => (
            <div key={sc.title} className="mt-7">
              <h3 className="text-[17px] font-bold text-ink">
                {sc.title}
                {sc.path && <code className="ml-2 text-[14px] font-normal text-faint">{sc.path}</code>}
              </h3>
              {sc.note && <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">{sc.note}</p>}
              <ul className="mt-2">
                {sc.rows.map((r) => (
                  <CaseRow key={`${r.c}-${r.to}`} row={r} />
                ))}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <section id="popup" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">팝업</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          팝업은 주소로 열 수 없어서, 화면을 연 뒤 버튼을 눌러 주세요. 팝업 안의 확인 버튼도 저장은 하지 않아요.
        </p>
        <ul className="mt-2">
          {POPUPS.map((p) => (
            <li key={p.title} className="border-b border-hairline py-2.5 text-[15px] leading-relaxed break-keep text-body">
              <a href={go(p.where.c, p.where.to)} className={linkCls}>
                {p.where.desc}
              </a>
              에서 {p.button}를 누르면 <b className="font-medium text-ink">{p.title}</b>
            </li>
          ))}
        </ul>
      </section>

      <section id="mail" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">메일</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          실제로 보내는 함수와 같은 글을 만들어 화면에만 띄워요. 케이스 쿠키와 상관없이 열려요.
        </p>
        <ul className="mt-2">
          {MOCK_MAIL_KINDS.map((k) => (
            <li key={k.kind} className="border-b border-hairline py-2.5">
              <Link href={`/dev/rent-mail/${k.kind}`} className={`${linkCls} text-[15px] break-keep`}>
                {k.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="cases" className="mt-12 scroll-mt-20">
        <h2 className="text-[22px] font-bold leading-snug tracking-tight text-ink">케이스 전체</h2>
        <p className="mt-1.5 text-[15px] leading-relaxed break-keep text-mute">
          케이스만 켜고 주소는 직접 치고 싶을 때 써요. 누르면 내 하루 가게로 들어가요.
        </p>
        <ul className="mt-2">
          {MOCK_CASES.map((c) => (
            <CaseRow key={c.id} row={{ desc: c.label, c: c.id, to: c.viewer.userId ? "/rent/my" : "/rent" }} />
          ))}
        </ul>
      </section>
    </main>
  );
}
