"use client";

import { useCallback, useEffect, useRef, type KeyboardEvent as ReactKeyboardEvent, type MouseEvent as ReactMouseEvent } from "react";

// 오버레이(시트·모달·얼럿) 공통 동작을 한 곳에 모은 훅.
// ESC · 딤 클릭 · 스크롤 잠금 · 초기 포커스 · 포커스 트랩 · 포커스 복귀 · role/aria-modal 을 한 번에 준다.
//
// ⚠️ 왜 훅으로 뽑았나 — 전엔 시트마다 개발자가 이 6가지를 손으로 붙여서 19곳이 19가지로 어긋났다
//    (ESC는 라이트박스 한 곳만, 딤 클릭은 제각각, aria-modal은 거의 없음. QA 07-29).
//    새 시트를 만들 때 또 빠지는 걸 구조적으로 막는 게 목적이다.
//
// 📌 대표 확정 정책(07-29)
//    - 얼럿·확인창·작성 중 위저드는 **딤 클릭으로 닫지 않는다** → `overlayClose: false`
//      (실수로 눌러 쓰던 내용이 날아가는 걸 막기 위함. 닫기는 X 버튼으로)
//    - 그래도 **얼럿은 ESC로 닫힌다** → 키보드·스크린리더 사용자에겐 ESC가 사실상 유일한 탈출구
//    - **작성 중인 위저드는 ESC에서 한 번 물어본다** → `onEscape`로 자체 확인 UI를 띄운다

const FOCUSABLE =
  'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// 열려 있는 오버레이 스택 — ESC는 '맨 위' 한 겹만 닫는다.
// 중첩이 실제로 있다(리포트 시트 → 소개서 고르기, register 미리보기 → 사진 라이트박스).
// 스택 없이 각자 document에 리스너를 달면 ESC 한 번에 여러 겹이 동시에 닫힌다.
const openStack: symbol[] = [];
// 배경 스크롤 잠금은 '첫 겹'만 걸고 '마지막 겹'이 풀어야 한다(중첩에서 복원값이 hidden으로 덮이는 사고 방지).
let savedBodyStyle: { overflow: string; paddingRight: string } | null = null;

export type DismissableOptions = {
  onClose: () => void;
  /** 딤(배경) 클릭으로 닫기. 얼럿·작성 중 시트는 false (대표 정책) */
  overlayClose?: boolean;
  /** ESC로 닫기 */
  escClose?: boolean;
  /** 지정하면 ESC에서 onClose 대신 이걸 호출한다(예: 위저드 '그만둘까요?' 확인) */
  onEscape?: () => void;
  /** 열릴 때 포커스를 줄 요소의 CSS 선택자. 기본 = 패널 안 첫 포커스 가능 요소 */
  initialFocus?: string;
  /** 제목 요소 id — 스크린리더가 이 창이 무엇인지 읽게 한다 */
  labelledBy?: string;
};

export function useDismissable(open: boolean, opts: DismissableOptions) {
  const { onClose, overlayClose = true, escClose = true, onEscape, initialFocus, labelledBy } = opts;

  const panelRef = useRef<HTMLElement | null>(null);
  const idRef = useRef<symbol | null>(null);
  if (idRef.current === null) idRef.current = Symbol("dismissable");
  // 딤에서 '누르기 시작'했는지 — 패널 안에서 드래그(텍스트 선택)하다 배경에서 손을 떼도 닫히던 사고를 막는다.
  const pressStartedOnOverlay = useRef(false);
  const restoreRef = useRef<HTMLElement | null>(null);

  // 콜백 최신값 — 리스너를 매 렌더 재등록하지 않으려고 ref로 넘긴다.
  const cbRef = useRef({ onClose, onEscape });
  cbRef.current = { onClose, onEscape };

  // 스택 등록 + 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const id = idRef.current as symbol;
    openStack.push(id);
    const body = document.body;
    if (openStack.length === 1) {
      const scrollbarW = window.innerWidth - document.documentElement.clientWidth;
      savedBodyStyle = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
      body.style.overflow = "hidden";
      if (scrollbarW > 0) body.style.paddingRight = `${scrollbarW}px`; // 스크롤바 폭 보정(레이아웃 밀림 방지)
    }
    return () => {
      const i = openStack.indexOf(id);
      if (i >= 0) openStack.splice(i, 1);
      if (openStack.length === 0 && savedBodyStyle) {
        body.style.overflow = savedBodyStyle.overflow;
        body.style.paddingRight = savedBodyStyle.paddingRight;
        savedBodyStyle = null;
      }
    };
  }, [open]);

  // ESC — 맨 위 한 겹만 반응
  useEffect(() => {
    if (!open || !escClose) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 한글 조합 중 ESC는 IME 취소용이다 — 시트를 닫으면 안 된다.
      if (e.isComposing) return;
      if (openStack[openStack.length - 1] !== idRef.current) return;
      e.stopPropagation();
      const cb = cbRef.current;
      if (cb.onEscape) cb.onEscape();
      else cb.onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, escClose]);

  // 초기 포커스 + 닫힐 때 원래 자리로 복귀
  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement) ?? null;
    const panel = panelRef.current;
    if (panel) {
      const wanted = initialFocus ? panel.querySelector<HTMLElement>(initialFocus) : null;
      const target = wanted ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      // preventScroll: 포커스 때문에 배경이 튀는 것 방지
      target.focus({ preventScroll: true });
    }
    return () => {
      const back = restoreRef.current;
      if (back && typeof back.focus === "function") back.focus({ preventScroll: true });
    };
  }, [open, initialFocus]);

  // Tab 트랩 — 열려 있는 동안 포커스가 시트 밖으로 새지 않게
  const onPanelKeyDown = useCallback((e: ReactKeyboardEvent) => {
    if (e.key !== "Tab") return;
    const panel = panelRef.current;
    if (!panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null || el === document.activeElement
    );
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  const overlayProps = {
    onMouseDown: (e: ReactMouseEvent) => {
      pressStartedOnOverlay.current = e.target === e.currentTarget;
    },
    onClick: (e: ReactMouseEvent) => {
      if (!overlayClose) return;
      if (e.target !== e.currentTarget) return; // 패널 내부 클릭은 무시
      if (!pressStartedOnOverlay.current) return; // 패널에서 시작한 드래그 → 무시(내용 유실 사고 방지)
      pressStartedOnOverlay.current = false;
      cbRef.current.onClose();
    },
  };

  const panelProps = {
    ref: panelRef as React.Ref<never>,
    role: "dialog" as const,
    "aria-modal": true,
    tabIndex: -1,
    onKeyDown: onPanelKeyDown,
    // 패널 안에서 시작한 드래그가 오버레이 클릭으로 새지 않게
    onMouseDown: (e: ReactMouseEvent) => e.stopPropagation(),
    onClick: (e: ReactMouseEvent) => e.stopPropagation(),
    ...(labelledBy ? { "aria-labelledby": labelledBy } : {}),
  };

  return { overlayProps, panelProps, panelRef };
}
