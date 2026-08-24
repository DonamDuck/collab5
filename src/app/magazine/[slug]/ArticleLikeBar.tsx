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
  initialLiked,
  loggedIn,
}: {
  articleId: number;
  slug: string;
  initialLiked: boolean;
  loggedIn: boolean;
}) {
  // 🔻08-15 개수 상태(`count`)·진행 상태(`busy`)를 **뺐다**(대표 지시 — 숫자는 나중에).
  //   ⭐**데이터는 그대로 쌓인다** — `magazine_likes` 행도, 서버 액션이 돌려주는 최종 개수도 살아 있다.
  //     화면 표시만 없앤 것이라, 되살릴 때 숫자가 0부터 시작하지 않는다.
  //   ⛔대신 **죽은 state를 남겨두지 않는다.** 안 쓰는 값이 남으면 다음 사람이 "이건 왜 있지"를 묻고,
  //     린트도 계속 경고한다. 되살리는 건 `initialCount` prop + useState 한 줄이면 된다.
  const [liked, setLiked] = useState(initialLiked);
  // 댓글 섹션이 화면에 들어왔나 — 들어오면 댓글 알약을 «슥» 접는다(보고 있는 것을 가리키는 버튼은 중복이다).
  const [atComments, setAtComments] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);
  const [err, setErr] = useState("");

  // 오버레이 공통 동작(ESC·스크롤 잠금·포커스 트랩·포커스 복귀·role/aria-modal)을 한 번에 얻는다.
  // ⚠️`overlayClose: false` — **얼럿은 딤 클릭으로 닫지 않는다**(대표 정책 07-29). 그래도 ESC로는 닫힌다.
  //   /m 소개서의 찜·제안 얼럿과 **같은 훅·같은 정책**이다. 새 규칙을 만들지 않는다.
  const loginDialog = useDismissable(needLogin, {
    onClose: () => setNeedLogin(false),
    overlayClose: false,
  });

  const apply = useCallback(
    async (next: boolean) => {
      setErr("");
      // 낙관적 — 누른 사람에겐 즉시 반응해야 한다. 실패하면 되돌린다.
      setLiked(next);
      const r = await setArticleLikedAction(articleId, next);
      if (r.error) {
        setLiked(!next); // 롤백
        setErr(r.error);
        return;
      }
    },
    [articleId]
  );

  // 댓글 섹션 감지 — `Reveal.tsx`와 같은 방식(IntersectionObserver, 라이브러리 없음).
  // ⚠️댓글 섹션은 이 컴포넌트의 자식이 아니라 페이지의 형제라, ref가 아니라 id로 찾는다.
  //   글이 아직 안 그려졌을 수 있어 못 찾으면 조용히 넘어간다(그럼 댓글 알약이 계속 보일 뿐, 깨지지 않는다).
  useEffect(() => {
    const el = document.getElementById("comments");
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      ([entry]) => setAtComments(entry.isIntersecting),
      { threshold: 0 } // 조금이라도 걸치면 접는다
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
    // ⛔`if (busy) return;`를 뺐다(08-15 대표 제보 "투명할 때 눌러도 아무것도 안 되더라").
    //   저장이 도는 동안 클릭을 삼키니, 쓰는 사람에겐 **버튼이 죽은 것**으로 보였다.
    //   서버가 멱등이라(upsert / delete) 연타해도 마지막 상태로 수렴한다 — 막을 이유가 없다.
    if (!loggedIn) {
      setNeedLogin(true);
      return;
    }
    void apply(!liked);
  };

  // 댓글로 «미끄러져» 내려간다.
  //
  // 🚨**왜 `scrollIntoView({behavior:"smooth"})`를 안 쓰나** — 이 글엔 사진이 수십 장이고
  //   모두 lazy 로딩이다. 내려가는 **도중에** 아래쪽 사진이 로드되며 문서가 길어져
  //   (실측 08-24: 12418 → 12732px) 목적지가 계속 밀린다. 네이티브 smooth는 **누른 순간의
  //   좌표 하나**로 애니메이션하므로, 도착해 보면 댓글이 또 저 아래에 있다.
  //   → 대표 증상 **「세 번 눌러야 댓글로 간다」**가 이것이다. 느릴수록 더 어긋난다.
  //   ⭐그래서 **매 프레임 목적지를 다시 잰다.** 홈(`HomeSectionTabs`)은 목적지 위에 사진이 없어
  //     네이티브로 충분하다 — 여기만 다른 이유가 이것이고, 그 차이가 없으면 홈 방식을 써라.
  //
  // 📏오프셋의 **정본은 여전히 CSS**(`ArticleComments`의 `scroll-mt-[82px]`)다. 여기선 그 값을
  //   `getComputedStyle`로 **읽기만** 한다 — 숫자를 JS에 또 적으면 두 군데로 갈라진다.
  // 🖐사용자가 도중에 스크롤하면 즉시 손을 뗀다. 안 그러면 애니메이션과 손가락이 싸운다.
  const goComments = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById("comments");
    if (!el) return; // 못 찾으면 네이티브 해시 점프에 맡긴다
    e.preventDefault();

    const offset = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const targetY = () => el.getBoundingClientRect().top + window.scrollY - offset;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      window.scrollTo(0, targetY());
      return;
    }

    const from = window.scrollY;
    const t0 = performance.now();
    const DURATION = 420; // 거리와 무관하게 일정 — 12,000px을 내려가도 체감이 같다
    let cancelled = false;
    const stop = () => {
      cancelled = true;
    };
    window.addEventListener("wheel", stop, { once: true, passive: true });
    window.addEventListener("touchstart", stop, { once: true, passive: true });

    const step = (now: number) => {
      if (cancelled) return;
      const p = Math.min(1, (now - t0) / DURATION);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic — 빠르게 출발해 부드럽게 선다
      const to = targetY(); // ⭐매 프레임 다시 잰다
      window.scrollTo(0, from + (to - from) * eased);
      if (p < 1) requestAnimationFrame(step);
      else window.scrollTo(0, targetY()); // 마지막 한 번 더 — 끝나는 순간에도 로드될 수 있다
    };
    requestAnimationFrame(step);

    // 애니메이션이 끝났으면 리스너를 남기지 않는다(다음 스크롤을 삼키지 않게).
    window.setTimeout(() => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
    }, DURATION + 100);
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

      {/* ⭐**알약은 «하나»다** — 안에서 두 영역으로 나뉜다(대표 지시 08-23: 「각각 떠 있으니 어색하다」).
          왼쪽 = 댓글로 내려가기 / 오른쪽 = 하트. 가운데 세로선이 경계를 말한다.
          📏실측: 하트 쪽 138px + 댓글 쪽 최대 150px + 경계선 = 375px 화면(가용 343px) 안에 들어간다. */}
      <div className="pointer-events-auto flex h-12 items-stretch overflow-hidden rounded-pill border-[0.5px] border-[#DFDFE3] bg-surface shadow-e2">
        {/* 댓글 영역 — 댓글 섹션이 보이면 폭이 0으로 접히고, 알약은 하트만 남은 크기로 «미끄러진다» */}
        <a
          href="#comments"
          onClick={goComments}
          aria-hidden={atComments}
          tabIndex={atComments ? -1 : 0}
          className={`inline-flex shrink-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[15px] font-medium text-ink transition-all duration-500 ease-in-out hover:bg-surface-soft motion-reduce:transition-none ${
            atComments ? "pointer-events-none max-w-0 px-0 opacity-0" : "max-w-[150px] px-5 opacity-100"
          }`}
        >
          <span>댓글 남기기</span>
        </a>

        {/* 경계선 — 댓글 영역이 접히면 같이 사라진다(선만 남으면 그게 더 어색하다) */}
        <span
          aria-hidden="true"
          className={`my-2 w-px shrink-0 bg-[#DFDFE3] transition-all duration-500 ease-in-out motion-reduce:transition-none ${
            atComments ? "opacity-0" : "opacity-100"
          }`}
        />

        <button
          type="button"
          onClick={onClick}
          aria-pressed={liked}
          className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap px-5 text-[15px] font-medium text-ink transition-colors hover:bg-surface-soft"
        >
          <span>잘 읽었어요</span>
          <svg viewBox="0 0 20 20"
            className={`h-[18px] w-[18px] shrink-0 transition-colors ${liked ? "text-red-500" : "text-ink"}`}
            aria-hidden="true"
            fill={liked ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7">
            <path d="M10 16.5S3.5 12.6 3.5 8.2A3.7 3.7 0 0 1 10 5.9a3.7 3.7 0 0 1 6.5 2.3c0 4.4-6.5 8.3-6.5 8.3Z"
              strokeLinejoin="round" />
          </svg>
        </button>
      </div>
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

          <p className="px-6 text-[20px] font-bold leading-snug text-balance break-keep text-ink">로그인이 필요해요</p>
          <p className="mt-2 text-[16px] leading-relaxed text-balance break-keep text-mute">
            로그인하고 이 글에 하트를 남겨보세요.
          </p>
          <div className="mt-5 flex gap-2">
            <button
              type="button"
              onClick={() => setNeedLogin(false)}
              className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
            >
              취소
            </button>
            <a
              href={`/login?redirect=${encodeURIComponent(`/magazine/${slug}`)}`}
              onClick={markPending}
              className="flex h-11 flex-1 items-center justify-center rounded-md bg-primary text-[14px] font-medium text-primary-on"
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
