"use server";

import { revalidatePath } from "next/cache";
import { repo } from "./repo";
import { isMagazineEditor } from "./magazine-auth";
import { sanitizeHttpUrl } from "./enrich";
import type { MagazineDoc, MagazineSaveInput, MagazineStatus } from "./types";

// 매거진 쓰기 서버 액션 (2026-08-10) — 스펙 = [[매거진-기능-개발지시]] §5
//
// 🚨**모든 함수가 첫 줄에서 권한을 검사한다.** 화면에서 버튼을 숨기는 건 UX일 뿐,
//   `/magazine/new`에 주소를 직접 치거나 액션을 직접 호출하는 경로는 늘 열려 있다.
//   08-06 소개서 편집에서 정확히 이 구멍이 났다(화면 분기를 건너뛰고 저장이 통과).

/** 제목 → 슬러그. 한글은 로마자로 못 바꾸므로, 한글만 있으면 날짜 기반으로 떨어진다. */
function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    // 한글은 URL에서 퍼센트 인코딩돼 길고 안 읽힌다 → 뺀다.
    .replace(/[가-힣]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  // ⚠️최소 길이 가드 — 한글 제목이면 base가 빈 문자열이 된다.
  //   소개서에서 같은 문제로 `/m/a` 같은 주소가 나온 적이 있다(07월 slug 가드).
  return base.length >= 3 ? base.slice(0, 60) : `article-${Date.now().toString(36)}`;
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

export type SaveResult = { ok: true; slug: string } | { ok: false; error: string };

export async function saveArticleAction(input: {
  slug?: string;          // 있으면 수정, 없으면 새 글
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

  // 새 글이면 슬러그를 만들고, 겹치면 뒤에 숫자를 붙인다.
  let slug = input.slug?.trim() || slugify(title);
  if (!input.slug) {
    let n = 2;
    while (await repo.articleSlugExists(slug)) slug = `${slugify(title)}-${n++}`;
  }

  const payload: MagazineSaveInput = {
    slug,
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
    body: sanitizeBody(input.body ?? {}),
  };

  try {
    await repo.saveArticle(payload);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "저장에 실패했어요." };
  }

  // 목록·상세 둘 다 비운다 — 발행했는데 목록에 안 뜨면 저장이 안 된 걸로 읽힌다.
  revalidatePath("/magazine");
  revalidatePath(`/magazine/${slug}`);
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
