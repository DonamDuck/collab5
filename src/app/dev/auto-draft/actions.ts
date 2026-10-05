"use server";

// 자동 초안 → 로컬 «초안 소개서» 만들기 (2026-10-04, 로컬 전용)
//
// 대표 10-04: *「json sql 이런 거 말고, 로컬에 ui로 페이지 만들어 주면 좋겠다」*.
// ⭐아티팩트 검토 화면을 따로 만들지 않고 **진짜 소개서로** 만든다 — 새 흐름에서 고객이 받는 게 바로 그 화면이고,
//   삭제·순서 바꾸기·문구 수정은 이미 수정 화면에 있다. 같은 기능을 두 번 만들 이유가 없다.
// 🔒로컬 전용: 개발 서버 + InMemoryRepo(설정 없음)일 때만 돈다. 운영 DB에는 쓰지 않는다.
//   InMemoryRepo는 서버를 다시 켜면 비워지므로, 이 버튼은 몇 번을 눌러도 같은 결과(다시 만들기)가 나게 짰다.
// 🔑수정 비번 = LOCAL_DRAFT_PASSWORD. 로컬 가짜 로그인은 «보기 전용»이라 소유자로 수정할 수 없어서 비번으로 연다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { repo } from "@/lib/repo";
import { sha256 } from "@/lib/hash";
import type { Activity, CollabHistory, CollabType } from "@/lib/types";
import { LOCAL_DRAFT_PASSWORD, type AutoDraftRequest } from "@/lib/autoDraft";
import { deliverDraft } from "@/lib/autoDraftDeliver";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

type DraftItem = { title?: string; partner?: string; types?: string[]; desc: string; year?: string; link?: string };
type DraftFile = {
  oneLiner: string;
  description: string;
  story?: string;
  keywords?: string[];
  offers_description?: string;
  seeks_description?: string;
  activities: DraftItem[];
  collab_history: DraftItem[];
};

export async function loadDraftAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development" || process.env.SUPABASE_URL) {
    throw new Error("로컬 개발 서버(InMemoryRepo)에서만 쓸 수 있어요.");
  }
  const id = String(formData.get("id") ?? "").replace(/[^0-9a-z-]/gi, "");
  const req = JSON.parse(await readFile(path.join(QUEUE_DIR, `${id}.json`), "utf8")) as AutoDraftRequest & { draft?: string };
  if (!req.draft) throw new Error("이 신청에는 아직 초안 파일이 없어요.");
  const d = JSON.parse(await readFile(req.draft, "utf8")) as DraftFile;
  // 사진(선택) — 규칙대로 고른 결과. 파일은 public/_auto-draft/ 아래에 두고 주소만 적는다(운영 스토리지 안 씀).
  // 모양: { profile: string[], activities: string[][], collabs: string[][] } — 순서 = 초안 항목 순서
  let ph: { profile?: string[]; activities?: string[][]; collabs?: string[][] } = {};
  if ((req as { photos?: string }).photos) {
    try {
      ph = JSON.parse(await readFile((req as { photos?: string }).photos!, "utf8"));
    } catch {}
  }

  const activities: Activity[] = d.activities.map((a, i) => ({
    title: a.title ?? "",
    desc: a.desc,
    photos: ph.activities?.[i] ?? [],
    ...(a.link ? { link: a.link } : {}),
  }));
  const collabHistory: CollabHistory[] = d.collab_history.map((c, i) => ({
    partner: c.partner ?? "",
    types: c.types ?? [],
    desc: c.desc,
    ...(c.year ? { year: String(c.year) } : {}),
    photos: ph.collabs?.[i] ?? [],
    ...(c.link ? { link: c.link } : {}),
  }));
  const offers = Array.from(new Set(collabHistory.flatMap((c) => c.types))) as CollabType[];
  const slug = `draft-${id.slice(-4)}`;

  const content = {
    name: req.brandName,
    oneLiner: d.oneLiner,
    region: req.region || undefined,
    offers,
    seeks: [] as CollabType[],
    targetAudience: [],
    collabHistory,
    description: d.description,
    story: d.story ?? "",
    activities,
    offersDescription: d.offers_description ?? "",
    seeksDescription: d.seeks_description ?? "",
    photos: ph.profile ?? [],
    showcases: [],
    keywords: (d.keywords ?? []).slice(0, 10),
    trust: {
      instagram: req.channels.find((c) => c.kind === "instagram")?.url.replace("https://instagram.com/", ""),
      homepage: req.channels.find((c) => c.kind === "homepage")?.url,
    },
    searchVisible: false, // 초안은 비공개로 시작한다 — 고객이 훑어보고 공개한다
    collabPaused: false,
  };

  const existing = await repo.getMakerBySlug(slug);
  if (existing) await repo.updateMakerContent(slug, content);
  else await repo.createMaker({ slug, ...content, editPasswordHash: sha256(LOCAL_DRAFT_PASSWORD) });
  redirect(`/m/${slug}`);
}

/** 대표 승인(처음 REVIEW_FIRST 건, 대표 10-04) — 초안 소개서를 보고 누른다 → done + 고객 안내 메일.
 *  🔁10-05 브리프를 흐름에서 빼면서 «브리프가 있어야 승인» 조건도 뺐다. */
export async function approveAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("로컬 개발 서버에서만 쓸 수 있어요.");
  const id = String(formData.get("id") ?? "").replace(/[^0-9a-z-]/gi, "");
  const req = JSON.parse(await readFile(path.join(QUEUE_DIR, `${id}.json`), "utf8")) as AutoDraftRequest;
  if (req.status !== "review") throw new Error("승인 대기 중인 신청이 아니에요.");
  const h = await headers();
  await deliverDraft(id, { origin: `http://${h.get("host") ?? "localhost:3001"}`, approved: true });
  redirect("/dev/auto-draft");
}
