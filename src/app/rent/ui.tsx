// 하루 가게 — 네 화면이 같이 쓰는 작은 조각들 (2026-09-13)
//
// ⚠️`src/components/`가 아니라 여기에 둔 이유: 지금 이 어휘(하루 값·비는 날·쓰임새)를 쓰는 화면은
//   `/rent/**` 넷뿐이다. 공용 폴더로 올리면 다른 팀이 동시에 만지는 파일이 하나 늘고,
//   이름도 서비스 전체 어휘인 척하게 된다. 두 번째 사용처가 밖에서 생기면 그때 올린다.
//
// 🚨전부 훅 없는 순수 함수라 서버·클라이언트 어느 쪽에서도 부를 수 있다.
//   `"use client"`를 붙이지 않은 것이 그 계약이다 — 훅을 더하려거든 파일을 쪼갤 것.
//
// 🎨09-13 디자인 재작업 — 대표 평가 *「그냥 막 만든 것 같아. 리틀리처럼 감각적으로」*.
//   여기 있던 옷(회색 각진 칩 · 12px 배지 · 15px 입력칸 · 검정 버튼)이 네 화면 전부를 행정 화면으로
//   만들고 있었다. 소개서(`/m`) 사다리와 디자인-시스템 정본에 맞춰 통째로 갈았다.
//   ⛔`rem` 유틸 금지(루트 17px라 6.25% 부푼다) — 전부 px로 박는다.
import type { ReactNode } from "react";
import type { BookingStatus, SpaceCategory } from "@/lib/types";

/** 금액은 늘 「12,000원」 한 모양으로. 숫자만 던져두면 자릿수를 눈으로 세게 된다. */
export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

// 🧹09-18 밤 QA SC-28 — 09-16~09-18에 화면이 바뀌며 부르는 곳이 없어진 조각 넷을 걷었다:
//   쓰임새 라벨 `usageLabel` · 범위 라벨 `scopeLabel`(09-18 상품 이름으로) · 판 `CardBox` · 잠긴 연락처 한 줄 `LockedLine`.

/** 📂업종 목록 (2026-09-16). ⚠️화면에 쓰는 말은 여기 한 곳에만 둔다 —
 *  목록·상세·카드가 각자 적으면 언젠가 「카페」와 「카페·디저트」가 같이 돌아다닌다.
 *  ⭐**등록 폼의 고르개와 목록의 거르개가 같은 줄을 본다.**
 *  🩸09-16까지 이 목록이 두 벌이었다(여기 하나, `SpaceForm`에 하나). 두 벌이면 한쪽에 업종을 더한 날
 *    다른 쪽에서 그 업종이 조용히 안 걸린다 — 목록에 있는데 거르개엔 없는 상태가 된다.
 *  ⭐순서도 정보다. 흔한 것부터 두고 「그 밖에」가 맨 뒤다. */
export const CATEGORY_OPTIONS: [Exclude<SpaceCategory, "">, string][] = [
  ["cafe", "카페"],
  ["restaurant", "음식점"],
  ["workshop", "공방"],
  ["studio", "스튜디오"],
  ["shop", "소품샵·편집숍"],
  ["lounge", "사무실·라운지"],
  ["etc", "그 밖에"],
];

/** ⚠️업종이 빈 공간은 빈 문자열을 돌려준다(09-17 QA). 호출부가 `filter(Boolean)`으로 빼고 그린다.
 *  🩸09-16까지 「업종 미정」을 돌려줬는데, 업종 칸이 생기기 전에 올린 공간이 전부 그 글자로 손님에게 보였다.
 *    손님 눈엔 사장님이 성의 없이 올린 것으로 읽힌다. 모르는 값은 말하지 않는 편이 낫다. */
export function categoryLabel(c: SpaceCategory): string {
  return CATEGORY_OPTIONS.find(([v]) => v === c)?.[1] ?? "";
}

/** 날짜·일정 서식은 `lib/rent-time`이 정본이다(09-16). 서버 액션·메일도 같은 함수를 쓴다.
 *  여기서 다시 내보내는 건 `/rent/**` 화면들이 이 파일 하나만 보게 하려는 것이다. */
export { dateLabel, bookingWhen, todayKst } from "@/lib/rent-time";

/** 읽고 지나가는 칩 — 설비·쓰임새·날짜. 소개서 상단 카드의 pill과 같은 얼굴.
 *  ⭐한 덩어리 안에서는 이 한 종류만 쓴다(디자인-시스템 §형태가 의미를 만든다).
 *    각진 `rounded-sm` 회색 칩은 표 안의 셀처럼 읽혀서 pill로 바꿨다. */
export function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-pill bg-surface-soft px-3 py-1.5 text-[15px] text-body">
      {children}
    </span>
  );
}

