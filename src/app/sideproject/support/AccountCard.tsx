"use client";

// 계좌 카드(한국어 후원하기). 왼쪽 위 「은행 · 이름」, 그 아래 계좌번호, 오른쪽 [복사].
// 누르면 2초 동안 위 줄이 「복사했어요」로 바뀌고 버튼 그림이 체크가 된다. 버튼 글자는 그대로 둔다
//   → 폰 폭에서 버튼이 넓어져 계좌번호가 두 줄로 꺾이던 걸 막는다(11-05 375px에서 실측).
// 복사는 숫자만 한다(은행 앱 칸에 그대로 붙게). 클립보드가 막힌 브라우저(앱 안 브라우저 등)는 숨긴 입력칸으로 한 번 더,
// 그것도 막히면 화면의 계좌번호를 골라 둔다. 폰이면 바로 「복사」 메뉴를 누를 수 있다.
import { useRef, useState } from "react";

function fallbackCopy(text: string): boolean {
  const el = document.createElement("textarea");
  el.value = text;
  el.setAttribute("readonly", "");
  el.style.position = "fixed";
  el.style.opacity = "0";
  document.body.appendChild(el);
  el.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  el.remove();
  return ok;
}

type Props = { bank: string; holder: string; number: string; copy: string; copied: string };

export function AccountCard({ bank, holder, number, copy, copied }: Props) {
  const [done, setDone] = useState(false);
  const numberRef = useRef<HTMLParagraphElement>(null);

  async function onCopy() {
    const text = number.replace(/\D/g, "");
    let ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch {
      ok = fallbackCopy(text);
    }
    if (!ok) {
      const sel = window.getSelection();
      if (numberRef.current && sel) {
        const range = document.createRange();
        range.selectNodeContents(numberRef.current);
        sel.removeAllRanges();
        sel.addRange(range);
      }
      return;
    }
    setDone(true);
    setTimeout(() => setDone(false), 2000);
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-[16px] bg-surface-soft py-3 pr-2 pl-5">
      <div className="min-w-0">
        <p aria-live="polite" className={`text-[13px] ${done ? "font-medium text-ink" : "text-mute"}`}>
          {done ? copied : `${bank} · ${holder}`}
        </p>
        <p
          ref={numberRef}
          className="mt-0.5 text-[clamp(16px,5vw,21px)] font-bold tracking-[0.01em] whitespace-nowrap tabular-nums text-ink select-all"
        >
          {number}
        </p>
      </div>
      <button
        type="button"
        onClick={onCopy}
        className="inline-flex h-[44px] shrink-0 items-center gap-1.5 rounded-md px-3 text-[15px] font-medium text-ink transition-colors hover:bg-surface"
      >
        {done ? (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.9">
            <path d="m4.5 10.5 3.5 3.5 7.5-8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg aria-hidden="true" viewBox="0 0 20 20" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6">
            <rect x="7" y="7" width="9.5" height="9.5" rx="2" />
            <path d="M13 4.5V4a1.5 1.5 0 0 0-1.5-1.5H5A1.5 1.5 0 0 0 3.5 4v6.5A1.5 1.5 0 0 0 5 12h.5" strokeLinecap="round" />
          </svg>
        )}
        {copy}
      </button>
    </div>
  );
}
