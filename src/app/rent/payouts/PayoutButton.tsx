"use client";

// 정산 — 「입금했어요」 버튼 (2026-09-16)
//
// ⚠️돈이 움직였다고 «장부에 적는» 버튼이라 한 번 더 묻는다. 은행에서 보내지 않았는데 눌러 버리면
//   그 사장님은 다음 정산 목록에서 사라진다(`paid_out_at`이 찍힌 행은 다시 안 올라온다).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPaidOutAction } from "@/lib/rent-actions";
import { ConfirmDialog } from "../ConfirmDialog";
import { secondaryBtnCls, won } from "../ui";

export function PayoutButton({ bookingIds, amount, name }: { bookingIds: number[]; amount: number; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const run = () =>
    start(async () => {
      setOpen(false);
      const r = await markPaidOutAction(bookingIds);
      setMsg(r.message);
      if (r.ok) router.refresh();
    });

  return (
    <div>
      <button type="button" onClick={() => setOpen(true)} disabled={pending} className={secondaryBtnCls}>
        {pending ? "적는 중…" : "입금했어요"}
      </button>
      {msg && <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">{msg}</p>}
      <ConfirmDialog
        open={open}
        title="입금하셨나요"
        confirmLabel="입금했어요"
        busy={pending}
        onConfirm={run}
        onCancel={() => setOpen(false)}
      >
        <p>
          {name}께 {won(amount)}을 보내셨으면 눌러 주세요. 표시한 예약은 다시 「드릴 돈」에 올라오지 않아요.
        </p>
      </ConfirmDialog>
    </div>
  );
}
