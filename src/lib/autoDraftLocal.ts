// 자동 초안 → 로컬 «초안 소개서»(InMemoryRepo) 만들기 — 신청함 버튼과 아침 발송이 같이 쓴다 (2026-10-05 actions.ts에서 분리)
//
// 왜 분리했나: 로컬 서버를 다시 켜면 InMemoryRepo가 비워져 /m/draft-XXXX 가 사라진다. 아침 9시 메일의 링크가
//   빈 페이지로 가지 않도록, 넘기기 직전(deliverDraft)에 다시 만든다. 몇 번 불러도 같은 결과가 나게 짰다.
// 🔒로컬 전용: 개발 서버 + InMemoryRepo(설정 없음)일 때만 돈다. 운영 DB에는 쓰지 않는다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repo } from "./repo";
import { sha256 } from "./hash";
import type { Activity, CollabHistory, CollabType } from "./types";
import { LOCAL_DRAFT_PASSWORD, type AutoDraftRequest } from "./autoDraft";

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

/** 신청 id → 로컬 초안 소개서를 만들거나 덮어쓰고 slug를 돌려준다. */
export async function buildLocalDraft(rawId: string): Promise<string> {
  if (process.env.NODE_ENV !== "development" || process.env.SUPABASE_URL) {
    throw new Error("로컬 개발 서버(InMemoryRepo)에서만 쓸 수 있어요.");
  }
  const id = rawId.replace(/[^0-9a-z-]/gi, "");
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
  return slug;
}
