"use client";

// 정산 — 「손이 필요한 예약」을 토스에서 다시 읽는 버튼 (2026-09-27, 대표 「제안대로 고고」)
//
// ⭐대표가 토스 관리자 화면에서 환불한 뒤 누른다. 돈은 움직이지 않는다 — 토스를 읽고 우리 장부만 맞춘다
//   (`resyncStuckBookingAction`). 그래서 확인 팝업 없이 바로 돈다. 바꾼 게 없으면 버튼 옆 한 줄로 끝난다.
// 🔁누르면 목록을 새로 그린다. 정리된 줄은 목록에서 사라지니 그 결과 한 줄을 줄 옆에 두면 같이 사라진다.
//   그래서 정리된 결과는 이 절을 감싼 `ResyncArea`가 절 머리 위에 남긴다(새로 그려도 이 틀은 그대로라 말이 안 사라진다).
import { createContext, useContext, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { resyncStuckBookingAction } from "@/lib/rent-actions";

type Done = { id: number; orderId: string; message: string };
const Ctx = createContext<(d: Done) => void>(() => {});

/** 「손이 필요한 예약」 절을 감싼다. 절이 통째로 사라져도(마지막 줄이 정리됨) 결과 한 줄은 여기 남는다. */
export function ResyncArea({ children }: { children: ReactNode }) {
  const [done, setDone] = useState<Done[]>([]);
  const push = (d: Done) => setDone((xs) => [d, ...xs.filter((x) => x.id !== d.id)].slice(0, 5));
  return (
    <Ctx.Provider value={push}>
      {done.length > 0 && (
        <div role="status" className="mt-12 rounded-lg bg-surface-soft px-4 py-3">
          <p className="text-[14px] font-medium text-mute">토스에서 다시 읽어 정리한 예약</p>
          <ul className="mt-1 space-y-1.5">
            {done.map((d) => (
              <li key={d.id} className="text-[15px] leading-relaxed break-keep text-body">
                <span className="break-all text-[13px] text-faint">주문번호 {d.orderId}</span>
                <br />
                {d.message}
              </li>
            ))}
          </ul>
        </div>
      )}
      {children}
    </Ctx.Provider>
  );
}

/** 줄마다 하나. 결과가 «그대로»면 버튼 옆에, «정리됨»이면 절 위(`ResyncArea`)에 한 줄. */
export function ResyncButton({ bookingId, orderId }: { bookingId: number; orderId: string }) {
  const router = useRouter();
  const report = useContext(Ctx);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState("");

  const run = () =>
    start(async () => {
      setMsg("");
      const r = await resyncStuckBookingAction(bookingId);
      if (r.resolved) report({ id: bookingId, orderId, message: r.message });
      else setMsg(r.message);
      router.refresh();
    });

  return (
    <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="py-[10px] text-[15px] font-medium text-body underline underline-offset-2 disabled:opacity-60"
      >
        {pending ? "새로고침 중…" : "새로고침"}
      </button>
      {msg && (
        <p role="status" className="min-w-0 text-[14px] leading-relaxed break-keep text-mute">
          {msg}
        </p>
      )}
    </div>
  );
}
