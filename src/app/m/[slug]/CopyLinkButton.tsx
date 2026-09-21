"use client";

import { useState } from "react";

// 소개서 링크 복사 — 상단 카드의 「수정」 왼쪽 (대표 09-21: 플로팅에서 빼서 수정 옆으로).
// 🎨`EditButton`과 같은 옷(28px · hairline · 12px)이다. 둘이 한 줄에 서는 보조 버튼이라 모양이 같아야 짝으로 읽힌다.
// 💬복사 확인은 토스트 대신 **버튼 글자 자체**가 2초 동안 바뀐다. 누른 자리에서 바로 보이고, 하단 바의 토스트는 이 카드에서 멀다.
export function CopyLinkButton() {
  const [done, setDone] = useState(false);

  const copy = () => {
    const url = window.location.href;
    // clipboard API 우선, 막힌 환경(인앱 브라우저 등)은 execCommand로 한 번 더.
    const legacy = () => {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
      } catch {
        /* noop */
      }
      document.body.removeChild(ta);
    };
    try {
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(url).catch(legacy);
      else legacy();
    } catch {
      legacy();
    }
    setDone(true);
    window.setTimeout(() => setDone(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-live="polite"
      className="inline-flex h-7 items-center gap-1 rounded-md border border-hairline bg-surface px-2.5 text-[12px] font-medium text-mute hover:border-border-strong hover:text-ink print:hidden"
    >
      {done ? "✓ 복사했어요" : "링크 복사"}
    </button>
  );
}
