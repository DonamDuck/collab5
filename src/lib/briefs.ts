import { createClient } from "@supabase/supabase-js";
import { BRIEFS, BRIEF_BY_SLUG, type BriefSample } from "./brief-samples/registry";

// 브리프 읽기 (2026-09-14) — 설계 `docs/superpowers/specs/2026-09-14-brief-page-design.md`
//
// ⭐**두 곳에서 온다.** `brand_briefs` 표가 먼저고, 없으면 코드 안 목록(`brief-samples/`)이다.
//   🔁이유 = **스키마 확장은 「DB 먼저 → 배포 나중」이 맞는 순서인데**(🔗[[schema-rename-checklist]])
//     두 손이 동시에 움직이는 일은 실제로는 잘 안 맞는다. 그래서 «어느 쪽이 먼저 와도» 화면이 산다.
//     표가 없으면 오늘과 똑같이 목록으로 그리고, 표가 생기면 표가 이긴다.
//   ⛔「표가 없으면 500」이 되면 배포 순서 한 번 틀렸다고 고객 문서 일곱 장이 통째로 죽는다.
//
// 🔑**누가 볼 수 있나 — 판정은 여기가 아니라 «화면»이 한다.** 이 파일은 읽어서 넘길 뿐이다.
//   `ownerUserId`가 있으면 그 사람만, 없으면 링크를 아는 사람까지(오늘과 같은 수준).

export interface Brief {
  slug: string;
  brandName: string;
  publishedAt: string;
  notionUrl: string;
  markdown: string;
  /** null = 아직 연결 전. 대표가 손으로 채운다(대표 확정 09-14). */
  ownerUserId: number | null;
}

const fromSample = (s: BriefSample): Brief => ({ ...s, ownerUserId: null });

function db() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/** 표가 아직 없을 때 나는 오류인가. 이때만 조용히 목록으로 떨어진다.
 *  ⚠️다른 오류(권한·네트워크)까지 삼키면 「왜 옛 내용이 보이지」를 영영 못 찾는다. */
function isMissingTable(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return err.code === "42P01" || /relation .*brand_briefs.* does not exist/i.test(err.message ?? "");
}

/** DB 한 줄 → Brief. `getBrief`와 `listBriefsByOwner`가 같은 모양을 쓴다. */
function toBrief(r: {
  markdown: string | null;
  notion_url: string | null;
  owner_user_id: number | null;
  published_at: string | null;
  brands: unknown;
}): Brief {
  const brand = r.brands as { slug: string; name: string };
  return {
    slug: brand.slug,
    brandName: brand.name,
    publishedAt: (r.published_at ?? "").slice(0, 10),
    notionUrl: r.notion_url ?? "",
    markdown: r.markdown ?? "",
    ownerUserId: r.owner_user_id ?? null,
  };
}

/** 주소 하나로 브리프 한 건. 없으면 null.
 *
 *  🩸**폴백 조건을 한 번 틀렸다** (09-14, 대조군이 잡았다). 처음엔 «행이 없으면» 목록으로 떨어지게
 *    썼는데, 그러면 표에서 `draft`로 내린 브리프가 **목록 때문에 계속 보인다.** 대표가 내려도 안 내려간다.
 *    ⭐고친 규칙 = **표가 «있으면» 표의 답이 최종이다.** 목록은 표가 «아직 없을 때»만 쓴다.
 *    🪤화면이 200을 주고 있어서 겉으론 멀쩡했다 — 한 줄을 draft로 내려 보고서야 알았다. */
export async function getBrief(slug: string): Promise<Brief | null> {
  const client = db();
  if (client) {
    const { data, error } = await client
      .from("brand_briefs")
      .select("markdown, notion_url, owner_user_id, published_at, brands!inner(slug, name)")
      .eq("brands.slug", slug)
      .eq("status", "published")
      .maybeSingle();
    if (error && !isMissingTable(error)) throw error;
    // 표가 «있는데» 못 찾았다 = 없거나 내려간 것이다. 목록으로 되살리지 않는다.
    if (!error) return data ? toBrief(data) : null;
  }
  const sample = BRIEF_BY_SLUG.get(slug);
  return sample ? fromSample(sample) : null;
}

/** 이 사람 것으로 «연결된» 브리프들. `/my`의 요약 보고서 절이 쓴다.
 *  ⚠️표가 없으면 빈 목록이다 — 연결이라는 개념 자체가 표에만 있어서, 목록으로 흉내 내면 거짓이 된다. */
export async function listBriefsByOwner(userId: number): Promise<Brief[]> {
  const client = db();
  if (!client) return [];
  const { data, error } = await client
    .from("brand_briefs")
    .select("markdown, notion_url, owner_user_id, published_at, brands!inner(slug, name)")
    .eq("owner_user_id", userId)
    .eq("status", "published")
    .order("published_at", { ascending: false });
  if (error) {
    if (isMissingTable(error)) return [];
    throw error;
  }
  return (data ?? []).map(toBrief);
}

/** 미리 만들어 둘 주소들. 표가 없던 시절의 일곱 건이 기준이라 **정적 생성은 목록이 맡는다.**
 *  ⚠️표에만 있는 브리프는 요청이 올 때 그려진다(`dynamicParams`를 열어 둔 이유). */
export function briefSlugsForPrerender(): string[] {
  return BRIEFS.map((b) => b.slug);
}
