"use server";

import { revalidatePath } from "next/cache";
import { repo } from "./repo";
import { isMagazineEditor } from "./magazine-auth";
import { sanitizeHttpUrl } from "./enrich";
import { normalizeSlug, slugError, SLUG_MIN } from "./magazine-slug";
import type { MagazineDoc, MagazineSaveInput, MagazineStatus } from "./types";
import { COMMENT_MAX } from "./limits";

// 매거진 쓰기 서버 액션 (2026-08-10) — 스펙 = [[매거진-기능-개발지시]] §5
//
// 🚨**모든 함수가 첫 줄에서 권한을 검사한다.** 화면에서 버튼을 숨기는 건 UX일 뿐,
//   `/magazine/new`에 주소를 직접 치거나 액션을 직접 호출하는 경로는 늘 열려 있다.
//   08-06 소개서 편집에서 정확히 이 구멍이 났다(화면 분기를 건너뛰고 저장이 통과).

/** 제목 → 슬러그. 편집자가 주소 칸을 비워둔 새 글에서만 쓴다.
 *  ⚠️한글 제목이면 옮길 글자가 없어 `article-mf3k2p`로 떨어진다 — 그래서 폼에 주소 칸을 만들었다(08-13).
 *  자동 생성은 이제 **마지막 안전망**이지 기본 경로가 아니다. */
function slugify(title: string): string {
  const base = normalizeSlug(title);
  return base.length >= SLUG_MIN ? base : `article-${Date.now().toString(36)}`;
}

/** 본문 JSON 위생 — 링크 스킴만 검사한다.
 *  ⚠️구조 자체는 손대지 않는다. Tiptap이 만든 트리를 여기서 재단하면 에디터와 어긋나
 *  "저장하면 뭔가 사라지는" 고장이 된다. 위험한 건 실행 가능한 URL뿐이다. */
function sanitizeBody(doc: MagazineDoc): MagazineDoc {
  const walk = (n: Record<string, unknown>): Record<string, unknown> => {
    const node = { ...n };
    if (Array.isArray(node.marks)) {
      node.marks = (node.marks as { type: string; attrs?: { href?: string } }[])
        .map((m) => {
          if (m.type !== "link") return m;
          const href = sanitizeHttpUrl(m.attrs?.href);
          return href ? { ...m, attrs: { ...m.attrs, href } } : null;
        })
        .filter(Boolean);
    }
    if (Array.isArray(node.content)) {
      node.content = (node.content as Record<string, unknown>[]).map(walk);
    }
    return node;
  };
  return walk(doc as Record<string, unknown>) as MagazineDoc;
}

/** 🚨**빈 사진 검문** — 주소가 없는 image 노드는 "저장은 됐는데 사진만 사라진" 상태다.
 *  08-13에 실제로 이렇게 5장이 날아갔다(원인은 클라 직렬화, 정본 주석 = BodyEditor `toPlainDoc`).
 *  ⭐원인을 고쳤어도 이 검문은 남긴다 — **조용히 반쯤 저장되느니 저장을 멈추는 게 낫다.**
 *  사진은 다시 올리면 되지만, 사라진 걸 모른 채 덮어쓰면 되돌릴 방법이 없다. */
function countEmptyImages(doc: MagazineDoc): number {
  let n = 0;
  const walk = (node: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
    if (node?.type === "image" && !(typeof node.attrs?.src === "string" && node.attrs.src)) n++;
    for (const c of (node?.content ?? []) as typeof node[]) walk(c);
  };
  walk(doc as Parameters<typeof walk>[0]);
  return n;
}

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

