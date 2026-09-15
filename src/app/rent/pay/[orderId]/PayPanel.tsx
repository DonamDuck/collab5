"use client";

// 하루 가게 — 결제 위젯 패널 (2026-09-15)
//
// 토스 결제창을 그리고 띄우는 일만 한다. 금액·주문번호는 **서버가 정해 준 값을 그대로 받는다** —
// 이 컴포넌트는 값을 계산하지 않는다(화면의 숫자로 결제하면 그게 곧 구멍이다).
//
// ⚠️SDK를 파일 맨 위에서 import하지 않는다. 결제까지 안 오는 대부분의 방문자에게 그 무게를 지울 이유가 없다.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { primaryBtnCls } from "../../ui";

export function PayPanel({
  orderId,
  amount,
  orderName,
  backHref,
  summary,
  amountLabel,
  withMentor,
}: {
  orderId: string;
  amount: number;
  orderName: string;
  /** 「신청 내용 고치기」가 돌아갈 곳 — 그 공간의 상세 화면. */
  backHref: string;
  summary: string;
  amountLabel: string;
  withMentor: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const widgetsRef = useRef<{ requestPayment: (p: Record<string, unknown>) => Promise<void> } | null>(null);
  /** 🚨**한 번만 그린다.** 개발 빌드의 Strict Mode는 effect를 «두 번» 돌리는데, 토스 SDK는 결제수단 위젯을
   *  하나만 허용해서 두 번째가 `PAYMENT_METHODS_WIDGET_ALREADY_RENDERED`로 죽는다.
   *  그러면 화면엔 결제 칸이 **통째로 비어** 보인다(에러는 콘솔에만 남는다).
   *  ⚠️의존성 배열로는 못 막는다 — 값이 안 바뀌어도 Strict Mode는 그냥 두 번 돈다. 플래그가 필요하다.
   *  SDK에 걷어내는 함수가 없어서 cleanup으로 되돌릴 수도 없다. */
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      try {
        const { loadTossPayments, ANONYMOUS } = await import("@tosspayments/tosspayments-sdk");
        const toss = await loadTossPayments(process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY!);
        // 비회원 결제. 카드를 저장해 두고 다시 쓰는 흐름은 아직 없다.
        const widgets = toss.widgets({ customerKey: ANONYMOUS });
        await widgets.setAmount({ currency: "KRW", value: amount });
        await Promise.all([
          widgets.renderPaymentMethods({ selector: "#rent-pay-methods", variantKey: "DEFAULT" }),
          widgets.renderAgreement({ selector: "#rent-pay-agreement", variantKey: "AGREEMENT" }),
        ]);
        widgetsRef.current = widgets as unknown as typeof widgetsRef.current;
        setReady(true);
      } catch (e) {
        console.error("[rent] widget render failed", (e as { code?: string })?.code, (e as Error)?.message);
        setErr("결제 화면을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      }
    })();
    // 🚨**cleanup에서 「살아 있나」 플래그를 끄지 않는다.** Strict Mode는 mount → cleanup → mount로 도는데,
    //   DOM은 그대로 두고 effect만 다시 돌린다. 여기서 플래그를 끄면 **첫 판이 끝내 놓은 일을 스스로 버리고**
    //   (`setReady`가 안 돌고 위젯 인스턴스도 안 잡힌다) 둘째 판은 위 플래그에 막혀 아무 일도 안 한다.
    //   🪤화면엔 에러도 안 뜬다. 결제 칸이 비고 버튼이 「불러오는 중」에서 영영 안 풀린다(09-15 실측).
  }, [amount]);

  const requestPay = () =>
    start(async () => {
      if (!widgetsRef.current) return;
      setErr("");
      try {
        await widgetsRef.current.requestPayment({
          orderId,
          orderName,
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

  return (
    <div className="space-y-6">
      {/* 🔙대표 09-15 — *「타이틀 왼쪽에 ←가 들어가면 될 거 같아 보임요」*.
          제목과 «같은 줄»에 둔다. 아래 따로 놓인 글자 링크는 다 읽고 나서야 눈에 들어와서,
          「고치러 돌아갈 수 있다」를 결제를 고민하는 «그 순간»에 알려 주지 못했다. */}
      <div className="flex items-center gap-1">
        <Link
          href={backHref}
          aria-label="신청 내용 고치기"
          className="-ml-3 flex size-[44px] shrink-0 items-center justify-center text-[20px] text-mute"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">결제</h1>
      </div>

      <div>
        <p className="text-[17px] leading-relaxed break-keep text-body">{summary}</p>
        <p className="mt-1 text-[17px] leading-relaxed break-keep text-body">
          낼 돈 <span className="font-medium text-ink">{amountLabel}</span>
          {withMentor && <span className="text-mute"> (사장님 시간 포함)</span>}
        </p>
      </div>

      {/* 토스가 이 두 칸을 채운다 — 결제수단과 약관. 우리는 자리만 둔다. */}
      <div id="rent-pay-methods" />
      <div id="rent-pay-agreement" />

      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      <button
        type="button"
        onClick={requestPay}
        disabled={pending || !ready}
        className={`${primaryBtnCls} h-[52px] w-full`}
      >
        {ready ? `${amountLabel} 결제하기` : "결제 화면 불러오는 중…"}
      </button>

      <p className="text-[15px] leading-relaxed break-keep text-faint">
        사장님이 거절하시면 전액 돌려드려요. 지금은 시험 결제예요.
      </p>
    </div>
  );
}
