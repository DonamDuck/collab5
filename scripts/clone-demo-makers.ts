// 데모 소개서 동결 복제 스크립트 — 대표가 키 넣어 1회 실행 (재실행 안전·멱등).
// 실행: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/clone-demo-makers.ts
//
// 하는 일:
//  1. 원본 소개서(m-ofjghi 하나)를 조회 — 사진본·무사진본 둘 다 같은 원본에서 뜬다
//  2. jsonb 안 사진 URL 전부(photos·activities[].photos·collab_history[].photos·showcases[].photos)를
//     "maker-photos" 버킷의 demo/<slug>/ 경로로 복사(동결) → 공개 URL로 교체
//     (원본 사진이 지워져도 데모는 깨지지 않음. storage upsert → 재실행 시 덮어쓰기, 고아 없음)
//  3. search_visible=false·collab_open=false·intro_file_url=null·slug 교체 후 upsert(onConflict: slug)
//
// ⚠️07-25 DB 전면 개명 반영(07-28) — 이 스크립트만 옛 이름을 쓰다가 실행이 통째로 죽었다
//   ("Could not find the table 'public.makers'"). 대조표:
//     makers→brands · soul→keywords · blocks→showcases · owner_uuid→owner_user_id(정수)
//     offers_note→offers_description · seeks_note→seeks_description · claim_token_hash→edit_password_hash
//   그리고 status 컬럼이 생겼다 — **'active'로 안 넣으면 읽기 함수가 전부 걸러내 데모가 404가 된다.**
import { createClient } from "@supabase/supabase-js";

const BUCKET = "maker-photos";
// ⭐둘 다 같은 원본(m-ofjghi)에서 뜬다(대표 지시 07-28) — 예전엔 사진 없는 쪽을 다른 소개서
//   (m-ay6uve)에서 떠와서 "같은 브랜드의 사진 유/무 비교"가 아니라 그냥 다른 두 브랜드였다.
//   같은 내용을 놓고 "사진이 있으면 이렇고, 없어도 이 정도"를 보여주는 게 이 데모의 목적이다.
const PAIRS = [
  { from: "m-ofjghi", to: "m-demo-photo", stripPhotos: false },
  { from: "m-ofjghi", to: "m-demo-none", stripPhotos: true },
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
interface BrandRow {
  id: number; slug: string; name: string; one_liner: string;
  region: string | null;
  offers: string[]; seeks: string[]; target_audience: string[];
  collab_history: PhotoHolder[] | null;
  story: string; activities: PhotoHolder[] | null;
  offers_description: string | null; seeks_description: string | null;
  description: string | null;
  photos: string[] | null;
  showcases: PhotoHolder[] | null; intro_file_url: string | null;
  keywords: string[] | null; trust: unknown; enrichment: unknown;
  collab_open: boolean; search_visible: boolean | null; status: string | null;
  created_at: string; updated_at: string | null;
  owner_user_id: number | null; edit_password_hash: string | null;
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

async function cloneOne({ from, to, stripPhotos }: { from: string; to: string; stripPhotos: boolean }) {
  console.log(`\n▶ ${from} → ${to}${stripPhotos ? " (사진 제거)" : ""}`);

  const { data: src, error: selErr } = await sb.from("brands").select().eq("slug", from).maybeSingle();
  if (selErr) throw new Error(`[${to}] 원본(${from}) 조회 실패: ${selErr.message}`);
  if (!src) throw new Error(`[${to}] 원본 소개서(${from})가 없어요 — slug를 확인해 주세요.`);
  const row = src as BrandRow;

  // 멱등: 기존 데모 행이 있으면 그 id 재사용(upsert가 같은 행을 갱신), 없으면 DB가 새로 부여.
  const { data: existing, error: exErr } = await sb.from("brands").select("id").eq("slug", to).maybeSingle();
  if (exErr) throw new Error(`[${to}] 기존 데모 행 조회 실패: ${exErr.message}`);
  if (existing) console.log(`   ↻ 기존 데모 행(id=${existing.id}) 갱신 — slug 충돌로 update`);

  // 사진 제거본은 동결(다운로드·업로드)을 아예 건너뛴다 — 어차피 안 쓸 파일을 버킷에 쌓지 않게.
  //   ⚠️사진 '만' 지운다 — 글·활동·콜라보·블록 항목은 전부 그대로 남는다(사진 칸만 빈 배열).
  //   cover_image_url도 함께 비운다(상단 카드의 대표 사진이라 남기면 "사진 없는 소개서"가 안 된다).
  //   logo_url은 유지 — 로고는 사진이 아니라 계정 프로필 소속이다.
  const c = { n: 0 };
  const strip = (hs: PhotoHolder[] | null) => (hs ?? []).map((h) => ({ ...h, photos: [] }));
  const photos = stripPhotos ? [] : await freezeList(row.photos, to, "photos", c);
  const activities = stripPhotos ? strip(row.activities) : await freezeHolders(row.activities, to, "activities", c);
  const collab_history = stripPhotos
    ? strip(row.collab_history)
    : await freezeHolders(row.collab_history, to, "collab_history", c);
  const showcases = stripPhotos ? strip(row.showcases) : await freezeHolders(row.showcases, to, "showcases", c);

  const demoRow: Record<string, unknown> = {
    // ⚠️id는 절대 넘기지 않는다 — 07-25 개명 후 `GENERATED ALWAYS AS IDENTITY`라
    //   값을 주면 "cannot insert a non-DEFAULT value into column id"로 거부된다(대표 실행 실패).
    //   멱등성은 id 재사용이 아니라 onConflict:"slug"가 담당한다(slug UNIQUE) — 기존 행이 갱신된다.
    slug: to,
    name: row.name,
    one_liner: row.one_liner,
    region: row.region,
    offers: row.offers,
    seeks: row.seeks,
    target_audience: row.target_audience,
    collab_history,
    story: row.story,
    activities,
    offers_description: row.offers_description,
    seeks_description: row.seeks_description,
    description: row.description,
    photos,
    showcases,
    intro_file_url: null, // 소개자료 파일은 데모에서 제외
    keywords: row.keywords,
    trust: row.trust,
    enrichment: row.enrichment,
    collab_open: false, // 데모는 콜라보 제안 비활성
    search_visible: false, // 검색 미노출
    status: "active", // ⚠️필수 — 없으면 읽기 함수(status='active' 필터)가 걸러내 404가 된다
    owner_user_id: row.owner_user_id,
    edit_password_hash: row.edit_password_hash,
  };

  const { error: upErr } = await sb.from("brands").upsert(demoRow, { onConflict: "slug" });
  if (upErr) throw new Error(`[${to}] upsert 실패: ${upErr.message}`);
  console.log(stripPhotos ? `✅ ${to} 저장 완료 — 사진 0장(전부 제거)` : `✅ ${to} 저장 완료 — 사진 ${c.n}장 동결`);
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
