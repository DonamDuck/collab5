"use client";

// 하루 가게 — 신청 폼 (2026-09-13)
//
// 🚨**결제가 신청보다 «먼저»다**(대표 09-13 확정). 호스트와 미리 연결되면 둘 다 수수료를 안 내는 쪽이
//   이득이라, 만나기만 하면 다음 거래부터 우리가 필요 없어진다(설계 §이탈). 그래서 이 버튼 하나가
//   「결제 + 신청」을 같이 끝낸다. 「신청해두고 나중에 결제」로 쪼개지 말 것.
//
// 💳**결제 UI는 토스가 그린다**(대표 09-13: *"최대한 토스 UI 쓰는 방향, 우리 개발 줄이공"*).
//   카드 번호·할부·인증·약관을 우리가 만들지 않는다. 우리가 하는 일은 셋뿐이다 —
//   ①서버에 자리를 잡고(`startBookingAction`) ②토스 **결제위젯**을 이 페이지 안에 그리고
//   ③돌아온 값으로 승인한다(`/rent/pay/success`).
//   🩸09-13 실측: 처음엔 `payment()`(새 창)로 짰는데 `NOT_SUPPORTED_WIDGET_KEY`가 났다.
//     대표가 받은 「주문서형·결제창형 연동 키」(`test_gck_…`)는 **위젯 전용**이고 `payment()`는
//     「API 개별 연동 키」(`test_ck_…`)를 요구한다. 키를 바꾸는 대신 위젯으로 맞췄다 —
//     결제수단·약관이 우리 페이지 안에 토스 모양 그대로 뜨니 대표 의도에 더 가깝다.
//
// ⭐**금액을 이 화면이 정하지 않는다.** 아래 `total`은 «보여주기»용이고, 실제 청구액은 서버가
//   공간 행에서 다시 계산해 `pending` 행에 적어 둔 값이다. 여기 숫자를 고쳐도 청구액은 안 바뀐다.
//
// 🚧클라이언트 키가 없으면 **결제창을 건너뛰고 모의 승인**으로 간다(`lib/rent-payment.ts`).
//   🚨키 없이 운영에 나가면 돈을 안 받고 예약이 확정된다. 배포 전 반드시 확인할 것.
//
// 🎨09-13 재작업 — 회색 상자를 걷고 지면에 바로 세웠다(소개서 폼 사다리: 라벨 16 medium ·
//   입력 48px/16px · 도움말 15 faint). 금액 표는 **한 문장**으로. 버튼은 화면 유일 키위 52px이고,
//   모바일에선 `MakerActionBar`처럼 **하단 고정 바**에 금액과 같이 앉는다(폼이 길어서 버튼이
//   화면 밖에 있으면 「어디서 내지」가 된다).
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBookingAction, confirmBookingAction } from "@/lib/rent-actions";
import type { SpaceUseType, OpenSlot, RentProduct, Space } from "@/lib/types";
import { bookingAmount, productNote, productPrice, sellableProducts } from "@/lib/rent-products";
import { dayMarks, durationLabel, endChoices, minHoursToMinutes, minutesBetween, nowHhmmKst, rangeLabel, startChoices as startChoicesOf, toMinutes, todayKst } from "@/lib/rent-time";
import { PLAN_MAX } from "@/lib/rent-limits";
import { dateLabel, InfoList, InfoRow, primaryBtnCls, RentSelect, rentInputCls, rentTextareaCls, won } from "../ui";
import Link from "next/link";
import { COFFEE_CHAT_LABEL, CONTACT_RULE_GUEST, isTestPayment, PRODUCT_HINT_GUEST, PRODUCT_LABEL } from "@/lib/rent-copy";
import { ConfirmDialog } from "../ConfirmDialog";
import { PickDateCalendar } from "./PickDateCalendar";
import { MentorOptions } from "./MentorOption";

const labelCls = "mb-2 block text-[16px] font-medium text-body";
const hintCls = "mt-2 text-[15px] leading-relaxed break-keep text-faint";
/** 못 넘어간 칸 바로 아래에 붙는 한 줄. 힌트와 같은 자리에 같은 크기로 서고 색만 다르다. */
const errCls = "mt-2 text-[15px] leading-relaxed break-keep text-danger";
/** 시각 칩. 44px = 손가락 하한. 폭은 격자가 4등분해 준다(sm부터 6등분). */
const chipCls = "h-[44px] rounded-md border text-[16px] tabular-nums transition-colors";
/** 고른 시작·끝 — 달력의 고른 날과 같은 키위 tint(한 폼 안에서 «고른 것»의 얼굴은 하나). */
const chipOnCls = "border-transparent bg-primary-tint font-medium text-primary-on";
/** 시작과 끝 사이 — 고른 구간이 한 덩어리로 읽히게 한 단 옅게. */
const chipRangeCls = "border-transparent bg-primary-pale text-primary-on";
/** 시작을 고른 뒤 «끝으로 고를 수 있는» 칩 — 진한 키위 테두리로 켜서 어디까지 갈 수 있는지 보인다.
 *  📐375 실측(09-19) — 옅은 테두리(`primary-tint`)는 흰 칩과 거의 안 갈렸다. 한 단 진한 `primary-strong`에 글자도 키위로. */
const chipEndableCls = "border-primary-strong bg-surface font-medium text-primary-on hover:bg-primary-pale";
/** 시작을 고른 뒤, 끝은 못 되지만 «새 시작»으로는 누를 수 있는 칩. 끝 후보가 먼저 읽히게 한 단 물린다. */
const chipDimCls = "border-hairline bg-surface text-mute hover:bg-surface-soft";
const chipOffCls = "border-hairline bg-surface text-ink hover:bg-primary-pale";
/** 못 고르는 칩(찬 시간·최소 시간을 못 채우는 꼬리·닫는 시각). 눈금은 남겨 두어 그날의 모양이 보이게 한다. */
const chipDisabledCls = "border-transparent bg-surface-soft text-faint";

/** 화면 아래 고정 바 — 금액 + 이 화면의 키위 버튼. 어느 폭에서나 이 하나가 유일한 결제 버튼이다.
 *  하단 여백은 `max()`다(MakerActionBar 08-09 실측): 홈 인디케이터가 있는 기기는 안전영역만, 없는 기기는 12px. */
