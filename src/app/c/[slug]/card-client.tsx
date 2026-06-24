"use client";

import { useEffect, useRef, useState } from "react";
import { recordReactionAction, recordViewAction } from "@/lib/actions";

/** 발송 단계 — 카드 생성 직후 발신자에게만 보이는 공유 링크 복사 바 (?new=1) */
export function ShareBar() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    const url = window.location.href.split("?")[0];
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard 차단 환경 — 무시
    }
  };
  return (
    <div className="mb-4 rounded-lg border border-hairline bg-surface-soft px-4 py-3">
      <p className="text-sm font-medium text-ink">카드가 만들어졌어요 🌱</p>
      <p className="mt-0.5 text-[13px] text-mute">
        이 링크를 인스타 DM이나 이메일로 보내세요. 받는 분은 로그인 없이 열어봐요.
      </p>
      <button
        onClick={copy}
        className="mt-2 h-10 w-full rounded-md bg-primary text-sm font-medium text-primary-on"
      >
        {copied ? "복사됐어요 ✓" : "공유 링크 복사"}
      </button>
    </div>
  );
}

/** North Star: 무계정 열람 시 1회 view 기록 */
export function ViewTracker({ cardId }: { cardId: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void recordViewAction(cardId);
  }, [cardId]);
  return null;
}

/** RSVP — 관심 있어요 / 다음에요. 부담 없이. */
export function RsvpBar({ cardId }: { cardId: string }) {
  const [done, setDone] = useState<"관심" | "패스" | null>(null);
  const [pending, setPending] = useState(false);

  const react = async (type: "관심" | "패스") => {
    if (pending || done) return;
    setPending(true);
    await recordReactionAction(cardId, type);
    setDone(type);
    setPending(false);
  };

  if (done) {
    return (
      <div className="mt-5 rounded-md bg-surface-soft px-4 py-3 text-center text-sm text-body">
        {done === "관심"
          ? "관심을 전했어요 🌱 메이커에게 마음이 닿았어요."
          : "마음 전했어요. 다음에 더 좋은 인연으로 만나요."}
      </div>
    );
  }

  return (
    <div className="mt-5 flex gap-2">
      <button
        onClick={() => react("관심")}
        disabled={pending}
        className="h-12 flex-1 rounded-md bg-primary text-base font-medium text-primary-on disabled:opacity-50"
      >
        관심 있어요
      </button>
      <button
        onClick={() => react("패스")}
        disabled={pending}
        className="h-12 rounded-md px-5 text-base font-medium text-mute disabled:opacity-50"
      >
        다음에요
      </button>
    </div>
  );
}
