"use client";

// 매거진 「잘 읽었어요 ❤️」 — 글 읽는 동안 화면 아래에 떠 있는 하트 버튼(대표 지시 08-14).
//
// ⭐찜(`MakerActionBar`)과 **같은 계약**으로 만들었다: 로그인 필수 · 낙관적 반영 · 실패 시 롤백 ·
//   비로그인은 로그인 유도 후 **복귀하면 의도를 자동 재개**. 뜻이 같은 동작은 같은 모양이어야
//   쓰는 사람도 다음에 코드를 볼 사람도 하나만 배우면 된다.
//
// ⚠️`fixed`라 본문 맨 끝을 가린다 — 그래서 상세 페이지 아래쪽에 그만큼 여백을 둔다(page.tsx).
// ⚠️`print:hidden` — 인쇄본에 버튼이 찍히면 종이에 누를 수 없는 것이 남는다.
import { useCallback, useEffect, useState } from "react";
import { setArticleLikedAction } from "@/lib/magazine-actions";
import { useDismissable } from "@/components/useDismissable";

/** 로그인하러 떠나기 직전 "이 글에 하트를 누르려던 참이었다"를 남긴다.
 *  ⚠️`sessionStorage` — 탭을 닫으면 사라지는 게 맞다. 며칠 뒤 로그인했다고 옛 의도가
 *    되살아나 하트가 저절로 눌리면 그건 사용자가 안 한 행동이다. */
const PENDING_LIKE_KEY = "collab5:pendingArticleLike";

