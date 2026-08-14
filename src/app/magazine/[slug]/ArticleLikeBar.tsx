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
    <div className="fixed inset-x-0 bottom-5 z-20 flex flex-col items-center gap-2 px-4 print:hidden">
      {/* 로그인 안내 — 버튼 **위**에 뜬다. 아래에 두면 화면 밖으로 밀려 안 보인다. */}
      {needLogin && (
        <div
          role="dialog"
          className="pointer-events-auto max-w-[calc(100vw-2rem)] rounded-md border-[0.5px] border-[#DFDFE3] bg-surface px-4 py-3 text-center shadow-e2"
        >
          <p className="text-[14px] font-medium text-ink">로그인이 필요해요</p>
          <p className="mt-1 text-[13px] leading-[1.5] text-body">
            로그인하면 이 글에 하트가 눌린 채로 돌아와요.
          </p>
          <div className="mt-3 flex items-center justify-center gap-2">
            <a
              href={`/login?redirect=${encodeURIComponent(`/magazine/${slug}`)}`}
              onClick={markPending}
              className="flex h-9 items-center rounded-md bg-primary px-4 text-[14px] font-medium text-primary-on"
            >
              로그인하기
            </a>
            <button
              type="button"
              onClick={() => setNeedLogin(false)}
              className="flex h-9 items-center rounded-md px-3 text-[14px] font-medium text-mute hover:text-ink"
            >
              나중에
            </button>
          </div>
        </div>
      )}

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
        {/* 하트는 이모지 대신 SVG — 이모지는 기기마다 모양·색이 제각각이라 '눌림/안 눌림'을
            면색으로 말하는 이 버튼에서 상태가 흐려진다. */}
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px] shrink-0" aria-hidden="true"
          fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
          <path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0 1 10 5.9a3.7 3.7 0 0 1 6.5 2.3c0 4.4-6.5 8.3-6.5 8.3Z"
            strokeLinejoin="round" />
        </svg>
        {/* 문구는 상태와 무관하게 그대로 둔다 — 눌림 여부는 하트 채움과 면색이 말한다.
            라벨까지 같이 바뀌면 버튼 폭이 흔들리고, 무엇이 상태 표시인지 흐려진다. */}
        <span>잘 읽었어요</span>
        {count > 0 && (
          // 숫자는 자릿수가 바뀌어도 버튼이 안 흔들리게 고정폭 숫자(tabular-nums).
          <span className="tabular-nums text-[14px] font-bold">{count}</span>
        )}
      </button>
    </div>
  );
}
