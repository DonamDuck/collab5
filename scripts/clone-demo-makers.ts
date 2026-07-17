// 데모 소개서 동결 복제 스크립트 — 대표가 키 넣어 1회 실행 (재실행 안전·멱등).
// 실행: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/clone-demo-makers.ts
//
// 하는 일:
//  1. 원본 소개서 2종(m-ofjghi·m-ay6uve)을 조회
//  2. jsonb 안 사진 URL 전부(photos·activities[].photos·collab_history[].photos·blocks[].photos)를
//     "maker-photos" 버킷의 demo/<slug>/ 경로로 복사(동결) → 공개 URL로 교체
//     (원본 사진이 지워져도 데모는 깨지지 않음. storage upsert → 재실행 시 덮어쓰기, 고아 없음)
//  3. search_visible=false·collab_open=false·intro_file_url=null·slug 교체 후 upsert(onConflict: slug)
//     (로고는 profiles 소속 → URL 그대로 복사, 동결하지 않음)
import { createClient } from "@supabase/supabase-js";

const BUCKET = "maker-photos";
const PAIRS = [
  { from: "m-ofjghi", to: "m-demo-photo" },
  { from: "m-ay6uve", to: "m-demo-none" },
] as const;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 환경변수가 필요해요.");
  console.error("   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/clone-demo-makers.ts");
  process.exit(1);
}
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// src/lib/repo.ts MakerRow와 동일 컬럼 구조(스크립트 독립 실행용 사본).
// jsonb 필드는 사진 교체에 필요한 photos만 타입을 알고, 나머지 키는 그대로 통과시킨다.
interface PhotoHolder {
  photos?: string[] | null;
  [k: string]: unknown;
}
interface MakerRow {
  id: number; slug: string; name: string; one_liner: string;
  cover_image_url: string | null; logo_url: string | null;
  region: string | null; size: string | null;
  offers: string[]; seeks: string[]; target_audience: string[];
  collab_history: PhotoHolder[] | null;
  story: string; activities: PhotoHolder[] | null; offers_note: string; seeks_note: string;
  photos: string[] | null;
  blocks: PhotoHolder[] | null; intro_file_url: string | null;
  soul: unknown; trust: unknown;
  collab_open: boolean; search_visible: boolean | null; created_at: string; updated_at: string | null;
  owner_uuid: string | null; claim_token_hash: string | null;
}

// 공개 URL에서 받아 → demo/<slug>/ 에 upsert 업로드 → 새 공개 URL 반환.
async function freezeUrl(url: string, demoSlug: string, i: number, field: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url);
  } catch (e) {
    throw new Error(`[${demoSlug}] ${field} fetch 실패 (네트워크): ${url}\n   → ${e instanceof Error ? e.message : e}`);
  }
  if (!res.ok) throw new Error(`[${demoSlug}] ${field} fetch 실패 (HTTP ${res.status}): ${url}`);
  const ext = url.match(/\.\w+(?=\?|$)/)?.[0] ?? ".jpg";
  const path = `demo/${demoSlug}/${i}${ext}`;
  const { error } = await sb.storage.from(BUCKET).upload(path, await res.arrayBuffer(), {
    upsert: true, // 재실행 시 덮어쓰기 → 고아 파일 없음
    contentType: res.headers.get("content-type") ?? "image/jpeg",
  });
  if (error) throw new Error(`[${demoSlug}] ${field} 업로드 실패 (${path}): ${error.message}\n   → 원본: ${url}`);
  const publicUrl = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  console.log(`   📸 ${field} → ${path}`);
  return publicUrl;
}

// 문자열 배열의 URL 전부 동결. counter는 데모 slug 안에서 파일명(0,1,2…) 유일성 담보.
async function freezeList(urls: string[] | null | undefined, demoSlug: string, field: string, c: { n: number }): Promise<string[]> {
  const out: string[] = [];
  for (const url of urls ?? []) out.push(await freezeUrl(url, demoSlug, c.n++, field));
  return out;
}

// photos 배열을 품은 jsonb 항목들(activities·collab_history·blocks) 동결 — 나머지 키는 그대로.
async function freezeHolders(holders: PhotoHolder[] | null, demoSlug: string, field: string, c: { n: number }): Promise<PhotoHolder[]> {
  const out: PhotoHolder[] = [];
  for (const [idx, h] of (holders ?? []).entries()) {
    out.push({ ...h, photos: await freezeList(h.photos, demoSlug, `${field}[${idx}].photos`, c) });
  }
  return out;
}

async function cloneOne({ from, to }: { from: string; to: string }) {
  console.log(`\n▶ ${from} → ${to}`);

  const { data: src, error: selErr } = await sb.from("makers").select().eq("slug", from).maybeSingle();
  if (selErr) throw new Error(`[${to}] 원본(${from}) 조회 실패: ${selErr.message}`);
  if (!src) throw new Error(`[${to}] 원본 소개서(${from})가 없어요 — slug를 확인해 주세요.`);
  const row = src as MakerRow;

  // 멱등: 기존 데모 행이 있으면 그 id 재사용(upsert가 같은 행을 갱신), 없으면 DB가 새로 부여.
  const { data: existing, error: exErr } = await sb.from("makers").select("id").eq("slug", to).maybeSingle();
  if (exErr) throw new Error(`[${to}] 기존 데모 행 조회 실패: ${exErr.message}`);
  if (existing) console.log(`   ↻ 기존 데모 행(id=${existing.id}) 갱신`);

  const c = { n: 0 };
  const photos = await freezeList(row.photos, to, "photos", c);
  const activities = await freezeHolders(row.activities, to, "activities", c);
  const collab_history = await freezeHolders(row.collab_history, to, "collab_history", c);
  const blocks = await freezeHolders(row.blocks, to, "blocks", c);

  const demoRow: Record<string, unknown> = {
    ...(existing ? { id: existing.id } : {}), // id·created_at·updated_at은 신규면 DB 자동 부여
    slug: to,
    name: row.name,
    one_liner: row.one_liner,
    cover_image_url: row.cover_image_url,
    logo_url: row.logo_url, // 로고는 profiles 소속 — 동결하지 않고 URL 그대로
    region: row.region,
    size: row.size,
    offers: row.offers,
    seeks: row.seeks,
    target_audience: row.target_audience,
    collab_history,
    story: row.story,
    activities,
    offers_note: row.offers_note,
    seeks_note: row.seeks_note,
    photos,
    blocks,
    intro_file_url: null, // 소개자료 파일은 데모에서 제외
    soul: row.soul,
    trust: row.trust,
    collab_open: false, // 데모는 콜라보 제안 비활성
    search_visible: false, // 검색 미노출 (이미 배포된 필터가 처리)
    owner_uuid: row.owner_uuid,
    claim_token_hash: row.claim_token_hash,
  };

  const { error: upErr } = await sb.from("makers").upsert(demoRow, { onConflict: "slug" });
  if (upErr) throw new Error(`[${to}] upsert 실패: ${upErr.message}`);
  console.log(`✅ ${to} 저장 완료 — 사진 ${c.n}장 동결`);
}

async function main() {
  for (const pair of PAIRS) await cloneOne(pair);
  console.log("\n🎉 완료! 프로덕션에서 확인해 주세요:");
  console.log("   1) /m/m-demo-photo  (사진 표시 = URL 재작성 성공)");
  console.log("   2) /m/m-demo-none   (사진 0장 유지)");
  console.log("   + /preview 두 탭 표시, /search 에 데모 미노출");
}

main().catch((e) => {
  console.error(`\n❌ 실패: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