function PayBar({
  amount,
  caption,
  emptyText,
  label,
  disabled,
  onClick,
}: {
  /** null = 아직 시간을 안 골랐다. 그땐 금액 대신 안내를 든다. */
  amount: number | null;
  /** 금액 위 작은 줄에 붙는 길이(「2시간 30분」). 무엇에 대한 값인지 바에서 바로 읽힌다(09-19 30분 단위). */
  caption?: string;
  /** 금액 자리에 대신 서는 말. 무엇을 골라야 금액이 나오는지(09-18: 상품 → 시간 순). */
  emptyText: string;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40">
      {/* 📐09-17 디자인팀 — lg부터 상세가 두 기둥이 되면서, 화면 가운데 640 바가 어느 기둥에도 안 맞았다.
          lg에선 바를 **오른쪽 기둥(340) 아래**로 붙인다. 위의 요약 카드(얼마·언제)와 한 줄로 읽혀서
          버튼이 무엇에 대한 것인지가 바로 보인다. 폭 값은 상세 `page.tsx`의 격자와 한 쌍이다. */}
      <div className="lg:mx-auto lg:flex lg:max-w-[1120px] lg:justify-end lg:px-6">
      <div className="mx-auto w-full max-w-[640px] rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-e2 lg:mx-0 lg:w-[340px] lg:px-5">
        {/* 🔻09-15 대표 — *「(폰이) 이렇게 나오는 거 좋은데, 데스크탑도 동일 UX로 적용 필요해」*.
            전엔 폰은 팝업 안에서, 데스크톱은 이 바 «안»에서 옵션을 골랐다. 두 화면이 서로 다른 물건이었다.
            ⭐이제 **옵션을 고르는 자리는 확인 팝업 한 곳뿐이다.** 바는 어느 폭에서나 금액과 버튼만 든다. */}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {/* 🔁09-14 「지금 내실 돈」 → **「대여 비용」**(대표). 「지금 내실」은 재촉으로 읽히고
                무엇에 대한 돈인지는 말해 주지 않는다. */}
            {/* 🔁09-17 QA — 아무것도 안 골랐는데 「대여 비용 30,000원」이 서 있어 「이 공간은 3만원」으로 읽혔다
                (기본값으로 채운 날짜·시각의 값이었다). 시간을 고르기 전엔 금액 자리에 할 일을 말한다. */}
            {amount === null ? (
              <p className="text-[15px] leading-snug break-keep text-mute">{emptyText}</p>
            ) : (
              <>
                <p className="text-[13px] text-faint">대여 비용{caption ? ` · ${caption}` : ""}</p>
                <p className="truncate text-[17px] font-medium text-ink">{won(amount)}</p>
              </>
            )}
          </div>
          <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${primaryBtnCls} h-[52px] shrink-0 px-5`}
          >
            {label}
          </button>
        </div>
      </div>
      </div>
    </div>
  );
}


/** 🔑09-19 대표 [G] — 로그인 안 한 손님이 고른 값을 로그인 동안 맡겨 두는 자리. 공간마다 따로(`slug`) 둔다.
 *  sessionStorage라 같은 탭에만 남는다. 카카오·구글을 다녀와도 같은 탭이면 그대로다(`lib/safe-redirect` 머리말과 같은 성질). */
const resumeKeyOf = (slug: string) => `collab5:rent-resume:${slug}`;

/** 맡겨 두는 폼 값. 소개서 고르기는 안 담는다 — 로그인 전엔 고를 소개서가 없다. */
interface ResumeDraft {
  product: RentProduct | "";
  useDate: string;
  startTime: string;
  endTime: string;
  headcount: string;
  headUnsure: boolean;
  plan: string;
  withChat: boolean;
  guestName: string;
  phone: string;
}

/** 맡겨 둔 값을 꺼낸다. 모양이 틀린 칸은 빈 값으로 — 값 하나 때문에 폼이 안 뜨면 안 된다. */
function readResume(raw: string | null): ResumeDraft | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    if (!o || typeof o !== "object") return null;
    const str = (v: unknown) => (typeof v === "string" ? v : "");
    return {
      product: o.product === "space" || o.product === "full" ? o.product : "",
      useDate: /^\d{4}-\d{2}-\d{2}$/.test(str(o.useDate)) ? str(o.useDate) : "",
      startTime: str(o.startTime),
      endTime: str(o.endTime),
      headcount: /^\d{1,4}$/.test(str(o.headcount)) ? str(o.headcount) : "",
      headUnsure: o.headUnsure === true,
      plan: str(o.plan).slice(0, PLAN_MAX),
      withChat: o.withChat === true,
      guestName: str(o.guestName).slice(0, 50),
      phone: str(o.phone).slice(0, 20),
    };
  } catch {
    return null;
  }
}

/** 확인 팝업에 싣는 「무엇을」 앞부분. 40자에서 자르고 줄바꿈은 한 칸으로 편다. */
function planPreview(plan: string): string {
  const flat = plan.trim().replace(/\s+/g, " ");
  return flat.length > 40 ? `${flat.slice(0, 40)}…` : flat;
}

export function BookingForm({
  spaceId,
  spaceSlug,
  openSlots,
  takenByDate,
  products,
  minHours,
  coffeeChat,
  coffeeChatMinutes,
  coffeeChatPrice,
  capacity,
  useType,
  myBrands,
  spaceName,
  initialPhone,
  signedIn,
}: {
  spaceId: number;
  spaceSlug: string;
  /** 확인 팝업 문장(「{공간}을 신청할까요」)에 쓴다. */
  spaceName: string;
  /** 🔁09-16 하루 단위 → 시간 단위. 호스트가 «날짜별로» 연 시간대. */
  openSlots: OpenSlot[];
  /** 이미 팔린 시간 — 날짜별 목록. 고르는 자리에서 바로 회색으로 만든다.
   *  ⚠️여기서 막아도 **관문은 서버·DB**다. 두 사람이 같은 순간에 들어오면 뒤에 온 쪽이 승인에서 떨어진다. */
  takenByDate: Record<string, { start: string; end: string }[]>;
  /** 🛍09-18 사장님이 켠 공간 상품(대관만·공간 전체)의 값·설명. 금액 계산은 서버와 같은 `bookingAmount`로 한다. */
  products: Pick<Space, "rentSpaceOn" | "rentSpacePrice" | "rentSpaceNote" | "rentFullOn" | "rentFullPrice" | "rentFullNote">;
  minHours: number;
  coffeeChat: boolean;
  coffeeChatMinutes: number;
  coffeeChatPrice: number;
  capacity?: number;
  /** 「몇 분이나」는 대관(`open`·`both`)에서만 묻는다. 원래 목적대로(`as_is`) 쓰는 자리엔 인원이 정보가 아니다. */
  useType: SpaceUseType;
  myBrands: { slug: string; name: string }[];
  /** 프로필에 적힌 번호. 있으면 칸을 미리 채운다(대표 09-17). */
  initialPhone: string;
  /** 🔑09-19 대표 [G] — 로그인 안 한 사람에게도 폼과 결제 바를 보인다. 바 버튼은 고른 값을 맡기고 로그인으로 보낸다. */
  signedIn: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  // 📐09-18 밤 QA(G-21) — 하단 고정 바가 **푸터 마지막 줄을 가렸다**(폰에서 사업자 정보 줄이 바 뒤에 깔렸다).
  //   상세 `main`은 이미 아래 여백을 두지만 푸터는 `main` 밖이라 그 여백이 안 닿는다.
  //   ⭐그래서 바가 뜨는 동안만 `body` 아래에 바 높이만큼을 비워 둔다. 폼이 사라지면 원래대로 돌린다.
  useEffect(() => {
    const prev = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "104px";
    return () => {
      document.body.style.paddingBottom = prev;
    };
  }, []);

  // 🔁09-17 QA — 전엔 첫 열린 날이 미리 골라져 있었다. 달력을 안 보고 시간만 고르면 «고른 적 없는 날»로
  //   결제까지 갔다. 날짜도 시각도 손님이 직접 고른 값만 쓴다.
  const [useDate, setUseDate] = useState("");
  /** 고른 날의 시작 시각. 날을 바꾸면 비운다 — 어제 고른 시각이 오늘 안 열려 있을 수 있다. */
  const [startTime, setStartTime] = useState("");
  /** ⏱09-19 대표 — 「몇 시간 빌리실까요」 칸을 없애고 끝나는 시각을 같은 줄에서 고른다. 시작을 바꾸면 비운다. */
  const [endPick, setEndPick] = useState("");
  const [headcount, setHeadcount] = useState("");
  const [plan, setPlan] = useState("");
  const [withChat, setWithChat] = useState(false);
  // 🛍09-18 대표 — 「고객은 신청할 때 이걸 선택할 수 있게」. 켜진 게 하나면 그것으로 정해 두고 고르기를 안 보인다.
  //   둘이면 비워 둔다 — 날짜·시각과 같은 규칙(09-17 QA: 손님이 직접 고른 값만 쓴다).
  const sellable = sellableProducts(products);
  const [pickedProduct, setPickedProduct] = useState<RentProduct | "">(sellable.length === 1 ? sellable[0] : "");
  const product: RentProduct | "" = sellable.length === 1 ? sellable[0] : pickedProduct;
  // 📎09-18 대표 코멘트 — 소개서 전달은 토글(예/아니요), **기본은 «예»**. 고르는 소개서는 첫 번째가 기본.
  const [brandOn, setBrandOn] = useState(true);
  const [brandPick, setBrandPick] = useState(myBrands[0]?.slug ?? "");
  const brandSlug = myBrands.length > 0 && brandOn ? brandPick : "";
  /** 👥09-18 대표 코멘트 — 「아직 잘 모르겠어요」 체크. 켜면 인원 칸을 비우고 잠근다. */
  const [headUnsure, setHeadUnsure] = useState(false);
  const [phone, setPhone] = useState(initialPhone);
  /** 🪪09-18 대표 — 이용하실 분 성함(실명). 당일 신분 확인에 쓴다. 프로필엔 실명 칸이 없어 미리 채우지 않는다. */
  const [guestName, setGuestName] = useState("");
  /** 결제 직전 확인 팝업(대표 09-14: 의사 확인은 팝업으로). */
  const [confirming, setConfirming] = useState(false);
  /** 🚨팝업 «안»에 서는 거절 이유(09-18 밤 QA G-02).
   *  전엔 [결제하러 가기]를 누르는 순간 팝업을 닫고 서버에 갔다. 서버가 거절하면 그 말이 폼 아래
   *  `err` 한 줄로 갔는데, 375에서 그 자리는 823px이라 **고정 바 뒤이거나 화면 밖**이었다.
   *  화면엔 아무 변화가 없어 「눌렀는데 아무 일도 안 난다」로 읽힌다(09-15에 같은 병을 한 번 고쳤다).
   *  ⭐그래서 팝업을 «응답 뒤에» 닫는다. 성공하면 어차피 다른 화면으로 떠나고, 실패하면 누른 자리에서 이유를 본다. */
  const [dialogErr, setDialogErr] = useState("");
  /** 돌아와서 고른 값이 그새 못 쓰게 된 것. 조용히 비우면 손님은 자기가 안 고른 줄 안다(대표 [G] 「조용히 버리지 말고」). */
  const [resumeNote, setResumeNote] = useState("");
  /** 🚨**못 넘어간 이유를 «그 칸 옆»에 둔다**(대표 09-15 [2][3]).
   *  전엔 오류 한 줄이 폼 맨 아래 결제 버튼 위에만 떴다. 그런데 버튼은 화면 아래 고정 바에 있어서
   *  **누른 자리에서 3,000px 떨어진 곳에 글자가 생겼다.** 화면에는 아무 변화도 없고 팝업도 안 열리니
   *  「버튼이 죽었다」로 읽힌다. 실제로 대표가 그렇게 읽었다.
   *  ⭐그래서 둘을 같이 한다 — 문구는 그 칸 아래에 놓고, 화면을 그 칸으로 끌어올린다. */
  const [badField, setBadField] = useState<"product" | "date" | "time" | "plan" | "name" | "phone" | "">("");
  const productRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const timeRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  // ⏱고른 날의 시간대와 이미 팔린 칸에서 «지금 고를 수 있는 것»을 만든다.
  //   🔁09-19 대표 — 30분 눈금, 시작과 끝을 «한 줄»에서 고른다. 계산은 `rent-time`의 순수 함수 셋이다
  //   (`dayMarks`·`startChoices`·`endChoices`). 서버 관문(`validateBookingRequest`)과 같은 규칙이라 화면이 켠 칸은 서버도 받는다.
  //   ⚠️**한 날에 시간대가 둘 이상일 수 있다**(오전만 열고 오후에 또 여는 가게). 눈금은 시각순으로 합치고, 구간은 칸 하나를 못 넘는다.
  const daySlots = openSlots.filter((sl) => sl.date === useDate);
  const taken = takenByDate[useDate] ?? [];
  const minMinutes = minHoursToMinutes(minHours);
  // ⏳오늘을 고른 경우엔 이미 지나간 시각도 뺀다. 서버도 같은 검사를 한다(`startBookingAction`).
  const cutoff = useDate === todayKst() ? toMinutes(nowHhmmKst()) : -1;
  const marks = dayMarks(daySlots);
  const startChoices = startChoicesOf(daySlots, taken, minMinutes, cutoff);
  // 🔁09-17 — 첫 시각을 대신 고르지 않는다(날짜와 같은 이유). 고른 시각이 목록에서 사라졌으면 빈 값으로 돌아간다.
  const activeStart = startChoices.includes(startTime) ? startTime : "";
  /** 고른 시작에서 갈 수 있는 끝 — 최소 시간부터, 닫는 시각과 다음 예약 중 먼저 오는 쪽까지. */
  const ends = activeStart ? endChoices(daySlots, taken, activeStart, minMinutes) : [];
  const endTime = ends.includes(endPick) ? endPick : "";
  const minutes = activeStart && endTime ? minutesBetween(activeStart, endTime) : 0;

  /** 칩 하나를 눌렀을 때. 시작 → 끝 순서로 고르고, 다 고른 뒤 다른 칩을 누르면 그 칩을 새 시작으로 처음부터 고른다.
   *  시작을 한 번 더 누르면 풀린다. 시작만 고른 상태에서 끝이 될 수 없는 칩을 누르면 그 칩이 새 시작이다. */
  const tapMark = (t: string) => {
    setBadField((f) => (f === "time" ? "" : f));
    setResumeNote("");
    if (activeStart && !endTime) {
      if (t === activeStart) { setStartTime(""); return; }
      if (ends.includes(t)) { setEndPick(t); return; }
    }
    if (activeStart && endTime && t === endTime && !startChoices.includes(t)) { setEndPick(""); return; }
    if (startChoices.includes(t)) { setStartTime(t); setEndPick(""); }
  };

  // 💸금액 = 고른 상품 값 × 길이(분) (+ 커피챗). 서버(`startBookingAction`)가 같은 함수로 다시 계산한다 — 여기는 보여주기용.
  const amount = product && minutes > 0
    ? bookingAmount({ ...products, coffeeChat, coffeeChatPrice }, product, minutes, withChat)
    : null;
  const chatAmount = amount?.chat ?? 0;
  const spaceAmount = amount?.space ?? 0;
  const total = amount?.total ?? 0;
  const timePicked = !!useDate && !!endTime;
  // ☎️서버(`startBookingAction`)와 같은 규칙 — 숫자만 세서 0으로 시작하는 9~11자리.
  const phoneOk = /^0\d{8,10}$/.test(phone.replace(/\D/g, ""));
  // 🪪서버(`startBookingAction`)와 같은 규칙 — 앞뒤 공백을 뺀 두 글자 이상.
  const nameOk = guestName.trim().length >= 2;
  // ⚠️열 글자는 서버(`confirmBookingAction`)가 강제하는 값이다. 여기서 먼저 막는 건 왕복을 아끼려는 것이지
  //   이게 관문이라서가 아니다 — 관문은 늘 서버 쪽이다.
  const planShort = plan.trim().length < 10;

  /** 버튼이 부르는 건 이것 — 싼 검사만 하고 팝업을 연다. 서버 왕복은 팝업에서 [신청하기]를 누른 뒤다. */
  /** 위에서부터 첫 번째로 비어 있는 칸으로 데려간다. 두 칸이 다 비어도 «위엣것» 하나만 말한다 —
   *  한 번에 둘을 고치라고 하면 어디부터 볼지 또 고민하게 된다. */
  const stopAt = (f: "product" | "date" | "time" | "plan" | "name" | "phone") => {
    setBadField(f);
    const el = { product: productRef.current, date: dateRef.current, time: timeRef.current, plan: planRef.current, name: nameRef.current, phone: phoneRef.current }[f];
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // 글 칸은 커서까지 넣어 준다. 날짜는 격자라 커서가 갈 곳이 없다.
    if (f === "plan") planRef.current?.focus({ preventScroll: true });
    if (f === "name") nameRef.current?.focus({ preventScroll: true });
    if (f === "phone") phoneRef.current?.focus({ preventScroll: true });
  };

  const askConfirm = () => {
    setDialogErr("");
    setBadField("");
    if (!product) { stopAt("product"); return; }
    if (!useDate) { stopAt("date"); return; }
    if (!endTime) { stopAt("time"); return; }
    if (planShort) { stopAt("plan"); return; }
    if (!nameOk) { stopAt("name"); return; }
    if (!phoneOk) { stopAt("phone"); return; }
    setConfirming(true);
  };

  // ─── 🔑09-19 대표 [G] 로그인 안 한 손님 ───
  //   대표 원문: *「로그인 안 한 사람도 결제 바를 보여 주고 → 결제 클릭하면 로그인하게 하자 → 로그인이나 회원가입해서
  //   로그인이 완료되면 → 결제 정보 기억하고 있다가 → 결제로 넘어가게 하고!」*
  //   ⭐바를 누르면 고른 값을 이 탭에 맡기고 로그인으로 간다. 돌아오는 주소는 `/rent/<slug>?resume=1`이다.
  //     로그인·가입·카카오·구글 넷 다 `?redirect=`를 이어 받는다(`lib/safe-redirect` · 09-18 밤 SC-05).
  //   ⛔로그인 전엔 검사하지 않고 보낸다. 칸을 다 채워야 로그인할 수 있으면 「결제 클릭하면 로그인」이 아니게 된다.
  //     빈 칸은 돌아온 뒤 바를 누른 것과 똑같이 그 칸으로 데려간다.
  const resumeKey = resumeKeyOf(spaceSlug);
  const goLogin = () => {
    const draft: ResumeDraft = {
      product, useDate, startTime: activeStart, endTime, headcount, headUnsure, plan, withChat, guestName, phone,
    };
    try {
      sessionStorage.setItem(resumeKey, JSON.stringify(draft));
    } catch {
      // 저장소를 막아 둔 브라우저면 못 맡긴다. 로그인 뒤 폼이 비어 있을 뿐 신청은 그대로 할 수 있다.
    }
    router.push(`/login?redirect=${encodeURIComponent(`/rent/${spaceSlug}?resume=1`)}`);
  };

  const resumeTried = useRef(false);
  // ⚠️여는 순간 한 번만 읽는다. useState 초기값에서 읽으면 서버 렌더와 모양이 달라 하이드레이션이 깨진다.
  //   브라우저 저장소는 «바깥 시스템»이라 effect 안에서 값을 얹는다(`SpaceForm` 초안 되살리기와 같은 처리).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (resumeTried.current) return;
    resumeTried.current = true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") !== "1") return;
    // 주소에서 표시를 걷는다. 새로 고침하거나 링크를 복사해도 되살리기가 다시 돌지 않게.
    params.delete("resume");
    const qs = params.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    let saved: ResumeDraft | null = null;
    try {
      saved = readResume(sessionStorage.getItem(resumeKey));
      sessionStorage.removeItem(resumeKey); // 쓴 값은 지운다. 다음에 이 공간에 올 때 옛 값이 끼지 않게.
    } catch {
      saved = null;
    }
    if (!saved) return;

    // 그새 바뀐 것을 가린다. 화면이 방금 서버에서 받은 열린 시간·찬 시간이 기준이다(서버 관문과 같은 함수).
    const notes: string[] = [];
    const p = saved.product && sellable.includes(saved.product) ? saved.product : "";
    if (saved.product && !p) notes.push("고르신 방식은 이제 이 공간에서 빌릴 수 없어요. 방식을 다시 확인해 주세요.");
    const pickedProduct = sellable.length === 1 ? sellable[0] : p;
    let d = saved.useDate;
    let st = saved.startTime;
    let en = saved.endTime;
    if (d && !openSlots.some((sl) => sl.date === d)) {
      notes.push(`고르신 날짜 ${dateLabel(d)}에는 이제 열린 시간이 없어요. 다른 날을 골라 주세요.`);
      d = st = en = "";
    } else if (d && st) {
      const ds = openSlots.filter((sl) => sl.date === d);
      const tk = takenByDate[d] ?? [];
      const cut = d === todayKst() ? toMinutes(nowHhmmKst()) : -1;
      const startOk = startChoicesOf(ds, tk, minMinutes, cut).includes(st);
      const endOk = startOk && (!en || endChoices(ds, tk, st, minMinutes).includes(en));
      if (!endOk) {
        notes.push(`${dateLabel(d)} ${en ? `${st}~${en}` : st}에는 그사이 다른 예약이 들어왔거나 시간이 닫혔어요. 시간을 다시 골라 주세요.`);
        st = en = "";
      }
    }
    setPickedProduct(p);
    setUseDate(d);
    setStartTime(st);
    setEndPick(en);
    setHeadcount(saved.headUnsure ? "" : saved.headcount);
    setHeadUnsure(saved.headUnsure);
    setPlan(saved.plan);
    setWithChat(coffeeChat && coffeeChatPrice > 0 && saved.withChat);
    setGuestName(saved.guestName);
    // 번호는 적어 둔 것이 먼저, 비었으면 방금 로그인한 계정의 프로필 번호.
    const ph = saved.phone.trim() ? saved.phone : initialPhone;
    setPhone(ph);

    if (notes.length > 0) {
      setResumeNote(notes.join(" "));
      document.getElementById("apply")?.scrollIntoView({ block: "start" });
      return;
    }
    if (!signedIn) return;
    // 다 맞으면 바를 누른 것과 똑같이 간다 — 빈 칸이 있으면 그 칸으로, 없으면 확인 팝업.
    //   ⭐결제하러 가기는 손님이 누른다. 팝업 안에 약관·유의 사항 확인이 있어서 대신 넘기지 않는다.
    //   팝업을 닫으면 신청 절 앞이도록 먼저 그리로 옮겨 둔다(로그인에서 돌아오면 화면 맨 위다).
    if (!pickedProduct) return stopAt("product");
    if (!d) return stopAt("date");
    if (!en) return stopAt("time");
    if (saved.plan.trim().length < 10) return stopAt("plan");
    if (saved.guestName.trim().length < 2) return stopAt("name");
    if (!/^0\d{8,10}$/.test(ph.replace(/\D/g, ""))) return stopAt("phone");
    document.getElementById("apply")?.scrollIntoView({ block: "start" });
    setConfirming(true);
    // 여는 순간 한 번만. 의존성을 채우면 입력마다 되살리기가 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  /** 서버가 「그 시간은 이제 못 쓴다」고 답한 것인가. 그러면 화면이 든 «찬 시간»이 이미 낡았다. */
  const slotGone = (m: string) => m.includes("이미 찼") || m.includes("열어 두신 시간") || m.includes("이미 지난 시간");

  const submit = () =>
    start(async () => {
      setDialogErr("");

      // ① 서버가 검사하고 자리를 잡는다. 주문번호와 청구액도 여기서 «서버가» 정해 돌려준다.
      const r = await startBookingAction({
        spaceSlug,
        useDate,
        startTime: activeStart,
        endTime,
        plan: plan.trim(),
        headcount: headcount ? Number(headcount) : undefined,
        withChat,
        product: product as RentProduct,
        guestBrandSlug: brandSlug,
        guestPhone: phone.trim(),
        guestName: guestName.trim(),
      });
      if (!r.ok || !r.orderId || !r.amount) {
        const m = r.message || "신청을 시작하지 못했어요.";
        setDialogErr(m);
        // 🔁찬 시간이 바뀌어 거절된 것이면 화면이 든 목록이 낡았다. 다시 받아 와서 그 시각을 고르개에서 지운다.
        //   ⚠️팝업은 열어 둔다 — 새로 고쳐진 폼 뒤에서 조용히 닫히면 왜 못 갔는지가 사라진다.
        if (slotGone(m)) router.refresh();
        return;
      }

      // ② 키가 없으면 위젯을 건너뛰고 모의 승인으로 간다(로컬에서 흐름을 막지 않으려고).
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        const done = await confirmBookingAction("", r.orderId);
        if (!done.ok) { setDialogErr(done.message); return; }
        setConfirming(false);
        router.push(done.bookingId ? `/rent/done/${done.bookingId}` : "/rent/requests");
        router.refresh();
        return;
      }
      // ③ 결제 화면으로. 🔁09-15 대표 — 전엔 이 화면 안에서 폼을 위젯으로 갈아끼웠다.
      //   주소가 그대로라 브라우저 뒤로가기가 「신청 내용 고치기」로 안 가고 목록으로 나가 버렸다.
      //   이제 `/rent/pay/<주문번호>`로 «이동»한다 — 뒤로가기가 제자리로 돌아온다.
      // 🚨**`router.push`가 아니라 문서를 새로 연다.** 토스 결제수단 위젯은 «한 문서에 하나»만 허용해서,
      //   화면 안 이동으로 결제 화면에 두 번째로 들어가면 `PAYMENT_METHODS_WIDGET_ALREADY_RENDERED`로 죽는다.
      //   🪤화면엔 에러가 안 뜬다 — 결제 칸이 통째로 비고 버튼이 「불러오는 중」에서 안 풀린다(09-15 실측).
      //   고치러 돌아갔다 다시 오는 길이 바로 그 경우라, 대표가 요청한 바로 그 동선에서 터진다.
      window.location.assign(`/rent/pay/${r.orderId}`);
    });

  return (
    // 📐09-17 디자인팀 — sm부터 폭 520. 데스크톱 왼쪽 기둥(676)을 다 쓰면 달력 칸이 75px로 벌어져
    //   날짜 줄이 한눈에 안 읽혔다. 폰(343)은 그대로 꽉 찬다.
    <div className="space-y-7 sm:max-w-[520px]">
      {/* 🔑09-19 [G] 로그인하고 돌아왔는데 고른 것이 그새 못 쓰게 됐을 때. 폼 맨 위에 한 줄 — 무엇이 비었는지 먼저 읽힌다. */}
      {resumeNote && (
        <p role="alert" className="rounded-lg bg-lemon-pale px-4 py-3 text-[15px] leading-relaxed break-keep text-lemon-on">
          {resumeNote}
        </p>
      )}
      {/* 🛍09-18 대표 — 날짜·시각 «위»에서 상품부터 고른다. 값이 상품마다 달라서 시간을 고르기 전에 무엇을 빌리는지 정해야
          하단 금액이 처음부터 맞게 선다. 둘이면 카드 라디오, 하나면 고르기 없이 한 줄. 설명은 상세 「빌릴 수 있는 것」과 같은 글이다. */}
      {sellable.length > 0 && (
        <div ref={productRef}>
          {/* 🔁09-18 대표 코멘트 — 「어떻게 빌리실까요」가 위 「빌릴 수 있는 것」과 겹쳐 읽혔다. 하나면 확인, 둘이면 고르기. */}
          <p className={labelCls}>{sellable.length === 1 ? "어떻게 빌리실지 확인해 주세요" : "어떻게 빌리실지 골라 주세요"}</p>
          {sellable.length === 1 ? (
            <div className="rounded-lg bg-surface-soft px-4 py-3">
              <p className="text-[16px] text-ink">
                <span className="font-medium">{PRODUCT_LABEL[sellable[0]]}</span>
                <span className="text-mute"> · 한 시간 {won(productPrice(products, sellable[0]))}</span>
              </p>
              <p className="mt-0.5 text-[15px] leading-snug break-keep text-mute">
                {PRODUCT_HINT_GUEST[sellable[0]]}. 이 공간은 이 방식으로만 빌려드려요.
              </p>
            </div>
          ) : (
            <div role="radiogroup" aria-label="빌리는 방식" className="space-y-2">
              {sellable.map((p) => {
                const on = product === p;
                const note = productNote(products, p);
                return (
                  <button
                    key={p}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      setPickedProduct(p);
                      setBadField((f) => (f === "product" ? "" : f));
                    }}
                    className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left transition-colors ${
                      on ? "border-primary-tint bg-primary-pale" : "border-hairline bg-surface hover:bg-surface-soft"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`mt-[3px] grid size-[18px] shrink-0 place-items-center rounded-full border-2 ${
                        on ? "border-primary-on" : "border-border-strong"
                      }`}
                    >
                      {on && <span className="size-[8px] rounded-full bg-primary-on" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                        <span className="text-[16px] font-medium text-ink">{PRODUCT_LABEL[p]}</span>
                        <span className="text-[15px] font-medium tabular-nums text-body">
                          {won(productPrice(products, p))}
                          <span className="font-normal text-mute"> / 시간</span>
                        </span>
                      </span>
                      <span className="mt-0.5 block text-[14px] leading-snug break-keep text-mute">{PRODUCT_HINT_GUEST[p]}</span>
                      {note && (
                        <span className="mt-2 line-clamp-3 whitespace-pre-line text-[15px] leading-relaxed break-keep text-body">
                          {note}
                        </span>
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {badField === "product" && <p className={errCls}>어느 쪽으로 빌릴지 먼저 골라 주세요.</p>}
        </div>
      )}

      <div ref={dateRef}>
        {/* ✍️09-17 「신청 날짜를 선택해주세요.」 → 말 걸듯(행정어 걷기). 아래 「몇 시부터 쓰실까요?」와 같은 말투다. */}
        {/* 🔁09-18 대표 코멘트 — 제목은 「날짜를 선택해 주세요」, 그 아래에 날짜를 고르면 무엇이 보이는지 한 줄. */}
        <p className="block text-[16px] font-medium text-body">날짜를 선택해 주세요</p>
        <p className="mt-1 mb-3 text-[15px] leading-relaxed break-keep text-faint">
          날짜를 선택하면 그날 예약할 수 있는 시간을 확인할 수 있어요.
        </p>
        {/* 🔁09-14 `<select>` → 달력(대표). 못 고르는 날이 흐리게 «보이는» 것이 오히려 정보다 —
            「이 공간은 화요일만 열린다」가 격자에서 한눈에 읽힌다. 목록은 그 규칙을 안 보여준다. */}
        <PickDateCalendar
          openDates={openSlots.map((sl) => sl.date)}
          value={useDate}
          onChange={(d) => {
            setUseDate(d);
            setResumeNote("");
            // 날을 바꾸면 시각을 비운다 — 어제 고른 시각이 오늘도 열려 있으리란 보장이 없다.
            setStartTime("");
            setEndPick("");
            setBadField((f) => (f === "date" ? "" : f));
          }}
        />
        {badField === "date" && <p className={errCls}>날짜부터 골라 주세요.</p>}
        {daySlots.length > 0 && (
          <p className={hintCls}>
            {daySlots.map((sl) => `${sl.start}~${sl.end}`).join(", ")} 열려 있어요 · 최소 {durationLabel(minMinutes)}부터
          </p>
        )}
      </div>

      {/* ⏱09-16 신설 — 시간 단위로 바뀌면서 「몇 시부터 몇 시간」이 신청의 핵심이 됐다.
          🔁09-19 대표 — 「몇 시간 빌리실까요?」 칸을 없애고 시작과 끝을 «한 줄»에서 고른다(30분 눈금).
          ⭐그날 열린 눈금을 다 깔고, 시작을 누르면 그 시작에서 갈 수 있는 끝만 테두리가 켜진다. 열린 시간·최소 시간·
            이미 팔린 칸 셋은 칩이 먼저 걸러 주므로 손님이 머리로 맞출 일이 없다. 고른 구간은 칩 색이 한 덩어리로 이어지고,
            그 아래 한 줄(「10:30~13:00 · 2시간 30분」)이 요약한다. 아워플레이스의 시간 고르기처럼 누르는 순서가 곧 답이다. */}
      <div ref={timeRef}>
        <p className={labelCls}>시작과 끝 시각을 골라 주세요</p>
        {!useDate ? (
          <p className={hintCls}>날짜를 고르면 열린 시각이 나와요.</p>
        ) : startChoices.length === 0 ? (
          <p className={hintCls}>이 날은 빌릴 수 있는 시간이 남아 있지 않아요. 다른 날을 골라 주세요.</p>
        ) : (
          <div>
            {/* 지금 무엇을 누를 차례인지 칩 «위»에 한 줄. 누르는 손가락이 가리는 자리를 피한다. */}
            <p className="-mt-1 mb-3 text-[15px] leading-relaxed break-keep text-mute" aria-live="polite">
              {!activeStart
                ? "시작 시각을 먼저 눌러 주세요."
                : !endTime
                  ? `${activeStart}부터예요. 끝나는 시각을 눌러 주세요.`
                  : "다른 시각을 누르면 처음부터 다시 골라요."}
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6" role="group" aria-label="시작과 끝 시각">
              {marks.map((t) => {
                const isStart = t === activeStart;
                const isEnd = t === endTime;
                const inRange = !!endTime && t > activeStart && t < endTime;
                const endable = !!activeStart && !endTime && ends.includes(t);
                const startable = startChoices.includes(t);
                const enabled = isStart || isEnd || endable || startable;
                const cls = isStart || isEnd
                  ? chipOnCls
                  : inRange
                    ? chipRangeCls
                    : endable
                      ? chipEndableCls
                      : !enabled
                        ? chipDisabledCls
                        : activeStart && !endTime
                          ? chipDimCls
                          : chipOffCls;
                return (
                  <button
                    key={t}
                    type="button"
                    data-time-chip={t}
                    disabled={!enabled}
                    aria-pressed={isStart || isEnd}
                    aria-label={isStart ? `${t} 시작` : isEnd ? `${t} 끝` : endable ? `${t}까지` : t}
                    onClick={() => tapMark(t)}
                    className={`${chipCls} ${cls}`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
            {endTime && (
              <p className="mt-3 text-[16px] text-body" data-time-summary>
                <span className="font-medium text-ink tabular-nums">
                  {activeStart}~{endTime}
                </span>
                <span className="text-mute"> · {durationLabel(minutes)}</span>
              </p>
            )}
            {activeStart && !endTime && (
              <p className={hintCls}>최소 {durationLabel(minMinutes)}부터 빌릴 수 있어요.</p>
            )}
          </div>
        )}
        {badField === "time" && (
          <p className={errCls}>{activeStart ? "끝나는 시각도 골라 주세요." : "시작 시각부터 골라 주세요."}</p>
        )}
      </div>

      {useType !== "as_is" && (
        <div>
          <label htmlFor="rent-head" className={labelCls}>
            오시는 인원 <span className="ml-1 text-[15px] font-normal text-faint">(선택)</span>
          </label>
          {/* 🔁09-14 대표 — 「input이 이렇게 길지 않아도 될 거 같은데」. 숫자 두세 자리를 받는 칸이
              화면 폭을 다 쓰면 **긴 글을 기대하는 칸처럼** 보인다. 폭이 곧 기대 길이다.
              그리고 단위 「명」을 칸 «안»에 박아 둔다 — 밖에 두면 좁은 화면에서 줄이 바뀌어 떨어진다. */}
          {/* 📐폭 200px — 대표가 「이렇게 길지 않아도」라 했지만 **너무 좁히면 플레이스홀더가 잘린다**
              140px에선 「숫자를 입력…」, 200px에서도 한 글자가 끊겼다. **재서 240px**로 잡았다
              (글자 자리 ~196 + 「명」 자리 44). 전체 폭 380의 63%라 여전히 「짧은 칸」으로 읽힌다.
              ⭐폭은 기대 길이를 말하는 장치지 최소화할 값이 아니다 — 문구가 잘리면 그 장치가 거짓말을 한다. */}
          {/* 📐09-18 대표 코멘트 — 칸을 조금 줄이고 옆에 「아직 잘 모르겠어요」. 「예) 3」은 180px에서도 안 잘린다. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="relative w-[180px]">
            <input
              id="rent-head"
              type="number"
              inputMode="numeric"
              min={1}
              max={capacity}
              className={`${rentInputCls} pr-11`}
              value={headcount}
              disabled={headUnsure}
              onChange={(e) => setHeadcount(e.target.value)}
              // ✍️09-17 「숫자를 입력해주세요」 → 예시 숫자(행정어 걷기). 칸 안 「명」과 붙여 읽힌다.
              placeholder="예) 3"
            />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-[16px] text-mute"
            >
              명
            </span>
          </div>
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-[15px] text-body">
            <input
              type="checkbox"
              className="size-[18px] accent-primary"
              checked={headUnsure}
              onChange={(e) => {
                setHeadUnsure(e.target.checked);
                if (e.target.checked) setHeadcount("");
              }}
            />
            아직 잘 모르겠어요
          </label>
          </div>
          {capacity ? <p className={hintCls}>최대 {capacity}명까지 들어가요.</p> : null}
        </div>
      )}

      <div>
        <label htmlFor="rent-plan" className={labelCls}>
          공간에서 무엇을 하실 예정인지 알려 주세요
        </label>
        {/* ⭐이 칸이 사장님이 수락을 정하는 유일한 근거다. 「대관 문의드립니다」로는 아무것도 못 정한다.
            그래서 placeholder에 **답의 모양**을 보여준다 — 무엇을·누구와·몇 시간. */}
        <textarea
          id="rent-plan"
          ref={planRef}
          rows={4}
          // ✂️09-18 밤 QA(SEC-07) — 서버(`startBookingAction`)와 같은 상한(`PLAN_MAX`).
          maxLength={PLAN_MAX}
          className={`${rentTextareaCls} resize-y`}
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            if (e.target.value.trim().length >= 10) setBadField((f) => (f === "plan" ? "" : f));
          }}
          // ⏱09-16 대표 — 시간 단위. 예시가 「하루 팝업」이면 바로 위에서 고른 몇 시간과 말이 어긋난다.
          // ☕09-18 대표 코멘트 — 「카페 창업 전에 카페 일을 진짜 한번 해 보기」 같은 목적도 녹여 달라.
          //   예시 둘을 나란히 두면 고르는 문제처럼 읽혀서, 한 문장 안에 «창업 전 연습 + 무엇을·누구와»를 담았다.
          placeholder="예) 카페를 열기 전에 일일카페로 네 시간 장사를 해 보려고 해요. 친구랑 둘이 커피와 구움과자를 팔 거예요."
        />
        {badField === "plan" && <p className={errCls}>그날 무엇을 하실지 열 글자 이상 적어 주세요.</p>}
        <p className={hintCls}>사장님이 이 글만 보고 정하세요. 열 글자면 충분해요.</p>
      </div>

      {/* 🪪09-18 대표 코멘트 — 「실명 확인 당일날도 필요하고」. 사장님 메일·내 하루 가게의 「성함」 칸이 이 값이다.
          번호 칸 «위»에 둔다. 누가 오는지를 먼저 적고, 그 사람에게 닿는 번호를 다음에 적는 순서다.
          ⚠️두 글자 검사는 서버(`startBookingAction`)가 관문이다. 여기는 왕복을 아끼려고 먼저 막는다. */}
      <div>
        <label htmlFor="rent-name" className={labelCls}>
          이용하실 분 성함(실명)
        </label>
        <input
          id="rent-name"
          ref={nameRef}
          type="text"
          autoComplete="name"
          maxLength={50}
          className={`${rentInputCls} max-w-[240px]`}
          value={guestName}
          onChange={(e) => {
            setGuestName(e.target.value);
            if (e.target.value.trim().length >= 2) setBadField((f) => (f === "name" ? "" : f));
          }}
          placeholder="예) 김하루"
        />
        {badField === "name" && (
          <p className={errCls}>{guestName.trim() ? "성함을 두 글자 이상 적어 주세요." : "이용하실 분 성함이 필요해요."}</p>
        )}
        <p className={hintCls}>이용 당일 신분 확인에 쓰여요. 사장님께만 전달돼요.</p>
      </div>

      {/* ☎️09-17 대표 — 손님 전화번호 필수. 사장님이 예약을 받은 뒤 보는 손님 연락처가 프로필 전화인데,
          소셜로 가입한 손님은 그 칸이 비어 있어 사장님이 연락할 길이 이메일뿐이었다.
          프로필에 번호가 있으면 미리 채우고, 없으면 여기서 받아 서버가 프로필에 적는다(`savePhoneIfEmpty`). */}
      <div>
        <label htmlFor="rent-phone" className={labelCls}>
          연락받을 번호
        </label>
        <input
          id="rent-phone"
          ref={phoneRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className={`${rentInputCls} max-w-[240px]`}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            if (/^0\d{8,10}$/.test(e.target.value.replace(/\D/g, ""))) setBadField((f) => (f === "phone" ? "" : f));
          }}
          placeholder="010-1234-5678"
        />
        {badField === "phone" && (
          <p className={errCls}>{phone.trim() ? "번호를 한 번 더 봐 주세요. 숫자 9~11자리예요." : "사장님이 연락드릴 번호가 필요해요."}</p>
        )}
        <p className={hintCls}>사장님이 예약을 받으면 이 번호로 연락드릴 수 있어요.</p>
      </div>

      {/* 🔻09-14 「사장님께 잠깐 배워보기」 체크박스 삭제 — 대표 [3][5].
          설명은 상세 본문의 «정보 절»로 올라갔고, 고르는 일은 결제 단계(아래 옵션)로 내려왔다.
          ⭐**설명하는 자리와 고르는 자리를 갈랐다.** 한 줄 체크박스는 둘 다 하려다 둘 다 못 했다. */}
      {myBrands.length > 0 ? (
        <div>
          {/* 🔁09-18 대표 코멘트 — 고르개 → 예/아니요 토글(기본 «예»), 질문은 손님이 이미 가진 걸 짚어 준다. */}
          <p className={labelCls}>등록한 collab5 소개서가 있으시네요? 사장님께 이것도 함께 전달드릴까요?</p>
          <div role="radiogroup" aria-label="소개서 함께 전달" className="flex gap-2">
            {[
              { v: true, label: "예" },
              { v: false, label: "아니요" },
            ].map((o) => (
              <button
                key={String(o.v)}
                type="button"
                role="radio"
                aria-checked={brandOn === o.v}
                onClick={() => setBrandOn(o.v)}
                className={`inline-flex h-[44px] min-w-[88px] items-center justify-center rounded-pill px-5 text-[15px] font-medium transition-colors ${
                  brandOn === o.v
                    ? "bg-primary-tint text-primary-on"
                    : "border-[0.5px] border-[#DFDFE3] bg-surface text-body hover:bg-surface-soft"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {/* 소개서가 둘 이상일 때만 어느 것을 보낼지 고른다. */}
          {brandOn && myBrands.length > 1 && (
            // 🏷09-18 밤 QA(G-22) — 이 고르개엔 `<label>`이 없어서 낭독기가 「콤보 상자」라고만 읽었다.
            //   위 질문 문장은 라디오 둘을 가리키고 있어 이 칸의 이름이 아니다.
            <RentSelect
              id="rent-brand"
              aria-label="보낼 소개서 고르기"
              wrapClassName="mt-3"
              value={brandPick}
              onChange={(e) => setBrandPick(e.target.value)}
            >
              {myBrands.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </RentSelect>
          )}
          <p className={hintCls}>소개서를 전달하면 사장님이 조금 더 마음 놓고 맡기실 수 있어요.</p>
        </div>
      ) : (
        // 📎09-17 QA — 소개서가 없는 손님에겐 이 칸이 통째로 안 보였다. 소개서로 데려올 사람이 바로 이분들이라
        //   같은 자리에 한 줄을 둔다. 새 탭으로 연다 — 이 탭에서 가면 적던 신청이 날아간다.
        <p className="text-[15px] leading-relaxed break-keep text-mute">
          소개서가 있으면 사장님이 어떤 브랜드가 오는지 미리 볼 수 있어요.{" "}
          <Link href="/register" target="_blank" className="text-body underline underline-offset-2">
            3분 만에 소개서 만들기
          </Link>
        </p>
      )}

      {/* 🔻09-15 대표 — 「대여 비용 · 거절하면 전액 환불 · 수락하면 주소가 열려요」 줄 삭제.
          금액은 화면 아래 고정 바가 늘 들고 있어서 같은 말이 두 번이었고, 환불 이야기는
          상세의 «환불 규정» 절로 옮겼다(대표 [2]). 한 문장이 세 가지 일을 하려다 셋 다 흐렸다. */}

      {/* 🔻09-14 데스크톱 인라인 버튼 삭제 — 하단 고정 바가 이제 모든 폭에서 뜬다(대표 지시).
          같은 버튼이 화면에 둘이면 어느 쪽이 진짜인지 고민하게 된다. */}
      {isTestPayment() && <p className="text-[14px] text-faint">지금은 시험 결제예요.</p>}

      {/* 🔁09-17 QA — 같은 흐름이 버튼 셋에서 「결제하고 신청하기 / 신청하기 / N원 결제하기」로 불렸다.
          바는 확인 팝업을 여는 버튼이라 「신청하기」, 팝업은 결제 화면으로 넘기니 「결제하러 가기」,
          결제 화면은 돈을 내는 버튼이라 「N원 결제하기」. 버튼 이름이 그 버튼이 여는 다음 화면을 말한다. */}
      <PayBar
        amount={timePicked && product ? total : null}
        caption={timePicked ? durationLabel(minutes) : undefined}
        emptyText={!product ? "방식을 고르면 금액이 나와요" : activeStart ? "끝나는 시각을 고르면 금액이 나와요" : "시간을 고르면 금액이 나와요"}
        // 🔑09-19 [G] 로그인 전엔 같은 바가 「로그인하고 신청하기」다. 누르면 고른 값을 맡기고 로그인으로 간다.
        label={pending ? "결제 화면으로 가는 중…" : signedIn ? "신청하기" : "로그인하고 신청하기"}
        disabled={pending}
        onClick={signedIn ? askConfirm : goLogin}
      />

      <ConfirmDialog
        open={confirming}
        title="이대로 신청할까요?"
        confirmLabel="결제하러 가기"
        busy={pending}
        error={dialogErr}
        onConfirm={submit}
        onCancel={() => {
          setConfirming(false);
          setDialogErr("");
        }}
      >
        {/* 🔁09-15 `sm:hidden` 제거 — 어느 폭에서나 여기서 고른다(대표 「데스크탑도 동일 UX」).
            바에서 옵션을 뺐으니 고르개가 둘로 보일 걱정도 없다. */}
        {coffeeChat && coffeeChatPrice > 0 && (
          <MentorOptions
            minutes={coffeeChatMinutes}
            price={coffeeChatPrice}
            value={withChat}
            onChange={setWithChat}
          />
        )}
        {/* 📋09-15 대표 — *「줄글로 하지 말고 결제 화면의 항목처럼」*. 결제 화면(`PayPanel`)과 같은 문법이다.
            ⭐두 화면이 같은 모양이라 **방금 확인한 것을 다음 화면에서 다시 대조**할 수 있다.
            🔻「사장님이 거절하시면 전액 돌려드려요」는 뺐다 — 상세의 환불 규정 절이 맡는다(대표 [6]). */}
        {/* 📐09-18 대표 코멘트 — 옵션과 장소 사이가 빠듯했다. 여백을 벌리고 「예약 정보 확인」 제목을 세운다. */}
        <p className="mt-6 text-[15px] font-bold text-ink">예약 정보 확인</p>
        <InfoList className="mt-2 border-t border-hairline pt-3">
          <InfoRow label="장소" value={spaceName} />
          {/* 🛍09-18 — 무엇을 샀는지. 결제 화면·완료·메일이 같은 이름(`PRODUCT_LABEL`)을 쓴다. */}
          {product && <InfoRow label="상품" value={PRODUCT_LABEL[product]} />}
          {/* 🔁09-18 밤 QA(G-12) — 「신청 날짜」는 신청한 날로도 읽힌다. 폼·완료 화면과 같은 말로. */}
          <InfoRow label="빌리는 날" value={dateLabel(useDate)} />
          <InfoRow label="이용 시간" value={rangeLabel(activeStart, endTime)} />
          {/* 📋09-17 QA — 사장님이 「이 글만 보고 정한다」면서 손님은 결제 직전에 그 글을 다시 못 봤다.
              인원과 앞부분만 싣는다. */}
          {headcount && <InfoRow label="인원" value={`${headcount}명`} />}
          <InfoRow label="무엇을" value={planPreview(plan)} />
          {/* 🪪☎️📎09-18 밤 QA(G-29) — 사장님께 «같이 가는 것» 셋이 확인 자리에 없었다. 성함과 번호는 고칠 기회가
              여기가 마지막이고, 소개서는 「보낼까요」를 켠 줄이 폼 한참 위라 무엇을 보내는지 잊는다. */}
          <InfoRow label="성함" value={guestName.trim()} />
          <InfoRow label="연락처" value={phone.trim()} />
          {brandSlug && (
            <InfoRow label="보낼 소개서" value={myBrands.find((b) => b.slug === brandSlug)?.name ?? brandSlug} />
          )}
          <InfoRow
            label="결제 금액"
            value={
              <>
                <span className="font-medium text-ink">{won(total)}</span>
                {/* 💸09-17 QA — 합계만 있으면 「왜 10만원인가」를 손님이 셈한다. 내역을 한 줄로. */}
                <span className="block text-[15px] text-mute">
                  {product ? PRODUCT_LABEL[product] : "대여"} {durationLabel(minutes)} {won(spaceAmount)}
                  {chatAmount > 0 && ` + ${COFFEE_CHAT_LABEL} ${coffeeChatMinutes}분 ${won(chatAmount)}`}
                </span>
              </>
            }
          />
        </InfoList>
        {/* ⚖️**통신판매중개자 고지 — 청약 확인 자리** (전자상거래법 제20조①, 2026-09-16).
            시행규칙 제11조의2는 초기 화면뿐 아니라 «청약 내용을 확인하는» 자리에도 알리라고 한다.
            돈을 내기 직전인 이 팝업이 그 자리다. 푸터에도 있지만 푸터는 여기서 안 보인다.
            ✍️푸터 문장은 법 문체라 이 팝업 말투와 안 맞는다. 뜻(당사자가 아니다 · 빌려주는 분은 사장님)은
              그대로 두고 주변 줄들과 같은 해요체로 옮겼다. 「통신판매중개자」라는 법 용어는 남긴다 —
              고지의 핵심 낱말이라 빼면 고지가 아니게 된다.
            📏15px — 위 항목 줄(16px)보다 한 단 작다. 강조가 아니라 «알림»이라 흐리게 둔다. */}
        {/* ⏱09-17 대표 — 결제 직전에 «그다음 누가 무엇을 하는지»를 한 줄로. */}
        {/* 🔁09-18 대표 코멘트 — 「예약 전 유의사항」 제목을 달고, 성격이 다른 두 문장을 점 하나씩으로 갈랐다.
            버튼과 붙어 있던 것도 아래 여백으로 뗐다. */}
        <div className="mt-6 mb-2">
          <p className="text-[15px] font-bold text-ink">예약 전 유의 사항</p>
          {/* 📐09-18 대표 코멘트 — 위 「예약 정보 확인」과 같은 위계로 제목 밑에 선 하나. */}
          <ul className="mt-2 space-y-2 border-t border-hairline pt-3">
            {[
              CONTACT_RULE_GUEST,
              // 🪪09-18 대표 — 「신청할 때 약관 동의 같은 데 넣어야 할 수도」. 약관 제10조에 넣은 한 줄을 돈 내기 직전에 한 번 더.
              "이용 당일 사장님이 신분증으로 성함을 확인할 수 있어요.",
              "공간을 빌려주시는 분은 사장님이에요. collab5는 신청과 결제를 이어 드리는 통신판매중개자라 거래의 당사자는 아니에요.",
            ].map((line) => (
              <li key={line} className="flex gap-2 text-[15px] leading-relaxed break-keep text-body">
                <span aria-hidden="true" className="text-mute">·</span>
                <span className="min-w-0 flex-1">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </ConfirmDialog>
    </div>
  );
}
