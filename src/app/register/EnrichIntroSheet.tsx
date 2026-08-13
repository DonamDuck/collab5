"use client";

// 등록 진입 시트 — /register를 **새로 작성**하러 온 사람에게 1초 뒤 스르륵 올라온다.
// 목적: 소개서 작성이 부담스러워 그냥 나가는 사람에게 "혼자 다 채우지 않아도 된다"를 먼저 알린다.
//       여기서 신청까지 받지는 않는다 — 소개서가 있어야 보강이 성립하므로 **등록 후**로 보낸다.
//
// ⚠️ 지켜야 할 선 3가지
//  ① 수정 모드(?edit=)에는 뜨지 않는다 — 이미 소개서가 있는 사람에겐 이 약속이 이미 지난 이야기다.
//  ② 닫으면 QUIET_MS(7일)간 안 뜬다 — 소개서를 여러 번 고치러 오는 사람에게 매번 뜨면 그게 방해다.
//  ⭐ 타이틀은 **질문이 아니라 약속**이다(08-03 대표 확정). 원래 "소개서 작성이 어려우신가요?"였는데,
//     이제 막 시작하려는 사람에게 "어렵죠?"라고 단정해 **없던 부담을 먼저 심는 문장**이었다.
//     지금 문형 = 「(당신이) ~하면, (저희가) ~해드릴게요」 — 조건과 보상이 한 문장에 있어야 한다.
//  ③ 기존 nudge 시트(등록 버튼 누를 때 뜸)와 시점이 겹치지 않는다 — 이건 **진입 직후**다.
import { useEffect, useState } from "react";
import { useDismissable } from "@/components/useDismissable";

const KEY = "collab5.enrichIntroSheet";
const QUIET_MS = 7 * 24 * 60 * 60 * 1000; // 닫은 뒤 쉬는 기간(대표 확정 08-02)
const DELAY_MS = 1000; // 진입 후 등장까지 — 폼이 먼저 눈에 들어온 다음에 올라와야 한다

export function EnrichIntroSheet({ enabled }: { enabled: boolean }) {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false); // 슬라이드업 트리거(마운트 후 한 틱 뒤에 켠다)

  useEffect(() => {
    if (!enabled) return;
    try {
      const until = Number(localStorage.getItem(KEY) ?? 0);
      if (Date.now() < until) return;
    } catch {}
    const t = setTimeout(() => {
      setOpen(true);
      // 다음 프레임에 transform을 풀어야 트랜지션이 재생된다(마운트와 동시에 끝값이면 안 움직인다).
      requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
    }, DELAY_MS);
    return () => clearTimeout(t);
  }, [enabled]);

  const close = () => {
    setShown(false);
    try {
      localStorage.setItem(KEY, String(Date.now() + QUIET_MS));
    } catch {}
    setTimeout(() => setOpen(false), 220); // 내려가는 동안 DOM 유지
  };

  const dialog = useDismissable(open, { onClose: close });

  if (!open) return null;

  return (
    <div
      className={`fixed inset-0 z-50 bg-ink/40 transition-opacity duration-200 ${shown ? "opacity-100" : "opacity-0"}`}
      {...dialog.overlayProps}
    >
      <div
        {...dialog.panelProps}
        className={`absolute inset-x-0 bottom-0 mx-auto max-w-[640px] overflow-hidden rounded-t-2xl bg-surface shadow-xl transition-transform duration-300 ease-out ${
          shown ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
          className="p-5"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="break-keep text-[17px] font-bold leading-[1.4] tracking-[-0.02em] text-ink">
              💌 소개서를 작성하면, 저희가 더 채워드릴게요.
            </p>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="-mr-1.5 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-pill text-[17px] leading-none text-mute hover:bg-surface-soft hover:text-ink"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 break-keep text-[14.5px] leading-[1.65] text-body">
            AI의 도움으로 간단히 소개서를 만들고 등록하면, collab5팀이 웹과 인스타그램의 사진,
            이야기를 더해 더욱 풍성하게 채워드릴 수 있어요. 소개서 보완 신청 방법은 소개서 등록 후
            확인하실 수 있어요.
          </p>
          <button
            type="button"
            onClick={close}
            className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-primary text-[15px] font-bold text-primary-on"
          >
            소개서 만들러 가기
          </button>
        </div>
      </div>
    </div>
  );
}
