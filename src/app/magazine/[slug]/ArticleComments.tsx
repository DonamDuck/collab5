"use client";

// 매거진 댓글 (2026-08-23) — 설계 = docs/superpowers/specs/2026-08-23-magazine-comments-design.md
//
// ⭐**이름은 브랜드명이고, 소개서가 있으면 그 소개서로 링크된다.**
//   네이버·브런치·인스타 어디에도 없는 동선이다 — 그들에겐 브랜드 페이지가 없다.
//   마스킹은 폐기됐다(개인 이름 필드가 없고, 마스킹은 익명 대중의 장치지 서로 아는 사이의 장치가 아니다).
//
// ⭐로그인 유도는 `ArticleLikeBar`와 **같은 계약**이다 — 같은 얼럿, 같은 sessionStorage 재개.
//   ⚠️단 **자동 등록은 하지 않는다.** 좋아요는 되돌릴 수 있는 사적 행동이지만
//     댓글은 되돌릴 수 없는 «공개 발언»이라, 돌아오면 쓰던 글을 복원해 두고 등록은 본인이 누른다.
//     (이 차이를 지우고 좋아요와 똑같이 맞추면 안 된다.)
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ArticleComment } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { useDismissable } from "@/components/useDismissable";
import {
  addArticleCommentAction,
  deleteArticleCommentAction,
  listArticleCommentsAction,
} from "@/lib/magazine-actions";
// ⚠️상한은 «서버 액션 파일이 아니라» limits.ts에서 가져온다 — 이유는 그 파일 주석 참조("use server" 규칙).
import { COMMENT_MAX } from "@/lib/limits";

/** 로그인하러 떠나기 직전 "이 글에 이런 댓글을 쓰던 참이었다"를 남긴다.
 *  ⚠️`sessionStorage` — 탭을 닫으면 사라지는 게 맞다. 며칠 뒤의 초안이 되살아나면 그건 지금 마음이 아니다. */
const DRAFT_KEY = "collab5:pendingArticleComment";
/** 한 번에 보여줄 댓글 수. 「댓글 더보기」를 누르면 이만큼씩 늘어난다. */
const PAGE = 5;