/** 상태는 배지가 아니라 **글자**로 말한다(09-13 대표 지시 — pill 금지, 색만).
 *  기다리는 중은 레몬, 열린 것은 민트, 끝나거나 막힌 것은 회색.
 *  ⛔Kiwi(primary)는 안 쓴다. 브랜드색이 「성공」을 뜻하기 시작하면 희소성이 무너진다
 *    (globals.css의 `--success-pale` 주석과 같은 규율). */
// 🔁09-17 대표 결정 4 — 이름을 «짧은 명사꼴»로 맞췄다. 제목·첫 줄의 긴 문장은 `rent-copy.ts`의 `BOOKING_HEADLINE`이고,
//   배지는 그 문장의 짧은 꼴이다(예약 완료 / 예약 확정 / 새 요청). 나머지 상태도 같은 결로 한 번에 갈았다.
//   ⭐용어 규칙: 손님은 결제 전 「신청」, 결제 뒤 「예약」. 사장님은 들어온 것이 「요청」, 수락 뒤 「예약」.
//   🩸09-16까지 손님 쪽은 「예약을 완료했어요」, 사장님 쪽은 「새 신청이에요」라서 같은 건이 화면마다 다른 이름이었다.
//   ⚠️「완료」를 셋(예약·환불·이용)에 붙이면 목록을 세로로 읽을 때 한 금형이 된다. 예약 완료 하나에만 쓴다.
const BOOKING_TONE: Record<BookingStatus, { label: string; cls: string }> = {
  // ⭐`pending`은 결제창까지 갔다가 안 내고 돌아온 자리다. 게스트 화면에만 뜨고 호스트에겐 안 보인다.
  //   말투를 「실패」로 쓰지 않는 이유 — 대개는 실패가 아니라 마음이 바뀐 것이다.
  pending: { label: "결제 전", cls: "text-faint" },
  paid: { label: "예약 완료", cls: "text-mint-on" },
  confirmed: { label: "예약 확정", cls: "text-mint-on" },
  rejected: { label: "사장님 거절", cls: "text-faint" },
  refunded: { label: "전액 환불", cls: "text-faint" },
  cancelled: { label: "예약 취소", cls: "text-faint" },
  done: { label: "다녀왔어요", cls: "text-faint" },
  // ⏳09-16 — 결제창만 열고 30분이 지나 닫힌 신청. 실패가 아니라 시간이 지난 것이라 말투도 그렇게.
  expired: { label: "결제 시간 지남", cls: "text-faint" },
};

/** 👥보는 사람에 따라 같은 상태를 다르게 말하는 자리. 09-16 phase 1 — 손님에게 `paid`는 기다림이 아니라
 *  «예약 완료»다(사장님 답을 기다리게 세워 두지 않는다). 사장님에게 같은 상태는 «새로 들어온 요청»이다(09-17 대표 결정 4). */
const TONE_FOR: Record<"guest" | "host", Partial<Record<BookingStatus, { label: string; cls: string }>>> = {
  guest: {},
  host: {
    paid: { label: "새 요청", cls: "text-lemon-on" },
    rejected: { label: "거절한 요청", cls: "text-faint" },
    cancelled: { label: "손님이 취소", cls: "text-faint" },
    done: { label: "손님 다녀감", cls: "text-faint" },
  },
};

export function BookingBadge({
  status,
  viewer = "guest",
  dot = false,
}: {
  status: BookingStatus;
  viewer?: "guest" | "host";
  /** 🔵09-18 들어온 요청 카드(대표 코멘트 #63) — 카드 맨 앞에 설 때 앞에 작은 점과 medium 굵기를 얹는다.
   *  ⚠️알약(면)은 여전히 안 쓴다(09-13 대표 지시). 점은 탭의 「새 요청 있음」 점(`StickyTabs`)과 같은 7px이다. */
  dot?: boolean;
}) {
  const t = TONE_FOR[viewer][status] ?? BOOKING_TONE[status] ?? BOOKING_TONE.paid;
  if (dot) {
    return (
      <span className={`inline-flex shrink-0 items-center gap-1.5 text-[15px] font-medium ${t.cls}`}>
        <span aria-hidden="true" className="size-[7px] rounded-full bg-current" />
        {t.label}
      </span>
    );
  }
  return <span className={`shrink-0 text-[15px] ${t.cls}`}>{t.label}</span>;
}