export function ArticleLikeBar({
  articleId,
  slug,
  initialCount,
  initialLiked,
  loggedIn,
}: {
  articleId: number;
  slug: string;
  initialCount: number;
  initialLiked: boolean;
  loggedIn: boolean;
}) {
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [needLogin, setNeedLogin] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  // 오버레이 공통 동작(ESC·스크롤 잠금·포커스 트랩·포커스 복귀·role/aria-modal)을 한 번에 얻는다.
  // ⚠️`overlayClose: false` — **얼럿은 딤 클릭으로 닫지 않는다**(대표 정책 07-29). 그래도 ESC로는 닫힌다.
  //   /m 소개서의 찜·제안 얼럿과 **같은 훅·같은 정책**이다. 새 규칙을 만들지 않는다.
  const loginDialog = useDismissable(needLogin, {
    onClose: () => setNeedLogin(false),
    overlayClose: false,
  });

  const apply = useCallback(
    async (next: boolean) => {
      setBusy(true);
      setErr("");
      // 낙관적 — 누른 사람에겐 즉시 반응해야 한다. 숫자는 서버 응답으로 정정한다.
      setLiked(next);
      setCount((c) => Math.max(0, c + (next ? 1 : -1)));
      const r = await setArticleLikedAction(articleId, next);
      setBusy(false);
      if (r.error) {
        setLiked(!next); // 롤백
        setCount((c) => Math.max(0, c + (next ? -1 : 1)));
        setErr(r.error);
        return;
      }
      // ⭐서버가 준 최종 개수로 덮는다 — 내가 보는 사이 남이 누른 하트까지 반영된다.
      if (typeof r.count === "number") setCount(r.count);
    },
    [articleId]
  );

  // 로그인하고 돌아왔을 때, 남겨둔 의도가 **이 글**이면 자동으로 눌러준다.
  useEffect(() => {
    if (!loggedIn || liked) return;
    let pending: string | null = null;
    try {
      pending = sessionStorage.getItem(PENDING_LIKE_KEY);
    } catch {
      return; // 프라이빗 모드 등 — 못 읽으면 그냥 수동으로 누르면 된다
    }
    if (pending !== String(articleId)) return;
    try {
      sessionStorage.removeItem(PENDING_LIKE_KEY);
    } catch {
      /* noop */
    }
    void apply(true);
  }, [loggedIn, liked, articleId, apply]);

  const onClick = () => {
    if (busy) return;
    if (!loggedIn) {
      setNeedLogin(true);
      return;
    }
    void apply(!liked);
  };

  const markPending = () => {
    try {
      sessionStorage.setItem(PENDING_LIKE_KEY, String(articleId));
    } catch {
      /* 실패해도 무해 — 돌아와서 한 번 더 누르면 된다 */
    }
  };

  return (
    <>
    {/* 🚨`pointer-events-none` — 이 띠는 화면 **폭 전체**를 차지한다. 그냥 두면 알약 좌우의 빈 곳이
        본문 맨 아래 글자·링크의 클릭을 먹는다(HomeMenuBar에서 같은 함정을 이미 밟았다). */}
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2 px-4 print:hidden">
      {err && (
        <p role="alert" className="rounded-md bg-surface px-3 py-1.5 text-[13px] text-red-600 shadow-e1">
          {err}
        </p>
      )}

      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        aria-pressed={liked}
        // ⭐눌린 상태 = 이 저장소가 이미 쓰는 「선택됨」 어휘(border-primary + tint + primary-on).
        //   새 표현을 만들지 않는다 — 사용자는 이 색을 이미 배웠다.
        className={`pointer-events-auto inline-flex h-12 shrink-0 items-center gap-2 rounded-pill border-[0.5px] px-5 text-[15px] font-medium shadow-e2 transition-colors disabled:opacity-60 ${
          liked
            ? "border-primary bg-primary-tint text-primary-on"
            : "border-[#DFDFE3] bg-surface text-ink hover:bg-surface-soft"
        }`}
      >
        {/* 문구는 상태와 무관하게 그대로 둔다 — 눌림 여부는 하트 채움과 면색이 말한다.
            라벨까지 같이 바뀌면 버튼 폭이 흔들리고, 무엇이 상태 표시인지 흐려진다. */}
        <span>잘 읽었어요</span>
        {/* 하트는 **글자 오른쪽**(대표 지시 08-14) — 「잘 읽었어요 ❤️」라고 말하는 순서 그대로다.
            하트는 이모지 대신 SVG — 이모지는 기기마다 모양·색이 제각각이라 '눌림/안 눌림'을
            면색으로 말하는 이 버튼에서 상태가 흐려진다. */}
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" aria-hidden="true"
          fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
          <path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0 1 10 5.9a3.7 3.7 0 0 1 6.5 2.3c0 4.4-6.5 8.3-6.5 8.3Z"
            strokeLinejoin="round" />
        </svg>
        {count > 0 && (
          // 숫자는 자릿수가 바뀌어도 버튼이 안 흔들리게 고정폭 숫자(tabular-nums).
          <span className="tabular-nums text-[14px] font-bold">{count}</span>
        )}
      </button>
    </div>

    {/* 비로그인 → 로그인 유도 **얼럿**(대표 지시 08-14 — "우리 얼럿 UI 디자인시스템 있잖아").
        전엔 버튼 위에 뜨는 작은 말풍선이었는데, 화면 아래 구석이라 본문에 묻혔다.
        ⭐/m 소개서의 찜·제안 얼럿과 **완전히 같은 껍데기**를 쓴다 — 딤 `bg-ink/40`, 카드 `max-w-sm`,
          우측 상단 X, [취소][로그인] 2버튼, 그 아래 회원가입 줄. 뜻이 같은 창은 같은 모양이어야 한다. */}
    {needLogin && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:hidden" {...loginDialog.overlayProps}>
        <div
          {...loginDialog.panelProps}
          className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2"
        >
          <button
            type="button"
            onClick={() => setNeedLogin(false)}
            aria-label="닫기"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-faint hover:bg-surface-soft hover:text-ink"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 5l10 10M15 5L5 15" strokeLinecap="round" />
            </svg>
          </button>

          <p className="px-6 text-xl font-bold leading-snug text-balance break-keep text-ink">로그인이 필요해요</p>
          <p className="mt-2 text-[16px] leading-relaxed text-balance break-keep text-mute">
            로그인하면 지금 보고 있는 글에 하트를 남길 수 있어요.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setNeedLogin(false)}
              className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-sm font-medium text-ink"
            >
              취소
            </button>
            <a
              href={`/login?redirect=${encodeURIComponent(`/magazine/${slug}`)}`}
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
