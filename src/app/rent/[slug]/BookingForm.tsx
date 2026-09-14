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
import type { SpaceUseType } from "@/lib/types";
import { dateLabel, primaryBtnCls, rentInputCls, rentTextareaCls, won } from "../ui";
import { ConfirmDialog } from "../ConfirmDialog";

const labelCls = "mb-2 block text-[16px] font-medium text-body";
const hintCls = "mt-2 text-[15px] leading-relaxed break-keep text-faint";

/** 모바일 하단 고정 바 — 금액 + 이 화면의 키위 버튼. 640px부터는 폼 안의 버튼이 대신한다.
 *  하단 여백은 `max()`다(MakerActionBar 08-09 실측): 홈 인디케이터가 있는 기기는 안전영역만, 없는 기기는 12px. */
function MobilePayBar({
  amount,
  label,
  disabled,
  onClick,
}: {
  amount: number;
  label: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 sm:hidden">
      <div className="mx-auto w-full max-w-[640px] rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-e2">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-faint">지금 내실 돈</p>
            <p className="truncate text-[17px] font-medium text-ink">{won(amount)}</p>
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
  );
}

export function BookingForm({
  spaceId,
  spaceSlug,
  openDates,
  priceDay,
  mentorMinutes,
  mentorPrice,
  capacity,
  hours,
  useType,
  myBrands,
  spaceName,
}: {
  spaceId: number;
  spaceSlug: string;
  /** 확인 팝업 문장(「{공간}을 신청할까요」)에 쓴다. */
  spaceName: string;
  openDates: string[];
  priceDay: number;
  mentorMinutes: number;
  mentorPrice: number;
  capacity?: number;
  hours: string;
  /** 「몇 분이나」는 대관(`open`·`both`)에서만 묻는다. 원래 목적대로(`as_is`) 쓰는 자리엔 인원이 정보가 아니다. */
  useType: SpaceUseType;
  myBrands: { slug: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [err, setErr] = useState("");

  const [useDate, setUseDate] = useState(openDates[0] ?? "");
  const [headcount, setHeadcount] = useState("");
  const [plan, setPlan] = useState("");
  const [withMentor, setWithMentor] = useState(false);
  const [brandSlug, setBrandSlug] = useState("");
  /** 2단계 — 서버가 자리를 잡아 준 뒤 토스 위젯을 그리는 단계. null이면 아직 1단계(신청 내용 쓰기). */
  const [pay, setPay] = useState<{ orderId: string; amount: number; orderName: string } | null>(null);
  const [widgetReady, setWidgetReady] = useState(false);
  /** 결제 직전 확인 팝업(대표 09-14: 의사 확인은 팝업으로). 열린 채로 `submit`이 돌지 않게 닫고 시작한다. */
  const [confirming, setConfirming] = useState(false);
  // 위젯 인스턴스는 렌더와 무관하게 살아 있어야 해서 ref에 둔다(state에 두면 리렌더마다 다시 그린다).
  const widgetsRef = useRef<{ requestPayment: (p: Record<string, unknown>) => Promise<void> } | null>(null);

  const mentorAmount = withMentor && mentorMinutes > 0 ? mentorPrice : 0;
  const total = priceDay + mentorAmount;
  // ⚠️열 글자는 서버(`confirmBookingAction`)가 강제하는 값이다. 여기서 먼저 막는 건 왕복을 아끼려는 것이지
  //   이게 관문이라서가 아니다 — 관문은 늘 서버 쪽이다.
  const planShort = plan.trim().length < 10;

  /** 버튼이 부르는 건 이것 — 싼 검사만 하고 팝업을 연다. 서버 왕복은 팝업에서 [신청하기]를 누른 뒤다. */
  const askConfirm = () => {
    setErr("");
    if (!useDate) { setErr("어느 날 쓰실지 골라 주세요."); return; }
    if (planShort) { setErr("그날 무엇을 하실지 열 글자 이상 적어 주세요."); return; }
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
        hours: "",          // 빈 값이면 서버가 공간의 이용 시간을 그대로 쓴다
        plan: plan.trim(),
        headcount: headcount ? Number(headcount) : undefined,
        withMentor,
        guestBrandSlug: brandSlug,
      });
      if (!r.ok || !r.orderId || !r.amount) { setErr(r.message || "신청을 시작하지 못했어요."); return; }

      // ② 키가 없으면 위젯을 건너뛰고 모의 승인으로 간다(로컬에서 흐름을 막지 않으려고).
      const clientKey = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY;
      if (!clientKey) {
        const done = await confirmBookingAction("", r.orderId);
        if (!done.ok) { setErr(done.message); return; }
        router.push(done.bookingId ? `/rent/done/${done.bookingId}` : "/rent/my");
        router.refresh();
        return;
      }
      // ③ 2단계로. 위젯은 아래 useEffect가 그린다(컨테이너 div가 먼저 DOM에 있어야 해서).
      setPay({ orderId: r.orderId, amount: r.amount, orderName: r.orderName ?? "하루 가게" });
    });

  // 2단계 진입 시 토스 위젯을 그린다. ⚠️SDK를 파일 맨 위에서 import하지 않는다 —
  //   결제까지 안 가는 대부분의 방문자에게 그 무게를 지울 이유가 없다.
  useEffect(() => {
    if (!pay) return;
    let alive = true;
    (async () => {
      try {
        const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
        const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
        // 비회원 결제. 카드를 저장해 두고 다시 쓰는 흐름은 아직 없다.
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        // 🚨금액은 서버가 정해 돌려준 값이다. 화면의 `total`을 쓰지 않는다.
        await widgets.setAmount({ currency: "KRW", value: pay.amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#rent-pay-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#rent-pay-agreement", variantKey: "AGREEMENT" }),
        ]);
        if (!alive) return;
        widgetsRef.current = widgets as unknown as typeof widgetsRef.current;
        setWidgetReady(true);
      } catch (e) {
        console.error("[rent] widget render failed", (e as { code?: string })?.code, (e as Error)?.message);
        if (alive) setErr("결제 화면을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
    })();
    return () => { alive = false; };
  }, [pay]);

  const requestPay = () =>
    start(async () => {
      if (!pay || !widgetsRef.current) return;
      setErr("");
      try {
        await widgetsRef.current.requestPayment({
          orderId: pay.orderId,
          orderName: pay.orderName,
          // 🔑돌아올 주소. 토스가 여기에 paymentKey·orderId·amount를 붙여 보낸다.
          successUrl: `${window.location.origin}/rent/pay/success`,
          failUrl: `${window.location.origin}/rent/pay/fail`,
        });
        // 여기 아래로는 안 내려온다 — 인증 창이 페이지를 가져간다.
      } catch (e) {
        // 사용자가 창을 닫으면 SDK가 던진다. 그건 사고가 아니라 「안 하기로 함」이다.
        const code = (e as { code?: string })?.code;
        if (code === "USER_CANCEL") return;
        console.error("[rent] requestPayment failed", code, (e as Error)?.message);
        setErr("결제를 진행하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
    });

  if (pay) {
    const payLabel = widgetReady ? "결제하기" : "불러오는 중…";
    return (
      <div className="space-y-6">
        <p className="text-[17px] leading-relaxed text-body">
          <span className="font-medium text-ink">{pay.orderName}</span> · {won(pay.amount)}
        </p>
        {/* 토스가 이 두 칸을 채운다 — 결제수단과 약관. 우리는 자리만 둔다. */}
        <div id="rent-pay-methods" />
        <div id="rent-pay-agreement" />
        {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={requestPay}
            disabled={pending || !widgetReady}
            className={`${primaryBtnCls} h-[52px] w-full`}
          >
            {widgetReady ? `${won(pay.amount)} 결제하기` : "결제 화면 불러오는 중…"}
          </button>
        </div>
        <button
          type="button"
          onClick={() => { setPay(null); setWidgetReady(false); }}
          className="py-[12px] text-[15px] text-mute underline underline-offset-2"
        >
          ← 신청 내용 고치기
        </button>
        <MobilePayBar amount={pay.amount} label={payLabel} disabled={pending || !widgetReady} onClick={requestPay} />
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <label htmlFor="rent-date" className={labelCls}>
          어느 날 쓰실까요
        </label>
        {/* 달력 라이브러리를 안 쓴다 — 고를 수 있는 날이 애초에 사장님이 올린 목록뿐이라,
            달력을 띄우면 못 고르는 날이 화면의 대부분을 차지한다. */}
        <select
          id="rent-date"
          className={rentInputCls}
          value={useDate}
          onChange={(e) => setUseDate(e.target.value)}
        >
          {openDates.map((d) => (
            <option key={d} value={d}>
              {dateLabel(d)}
            </option>
          ))}
        </select>
        {hours && <p className={hintCls}>이용 시간은 {hours}예요.</p>}
      </div>

      {useType !== "as_is" && (
        <div>
          <label htmlFor="rent-head" className={labelCls}>
            몇 분이나 오실까요 <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>
          </label>
          <input
            id="rent-head"
            type="number"
            inputMode="numeric"
            min={1}
            max={capacity}
            className={rentInputCls}
            value={headcount}
            onChange={(e) => setHeadcount(e.target.value)}
            placeholder={capacity ? `최대 ${capacity}명` : "예: 8"}
          />
        </div>
      )}

      <div>
        <label htmlFor="rent-plan" className={labelCls}>
          그날 무엇을 하실 건가요
        </label>
        {/* ⭐이 칸이 사장님이 수락을 정하는 유일한 근거다. 「대관 문의드립니다」로는 아무것도 못 정한다.
            그래서 placeholder에 **답의 모양**을 보여준다 — 무엇을·누구와·몇 시간. */}
        <textarea
          id="rent-plan"
          rows={4}
          className={`${rentTextareaCls} resize-y`}
          value={plan}
          onChange={(e) => setPlan(e.target.value)}
          placeholder="예) 직접 만든 도자기 그릇 20점으로 하루 팝업을 열려고 해요. 친구 한 명과 둘이 오고, 오후에 손님을 받을 계획이에요."
        />
        <p className={hintCls}>사장님이 이 글만 보고 정하세요. 열 글자면 충분해요.</p>
      </div>

      {mentorMinutes > 0 && (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-[3px] size-[18px] shrink-0 accent-primary"
            checked={withMentor}
            onChange={(e) => setWithMentor(e.target.checked)}
          />
          <span className="min-w-0 text-[16px] leading-relaxed break-keep text-body">
            사장님께 {mentorMinutes}분 배우고 싶어요
            <span className="ml-1.5 text-mute">+{won(mentorPrice)}</span>
          </span>
        </label>
      )}

      {myBrands.length > 0 && (
        <div>
          <label htmlFor="rent-brand" className={labelCls}>
            내 소개서도 같이 보여드릴까요 <span className="ml-1 text-[15px] font-normal text-faint">· 선택</span>
          </label>
          <select
            id="rent-brand"
            className={rentInputCls}
            value={brandSlug}
            onChange={(e) => setBrandSlug(e.target.value)}
          >
            <option value="">안 보여드릴래요</option>
            {myBrands.map((b) => (
              <option key={b.slug} value={b.slug}>
                {b.name}
              </option>
            ))}
          </select>
          <p className={hintCls}>사장님이 어떤 분인지 알면 수락이 훨씬 빨라져요.</p>
        </div>
      )}

      {/* ── 금액 ── 낼 돈을 버튼 «위»에 적는다. 누른 뒤에 금액을 처음 보면 그건 함정이다.
          표 대신 한 문장 — 항목이 둘뿐이라 표를 그리면 영수증이 된다. */}
      <p className="border-t border-hairline pt-6 text-[17px] leading-relaxed break-keep text-body">
        지금 내실 돈 <span className="font-medium text-ink">{won(total)}</span>
        {mentorAmount > 0 && <span className="text-mute"> (사장님 시간 포함)</span>} · 사장님이 거절하시면
        전액 돌려드려요. 수락하시면 그때 주소와 연락처가 열려요.
      </p>

      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      <div>
        <div className="hidden sm:block">
          <button
            type="button"
            onClick={askConfirm}
            disabled={pending}
            className={`${primaryBtnCls} h-[52px] w-full`}
          >
            {pending ? "신청하는 중이에요…" : `${won(total)} 결제하고 신청하기`}
          </button>
        </div>
        <p className="mt-3 text-[14px] text-faint sm:text-center">지금은 시험 결제예요.</p>
      </div>

      <MobilePayBar
        amount={total}
        label={pending ? "신청하는 중…" : "결제하고 신청하기"}
        disabled={pending}
        onClick={askConfirm}
      />

      <ConfirmDialog
        open={confirming}
        title="이대로 신청할까요"
        confirmLabel="신청하기"
        busy={pending}
        onConfirm={submit}
        onCancel={() => setConfirming(false)}
      >
        <p>
          {dateLabel(useDate)}에 <span className="font-medium text-ink">{spaceName}</span>을 {won(total)}에 신청할까요?
        </p>
        <p className="text-mute">사장님이 거절하시면 전액 돌려드려요.</p>
      </ConfirmDialog>
    </div>
  );
}
