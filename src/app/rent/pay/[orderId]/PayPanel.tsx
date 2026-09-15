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

  /** 🔎**개발 빌드에서만 — 지금 이 화면의 «숫자»를 띄운다** (09-15).
   *
   *  🩸토스 창 안에서 한 단계 들어갈 때마다 그 다음 자리가 안 눌린다. 그런데 **약관 창은 눌린다**(대표 실측).
   *    두 창이 같은 페이지에 나란히 있는데 하나만 죽는다면, 원인은 「창 전체」가 아니라 **그 창의 «모양»**이다.
   *  ⭐앞서 두 번 처치를 넣었지만 둘 다 «내가 못 보는 상태»를 겨냥한 짐작이었다. 짐작을 더 얹지 않는다.
   *    📐**막힌 그 순간의 크기를 먼저 본다** — 결제창이 화면보다 얼마나 큰지, 창이 몇 개인지.
   *  🚨자동화로는 이 자리를 못 잰다. 토스 창 «안»을 누르는 건 대표 손에서만 일어난다.
   *    그래서 화면에 띄운다 — 막혔을 때 그 줄을 찍어 주시면 그게 곧 측정값이다.
   *  ⛔운영 빌드에선 통째로 빠진다(`NODE_ENV` 게이트). */
  const [probe, setProbe] = useState("");
  useEffect(() => {
    if (process.env.NODE_ENV !== "development" || !ready) return;
    const tick = () => {
      const frames = document.querySelectorAll("iframe");
      const m = document.querySelector("#rent-pay-methods iframe");
      const a = document.querySelector("#rent-pay-agreement iframe");
      const box = (el: Element | null) => {
        if (!el) return "없음";
        const r = el.getBoundingClientRect();
        return `${Math.round(r.width)}×${Math.round(r.height)} @${Math.round(r.top)}`;
      };
      setProbe(
        `창 ${frames.length}개 · 결제 ${box(m)} · 약관 ${box(a)} · 화면 ${window.innerWidth}×${window.innerHeight} · 스크롤 ${Math.round(window.scrollY)}`,
      );
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
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


      {/* 토스가 이 두 칸을 채운다 — 결제수단과 약관. 우리는 자리만 둔다. */}
      {/* 📐09-15 **결제수단을 맨 위로 올렸다.** 대표 실측: 이 창이 696px까지 자라는데 위에 다른 것이
          368px 쌓여 있어서 902px 화면에 안 들어갔다. 그래서 스크롤을 내려야 했고, 그때 창 윗부분이
          화면 밖으로 104px 잘려 나간 상태에서 **그 안의 어떤 것도 안 눌렸다.**
          ⭐창이 화면 안에 통째로 들어오면 그 상태가 아예 안 만들어진다 — 지금 배치면 150 + 696 < 902다.
          🔻「결제 정보 확인」은 버튼 «바로 위»로 내렸다. 대조는 누르기 직전에 하는 일이라 자리로도 맞다. */}
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
      {probe && (
        <p className="rounded-md bg-surface-soft px-3 py-2 font-mono text-[12px] leading-relaxed break-all text-mute">
          {probe}
        </p>
      )}
    </div>
  );
}
