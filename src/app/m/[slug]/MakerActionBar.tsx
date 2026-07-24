"use client";

// 소개서 페이지 하단 고정 플로팅 액션바 — 방문자 액션 존.
// [ ♡ 찜(작게) + 콜라보 시작하기(신설, 지금은 UI만) ] + 링크복사 pill(바 우측 위).
// 백보드 = 흰 배경 + 상단 좌우 모서리만 둥근 바텀시트형.
import { useState, useTransition, useEffect } from "react";
import { setMakerSavedAction } from "@/lib/actions";
import { ScrollLock } from "@/components/ScrollLock";

// 로그인/가입 전에 눌렀던 찜 의도를 보관하는 키(같은 탭 세션 한정).
// 고객이 이미 하트를 눌렀으니, 로그인 후 이 페이지로 돌아오면 자동으로 찜 처리한다.
const PENDING_SAVE_KEY = "collab5:pendingSave";

export function MakerActionBar({
  slug,
  makerId,
  initialSaved,
  loggedIn,
}: {
  slug: string;
  makerId: number;
  initialSaved: boolean;
  loggedIn: boolean;
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loginOpen, setLoginOpen] = useState(false);
  const [toast, setToast] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // 로그인/가입으로 떠나기 직전, 이 업체를 찜하려 했다는 의도를 남긴다.
  const markPendingSave = () => {
    try {
      sessionStorage.setItem(PENDING_SAVE_KEY, String(makerId));
    } catch {
      /* 프라이빗 모드 등 — 실패해도 무해 */
    }
  };

  // 로그인 후 이 페이지로 복귀 시: 보류해둔 찜 의도가 이 업체면 자동 저장(하트 채움).
  useEffect(() => {
    if (!loggedIn || saved) return;
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(PENDING_SAVE_KEY);
    } catch {
      return;
    }
    if (pendingId !== String(makerId)) return;
    try {
      sessionStorage.removeItem(PENDING_SAVE_KEY);
    } catch {
      /* noop */
    }
    setSaved(true); // 낙관적 — 고객은 이미 눌렀으니 즉시 채움
    setMakerSavedAction(makerId, true).then((r) => {
      if (r.error) setSaved(false); // 저장 실패 시 되돌림
    });
  }, [loggedIn, saved, makerId]);

  // 찜 토글 — 비로그인은 로그인 유도, 로그인은 낙관적 저장(실패 시 롤백).
  const toggleHeart = () => {
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    const next = !saved;
    setSaved(next);
    start(async () => {
      const r = await setMakerSavedAction(makerId, next);
      if (r.error) {
        setSaved(!next); // 롤백
        alert(r.error);
      }
    });
  };

  // 콜라보 시작하기 — UI만(기능 나중). 죽은 버튼처럼 안 보이게 잠깐 안내.
  const startCollab = () => {
    setToast(true);
    window.setTimeout(() => setToast(false), 2200);
  };

  const copy = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    try {
      await navigator.clipboard.writeText(url);
    } catch {
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
      {/* 하단 고정 플로팅 — 640px 중앙, 모바일·데스크탑 공통 */}
      <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
        <div className="relative mx-auto w-full max-w-[640px] px-4">
          {/* 링크복사 pill — 바 우측 위 */}
          <button
            type="button"
            onClick={copy}
            aria-label="링크 복사"
            className="absolute -top-[52px] right-4 flex h-10 items-center gap-1.5 rounded-pill bg-primary px-4 text-sm font-medium text-primary-on shadow-e2 transition-colors"
          >
            {copied ? "✓ 복사됐어요" : "🔗 링크 복사"}
          </button>

          {/* 백보드 바 — 흰 배경 + 상단 좌우 라운드 */}
          <div className="flex items-center gap-2.5 rounded-t-2xl border border-b-0 border-hairline bg-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-e2">
            {/* 찜 하트 — 작게, 좌측. 빈 → 채워진 빨강 토글 */}
            <button
              type="button"
              onClick={toggleHeart}
              disabled={pending}
              role="switch"
              aria-checked={saved}
              aria-label={saved ? "찜 해제" : "찜하기"}
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-md border transition-colors ${
                saved
                  ? "border-red-200 bg-red-50 text-red-500"
                  : "border-border-strong bg-surface text-faint hover:text-body"
              }`}
            >
              <svg
                viewBox="0 0 24 24"
                className="h-6 w-6"
                fill={saved ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path
                  d="M12 20.5l-7.19-7.12a4.6 4.6 0 0 1 6.5-6.5l.69.68.69-.68a4.6 4.6 0 1 1 6.5 6.5L12 20.5z"
                  strokeLinejoin="round"
                />
              </svg>
            </button>

            {/* 콜라보 시작하기 — primary, 나머지 폭. 지금은 UI만 */}
            <button
              type="button"
              onClick={startCollab}
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on transition-colors"
            >
              콜라보 시작하기
            </button>
          </div>
        </div>
      </div>

      {/* 콜라보 시작하기 안내 토스트 */}
      {toast && (
        <div className="fixed bottom-[92px] left-1/2 z-50 -translate-x-1/2 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-medium text-surface shadow-e2 print:hidden">
          열심히 준비 중이에요!
        </div>
      )}

      {/* 비로그인 찜 → 로그인 유도 얼럿 */}
      {loginOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <ScrollLock />
          <div className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            {/* 우측 상단 닫기 */}
            <button
              type="button"
              onClick={() => setLoginOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>

            <p className="text-xl font-bold text-ink">찜하려면 로그인이 필요해요</p>
            <p className="mt-2 text-base leading-relaxed text-mute">
              관심 있는 곳을 저장해두고 언제든 다시 볼 수 있어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setLoginOpen(false)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
              >
                취소
              </button>
              <a
                href={`/login?redirect=${encodeURIComponent(`/m/${slug}`)}`}
                onClick={markPendingSave}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-on"
              >
                로그인
              </a>
            </div>
            <p className="mt-4 text-[13px] text-mute">
              아직 회원이 아니신가요?{" "}
              <a href="/signup" onClick={markPendingSave} className="font-medium text-ink underline underline-offset-2">
                회원가입 하기
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