/** 「2일 전」 — 7일이 넘으면 「8월 15일」. 시간대는 KST. */
function when(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금";
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  if (day <= 7) return `${day}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", {
    month: "long", day: "numeric", timeZone: "Asia/Seoul",
  });
}

export function ArticleComments({
  articleId,
  slug,
  initialComments,
  loggedIn,
  viewerUserId,
}: {
  articleId: number;
  slug: string;
  initialComments: ArticleComment[];
  loggedIn: boolean;
  viewerUserId?: number;
}) {
  const [comments, setComments] = useState(initialComments);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  // 한 번에 보여줄 개수 — 5개씩 늘린다(대표 지시 08-23).
  const [shown, setShown] = useState(PAGE);
  const [err, setErr] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  // 지울 댓글 id — ⭐**삭제는 되돌릴 수 없다.** 확인 없이 지우면 손이 미끄러진 게 곧 사고다.
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const loginDialog = useDismissable(needLogin, {
    onClose: () => setNeedLogin(false),
    overlayClose: false, // 얼럿은 딤 클릭으로 닫지 않는다(대표 정책 07-29) — 좋아요 바와 같다
  });
  const confirmDialog = useDismissable(confirmId !== null, {
    onClose: () => setConfirmId(null),
    overlayClose: false,
  });

  const refresh = useCallback(async () => {
    const r = await listArticleCommentsAction(articleId);
    setComments(r.comments);
  }, [articleId]);

  // 로그인하고 돌아왔으면 쓰던 글을 되살린다. ⛔등록은 하지 않는다(위 주석 참조).
  useEffect(() => {
    if (!loggedIn) return;
    let saved: string | null = null;
    try {
      saved = sessionStorage.getItem(DRAFT_KEY);
    } catch {
      return; // 프라이빗 모드 등 — 못 읽으면 그냥 다시 쓰면 된다
    }
    if (!saved) return;
    try {
      const d = JSON.parse(saved) as { articleId: number; text: string };
      if (d.articleId === articleId && d.text) {
        setText(d.text);
        taRef.current?.focus();
      }
    } catch {
      /* 깨진 값이면 버린다 */
    }
    try { sessionStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
  }, [loggedIn, articleId]);

  const markPending = () => {
    try {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ articleId, text }));
    } catch { /* 실패해도 무해 — 돌아와서 다시 쓰면 된다 */ }
  };

  const submit = async () => {
    if (busy) return; // ⭐등록은 «멱등이 아니다» — 연타하면 같은 글이 두 번 올라간다. 여기선 막는 게 맞다.
    setErr("");
    const body = text.trim();
    if (!body) { setErr("내용을 입력해주세요."); return; }
    setBusy(true);
    const r = await addArticleCommentAction(articleId, body);
    if (r.error) { setErr(r.error); setBusy(false); return; }
    setText("");
    await refresh();
    // 🪤내가 방금 쓴 댓글이 6번째면 «접힌 자리»에 들어가 안 보인다 — 그만큼 열어 준다.
    setShown((n) => n + 1);
    setBusy(false);
  };

  const remove = async (id: number) => {
    setErr("");
    setConfirmId(null);
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id)); // 낙관적
    const r = await deleteArticleCommentAction(id);
    if (r.error) { setComments(prev); setErr(r.error); } // 롤백
  };

  // 🔢`scroll-mt-[82px]` = 헤더 59.5(`SiteHeader`의 `h-14`) + 숨 쉴 틈 22.5.
  //   플로팅 [댓글 남기기]가 `href="#comments"`로 여기 오는데, 오프셋이 없으면
  //   **「댓글」 제목이 sticky 헤더 밑에 통째로 깔린다** — 섹션 top이 뷰포트 0에 붙고
  //   제목은 `pt-8`(34px) 아래라 60px 헤더에 완전히 가려서, 도착하면
  //   「첫 댓글을 남겨보세요」부터 보인다(08-24 대표 QA).
  // ⚠️rem 유틸(`scroll-mt-20`)을 쓰면 안 된다 — 루트 폰트가 17px이라 80이 아니라 85px이 된다.
  //   홈(`HomeBody`의 `scroll-mt-[152px]`)이 px를 박아 둔 것과 같은 이유다.
  return (
    <section id="comments" className="mt-14 scroll-mt-[82px] border-t border-hairline pt-8">
      <h2 className="text-[18px] font-bold text-ink">댓글</h2>

      {/* 목록 — 오래된 순(대화 흐름). 개수는 표시하지 않는다(대표 확정: 숫자는 나중에). */}
      {comments.length === 0 ? (
        <p className="mt-5 text-[15px] text-mute">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-5">
          {/* ⭐`slice`가 아니라 **CSS로 숨긴다**(저장소 관례) — 넘친 댓글도 문서에 남아
              인쇄·검색·브라우저 찾기(⌘F)에 걸린다. `hidden`이라 레이아웃 비용도 없다. */}
          {comments.map((c, i) => (
            <li key={c.id} className={`flex gap-3 ${i >= shown ? "hidden" : ""}`}>
              {/* 로고·이름은 «쓸 때 스냅샷»한 값이다 — 그 뒤 브랜드명이 바뀌어도 이 댓글은 그대로다 */}
              {/* 🔗`<a>` → `<Link>`(08-31, B27) — 여기만 앵커라 **새로고침으로 넘어가고 있었다.**
                  ⭐버는 것 둘 — ①문서 통째 재로딩이 사라진다(JS·CSS를 다시 안 받는다)
                    ②`<Link>`라서 **미리 받아두기(prefetch)도 붙는다.**
                  🩸이 주석의 초판은 *"프리페치는 어차피 안 된다"*고 적었는데 **틀린 실측이었다**
                    (탭이 `hidden`이라 브라우저가 프리페치를 안 한 것). 정정 경위 =
                    `magazine/[slug]/loading.tsx` 주석. */}
              {c.authorSlug ? (
                <Link href={`/m/${c.authorSlug}`} className="shrink-0" aria-label={`${c.authorName} 소개서`}>
                  <Avatar image={c.authorImage} name={c.authorName} size={36} shape="square" />
                </Link>
              ) : (
                <Avatar image={c.authorImage} name={c.authorName} size={36} shape="square" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
                  {/* ⛔소개서가 없으면 «평범한 글자»다 — 링크처럼 보이는데 안 눌리는 죽은 링크를 만들지 않는다 */}
                  {c.authorSlug ? (
                    <Link href={`/m/${c.authorSlug}`} className="font-semibold text-ink underline underline-offset-2">
                      {c.authorName}
                    </Link>
                  ) : (
                    <span className="font-semibold text-ink">{c.authorName}</span>
                  )}
                  <span className="text-faint">{when(c.createdAt)}</span>
                  {viewerUserId === c.userId && (
                    <button
                      type="button"
                      onClick={() => setConfirmId(c.id)}
                      className="ml-auto text-[13px] text-faint hover:text-ink"
                    >
                      삭제
                    </button>
                  )}
                </p>
                {/* 순수 텍스트로만 렌더한다(React 기본 이스케이프). 개행만 살린다. */}
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-body">
                  {c.body}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* 더보기 — 남은 게 있을 때만. ⛔개수는 안 쓴다(숫자는 나중에, 대표 08-23). */}
      {comments.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + PAGE)}
          className="mt-5 h-11 w-full rounded-md border border-hairline bg-surface-soft text-[14px] font-medium text-mute hover:text-ink"
        >
          댓글 더보기
        </button>
      )}

      {/* 입력 */}
      <div className="mt-8">
        {loggedIn ? (
          <>
            <textarea
              ref={taRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={COMMENT_MAX}
              rows={3}
              placeholder="댓글을 남겨보세요…"
              className="w-full resize-y rounded-md border border-border-strong bg-surface p-3 text-[15px] leading-relaxed text-ink placeholder:text-faint"
            />
            <div className="mt-2 flex items-center justify-end gap-3">
              {err && <p role="alert" className="mr-auto text-[13px] text-red-600">{err}</p>}
              <button
                type="button"
                onClick={submit}
                disabled={busy || !text.trim()}
                className="h-10 rounded-md bg-primary px-4 text-[14px] font-medium text-primary-on disabled:opacity-50"
              >
                {busy ? "남기는 중…" : "댓글 남기기"}
              </button>
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setNeedLogin(true)}
            className="h-11 w-full rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
          >
            로그인하고 댓글 남기기
          </button>
        )}
      </div>

      {/* 삭제 확인 — 로그인 얼럿과 «같은 껍데기»다. 뜻이 같은 창은 같은 모양이어야 한다.
          ⚠️확인 버튼만 빨강(`bg-red-600`) — 되돌릴 수 없는 동작이라 색으로도 말한다. */}
      {confirmId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:hidden" {...confirmDialog.overlayProps}>
          <div {...confirmDialog.panelProps} className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
            <p className="px-6 text-[20px] font-bold leading-snug text-balance break-keep text-ink">이 댓글을 지울까요?</p>
            <p className="mt-2 text-[16px] leading-relaxed text-balance break-keep text-mute">
              지운 댓글은 다시 볼 수 없어요.
            </p>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={() => setConfirmId(null)}
                className="h-11 flex-1 rounded-md border border-border-strong bg-surface text-[14px] font-medium text-ink"
              >
                취소
              </button>
              <button
                type="button"
                onClick={() => remove(confirmId)}
                className="h-11 flex-1 rounded-md bg-red-600 text-[14px] font-medium text-white"
              >
                삭제
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 비로그인 얼럿 — /m 소개서·좋아요 바와 «완전히 같은 껍데기» */}
      {needLogin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 print:hidden" {...loginDialog.overlayProps}>
          <div {...loginDialog.panelProps} className="relative w-full max-w-sm rounded-lg border border-hairline bg-surface p-6 text-center shadow-e2">
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
              로그인하고 이 글에 댓글을 남겨보세요.
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
                href={`/login?redirect=${encodeURIComponent(`/magazine/${slug}#comments`)}`}
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
    </section>
  );
}
