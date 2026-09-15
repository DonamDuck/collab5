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
import type { SpaceUseType, BookingStatus, SpaceCategory, SpaceScope } from "@/lib/types";

/** 금액은 늘 「12,000원」 한 모양으로. 숫자만 던져두면 자릿수를 눈으로 세게 된다. */
export function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 쓰임새 라벨 — 설계 §화면의 두 갈래를 사람 말로.
 *  ⚠️`both`를 「둘 다」로 적지 않는다. 빌리는 사람 입장에선 「골라서 쓸 수 있다」가 정보다. */
export function usageLabel(t: SpaceUseType): string {
  if (t === "as_is") return "원래 목적대로";
  if (t === "open") return "대관";
  return "원래 목적대로 · 대관";
}

/** 날짜를 「10월 5일 (월)」로. `YYYY-MM-DD` 외의 값이 오면 받은 그대로 돌려준다.
 *  ⚠️`new Date("2026-10-05")`는 UTC 자정으로 읽혀 KST에선 하루 전으로 밀린다.
 *    그래서 Date를 거치지 않고 글자를 쪼갠 뒤, 요일만 정오 기준으로 계산한다. */
/** 📂업종·범위 라벨 (2026-09-16). ⚠️화면에 쓰는 말은 여기 한 곳에만 둔다 —
 *  목록·상세·카드가 각자 적으면 언젠가 「카페」와 「카페·디저트」가 같이 돌아다닌다. */
export function categoryLabel(c: SpaceCategory): string {
  return (
    {
      "": "업종 미정",
      cafe: "카페",
      restaurant: "음식점",
      workshop: "공방",
      studio: "스튜디오",
      shop: "소품샵·편집숍",
      lounge: "사무실·라운지",
      etc: "그 밖에",
    }[c] ?? "업종 미정"
  );
}

export function scopeLabel(v: SpaceScope): string {
  return { space_only: "공간만", with_gear: "공간과 장비까지", whole_shop: "가게 그대로" }[v] ?? "공간만";
}

export function dateLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  const dow = "일월화수목금토"[new Date(`${iso}T12:00:00+09:00`).getDay()];
  void y;
  return `${Number(mo)}월 ${Number(d)}일 (${dow})`;
}

/** 오늘(KST) `YYYY-MM-DD` — 날짜 입력칸의 `min`으로 쓴다. 지난 날짜를 고르는 실수를 미리 막는다. */
export function todayKst(): string {
  return new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
}

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
const BOOKING_TONE: Record<BookingStatus, { label: string; cls: string }> = {
  // ⭐`pending`은 결제창까지 갔다가 안 내고 돌아온 자리다. 게스트 화면에만 뜨고 호스트에겐 안 보인다.
  //   말투를 「실패」로 쓰지 않는 이유 — 대개는 실패가 아니라 마음이 바뀐 것이다.
  pending: { label: "결제가 안 끝났어요", cls: "text-faint" },
  paid: { label: "사장님 답 기다리는 중", cls: "text-lemon-on" },
  confirmed: { label: "확정됐어요", cls: "text-mint-on" },
  rejected: { label: "거절됐어요", cls: "text-faint" },
  refunded: { label: "환불됐어요", cls: "text-faint" },
  cancelled: { label: "취소했어요", cls: "text-faint" },
  done: { label: "다녀왔어요", cls: "text-faint" },
};

export function BookingBadge({ status }: { status: BookingStatus }) {
  const t = BOOKING_TONE[status] ?? BOOKING_TONE.paid;
  return <span className={`shrink-0 text-[15px] ${t.cls}`}>{t.label}</span>;
}

const SPACE_TONE: Record<string, { label: string; cls: string }> = {
  draft: { label: "초안", cls: "text-faint" },
  pending: { label: "검토 기다리는 중", cls: "text-lemon-on" },
  open: { label: "공개 중", cls: "text-mint-on" },
  paused: { label: "쉬는 중", cls: "text-faint" },
};

export function SpaceBadge({ status }: { status: string }) {
  const t = SPACE_TONE[status] ?? SPACE_TONE.draft;
  return <span className={`shrink-0 text-[15px] ${t.cls}`}>{t.label}</span>;
}

/** 폼 입력칸 얼굴 — `/rent/new`와 신청 폼이 같은 모양이어야 한다.
 *  높이 48 · `rounded-md`(16px) · `border-strong` · 글자 16px(iOS 확대 하한). */
export const rentInputCls =
  "h-[48px] w-full rounded-md border border-border-strong bg-surface px-4 text-[16px] text-ink outline-none placeholder:text-faint focus:border-focus";

/** 🔽고르는 칸. 대표 09-14: *「드롭다운 UI들 로컬에 구현한 거 싹 다 봐줘. 아래쪽 화살표가 너무 다
 *  우측에 붙어 있어」*.
 *  ⭐브라우저가 그려 주는 기본 화살표는 **칸 오른쪽 끝에 딱 붙는다.** 우리 입력칸은 좌우 패딩이 16px인데
 *  화살표만 0px에 서 있으니 그 칸만 여백이 깨져 보인다. `appearance-none`으로 기본 화살표를 끄고
 *  같은 16px 자리에 우리 것을 그린다. 🚨훅이 없어 서버·클라 양쪽에서 쓸 수 있다(이 파일의 규율). */
export function RentSelect({
  className = "",
  children,
  ...rest
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative w-full">
      <select className={`${rentInputCls} appearance-none pr-11 ${className}`} {...rest}>
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
        className="pointer-events-none absolute right-4 top-1/2 size-[18px] -translate-y-1/2 text-mute"
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

export function CardBox({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-hairline bg-surface p-5 ${className}`}>{children}</div>
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