export async function saveArticleAction(input: {
  slug?: string;          // 있으면 수정(= 고치기 전 주소), 없으면 새 글
  desiredSlug?: string;   // 편집자가 주소 칸에 적은 값. 비어 있으면 기존 주소 유지(새 글이면 제목에서 생성)
  status: MagazineStatus;
  title: string;
  subtitle?: string;
  editorName?: string;
  location?: string;
  coverImage?: string;
  summary?: string;
  factBox?: { label: string; value: string }[];
  brandLinks?: { slug: string; name: string; tagline: string }[];
  body: MagazineDoc;
}): Promise<SaveResult> {
  if (!(await isMagazineEditor())) return { ok: false, error: "권한이 없어요." };

  const title = input.title?.trim();
  if (!title) return { ok: false, error: "제목을 입력해주세요." };

  const body = sanitizeBody(input.body ?? {});
  const empty = countEmptyImages(body);
  if (empty > 0) {
    return {
      ok: false,
      error: `본문 사진 ${empty}장의 주소가 비어 있어 저장을 멈췄어요. 그대로 저장하면 사진이 사라집니다 — 사진을 다시 넣어주세요.`,
    };
  }

  // ── 주소 정하기 ─────────────────────────────────────────────
  // ⭐**편집자가 적은 게 있으면 그게 이긴다**(08-13 대표 지시). 비워두면 예전처럼 자동으로 만든다.
  const prevSlug = input.slug?.trim() || undefined;   // 있으면 수정
  const typed = normalizeSlug(input.desiredSlug ?? "");
  let slug: string;

  if (typed) {
    const bad = slugError(typed);
    if (bad) return { ok: false, error: bad };
    // 남이 이미 쓰는 주소인가. **자기 자신은 제외** — 안 그러면 주소를 안 바꾼 채 저장만 해도 막힌다.
    if (typed !== prevSlug && (await repo.articleSlugExists(typed))) {
      return { ok: false, error: `'${typed}'는 다른 글이 쓰고 있어요. 다른 주소로 적어주세요.` };
    }
    slug = typed;
  } else if (prevSlug) {
    slug = prevSlug;                                   // 수정인데 안 적었으면 그대로 둔다
  } else {
    slug = slugify(title);                             // 새 글 + 안 적음 → 제목에서
    let n = 2;
    while (await repo.articleSlugExists(slug)) slug = `${slugify(title)}-${n++}`;
  }

  const payload: MagazineSaveInput = {
    slug,
    prevSlug,
    status: input.status,
    title,
    subtitle: input.subtitle?.trim() ?? "",
    editorName: input.editorName?.trim() || "안톤",
    location: input.location?.trim() ?? "",
    coverImage: sanitizeHttpUrl(input.coverImage) ?? "",
    summary: input.summary?.trim() ?? "",
    // 빈 줄은 저장하지 않는다 — 폼에서 항목을 지웠다 만들었다 하면 빈 칸이 남는다.
    factBox: (input.factBox ?? []).filter((f) => f.label?.trim() || f.value?.trim()),
    brandLinks: (input.brandLinks ?? []).filter((b) => b.slug?.trim()),
    body,
  };

  try {
    await repo.saveArticle(payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했어요." };
  }

  // 목록·상세 둘 다 비운다 — 발행했는데 목록에 안 뜨면 저장이 안 된 걸로 읽힌다.
  revalidatePath("/magazine");
  revalidatePath(`/magazine/${slug}`);
  // 주소를 바꿨으면 **옛 주소도** 비운다 — 안 그러면 이미 없는 글이 캐시로 계속 열린다.
  if (prevSlug && prevSlug !== slug) revalidatePath(`/magazine/${prevSlug}`);
  return { ok: true, slug };
}

/** 연결 브랜드 slug → 이름·한 줄 자동 조회. 편집 화면에서 slug만 치면 나머지가 채워진다. */
export async function lookupBrandAction(
  slug: string
): Promise<{ name: string; tagline: string } | null> {
  if (!(await isMagazineEditor())) return null;
  const m = await repo.getMakerBySlug(slug.trim());
  return m ? { name: m.name, tagline: m.oneLiner ?? "" } : null;
}

/** 「잘 읽었어요 ❤️」 토글 — 로그인 필수. 찜(`setMakerSavedAction`)과 같은 계약이다.
 *
 *  ⭐돌려주는 값에 **최종 개수**를 실어 보낸다. 클라가 자기 숫자를 혼자 ±1 하면, 그 사이
 *    다른 사람이 누른 하트가 반영되지 않아 화면 숫자가 조용히 진실과 어긋난다.
 *    누른 사람은 즉시(낙관적) 보고, 서버 응답이 오면 그 숫자로 정정한다.
 *  ⚠️표(`magazine_likes`)가 아직 없으면 여기서 에러가 난다 — 대표가 SQL을 돌리기 전까진
 *    "잠시 후 다시" 문구가 뜨는 게 맞다(조용히 성공한 척하면 안 눌린 하트를 눌렸다고 말하게 된다). */
export async function setArticleLikedAction(
  articleId: number,
  liked: boolean
): Promise<{ error?: string; count?: number; liked?: boolean }> {
  const { getSessionUserId } = await import("./profiles");
  const userId = await getSessionUserId();
  if (!userId) return { error: "로그인이 필요해요." };
  try {
    await repo.setArticleLiked(userId, articleId, liked);
    return { count: await repo.countArticleLikes(articleId), liked };
  } catch {
    return { error: "잠시 후 다시 시도해주세요." };
  }
}

// ── 매거진 댓글 (2026-08-23) — 설계 = docs/superpowers/specs/2026-08-23-magazine-comments-design.md ──
//
// ⭐**표시 이름은 브랜드명이고, 소개서가 «정확히 1개»일 때만 그 소개서로 링크된다.**
//   마스킹은 폐기됐다 — 개인 이름 필드가 없어서 「캔버스가든」이 「캔**」이 되기 때문이고,
//   무엇보다 마스킹은 익명 대중(네이버 뉴스)의 장치지 서로 아는 브랜드끼리의 장치가 아니다.

/** 같은 사람이 같은 글에 연속으로 다는 걸 막는 최소 간격(ms). 낙관적 반영이라 클라만으론 못 막는다. */
const COMMENT_COOLDOWN_MS = 10_000;

/** 저장 직전 본문 다듬기. ⚠️여기서 «내용»을 바꾸진 않는다 — 공백·개행만 정리한다. */
function tidyBody(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n") // 3줄 이상 연속 개행 → 2줄(도배 방지)
    .trim();
}

/** 댓글 남기기.
 *  ⭐작성자 이름·소개서·이미지를 **여기서 스냅샷해 넣는다**(클라가 보낸 값을 믿지 않는다).
 *  ⚠️표(`magazine_comments`)가 없으면 에러를 돌려준다 — 조용히 성공한 척하면
 *    "남겼는데 안 보인다"가 되고, 그건 안 남긴 것보다 나쁘다(좋아요와 같은 규칙). */
export async function addArticleCommentAction(
  articleId: number,
  body: string
): Promise<{ error?: string }> {
  const { getSessionUserId, getProfileById } = await import("./profiles");
  const userId = await getSessionUserId();
  if (!userId) return { error: "로그인이 필요해요." };

  const text = tidyBody(body ?? "");
  if (!text) return { error: "내용을 입력해주세요." };
  if (text.length > COMMENT_MAX) return { error: `${COMMENT_MAX}자까지 쓸 수 있어요.` };

  try {
    // 도배 방지 — 마지막 댓글로부터 10초.
    const last = await repo.lastCommentAt(articleId, userId);
    if (last && Date.now() - new Date(last).getTime() < COMMENT_COOLDOWN_MS) {
      return { error: "조금 뒤에 다시 남겨주세요." };
    }

    const profile = await getProfileById(userId);
    // 🔗소개서가 **정확히 1개**일 때만 링크를 건다. 0개(아직 안 만든 회원)나 2개 이상(대표 계정)이면
    //   이름이 «평범한 글자»가 된다 — 죽은 링크를 만들지 않는다(대표 확정 08-23).
    const mine = await repo.listMakersByOwner(userId);
    const authorSlug = mine.length === 1 ? mine[0].slug : undefined;

    await repo.addArticleComment({
      articleId,
      userId,
      authorName: profile?.brandName?.trim() || "이름 없음",
      authorSlug,
      authorImage: profile?.profileImage || undefined,
      body: text,
    });
    return {};
  } catch {
    return { error: "잠시 후 다시 시도해주세요." };
  }
}

/** 내 댓글 지우기. **소유 검사는 repo(=DB 쿼리 조건)에서** 한다 —
 *  남의 id를 넣어도 0행이 갱신되고 조용히 끝난다(존재 여부조차 알려주지 않는다). */
export async function deleteArticleCommentAction(
  commentId: number
): Promise<{ error?: string }> {
  const { getSessionUserId } = await import("./profiles");
  const userId = await getSessionUserId();
  if (!userId) return { error: "로그인이 필요해요." };
  try {
    await repo.deleteArticleComment(commentId, userId);
    return {};
  } catch {
    return { error: "잠시 후 다시 시도해주세요." };
  }
}

/** 댓글 목록 다시 읽기 — 등록·삭제 뒤 화면 갱신용.
 *  ⚠️`revalidatePath`를 쓰지 않는다: 아티클 본문은 그대로인데 페이지 전체를 무효화할 이유가 없고,
 *    댓글만 다시 그리는 편이 빠르다. */
export async function listArticleCommentsAction(articleId: number) {
  try {
    return { comments: await repo.listArticleComments(articleId) };
  } catch {
    return { comments: [], error: "댓글을 불러오지 못했어요." };
  }
}
