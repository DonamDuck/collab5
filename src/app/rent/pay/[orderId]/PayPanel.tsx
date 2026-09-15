"use client";

// 하루 가게 — 결제 위젯 패널 (2026-09-15)
//
// 토스 결제창을 그리고 띄우는 일만 한다. 금액·주문번호는 **서버가 정해 준 값을 그대로 받는다** —
// 이 컴포넌트는 값을 계산하지 않는다(화면의 숫자로 결제하면 그게 곧 구멍이다).
//
// ⚠️SDK를 파일 맨 위에서 import하지 않는다. 결제까지 안 오는 대부분의 방문자에게 그 무게를 지울 이유가 없다.
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { InfoPanel, InfoRow, primaryBtnCls, secondaryBtnCls } from "../../ui";

export function PayPanel({
  orderId,
  amount,
  orderName,
  backHref,
  placeLabel,
  scheduleLabel,
  amountLabel,
  withMentor,
}: {
  orderId: string;
  amount: number;
  orderName: string;
  /** 「신청 내용 고치기」가 돌아갈 곳 — 그 공간의 상세 화면. */
  backHref: string;
  placeLabel: string;
  scheduleLabel: string;
  amountLabel: string;
  withMentor: boolean;
}) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  /** 🪤**이 화면의 실패는 조용하다.** 결제 칸이 비고 버튼이 「불러오는 중」에서 안 풀릴 뿐,
   *  에러도 안 뜨고 로그는 콘솔에만 남는다. 09-15에 그 상태를 두 번 만들었는데 둘 다 화면만 봐서는 몰랐다.
   *  ⭐그래서 **기다림에 끝을 준다.** 12초 안에 안 뜨면 「다시 불러오기」를 내놓는다.
   *    고치는 것보다 «보이게 하는 것»이 먼저다 — 안 보이면 대표도 나도 없는 일로 안다. */
  const [slow, setSlow] = useState(false);
  const [pending, start] = useTransition();
  const widgetsRef = useRef<{ requestPayment: (p: Record<string, unknown>) => Promise<void> } | null>(null);
  /** 🚨**한 번만 그린다.** 개발 빌드의 Strict Mode는 effect를 «두 번» 돌리는데, 토스 SDK는 결제수단 위젯을
   *  하나만 허용해서 두 번째가 `PAYMENT_METHODS_WIDGET_ALREADY_RENDERED`로 죽는다.
   *  그러면 화면엔 결제 칸이 **통째로 비어** 보인다(에러는 콘솔에만 남는다).
   *  ⚠️의존성 배열로는 못 막는다 — 값이 안 바뀌어도 Strict Mode는 그냥 두 번 돈다. 플래그가 필요하다.
   *  SDK에 걷어내는 함수가 없어서 cleanup으로 되돌릴 수도 없다. */
  const startedRef = useRef(false);

  /** 🚨**뒤로가기로 돌아온 화면은 다시 그린다**(대표 09-15 [11]: *「모바일에서 결제 수단이 클릭이 안 돼」*).
   *  브라우저는 뒤로 갈 때 이 문서를 «사진처럼» 통째로 저장해 두었다가 그대로 되살린다(bfcache).
   *  그러면 결제수단이 **보이기는 하는데 죽어 있다** — 토스 위젯은 살아 있는 스크립트가 있어야 반응하는데
   *  복원된 문서에선 그 스크립트가 다시 돌지 않는다.
   *  🪤화면은 멀쩡해 보인다. 그래서 「안 눌린다」로만 보이고 원인이 화면에 안 남는다.
   *  ⭐`persisted`가 참일 때만 새로 불러온다. 보통 방문에선 안 돈다. */
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) window.location.reload(); };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  /** 🩸**토스 창 안은 «한 번 누를 때마다» 다음 자리가 죽는다** (대표 09-15, 좁은 화면에서만).
   *  카드를 고르면 카드사가 펼쳐지는데 그 카드사가 안 눌리고, 억지로 고르면 이번엔 할부 칸이 안 눌린다.
   *  대표: *「step by step으로 하나 해결하면 다음 클릭이 안 되고 하는 이슈가 계속 반복적」*.
   *
   *  ⭐**창 크기를 바꾸면 되살아난다**는 실측이 답을 가리킨다. 브라우저는 «다른 출처의 iframe»을 위해
   *    「화면의 어디를 누르면 그 프레임인가」 지도를 따로 들고 있는데, 그 안에서 내용이 바뀌어
   *    iframe이 자라도 **그 지도가 옛날 크기 그대로 남는다.** 새로 생긴 자리는 지도에 없어서 눌러도 안 간다.
   *
   *  🩸**첫 처치가 약했다.** 1px 스크롤을 두 줄 연달아 쓰고 `resize` 이벤트를 쐈는데 —
   *    같은 프레임 안의 스크롤 두 번은 브라우저가 «합쳐서 없던 일»로 만들고, 사람이 만든 `resize`
   *    이벤트는 **진짜 크기 변화가 아니라서 그 지도를 다시 그리게 하지 못한다.**
   *    자바스크립트 이벤트와 브라우저의 레이아웃은 다른 층이다.
   *  ⭐**고침 = 레이아웃을 «진짜로» 한 번 흔든다.** 우리가 가진 바깥 칸의 안쪽 여백을 1px 줬다가 되돌린다.
   *    iframe의 실제 폭이 바뀌니 브라우저가 그 지도를 다시 그린다. 눈에는 안 보인다.
   *  📡크기가 안 변하는 변화(할부 목록이 열리는 것 같은)도 있어서 **토스가 보내는 메시지에도 같이 반응한다.**
   *    내용은 못 읽지만(다른 출처다) **「무언가 바뀌었다」는 신호로는 충분하다.** */
  useEffect(() => {
    if (!ready) return;
    const hosts = ["rent-pay-methods", "rent-pay-agreement"]
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => !!el);
    if (hosts.length === 0) return;

    let raf1 = 0;
    let on = false;
    /** 🪄**보이지 않게 한 번 흔든다.** 0.01px 옮겼다 되돌리면 사람 눈엔 아무 일도 없지만
     *  브라우저에는 「이 프레임이 움직였다」가 되어 누를 자리 지도를 다시 그린다. */
    const nudge = () => {
      cancelAnimationFrame(raf1);
      raf1 = requestAnimationFrame(() => {
        on = !on;
        hosts.forEach((h) => (h.style.transform = on ? "translateY(0.01px)" : "translateY(0px)"));
      });
    };

    const ro = new ResizeObserver(nudge);
    hosts.forEach((h) => {
      ro.observe(h);
      const frame = h.querySelector("iframe");
      if (frame) ro.observe(frame);
    });
    // ⚠️출처를 확인하고 받는다. 아무 메시지에나 반응하면 남의 창이 우리 화면을 흔들 수 있다.
    const onMessage = (e: MessageEvent) => {
      if (typeof e.origin === "string" && e.origin.includes("tosspayments.com")) nudge();
    };
    window.addEventListener("message", onMessage);

    // ⏱**그리고 1초마다 한 번씩 그냥 흔든다.** 위 둘(크기 변화·메시지)이 모든 변화를 잡아 준다는 보장이 없고,
    //   못 잡으면 그 자리는 «다음 탭이 죽는» 자리가 된다. 흔드는 값이 0.01px이라 비용도 자국도 없다.
    //   ⚠️보이는 동안만 돈다 — 안 보이는 탭에서 계속 돌 이유가 없다.
    const beat = setInterval(() => {
      if (!document.hidden) nudge();
    }, 1000);

    return () => {
      ro.disconnect();
      window.removeEventListener("message", onMessage);
      clearInterval(beat);
      cancelAnimationFrame(raf1);
      hosts.forEach((h) => (h.style.transform = ""));
    };
  }, [ready]);

  useEffect(() => {
    if (ready || err) return;
    const t = setTimeout(() => setSlow(true), 12000);
    return () => clearTimeout(t);
  }, [ready, err]);

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
      {/* 🔻09-15 대표 — *「결제 위에 마진이 너무 넓은데」*. 제목 줄을 감싸던 `space-y-6`의 첫 칸이
          본문 여백과 같은 값이라 헤더와 제목 사이가 한 칸 더 벌어져 있었다. 제목 블록만 위 여백을 지운다. */}
      <div className="-mt-4 flex items-center gap-1">
        <Link
          href={backHref}
          aria-label="신청 내용 고치기"
          className="-ml-3 flex size-[44px] shrink-0 items-center justify-center text-[20px] text-mute"
        >
          ←
        </Link>
        {/* 🔁09-15 「결제」 → 「결제하기」(대표). 명사는 화면 이름이고 동사는 지금 할 일이다. */}
        <h1 className="text-[22px] font-bold leading-tight tracking-tight text-ink">결제하기</h1>
      </div>

      {/* 📋09-15 대표 — *「그럴싸한 결제 정보처럼 보여줘야 해 · subtitle 결제 정보 확인 · 장소/일정/금액」*.
          줄글은 「읽고 넘기는 글」로 보이고 항목은 「대조하는 표」로 보인다. 돈 내기 직전에 필요한 건 대조다.
          ⚠️표 태그를 쓰지 않는다 — 두 칸짜리 표는 좁은 화면에서 칸이 깨진다. 왼쪽 라벨 고정폭이면 충분하다. */}
      <InfoPanel title="결제 정보 확인">
        <InfoRow label="장소" value={placeLabel} />
        <InfoRow label="일정" value={scheduleLabel} />
        <InfoRow
          label="금액"
          value={
            <>
              <span className="font-medium text-ink">{amountLabel}</span>
              {withMentor && <span className="text-mute"> · 사장님 시간 포함</span>}
            </>
          }
        />
      </InfoPanel>

      {/* 토스가 이 두 칸을 채운다 — 결제수단과 약관. 우리는 자리만 둔다. */}
      <div id="rent-pay-methods" />

      {err && <p className="text-[15px] leading-relaxed break-keep text-danger">{err}</p>}

      {slow && !ready && !err && (
        <div>
          <p className="text-[15px] leading-relaxed break-keep text-mute">
            결제 화면이 늦게 뜨고 있어요. 한 번 다시 불러와 주세요.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className={`${secondaryBtnCls} mt-2 h-[44px] px-4`}
          >
            다시 불러오기
          </button>
        </div>
      )}

      {/* 🤝09-15 대표 — *「약관이 버튼과 떨어져 있어서 «약관 + 결제»처럼 느껴지지가 않는다.
          토스 약관이긴 하지만 우리 서비스 안에 넣은 거니까 우리가 만든 것처럼 어색하지 않게」*.
          ⭐약관과 버튼 사이의 «여백»이 곧 둘의 관계다. 한 칸 띄우면 남의 안내문이 되고, 붙이면
            「이걸 읽고 이 버튼을 누른다」가 된다. `space-y-6`에서 빼내 한 덩어리로 묶었다. */}
      <div className="space-y-3">
        <div id="rent-pay-agreement" />
        <button
          type="button"
          onClick={requestPay}
          disabled={pending || !ready}
          className={`${primaryBtnCls} h-[52px] w-full`}
        >
          {ready ? `${amountLabel} 결제하기` : "결제 화면 불러오는 중…"}
        </button>
      </div>

      <p className="text-[15px] leading-relaxed break-keep text-faint">지금은 시험 결제예요.</p>
    </div>
  );
}
