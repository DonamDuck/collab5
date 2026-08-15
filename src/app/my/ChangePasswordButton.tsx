"use client";

import { useEffect, useState, useTransition } from "react";
import { requestPasswordResetAction } from "@/lib/auth-actions";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import { authEnvReady, createBrowserAuthClient } from "@/lib/supabase/client";
import { kstDateKey } from "@/lib/time";

// 비밀번호 변경 — 비밀번호 찾기와 동일하게 이메일로 변경 링크 발송.
// 하루 최대 5회 제한(브라우저 로컬 기준, 소프트 제한). Supabase 자체 서버 레이트리밋도 존재.
const DAILY_LIMIT = 5;
const LS_KEY = "pw_change_count";

function today(): string {
  return kstDateKey(); // KST 자정 기준 — UTC로 자르면 한국에서 하루가 오전 9시에 바뀐다
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
  // 🚨**비밀번호가 아예 없는 계정이 있다**(08-15 카카오 실측). 소셜로만 가입하면 이메일 주소는
  //   있어도 비밀번호 로그인 수단(`email` identity)은 안 생긴다. 그런데 여기 버튼은
  //   "비밀번호 변경"이라 **없는 걸 바꾸라고** 서 있었다.
  //   ⭐게다가 그 계정은 로그인 문이 소셜 하나뿐이라, 그 소셜을 잃으면 못 들어온다 —
  //     비밀번호를 **새로 거는 것**이 곧 안전장치다. 그래서 숨기지 않고 문구만 바꾼다.
  //   기본값 true = 확인 전이나 조회 실패 시엔 기존 문구를 유지한다(멀쩡한 계정을 헷갈리게 하지 않는다).
  const [hasPassword, setHasPassword] = useState(true);

  useEffect(() => {
    if (!authEnvReady) return;
    let alive = true;
    (async () => {
      try {
        const supabase = createBrowserAuthClient();
        const { data } = await supabase.auth.getUserIdentities();
        if (!alive || !data) return;
        setHasPassword(data.identities.some((i) => i.provider === "email"));
      } catch {
        // 조회 실패 — 기본값(있음)을 유지한다
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const label = hasPassword ? "비밀번호 변경" : "비밀번호 설정";

  const send = () =>
    start(async () => {
      setErr("");
      if (remaining() <= 0) {
        setErr(`${label}은 하루 5번까지만 할 수 있어요. 내일 다시 시도해주세요.`);
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
        {label}
      </button>
      {/* 비밀번호가 없는 계정에는 **왜 걸어두는 게 좋은지**를 말해준다 —
          지금 로그인 문이 소셜 하나뿐이라, 그걸 잃으면 들어올 길이 없다. */}
      {!hasPassword && (
        <p className="mt-2 max-w-[320px] text-center text-[13px] leading-relaxed text-faint">
          비밀번호를 걸어두면 이메일로도 로그인할 수 있어요. 소셜 계정을 못 쓰게 될 때를 위한 예비 열쇠예요.
        </p>
      )}
      {err && <p className="mt-2 text-center text-[13px] text-danger">{err}</p>}

      {pending && <LoadingOverlay label="메일 보내는 중이에요…" />}

      {done && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center">
          <div className="w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="text-[18px] font-bold text-balance break-keep text-ink">📧 메일을 보냈어요</p>
            <p className="mt-2 text-[15px] leading-relaxed break-keep text-body">
              {email}로 {hasPassword ? "비밀번호 변경" : "비밀번호 설정"} 링크를 보냈어요. 메일함을
              확인해주세요.
            </p>
            <button
              type="button"
              onClick={() => setDone(false)}
              className="mt-5 h-12 w-full rounded-md bg-primary text-[15px] font-medium text-primary-on"
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
