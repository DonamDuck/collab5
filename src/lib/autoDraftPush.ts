// 자동 만들기 — 로컬에서 만든 초안을 «운영에 비공개 초안으로 올리고» 고객에게 안내 메일을 보낸다 (2026-10-08, 2단계)
//
// 흐름: 밤(1·3·5시) 로컬에서 초안 → 아침 9시 대표에게 «준비됐어요» 메일 → 대표가 로컬 초안을 보고
//   신청함(/dev/auto-draft)에서 [운영에 올리고 안내 보내기] → 여기.
// 🔑**운영 DB에 쓰는 유일한 자동 만들기 경로**다. 그래서 «대표가 버튼을 누를 때만» 돈다 — 예약 작업은 부르지 않는다
//   (예약 작업은 운영 DB에 쓰지 않는다 — 10-05 규칙. 대표의 버튼 클릭이 곧 그 건의 「고고」다).
// 무엇을 쓰나: ①사진을 운영 스토리지(maker-photos/auto-draft/<신청id>/)에 올리고 ②brands에 status='draft'로 한 줄
//   (주인 = 신청한 계정, 질문 = draft_notes) ③고객에게 운영 주소로 안내 메일 ④로컬 대기열에 prodSlug를 남긴다.
// ⚠️운영 키는 1팀 작업트리 .env.local에서 읽는다(scripts/db/sql·queue pull과 같은 곳). 로컬 dev 서버엔 운영 키가 없다.
import { readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { readDraftBundle } from "./autoDraftLocal";
import { createSupabaseRepo } from "./repo";
import { notifyDraftReady } from "./notify";
import { kstIso } from "./time";
import type { AutoDraftRequest } from "./autoDraft";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");
const PROD_ENV = path.join(os.homedir(), "Desktop", "collab5", ".env.local");
const SITE = "https://collab5.co.kr";
const BUCKET = "maker-photos"; // actions.ts PHOTO_BUCKET과 같은 곳

async function prodCreds(): Promise<{ url: string; key: string }> {
  const env = await readFile(PROD_ENV, "utf8");
  const url = /^SUPABASE_URL=(\S+)/m.exec(env)?.[1];
  const key = /^SUPABASE_SERVICE_ROLE_KEY=(\S+)/m.exec(env)?.[1];
  if (!url || !key) throw new Error(`운영 키를 못 찾았어요(${PROD_ENV}).`);
  return { url, key };
}

const CONTENT_TYPE: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

export async function pushDraftToProd(rawId: string): Promise<{ slug: string; url: string; mailed: boolean; why?: string }> {
  if (process.env.NODE_ENV !== "development") throw new Error("로컬 개발 서버에서만 쓸 수 있어요.");
  const { id, req, content, notes } = await readDraftBundle(rawId);
  const r = req as AutoDraftRequest;
  if (r.source !== "prod") throw new Error("운영에서 온 신청만 운영에 올릴 수 있어요.");
  if (r.prodSlug) throw new Error(`이미 올렸어요: /m/${r.prodSlug}`);
  const ownerUserId = r.account?.userId;
  if (!ownerUserId) throw new Error("신청한 계정 번호가 없어요 — 초안을 누구에게 붙일지 몰라 올리지 않았어요.");

  const { url, key } = await prodCreds();
  const db = createClient(url, key, { auth: { persistSession: false } });

  // ① 사진 — 로컬 주소(/_auto-draft/…)만 올리고, 이미 http인 건 그대로 둔다. 같은 파일은 한 번만.
  const moved = new Map<string, string>();
  let n = 0;
  const up = async (u: string): Promise<string> => {
    if (!u.startsWith("/")) return u;
    const hit = moved.get(u);
    if (hit) return hit;
    const ext = (u.split(".").pop() ?? "jpg").toLowerCase();
    const bytes = await readFile(path.join(process.cwd(), "public", u));
    const objectPath = `auto-draft/${id}/${String(++n).padStart(3, "0")}.${ext}`;
    const { error } = await db.storage
      .from(BUCKET)
      .upload(objectPath, bytes, { contentType: CONTENT_TYPE[ext] ?? "application/octet-stream", upsert: true });
    if (error) throw new Error(`사진을 못 올렸어요(${u}): ${error.message}`);
    const pub = db.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
    moved.set(u, pub);
    return pub;
  };
  const ups = async (list: string[]) => {
    const out: string[] = [];
    for (const u of list) out.push(await up(u)); // 차례로 — 한꺼번에 쏘지 않는다
    return out;
  };
  const photos = await ups(content.photos);
  const activities = [];
  for (const a of content.activities) activities.push({ ...a, photos: await ups(a.photos ?? []) });
  const collabHistory = [];
  for (const c of content.collabHistory) collabHistory.push({ ...c, photos: await ups(c.photos ?? []) });

  // ② 주소 — 영문 이름이면 그대로, 한글 이름이면 m-xxxxxx(가입 폼의 slugify와 같은 규칙). 겹치면 다시 뽑는다.
  const base = r.brandName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  let slug = base.length >= 3 ? base : "";
  for (let i = 0; i < 6; i++) {
    if (!slug) slug = `m-${Math.random().toString(36).slice(2, 8)}`;
    const { data } = await db.from("brands").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = "";
  }
  if (!slug) throw new Error("겹치지 않는 주소를 못 만들었어요. 다시 눌러 주세요.");

  const repo = createSupabaseRepo(url, key);
  await repo.createMaker({
    slug,
    ...content,
    photos,
    activities,
    collabHistory,
    // 공개(게시) 뒤엔 다른 소개서처럼 «콜라보 찾기»에 뜬다. 초안인 동안은 status='draft'가 전부 가린다.
    searchVisible: true,
    ownerUserId,
    status: "draft",
    draftNotes: notes,
  });

  // ③ 고객 안내 — 운영 주소. 메일이 실패해도 초안은 이미 올라갔다(신청함에 빨갛게 남긴다).
  const link = `${SITE}/m/${slug}`;
  const m = await notifyDraftReady({ to: r.email, brandName: r.brandName, url: link });

  // ④ 로컬 대기열에 남긴다
  const f = path.join(QUEUE_DIR, `${id}.json`);
  const cur = JSON.parse(await readFile(f, "utf8")) as AutoDraftRequest;
  const now = kstIso(new Date());
  await writeFile(
    f,
    JSON.stringify(
      { ...cur, status: "done", prodSlug: slug, pushedAt: now, ...(m.ok ? { mailedAt: now, mailError: undefined } : { mailError: m.why }) },
      null,
      2,
    ),
    "utf8",
  );
  return m.ok ? { slug, url: link, mailed: true } : { slug, url: link, mailed: false, why: m.why };
}
