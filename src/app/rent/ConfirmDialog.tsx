"use client";

// 하루 가게 — 의사 확인 팝업 (2026-09-14)
//
// 대표 09-14: *「우리는 결제·취소 등 의사를 확인할 때 팝업을 띄움」*. 돈이 움직이거나 되돌릴 수 없는 세 자리
// (결제 직전 · 손님 취소 · 사장님 거절)가 전부 이 하나를 쓴다. 자리마다 따로 그리면 세 모양이 되고,
// 어느 하나가 ESC를 빠뜨리는 날이 온다(07-29 QA에서 시트 19곳이 19가지였다).
//
// 🎨모양 — `rounded-lg bg-surface shadow-e3`(모달 급 엘리베이션) · 제목 18 medium · 본문 17 regular ·
//   버튼 둘(확인 = 키위, 취소 = 보조 44px). 375px에선 바닥에 붙는 시트, 640px부터 가운데 카드.
// ⚠️홈 얼럿(`HomeGateAlert`)과 달리 **딤 클릭으로 닫힌다**(overlayClose: true). 그쪽은 작성 중 내용을 지키려는
//   정책이고, 여기엔 지킬 입력이 없다. 닫힘 = 「다시 볼게요」라 잃을 것이 없다.
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { useDismissable } from "@/components/useDismissable";
import { primaryBtnCls, secondaryBtnCls } from "./ui";

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  cancelLabel = "다시 볼게요",
  busy = false,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** 본문 17px. 문장 하나면 string, 줄이 여럿이면 <p>들을 넘긴다. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 액션이 도는 동안 버튼 둘 다 잠근다. 두 번 눌러 두 번 취소되는 일을 막는다. */
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const dialog = useDismissable(open, { onClose: onCancel, overlayClose: true, labelledBy: "rent-confirm-title" });
  // `open`은 클릭으로만 참이 되니 서버 렌더에선 늘 null이고, 하이드레이션이 어긋날 일이 없다.
  //   `document` 검사는 그 전제가 깨지는 날(초기값 true로 여는 호출부)을 위한 안전판.
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    // 딤은 홈 얼럿과 같은 값(`bg-ink/55` + 2px 블러, 08-16 대표 확정). z-[60] = 헤더·하단 고정 바(z-40) 위.
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/55 backdrop-blur-[2px] sm:items-center sm:p-4 print:hidden"
      {...dialog.overlayProps}
    >
      <div
        {...dialog.panelProps}
        className="w-full max-w-[420px] rounded-t-lg bg-surface px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-6 shadow-e3 sm:rounded-lg sm:p-6"
      >
        <h2 id="rent-confirm-title" className="text-[18px] font-medium leading-snug break-keep text-ink">
          {title}
        </h2>
        <div className="mt-3 space-y-2 text-[17px] leading-relaxed break-keep text-body">{children}</div>
        {/* 확인이 오른쪽 — 엄지가 닿는 자리. 취소가 먼저 읽히고 확인이 마지막에 눌린다. */}
        <div className="mt-6 flex gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className={`${secondaryBtnCls} flex-1 px-4`}>
            {cancelLabel}
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} className={`${primaryBtnCls} h-[44px] flex-1 px-4`}>
            {busy ? "잠시만요…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
