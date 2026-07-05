"use client";

import { useState } from "react";

// 소개서 링크 복사 — 현재 페이지 URL을 클립보드로. 복사 후 잠깐 '복사됨' 피드백.
export function CopyLinkButton() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // 클립보드 API 불가 시 폴백(구형/비보안 컨텍스트)
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
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary text-base font-medium text-primary-on transition-colors"
      >
        {copied ? "✓ 링크가 복사됐어요" : "🔗 링크 복사"}
      </button>
      {/* 모바일 플로팅 — sm 미만에서만 */}
      <button
        type="button"
        onClick={copy}
        aria-label="링크 복사"
        className="fixed bottom-4 right-4 z-40 flex h-12 items-center gap-1.5 rounded-pill bg-primary px-5 text-sm font-medium text-primary-on shadow-e2 sm:hidden"
      >
        {copied ? "✓ 복사됨" : "🔗 링크 복사"}
      </button>
    </>
  );
}
