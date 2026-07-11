"use client";

import { useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/auth-actions";
import { LoadingOverlay } from "@/components/LoadingOverlay";

// 비밀번호 변경 — 비밀번호 찾기와 동일하게 이메일로 변경 링크 발송.
// 하루 최대 5회 제한(브라우저 로컬 기준, 소프트 제한). Supabase 자체 서버 레이트리밋도 존재.
const DAILY_LIMIT = 5;
const LS_KEY = "pw_change_count";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function remaining(): number {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DAILY_LIMIT;
    const { date, count } = JSON.parse(raw) as { date: string; count: number };
    if (date !== today()) return DAILY_LIMIT;
    return Math.max(0, DAILY_LIMIT - count);
  } catch {
    return DAILY_LIMIT;
  }
}
function bump(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    let count = 0;
    if (raw) {
      const p = JSON.parse(raw) as { date: string; count: number };
      if (p.date === today()) count = p.count;
    }
    localStorage.setItem(LS_KEY, JSON.stringify({ date: today(), count: count + 1 }));
  } catch {
    // 로컬스토리지 불가 환경 — 제한 없이 진행
  }
}

export function ChangePasswordButton({ email }: { email: string }) {
  const [done, setDone] = useState(false); // 완료 얼럿
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();

  const send = () =>
    start(async () => {
      setErr("");
      if (remaining() <= 0) {
        setErr("비밀번호 변경은 하루 5번까지만 할 수 있어요. 내일 다시 시도해주세요.");
        return;
      }
      const r = await requestPasswordResetAction(email);
      if (r.error) {
        setErr(r.error);
        return;
      }
      bump();
      setDone(true);
    });

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={send}
        disabled={pending}
        className="text-[15px] font-medium text-mute underline-offset-2 hover:text-ink hover:underline disabled:opacity-50"
      >
        비밀번호 변경
      </button>
      {err && <p className="mt-2 text-center text-sm text-red-600">{err}</p>}

      {pending && <LoadingOverlay label="메일 보내는 중이에요…" />}

      {done && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-lg font-bold text-ink">📧 메일을 보냈어요</p>
            <p className="mt-2 text-[15px] leading-relaxed text-body">
              {email}로 비밀번호 변경 링크를 보냈어요. 메일함을 확인해주세요.
            </p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-5 h-12 w-full rounded-md bg-primary text-base font-medium text-primary-on"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
