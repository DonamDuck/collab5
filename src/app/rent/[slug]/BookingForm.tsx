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
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { startBookingAction, confirmBookingAction } from "@/lib/rent-actions";
import type { SpaceUseType, OpenSlot, RentProduct, Space } from "@/lib/types";
import { bookingAmount, productNote, productPrice, sellableProducts } from "@/lib/rent-products";
import { hourMarks, hoursBetween, nowHhmmKst, overlaps, toHHMM, toMinutes, rangeLabel, todayKst } from "@/lib/rent-time";
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
/** 시각·길이 칩. 44px = 손가락 하한. 폭은 격자가 4등분해 준다. */
const chipCls = "h-[44px] rounded-md border text-[16px] tabular-nums transition-colors";
const chipOnCls = "border-transparent bg-primary-tint font-medium text-primary-on";
const chipOffCls = "border-hairline bg-surface text-ink hover:bg-primary-pale";

/** 화면 아래 고정 바 — 금액 + 이 화면의 키위 버튼. 어느 폭에서나 이 하나가 유일한 결제 버튼이다.
 *  하단 여백은 `max()`다(MakerActionBar 08-09 실측): 홈 인디케이터가 있는 기기는 안전영역만, 없는 기기는 12px. */
function PayBar({
  amount,
  emptyText,
  label,
  disabled,
  onClick,
}: {
  /** null = 아직 시간을 안 골랐다. 그땐 금액 대신 안내를 든다. */
  amount: number | null;
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
                <p className="text-[13px] text-faint">대여 비용</p>
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
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  // 🔁09-17 QA — 전엔 첫 열린 날이 미리 골라져 있었다. 달력을 안 보고 시간만 고르면 «고른 적 없는 날»로
  //   결제까지 갔다. 날짜도 시각도 손님이 직접 고른 값만 쓴다.
  const [useDate, setUseDate] = useState("");
  /** 고른 날의 시작 시각. 날을 바꾸면 비운다 — 어제 고른 시각이 오늘 안 열려 있을 수 있다. */
  const [startTime, setStartTime] = useState("");
  const [useHours, setUseHours] = useState(0);
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
  /** 결제 직전 확인 팝업(대표 09-14: 의사 확인은 팝업으로). 열린 채로 `submit`이 돌지 않게 닫고 시작한다. */
  const [confirming, setConfirming] = useState(false);
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
  const daySlots = openSlots.filter((sl) => sl.date === useDate);
  const taken = takenByDate[useDate] ?? [];
  /** 시작 가능 시각 — 열린 시간대를 정시로 쪼개고, 최소 시간을 못 채우는 꼬리와 이미 팔린 칸은 뺀다.
   *  ⚠️**한 날에 시간대가 둘 이상일 수 있다**(오전만 열고 오후에 또 여는 가게). 그래서 이어 붙인 뒤
   *    시각 순으로 세우고 겹치는 칸에서 나온 같은 시각은 하나로 줄인다. 저장된 순서를 그대로 쓰면
   *    오후를 먼저 적어 둔 가게에서 고르개가 「15:00, 16:00, 10:00, 11:00」로 선다. */
  // ⏳오늘을 고른 경우엔 이미 지나간 시각도 뺀다. 서버도 같은 검사를 한다(`startBookingAction`).
  const cutoff = useDate === todayKst() ? toMinutes(nowHhmmKst()) : -1;
  const startChoices = Array.from(
    new Set(
      daySlots.flatMap((sl) =>
        hourMarks(sl)
          .filter((t) => hoursBetween(t, sl.end) >= minHours)
          .filter((t) => toMinutes(t) > cutoff)
          .filter((t) => !taken.some((b) => overlaps(t, toHHMM(toMinutes(t) + minHours * 60), b.start, b.end))),
      ),
    ),
  ).sort();
  // 🔁09-17 — 첫 시각을 대신 고르지 않는다(날짜와 같은 이유). 고른 시각이 목록에서 사라졌으면 빈 값으로 돌아간다.
  const activeStart = startChoices.includes(startTime) ? startTime : "";
  /** 그 시작에서 «몇 시간까지» 가능한가. 문 닫는 시각과 다음 예약 중 먼저 오는 쪽이 한계다. */
  const maxHours = (() => {
    const sl = daySlots.find((x) => activeStart >= x.start && activeStart < x.end);
    if (!sl) return 0;
    let limit = toMinutes(sl.end);
    for (const b of taken) {
      const bs = toMinutes(b.start);
      if (bs >= toMinutes(activeStart) && bs < limit) limit = bs;
    }
    return Math.floor((limit - toMinutes(activeStart)) / 60);
  })();
  const hourChoices = Array.from({ length: Math.max(0, maxHours - minHours + 1) }, (_, i) => minHours + i);
  const activeHours = useHours && hourChoices.includes(useHours) ? useHours : hourChoices[0] ?? 0;
  const endTime = activeStart && activeHours ? toHHMM(toMinutes(activeStart) + activeHours * 60) : "";

  // 💸금액 = 고른 상품 값 × 시간 (+ 커피챗). 서버(`startBookingAction`)가 같은 함수로 다시 계산한다 — 여기는 보여주기용.
  const amount = product && activeHours > 0
    ? bookingAmount({ ...products, coffeeChat, coffeeChatPrice }, product, activeHours, withChat)
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
    setErr("");
    setBadField("");
    if (!product) { stopAt("product"); return; }
    if (!useDate) { stopAt("date"); return; }
    if (!endTime) { stopAt("time"); return; }
    if (planShort) { stopAt("plan"); return; }
    if (!nameOk) { stopAt("name"); return; }
    if (!phoneOk) { stopAt("phone"); return; }
    setConfirming(true);
  };

  const submit = () =>
    start(async () => {
      setConfirming(false);
      setErr("");

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
      if (!r.ok || !r.orderId || !r.amount) { setErr(r.message || "신청을 시작하지 못했어요."); return; }

      // ② 키가 없으면 위젯을 건너뛰고 모의 승인으로 간다(로컬에서 흐름을 막지 않으려고).
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        const done = await confirmBookingAction("", r.orderId);
        if (!done.ok) { setErr(done.message); return; }
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
      {/* 🛍09-18 대표 — 날짜·시각 «위»에서 상품부터 고른다. 값이 상품마다 달라서 시간을 고르기 전에 무엇을 빌리는지 정해야
          하단 금액이 처음부터 맞게 선다. 둘이면 카드 라디오, 하나면 고르기 없이 한 줄. 설명은 상세 「빌릴 수 있는 것」과 같은 글이다. */}
      {sellable.length > 0 && (
        <div ref={productRef}>
          {/* 🔁09-18 대표 코멘트 — 「어떻게 빌리실까요」가 위 「빌릴 수 있는 것」과 겹쳐 읽혔다. 하나면 확인, 둘이면 고르기. */}
          <p className={labelCls}>{sellable.length === 1 ? "신청 타입을 확인해 주세요" : "신청 타입을 골라 주세요"}</p>
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
                        <span className="mt-2 line-clamp-3 block whitespace-pre-line text-[15px] leading-relaxed break-keep text-body">
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
            // 날을 바꾸면 시각을 비운다 — 어제 고른 시각이 오늘도 열려 있으리란 보장이 없다.
            setStartTime("");
            setUseHours(0);
            setBadField((f) => (f === "date" ? "" : f));
          }}
        />
        {badField === "date" && <p className={errCls}>날짜부터 골라 주세요.</p>}
        {daySlots.length > 0 && (
          <p className={hintCls}>
            {daySlots.map((sl) => `${sl.start}~${sl.end}`).join(", ")} 열려 있어요 · 최소 {minHours}시간부터
          </p>
        )}
      </div>

      {/* ⏱09-16 신설 — 시간 단위로 바뀌면서 「몇 시부터 몇 시간」이 신청의 핵심이 됐다.
          ⭐**시작을 먼저, 길이를 그다음.** 끝나는 시각을 직접 고르게 하면 열린 시간·최소 시간·이미 팔린 칸
            셋을 손님이 머리로 맞춰야 한다. 시작을 고르면 가능한 길이만 남겨 주는 쪽이 고를 것이 적다. */}
      <div ref={timeRef}>
        <p className={labelCls}>몇 시부터 빌리실까요?</p>
        {!useDate ? (
          <p className={hintCls}>날짜를 고르면 열린 시각이 나와요.</p>
        ) : startChoices.length === 0 ? (
          <p className={hintCls}>이 날은 빌릴 수 있는 시간이 남아 있지 않아요. 다른 날을 골라 주세요.</p>
        ) : (
          // 🎨09-17 디자인팀 — 드롭다운 둘(시작 · 길이) → **칩 두 줄**.
          //   드롭다운은 열기 전엔 무엇이 남았는지 안 보이고, 폰에선 휠을 두 번 돌려야 했다.
          //   칩으로 깔면 「이 날은 오후만 남았구나」가 누르기 전에 읽힌다(아워플레이스 시간 고르기와 같은 문법).
          //   선택 색은 달력의 고른 날과 같은 키위 tint다 — 한 폼 안에서 «고른 것»의 얼굴은 하나.
          <div>
            <div className="grid grid-cols-4 gap-2" role="group" aria-label="시작 시각">
              {startChoices.map((t) => (
                <button
                  key={t}
                  type="button"
                  data-start-chip
                  aria-pressed={t === activeStart}
                  onClick={() => {
                    setStartTime(t);
                    setUseHours(0);
                    setBadField((f) => (f === "time" ? "" : f));
                  }}
                  className={`${chipCls} ${t === activeStart ? chipOnCls : chipOffCls}`}
                >
                  {t}
                </button>
              ))}
            </div>
            {activeStart && (
              <>
                <p className="mb-2 mt-5 text-[15px] text-mute">몇 시간 쓰실까요?</p>
                <div className="grid grid-cols-4 gap-2" role="group" aria-label="몇 시간">
                  {hourChoices.map((h) => (
                    <button
                      key={h}
                      type="button"
                      aria-pressed={h === activeHours}
                      onClick={() => setUseHours(h)}
                      className={`${chipCls} ${h === activeHours ? chipOnCls : chipOffCls}`}
                    >
                      {h}시간
                    </button>
                  ))}
                </div>
                {endTime && (
                  <p className="mt-3 text-[15px] text-body">
                    <span className="font-medium text-ink">{rangeLabel(activeStart, endTime)}</span>
                  </p>
                )}
              </>
            )}
          </div>
        )}
        {badField === "time" && <p className={errCls}>시작 시각이 비어 있어요.</p>}
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
          <p className={errCls}>{phone.trim() ? "번호 자릿수가 맞지 않아요." : "사장님이 연락드릴 번호가 필요해요."}</p>
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
            <RentSelect
              id="rent-brand"
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
      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      {/* 🔻09-14 데스크톱 인라인 버튼 삭제 — 하단 고정 바가 이제 모든 폭에서 뜬다(대표 지시).
          같은 버튼이 화면에 둘이면 어느 쪽이 진짜인지 고민하게 된다. */}
      {isTestPayment() && <p className="text-[14px] text-faint">지금은 시험 결제예요.</p>}

      {/* 🔁09-17 QA — 같은 흐름이 버튼 셋에서 「결제하고 신청하기 / 신청하기 / N원 결제하기」로 불렸다.
          바는 확인 팝업을 여는 버튼이라 「신청하기」, 팝업은 결제 화면으로 넘기니 「결제하러 가기」,
          결제 화면은 돈을 내는 버튼이라 「N원 결제하기」. 버튼 이름이 그 버튼이 여는 다음 화면을 말한다. */}
      <PayBar
        amount={timePicked && product ? total : null}
        emptyText={!product ? "방식을 고르면 금액이 나와요" : "시간을 고르면 금액이 나와요"}
        label={pending ? "결제 화면으로 가는 중…" : "신청하기"}
        disabled={pending}
        onClick={askConfirm}
      />

      <ConfirmDialog
        open={confirming}
        title="이대로 신청할까요?"
        confirmLabel="결제하러 가기"
        busy={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
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
          <InfoRow label="신청 날짜" value={dateLabel(useDate)} />
          <InfoRow label="이용 시간" value={rangeLabel(activeStart, endTime)} />
          {/* 📋09-17 QA — 사장님이 「이 글만 보고 정한다」면서 손님은 결제 직전에 그 글을 다시 못 봤다.
              인원과 앞부분만 싣는다. 팝업이 길어지면 버튼이 화면 밖으로 밀린다. */}
          {headcount && <InfoRow label="인원" value={`${headcount}명`} />}
          <InfoRow label="무엇을" value={planPreview(plan)} />
          <InfoRow
            label="결제 금액"
            value={
              <>
                <span className="font-medium text-ink">{won(total)}</span>
                {/* 💸09-17 QA — 합계만 있으면 「왜 10만원인가」를 손님이 셈한다. 내역을 한 줄로. */}
                <span className="block text-[15px] text-mute">
                  {product ? PRODUCT_LABEL[product] : "대여"} {activeHours}시간 {won(spaceAmount)}
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
          <p className="text-[15px] font-bold text-ink">예약 전 유의사항</p>
          {/* 📐09-18 대표 코멘트 — 위 「예약 정보 확인」과 같은 위계로 제목 밑에 선 하나. */}
          <ul className="mt-2 space-y-2 border-t border-hairline pt-3">
            {[
              CONTACT_RULE_GUEST,
              // 🪪09-18 대표 — 「신청할 때 약관 동의 같은 데 넣어야 할 수도」. 약관 제10조에 넣은 한 줄을 돈 내기 직전에 한 번 더.
              "이용 당일 사장님이 신분증으로 성함을 확인할 수 있어요.",
              "공간은 사장님이 직접 빌려주세요. collab5는 신청과 결제를 이어 드리는 통신판매중개자라 거래의 당사자는 아니에요.",
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
