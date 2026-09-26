"use client";

// 정산 — 사장님의 환불 신청을 관리자가 처리하는 버튼 둘 (2026-09-16 대표)
//
// ⭐순서는 «전화 먼저, 버튼 나중»이다. 사장님과 손님께 사정을 확인한 뒤에 누른다.
// ⚠️승인은 되돌릴 수 없다(토스 환불이 나간다). 그래서 한 번 더 묻는다.
// 🔁09-17 QA — 닫기도 묻는다. 예약은 안 건드리지만 사장님 화면의 「환불 신청을 받았어요」가 사라지고 버튼이 되돌아온다.
//   사장님께 따로 알림이 안 가서(메일 없음), 실수로 누르면 사장님은 이유도 모른 채 신청이 없어진 화면을 본다.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveRefundAction, dismissRefundAction } from "@/lib/rent-actions";
import { ConfirmDialog } from "../ConfirmDialog";
import { secondaryBtnCls, won } from "../ui";

export function RefundDecision({ bookingId, amount }: { bookingId: number; amount: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [msg, setMsg] = useState("");

  const run = (approve: boolean) =>
    start(async () => {
      setOpen(false);
      setCloseOpen(false);
      const r = approve ? await approveRefundAction(bookingId) : await dismissRefundAction(bookingId);
      setMsg(r.message);
      if (r.ok) router.refresh();
    });

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setOpen(true)} disabled={pending} className={secondaryBtnCls}>
          승인하고 환불
        </button>
        <button
          type="button"
          onClick={() => setCloseOpen(true)}
          disabled={pending}
          className="px-2 py-[12px] text-[15px] text-mute underline underline-offset-2"
        >
          신청 닫기
        </button>
      </div>
      {msg && <p className="mt-2 text-[15px] leading-relaxed break-keep text-mute">{msg}</p>}
      <ConfirmDialog
        open={open}
        title="환불을 승인할까요?"
        confirmLabel="승인하고 환불"
        busy={pending}
        onConfirm={() => run(true)}
        onCancel={() => setOpen(false)}
      >
        <p>
          손님께 {won(amount)}이 돌아가고 예약은 환불로 바뀌어요. 사장님과 손님께 전화로 확인하셨는지 한 번 더 봐 주세요.
        </p>
      </ConfirmDialog>
      <ConfirmDialog
        open={closeOpen}
        title="환불 신청을 닫을까요?"
        confirmLabel="신청 닫기"
        cancelLabel="그냥 둘게요"
        busy={pending}
        onConfirm={() => run(false)}
        onCancel={() => setCloseOpen(false)}
      >
        <p>예약은 그대로 살아 있어요. 사장님 화면에선 신청이 사라지고 환불 신청 버튼이 다시 보여요.</p>
        <p className="text-mute">사장님께 따로 알림이 가지 않으니 전화로 먼저 말씀드려 주세요.</p>
      </ConfirmDialog>
    </div>
  );
}