const SPACE_TONE: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "text-faint" },
  pending: { label: "검토 기다리는 중", cls: "text-lemon-on" },
  open: { label: "공개 중", cls: "text-mint-on" },
  paused: { label: "쉬는 중", cls: "text-faint" },
  // 🚪09-19 오후 — 사업자등록번호가 빈 공간(`bizOnFile` 거짓). 상태 칸의 값이 아니라 화면이 얹는 표지다.
  nobiz: { label: "사업자 정보 필요", cls: "text-lemon-on" },
  // 🔁09-19 저녁 — 관리자가 보완을 요청한 공간(`needsFix`). 상태 칸은 `pending` 그대로고 화면이 얹는 표지다.
  fix: { label: "보완 필요", cls: "text-lemon-on" },
};

export function SpaceBadge({ status }: { status: string }) {
  const t = SPACE_TONE[status] ?? SPACE_TONE.draft;
  return <span className={`shrink-0 text-[15px] ${t.cls}`}>{t.label}</span>;
}

/** 폼 입력칸 얼굴 — `/rent/new`와 신청 폼이 같은 모양이어야 한다.
 *  높이 48 · `rounded-md`(16px) · `border-strong` · 글자 16px(iOS 확대 하한). */
export const rentInputCls =
  "h-[48px] w-full rounded-md border border-border-strong bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";

/** 훑는 칸 — 폼 입력칸(`rentInputCls`, border-strong)보다 한 단 조용하다.
 *  여긴 채우는 곳이 아니라 훑는 곳이라, 테두리가 진하면 「써야 하는 칸」처럼 보인다. */
export const rentQuietInputCls =
  "h-[44px] w-full rounded-md border border-hairline bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";

/** 🔽고르는 칸. 대표 09-14: *「드롭다운 UI들 로컬에 구현한 거 싹 다 봐줘. 아래쪽 화살표가 너무 다
 *  우측에 붙어 있어」*.
 *  ⭐브라우저가 그려 주는 기본 화살표는 **칸 오른쪽 끝에 딱 붙는다.** 우리 입력칸은 좌우 패딩이 16px인데
 *  화살표만 0px에 서 있으니 그 칸만 여백이 깨져 보인다. `appearance-none`으로 기본 화살표를 끄고
 *  같은 16px 자리에 우리 것을 그린다. 🚨훅이 없어 서버·클라 양쪽에서 쓸 수 있다(이 파일의 규율). */
export function RentSelect({
  className = "",
  tone = "form",
  compact = false,
  wrapClassName = "w-full",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  tone?: "form" | "quiet";
  /** 한 줄에 여럿이 서야 할 때. ⚠️`size`는 `select`가 이미 쓰는 속성이라 이름을 달리했다. */
  compact?: boolean;
  /** 🩸**폭·높이는 여기로 준다. `className`으로 주면 조용히 안 먹는다.**
   *  안쪽 `select`가 `w-full h-[48px]`를 들고 있어서, 바깥에서 `w-[92px]`를 얹어도
   *  Tailwind는 나중에 적은 클래스가 아니라 스타일시트 «순서»로 이긴다.
   *  🪤에러도 경고도 없다. 09-16에 등록 폼의 「한 줄 시간 칸」이 이것 때문에 314px로 서 있었다. */
  wrapClassName?: string;
}) {
  // 📐높이는 «얼굴»이 정한다 — 훑는 칸 44, 채우는 칸 48, 한 줄에 여럿 설 땐 40.
  //   🩸09-16에 이걸 단 하나로 묶었다가 거르개의 입력칸(44)과 고르개(48)가 4px 어긋났다.
  const border = tone === "quiet" ? "border-hairline" : "border-border-strong";
  const h = compact ? "h-[40px]" : tone === "quiet" ? "h-[44px]" : "h-[48px]";
  const box = compact ? `${h} pl-3 pr-8 text-[15px]` : `${h} pl-4 pr-11 text-[16px]`;
  return (
    <div className={`relative ${wrapClassName}`}>
      <select
        className={`w-full appearance-none rounded-md border ${border} ${box} bg-surface text-ink outline-none focus:border-focus ${className}`}
        {...rest}
      >
        {children}
      </select>
      {/* `pointer-events-none` — 화살표가 클릭을 먹으면 그 자리를 눌렀을 때 목록이 안 열린다. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-mute ${
          compact ? "right-2.5 size-[16px]" : "right-4 size-[18px]"
        }`}
      >
        <path d="m5 7.5 5 5 5-5" />
      </svg>
    </div>
  );
}

/** 여러 줄 칸 — 높이만 빼고 입력칸과 같은 얼굴. `h-[48px]`를 textarea에 주면 두 줄부터 잘린다. */
export const rentTextareaCls =
  "w-full rounded-md border border-border-strong bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-focus";

/** 화면당 하나뿐인 키위 버튼. 폼 제출은 52px, 히어로·로그인 유도는 48px로 호출부가 높이를 얹는다. */
export const primaryBtnCls =
  "inline-flex items-center justify-center rounded-md bg-primary px-6 text-[16px] font-medium text-primary-on transition-colors hover:bg-primary-strong disabled:opacity-60";

/** 보조 버튼 = 흰 면 + `border-strong`. ⛔검정 버튼(`bg-ink`)은 이 사이트에 없는 어휘라 전부 이걸로 갈았다. */
export const secondaryBtnCls =
  "inline-flex h-[44px] items-center justify-center rounded-md border border-border-strong bg-surface px-5 text-[16px] font-medium text-ink transition-colors hover:bg-surface-soft disabled:opacity-60";

/** 목록 카드·상세 상단이 쓰는 흰 카드. ⛔점선 테두리 금지(대표 지시) — 실선 hairline 한 종류만 쓴다. */
/** 📋 항목 줄 — 「장소 / 일정 / 금액」처럼 **라벨과 값이 짝인 것**을 세로로 세운다 (2026-09-15 대표).
 *
 *  대표: *「줄글로 하지 말고 결제 화면의 항목처럼」* · *「이쁘게 나오게 하자고! 이건 예약 완료 화면이니깐」*.
 *  ⭐한 곳에 둔 이유 — 신청 확인 팝업 · 결제 · 신청 완료 · 확정 · 취소, **다섯 자리가 같은 것을 보여 준다.**
 *    자리마다 따로 그리면 라벨 폭이 제각각이 되고, 방금 확인한 것을 다음 화면에서 대조하기 어려워진다.
 *  ⚠️표 태그를 쓰지 않는다. 두 칸짜리 표는 좁은 화면에서 칸이 깨진다. 라벨 고정폭이면 충분하다.
 *  📐라벨 88px = 「결제 금액」 네 글자가 안 접히는 폭(16px 기준 재서 잡았다). */
export function InfoList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <dl className={`space-y-2.5 ${className}`}>{children}</dl>;
}

export function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex gap-3 text-[16px] leading-relaxed break-keep">
      <dt className="w-[88px] shrink-0 text-mute">{label}</dt>
      <dd className="min-w-0 flex-1 text-body">{value}</dd>
    </div>
  );
}

