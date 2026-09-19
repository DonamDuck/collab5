"use client";

// 하루 팝업 — 의사 확인 팝업 (2026-09-14)
//
// 대표 09-14: *「우리는 결제·취소 등 의사를 확인할 때 팝업을 띄움」*. 돈이 움직이거나 되돌릴 수 없는 세 자리
// (결제 직전 · 손님 취소 · 사장님 거절)가 전부 이 하나를 쓴다. 자리마다 따로 그리면 세 모양이 되고,
// 어느 하나가 ESC를 빠뜨리는 날이 온다(07-29 QA에서 시트 19곳이 19가지였다).
//
// 🎨모양 — `rounded-lg bg-surface shadow-e3`(모달 급 엘리베이션) · 제목 18 medium · 본문 17 regular ·
//   버튼 둘(확인 = 키위, 취소 = 보조 44px). **어느 폭에서나 화면 가운데 뜨는 카드다.**
// 🔁09-15 대표 — *「팝업으로 띄워 봐줄래?」*. 전엔 640px 아래에서 바닥에 붙는 시트였다.
//   바닥 시트는 「이 화면에 딸린 서랍」으로 읽혀서, 돈이 움직이기 직전에 멈춰 세우는 힘이 약하다.
//   ⭐그리고 폰 바닥은 제품의 고정 바와 개발 표시가 이미 쓰는 자리다. 거기로 내려가면 남의 것과 겹친다.
//   ⚠️주소 찾기(`AddressField`)는 여전히 바닥에서 올라온다 — 그건 대표가 그렇게 요청한 자리다.
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
  error = "",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  /** 본문 17px. 문장 하나면 string, 줄이 여럿이면 <p>들을 넘긴다. */
  children: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** 🚨확인을 눌렀는데 **서버가 거절한 이유**(09-18 밤 QA G-02). 팝업을 닫고 뒤 화면에 적으면
   *  그 글자가 화면 밖에 생겨서 「버튼이 죽었다」로 읽힌다. 스크롤 밖으로 안 밀리게 버튼 줄 바로 위에 고정한다. */
  error?: string;
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
      className="fixed inset-0 z-[60] flex items-center justify-center bg-ink/55 p-4 backdrop-blur-[2px] print:hidden"
      {...dialog.overlayProps}
    >
      {/* 📐09-18 밤 QA(G-06) — 팝업 전체가 스크롤 상자라, 본문이 길면 **버튼 줄이 화면 밖으로 밀려났다**
          (375에서 「결제하러 가기」가 927px 자리에 있었다). 판을 세로 flex로 세우고 본문만 스크롤하게 한다.
          ⭐버튼 줄은 `shrink-0` — 돈이 움직이는 자리라 어느 폭에서든 늘 보여야 한다. */}
      <div
        {...dialog.panelProps}
        className="flex max-h-[calc(100dvh-2rem)] w-full max-w-[420px] flex-col rounded-lg bg-surface p-5 shadow-e3 sm:p-6"
      >
        <h2 id="rent-confirm-title" className="shrink-0 text-[18px] font-medium leading-snug break-keep text-ink">
          {title}
        </h2>
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto text-[17px] leading-relaxed break-keep text-body">
          {children}
        </div>
        {error && (
          <p role="alert" className="mt-4 shrink-0 text-[15px] leading-relaxed break-keep text-danger">
            {error}
          </p>
        )}
        {/* 확인이 오른쪽 — 엄지가 닿는 자리. 취소가 먼저 읽히고 확인이 마지막에 눌린다. */}
        <div className="mt-6 flex shrink-0 gap-2">
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
