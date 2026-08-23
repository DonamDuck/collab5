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
  const [err, setErr] = useState("");
  const [needLogin, setNeedLogin] = useState(false);
  const taRef = useRef<HTMLTextAreaElement>(null);

  const loginDialog = useDismissable(needLogin, {
    onClose: () => setNeedLogin(false),
    overlayClose: false, // 얼럿은 딤 클릭으로 닫지 않는다(대표 정책 07-29) — 좋아요 바와 같다
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
    setBusy(false);
  };

  const remove = async (id: number) => {
    setErr("");
    const prev = comments;
    setComments((c) => c.filter((x) => x.id !== id)); // 낙관적
    const r = await deleteArticleCommentAction(id);
    if (r.error) { setComments(prev); setErr(r.error); } // 롤백
  };

  return (
    <section id="comments" className="mt-14 border-t border-hairline pt-8">
      <h2 className="text-[18px] font-bold text-ink">댓글</h2>

      {/* 목록 — 오래된 순(대화 흐름). 개수는 표시하지 않는다(대표 확정: 숫자는 나중에). */}
      {comments.length === 0 ? (
        <p className="mt-5 text-[15px] text-mute">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-5 flex flex-col gap-5">
          {comments.map((c) => (
            <li key={c.id} className="flex gap-3">
              {/* 로고·이름은 «쓸 때 스냅샷»한 값이다 — 그 뒤 브랜드명이 바뀌어도 이 댓글은 그대로다 */}
              {c.authorSlug ? (
                <a href={`/m/${c.authorSlug}`} className="shrink-0" aria-label={`${c.authorName} 소개서`}>
                  <Avatar image={c.authorImage} name={c.authorName} size={36} shape="square" />
                </a>
              ) : (
                <Avatar image={c.authorImage} name={c.authorName} size={36} shape="square" />
              )}
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-x-2 text-[14px]">
                  {/* ⛔소개서가 없으면 «평범한 글자»다 — 링크처럼 보이는데 안 눌리는 죽은 링크를 만들지 않는다 */}
                  {c.authorSlug ? (
                    <a href={`/m/${c.authorSlug}`} className="font-semibold text-ink underline underline-offset-2">
                      {c.authorName}
                    </a>
                  ) : (
                    <span className="font-semibold text-ink">{c.authorName}</span>
                  )}
                  <span className="text-faint">{when(c.createdAt)}</span>
                  {viewerUserId === c.userId && (
                    <button
                      type="button"
                      onClick={() => remove(c.id)}
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