/** 항목을 감싸는 옅은 판. 「지금 대조할 것」이 한 덩어리로 보인다. */
export function InfoPanel({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft p-4">
      {title && <p className="mb-3 text-[15px] font-medium text-mute">{title}</p>}
      <InfoList>{children}</InfoList>
    </div>
  );
}

/** 읽는 목록의 한 줄 — 위 구분선 + 왼쪽 글 + 오른쪽 상태. 마지막 줄은 아래 구분선도 갖는다.
 *  🔁09-16 `/rent/my` 안에만 있던 것을 여기로 올렸다. 보낸 신청 줄(`GuestBookingRow`)이 `/rent/requests`와
 *    같이 쓰면서, 줄 모양이 한 화면에만 있으면 두 화면의 구분선·간격이 따로 놀게 된다. */
export function ListRow({
  head,
  status,
  children,
  card = false,
  id,
}: {
  head: ReactNode;
  status: ReactNode;
  children?: ReactNode;
  /** 🔗줄을 주소로 가리킬 이름(09-18 밤 QA H-08). 화면 위 결과 줄이 `#booking-12`로 이 줄까지 데려온다.
   *  `scroll-mt`는 헤더(3.5rem)와 고정 탭이 덮는 만큼을 미리 비켜 둔 값이다. */
  id?: string;
  /** 🗂09-18 대표 코멘트(/rent/requests) — 「각각의 예약이 분리돼 보이게. 라인 하나로만 나뉘어 아쉬워」.
   *  예약 한 건이 연락·주소·버튼까지 품어 길어지면 선 하나로는 어디서 다음 예약이 시작하는지 안 보인다. 그때 카드로 세운다. */
  card?: boolean;
}) {
  if (card) {
    return (
      <li id={id} className="mb-3 scroll-mt-32 rounded-xl border border-hairline bg-surface p-4 last:mb-0 sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">{head}</div>
          {status}
        </div>
        {children}
      </li>
    );
  }
  return (
    <li id={id} className="scroll-mt-32 border-t border-hairline py-5 last:border-b">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">{head}</div>
        {status}
      </div>
      {children}
    </li>
  );
}

/** 사진이 없을 때 커버 자리 — 회색 면에 아톰 마크를 옅게. 「사진 준비 중」 글자보다 조용하다.
 *  🚨정사각 클래스 금지 — 마크 비율이 1.28이라 `w-*`를 높이와 같게 박으면 찌그러진다. */
export function CoverPlaceholder() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-surface-soft">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-mark.png" alt="" aria-hidden="true" className="h-[34px] w-auto opacity-30" />
    </div>
  );
}
