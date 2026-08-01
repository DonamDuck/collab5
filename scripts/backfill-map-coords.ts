// 지도 좌표(trust.lat/lng) 백필 — 대표가 키 넣어 1회 실행 (재실행 안전·멱등).
// 실행: .env.local에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY 채운 뒤
//       npx tsx scripts/backfill-map-coords.ts
//       (좌표 안 바꾸고 몇 건이 채워질지만 보려면 뒤에 --dry-run 붙이기)
//
// 배경: 07-31 지도 핀 UI(trust.lat/lng)는 **그 뒤로 저장된 소개서에만** 자동으로 붙는다
//   (주소 자동 채움이 만든 mapUrl `?c=lng,lat,...`를 서버가 파싱). 그 전에 만들어졌거나
//   사장님이 place 링크(`/p/entry/place/{id}`, 좌표 없음)를 직접 붙여넣은 소개서는 좌표가 비어
//   지도 카드가 조용히 숨는다. 이 스크립트가 그 구멍을 메운다.
//
// 하는 일 (건마다 순서대로 시도, 먼저 되는 걸로 확정):
//  1. mapUrl에 이미 좌표가 있으면 파싱만 한다(콜 없음, 공짜) — 우리가 예전에 만든 링크가 이 형태.
//  2. 없으면 상호명으로 지역검색 재조회(동명이인 가드 포함, naver-local.ts와 동일 로직).
//  3. 그래도 못 찾으면 건너뛴다 — 잘못 채우느니 비워두는 게 맞다(자동 채움 원칙, 07-31).
//
// 대상 = mapUrl은 있는데 lat/lng가 없는 행만. 이미 좌표 있는 건 안 건드림(멱등).
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// .env.local을 직접 읽어 process.env에 채운다(이미 있는 값은 안 덮음) — 매번 긴 커맨드를
// 손으로 안 치고, 지금까지 다른 키(NAVER·GEMINI·NCP_MAP)를 넣던 것과 같은 자리에서 채우게 한다.
// ⚠️ `KEY=value` 형태만 읽는 얕은 파서다(따옴표·멀티라인 값은 없다고 가정 — 이 파일의 다른 값들과 동일 스타일).
function loadDotEnvLocal() {
  const path = new URL("../.env.local", import.meta.url);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].trim();
  }
}
loadDotEnvLocal();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌ SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY가 비어있어요.");
  console.error("   .env.local 맨 아래 '── Supabase 서비스키 ──' 항목에 값을 채우고 다시 실행해주세요.");
  console.error("   (Supabase 대시보드 → Project Settings → API → Project URL / service_role 키)");
  process.exit(1);
}
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;
const DRY = process.argv.includes("--dry-run");
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

type TrustJson = { address?: string; mapUrl?: string; lat?: number; lng?: number; [k: string]: unknown };
type Row = { id: number; slug: string; name: string; region: string | null; trust: TrustJson | null };

function parseLatLngFromMapUrl(url?: string): { lat: number; lng: number } | null {
  if (!url) return null;
  try {
    const c = new URL(url).searchParams.get("c");
    if (!c) return null;
    const [lngStr, latStr] = c.split(",");
    const lng = Number(lngStr);
    const lat = Number(latStr);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
    if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

function clean(s?: string): string {
  return (s ?? "").replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").trim();
}
function norm(s: string): string {
  return s.replace(/[\s·・.,'"()[\]-]/g, "").toLowerCase();
}

/** naver-local.ts의 lookupPlaceByName과 같은 가드(정확 일치 + 지역 필터 + 여러 곳이면 포기).
 *  스크립트를 앱 코드에서 import하지 않고 사본으로 두는 이유는 clone-demo-makers.ts와 동일 —
 *  독립 실행 스크립트는 Next.js 런타임 없이 tsx로 바로 돈다. */
async function lookupCoordsByName(
  name: string,
  regionHint: string | null
): Promise<{ lat: number; lng: number } | null> {
  if (!NAVER_ID || !NAVER_SECRET) return null;
  const q = name.trim();
  if (q.length < 2) return null;
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(q)}&display=5`;
  const res = await fetch(url, {
    headers: { "X-Naver-Client-Id": NAVER_ID, "X-Naver-Client-Secret": NAVER_SECRET },
  });
  if (!res.ok) return null;
  const items = ((await res.json()) as { items?: { title?: string; address?: string; roadAddress?: string; mapx?: string; mapy?: string }[] }).items ?? [];
  const target = norm(q);
  let hits = items.filter((it) => norm(clean(it.title)) === target);
  if (!hits.length) return null;
  if (regionHint && hits.length > 1) {
    const wantTop = regionHint.trim().split(/\s+/)[0];
    const narrowed = hits.filter((it) => `${clean(it.roadAddress)} ${clean(it.address)}`.includes(wantTop));
    if (narrowed.length) hits = narrowed;
  }
  if (hits.length !== 1) return null;
  const lng = Number(hits[0].mapx) / 1e7;
  const lat = Number(hits[0].mapy) / 1e7;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return null;
  if (lng < 124 || lng > 132 || lat < 33 || lat > 39) return null;
  return { lat, lng };
}

async function main() {
  const { data, error } = await sb
    .from("brands")
    .select("id, slug, name, region, trust")
    .eq("status", "active")
    .not("trust->>mapUrl", "is", null);
  if (error) throw error;
  const rows = (data ?? []) as Row[];
  const targets = rows.filter((r) => r.trust?.lat == null || r.trust?.lng == null);

  console.log(`전체 지도링크 보유: ${rows.length}건 / 좌표 없는 것: ${targets.length}건`);
  if (DRY) console.log("(--dry-run: 실제로 저장하지 않음)\n");

  let fromUrl = 0, fromLookup = 0, skipped = 0;
  for (const r of targets) {
    const t = r.trust ?? {};
    let ll = parseLatLngFromMapUrl(t.mapUrl);
    let via = "URL 파싱";
    if (!ll) {
      ll = await lookupCoordsByName(r.name, r.region);
      via = "재조회";
    }
    if (ll) via === "URL 파싱" ? fromUrl++ : fromLookup++;
    if (!ll) {
      skipped++;
      console.log(`  ⏭  ${r.slug} (${r.name}) — 좌표 못 찾음, 건너뜀`);
      continue;
    }
    console.log(`  ✅ ${r.slug} (${r.name}) — ${ll.lat.toFixed(6)}, ${ll.lng.toFixed(6)} [${via}]`);
    if (!DRY) {
      const { error: upErr } = await sb
        .from("brands")
        .update({ trust: { ...t, lat: ll.lat, lng: ll.lng } })
        .eq("id", r.id);
      if (upErr) console.error(`     ⚠️ 저장 실패: ${upErr.message}`);
    }
  }

  console.log(`\n완료 — URL 파싱: ${fromUrl} / 재조회: ${fromLookup} / 건너뜀: ${skipped}`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});
