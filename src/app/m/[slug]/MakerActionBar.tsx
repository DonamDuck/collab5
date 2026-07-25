"use client";

// 소개서 페이지 하단 고정 플로팅 액션바 — 방문자 액션 존.
// [ ♡ 찜(작게) + 콜라보 시작하기 ] + 링크복사 pill(바 우측 위). 백보드 = 흰 배경 + 상단 좌우 라운드.
// 찜·콜라보 시작 둘 다 로그인 필수 — 비로그인은 로그인 유도 후, 복귀 시 원래 의도를 자동 재개.
import { useState, useTransition, useEffect } from "react";
import { setMakerSavedAction, recordCollabRequestAction } from "@/lib/actions";
import { resolveCollabChannel } from "@/lib/links";
import { ScrollLock } from "@/components/ScrollLock";

// 로그인/가입 전에 눌렀던 의도를 보관하는 키(같은 탭 세션 한정) — 복귀 시 자동 재개.
const PENDING_SAVE_KEY = "collab5:pendingSave";
const PENDING_PROPOSE_KEY = "collab5:pendingPropose";

export function MakerActionBar({
  slug,
  makerId,
  makerName,
  initialSaved,
  loggedIn,
  instagram,
  homepage,
  senderName,
  senderSlug,
}: {
  slug: string;
  makerId: number;
  makerName: string;
  initialSaved: boolean;
  loggedIn: boolean;
  instagram?: string;
  homepage?: string;
  senderName?: string; // 제안자(로그인 유저) 상호 — 추천 메시지 인사말
  senderSlug?: string; // 제안자의 첫 소개서 slug — 있으면 소개 링크 첨부
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginReason, setLoginReason] = useState<"save" | "propose">("save");
  const [proposeOpen, setProposeOpen] = useState(false);
  const [message, setMessage] = useState(""); // 추천 메시지(수정 가능)
  const [msgCopied, setMsgCopied] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();

  // 콜라보 연락 채널(인스타 DM 우선 → 홈페이지/카톡 → 없으면 null)
  const channel = resolveCollabChannel({ instagram, homepage });

  // 추천 메시지 기본값 — 제안자 상호로 인사, 소개서 있으면 링크 첨부. 시트 열릴 때 채운다.
  useEffect(() => {
    if (!proposeOpen) return;
    const hello = senderName ? `안녕하세요, ${senderName}입니다.` : "안녕하세요!";
    let msg = `${hello}\ncollab5에서 소개서를 보고 함께 재미있는 콜라보를 만들어볼 수 있을 것 같아 먼저 연락드렸어요.\n관심 있으시다면 편하실 때 답장 주시면 감사하겠습니다. 😊`;
    if (senderSlug && typeof window !== "undefined") {
      msg += `\n\n저희 소개도 함께 보내드려요.\n${window.location.origin}/m/${senderSlug}`;
    }
    setMessage(msg);
  }, [proposeOpen, senderName, senderSlug]);

  // 로그인/가입으로 떠나기 직전, 무슨 의도였는지(찜/제안) 이 업체 기준으로 남긴다.
  const markPending = () => {
    try {
      sessionStorage.setItem(loginReason === "propose" ? PENDING_PROPOSE_KEY : PENDING_SAVE_KEY, String(makerId));
    } catch {
      /* 프라이빗 모드 등 — 실패해도 무해 */
    }
  };

  // 복귀 시 보류해둔 찜 의도가 이 업체면 자동 저장(하트 채움).
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
      if (r.error) setSaved(false);
    });
  }, [loggedIn, saved, makerId]);

  // 복귀 시 보류해둔 제안 의도가 이 업체면 제안 시트 자동 오픈.
  useEffect(() => {
    if (!loggedIn) return;
    let pendingId: string | null = null;
    try {
      pendingId = sessionStorage.getItem(PENDING_PROPOSE_KEY);
    } catch {
      return;
    }
    if (pendingId !== String(makerId)) return;
    try {
      sessionStorage.removeItem(PENDING_PROPOSE_KEY);
    } catch {
      /* noop */
    }
    setProposeOpen(true);
  }, [loggedIn, makerId]);

  // 찜 토글 — 비로그인은 로그인 유도, 로그인은 낙관적 저장(실패 시 롤백).
  const toggleHeart = () => {
    if (!loggedIn) {
      setLoginReason("save");
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

  // 콜라보 시작하기 — 비로그인은 로그인 유도, 로그인은 제안 시트.
  const handlePropose = () => {
    if (!loggedIn) {
      setLoginReason("propose");
      setLoginOpen(true);
      return;
    }
    setProposeOpen(true);
  };

  // 텍스트 복사 — clipboard API 우선, 실패 시 레거시 execCommand. (제스처 내 동기 실행 가능)
  const copyText = (text: string) => {
    const legacy = () => {
      const ta = document.createElement("textarea");
      ta.value = text;
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
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(legacy);
      else legacy();
    } catch {
      legacy();
    }
  };

  const flashMsgCopied = () => {
    setMsgCopied(true);
    window.setTimeout(() => setMsgCopied(false), 2000);
  };

  // Primary — 메시지 복사 + 상대 채널 오픈(제스처 내 즉시, 팝업 차단 회피) + 계측(best-effort) + 닫기.
  const proposeAndSend = () => {
    if (!channel) return;
    copyText(message);
    window.open(channel.url, "_blank", "noopener,noreferrer");
    recordCollabRequestAction(makerId, channel.channel).catch(() => {});
    setProposeOpen(false);
  };

  // Secondary — 메시지만 복사(시트 유지 + 토스트).
  const copyMessageOnly = () => {
    copyText(message);
    flashMsgCopied();
  };

  const isInstagram = channel?.channel === "instagram";
  const proposePrimaryLabel = isInstagram ? "메시지 복사하고 인스타 DM 보내기" : "메시지 복사하고 채널 열기";

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

  const loginTitle = loginReason === "propose" ? "콜라보를 시작하려면 로그인이 필요해요" : "찜하려면 로그인이 필요해요";
  const loginSub =
    loginReason === "propose"
      ? "로그인하면 마음에 드는 브랜드와 콜라보를 시작할 수 있어요."
      : "마음에 드는 브랜드를 저장해두고 언제든 다시 만나보세요.";

  return (
    <>
      {/* 하단 고정 플로팅 — 640px 중앙, 모바일·데스크탑 공통. 좌우 마진 없이 화면 끝까지(바텀시트) */}
      <div className="fixed inset-x-0 bottom-0 z-40 print:hidden">
        <div className="relative mx-auto w-full max-w-[640px]">
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

            {/* 콜라보 시작하기 — primary, 나머지 폭 */}
            <button
              type="button"
              onClick={handlePropose}
              className="flex h-12 flex-1 items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on transition-colors"
            >
              콜라보 시작하기
            </button>
          </div>
        </div>
      </div>

      {/* 콜라보 제안 시트 — 앱 내 채팅 준비 전까지 인스타 등으로 핸드오프 */}
      {proposeOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 print:hidden" onClick={() => setProposeOpen(false)}>
          <ScrollLock />
          <div
            className="relative w-full max-w-[640px] rounded-t-2xl border border-b-0 border-hairline bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] shadow-e2"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 우측 상단 닫기 */}
            <button
              type="button"
              onClick={() => setProposeOpen(false)}
              aria-label="닫기"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
            >
              <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
              </svg>
            </button>

            <p className="pr-8 text-xl font-bold break-keep text-ink">{makerName}님과 콜라보 시작하기</p>
            {channel ? (
              <>
                <p className="mt-2 text-[15px] leading-relaxed text-mute">
                  아직 앱 내 채팅은 준비 중이에요.
                  <br />
                  그전까지는 아래 메시지를 복사해 {isInstagram ? "인스타그램으로" : "아래 채널로"} 연락해보세요.
                </p>
                <label className="mt-4 block text-[13px] font-medium text-body">메시지 초안 (자유롭게 수정해보세요)</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  className="mt-1.5 w-full resize-none rounded-md border border-border-strong bg-surface-soft p-3 text-[14px] leading-relaxed text-ink focus:border-primary focus:outline-none"
                />
                <button
                  type="button"
                  onClick={proposeAndSend}
                  className="mt-4 flex h-12 w-full items-center justify-center rounded-md bg-primary text-base font-medium text-primary-on"
                >
                  {proposePrimaryLabel}
                </button>
                <button
                  type="button"
                  onClick={copyMessageOnly}
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-md border border-border-strong bg-surface text-base font-medium text-ink"
                >
                  메시지 복사하기
                </button>
              </>
            ) : (
              <p className="mt-2 text-[15px] leading-relaxed text-mute">
                아직 {makerName}님의 연락처가 준비되지 않았어요.
                <br />
                조금만 기다려 주세요.
              </p>
            )}
          </div>
        </div>
      )}

      {/* 메시지 복사 완료 토스트 (제안 시트 위) */}
      {msgCopied && (
        <div className="fixed bottom-[92px] left-1/2 z-[60] -translate-x-1/2 rounded-pill bg-ink px-4 py-2.5 text-[13px] font-medium text-surface shadow-e2 print:hidden">
          ✓ 메시지를 복사했어요.
        </div>
      )}

      {/* 비로그인 → 로그인 유도 얼럿 (찜/제안 공용) */}
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

            <p className="px-6 text-xl font-bold leading-snug text-balance break-keep text-ink">{loginTitle}</p>
            <p className="mt-2 text-base leading-relaxed text-balance break-keep text-mute">{loginSub}</p>
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
                onClick={markPending}
                className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-on"
              >
                로그인
              </a>
            </div>
            <p className="mt-4 text-[13px] text-mute">
              아직 회원이 아니신가요?{" "}
              <a href="/signup" onClick={markPending} className="font-medium text-ink underline underline-offset-2">
                회원가입
              </a>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
