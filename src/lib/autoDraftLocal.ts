// 자동 초안 → 로컬 «초안 소개서»(InMemoryRepo) 만들기 — 신청함 버튼과 아침 발송이 같이 쓴다 (2026-10-05 actions.ts에서 분리)
//
// 왜 분리했나: 로컬 서버를 다시 켜면 InMemoryRepo가 비워져 /m/draft-XXXX 가 사라진다. 아침 9시 메일의 링크가
//   빈 페이지로 가지 않도록, 넘기기 직전(deliverDraft)에 다시 만든다. 몇 번 불러도 같은 결과가 나게 짰다.
// 🔒로컬 전용: 개발 서버 + InMemoryRepo(설정 없음)일 때만 돈다. 운영 DB에는 쓰지 않는다.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { repo } from "./repo";
import { sha256 } from "./hash";
import type { Activity, CollabHistory, CollabType, DraftNotes } from "./types";
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

/** 신청 id → 소개서 내용·항목별 질문·사진 주소를 읽는다(파일만 읽는다 — 로컬 초안과 운영 올리기가 같이 쓴다, 10-08). */
export async function readDraftBundle(rawId: string) {
  const id = rawId.replace(/[^0-9a-z-]/gi, "");
  const req = JSON.parse(await readFile(path.join(QUEUE_DIR, `${id}.json`), "utf8")) as AutoDraftRequest & { draft?: string };
  if (!req.draft) throw new Error("이 신청에는 아직 초안 파일이 없어요.");
  const raw = JSON.parse(await readFile(req.draft, "utf8"));
  const d = raw as DraftFile;
  // 사진(선택) — 규칙대로 고른 결과. 파일은 public/_auto-draft/ 아래에 두고 주소만 적는다.
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
    searchVisible: false, // 로컬 초안은 비공개로 시작한다 — 고객이 훑어보고 공개한다(운영은 status='draft'가 맡는다)
    collabPaused: false,
  };
  const notes = attachNotes(
    raw.activities ?? [],
    raw.collab_history ?? [],
    Array.isArray(raw.open_questions) ? raw.open_questions : [],
  );
  return { id, req, content, notes };
}

/** 신청 id → 로컬 초안 소개서를 만들거나 덮어쓰고 slug를 돌려준다. */
export async function buildLocalDraft(rawId: string): Promise<string> {
  if (process.env.NODE_ENV !== "development" || process.env.SUPABASE_URL) {
    throw new Error("로컬 개발 서버(InMemoryRepo)에서만 쓸 수 있어요.");
  }
  const { id, content } = await readDraftBundle(rawId);
  const slug = `draft-${id.slice(-4)}`;
  const existing = await repo.getMakerBySlug(slug);
  if (existing) await repo.updateMakerContent(slug, content);
  else await repo.createMaker({ slug, ...content, editPasswordHash: sha256(LOCAL_DRAFT_PASSWORD) });
  return slug;
}

// ── 초안 페이지 상태 (2026-10-06 대표: 「완성형이 아니라 초안 페이지로 주고, 항목마다 질문을 남기고, 사장님이 마지막에 게시하기」) ──
// 로컬 시험판이라 «초안인지·게시됐는지»는 대기열 파일(publishedAt)이 들고, 질문은 초안 JSON에서 읽는다.
// 🔜운영판에선 brands에 «초안/게시» 상태 칸과 항목별 메모 칸이 따로 필요하다 — 지금의 searchVisible(콜라보 찾기에 보이기)은
//   이미 공개한 소개서도 끌 수 있는 값이라 «초안»과 섞으면 안 된다.

export type { DraftNotes } from "./types";
export type LocalDraftState = { id: string; publishedAt?: string; notes: DraftNotes };

type NoteItem = { title?: string; partner?: string; questions?: string[] };

/** 질문 문장을 항목에 붙인다. 항목별 questions가 있으면 그걸 쓰고(새 초안), 없으면 open_questions를
 *  «항목 이름이 문장에 그대로 나오는 경우에만» 그 항목에 붙인다(옛 초안). 어디에도 안 맞으면 전체 질문으로 둔다. */
function attachNotes(acts: NoteItem[], cols: NoteItem[], open: string[]): DraftNotes {
  const activities = acts.map((a) => [...(a.questions ?? [])]);
  const collabs = cols.map((c) => [...(c.questions ?? [])]);
  const general: string[] = [];
  const key = (s?: string) => (s ?? "").split(/\s*[·(（「」]\s*/)[0].trim();
  for (const q of open) {
    // 딱 «한 항목»만 가리킬 때만 그 항목에 붙인다 — 여러 항목을 묶어 묻는 문장은 전체 질문이다(10-06 QA)
    const ai = acts.flatMap((a, i) => (key(a.title).length >= 3 && q.includes(key(a.title)) ? [i] : []));
    const ci = cols.flatMap((c, i) => (key(c.partner).length >= 3 && q.includes(key(c.partner)) ? [i] : []));
    if (ai.length + ci.length !== 1) general.push(q);
    else if (ci.length) collabs[ci[0]].push(q);
    else activities[ai[0]].push(q);
  }
  return { general, activities, collabs };
}

/** `/m/draft-XXXX`가 대기열에서 만든 초안이면 그 상태를, 아니면 null. 운영 빌드에선 늘 null. */
export async function localDraftState(slug: string): Promise<LocalDraftState | null> {
  if (process.env.NODE_ENV !== "development") return null;
  const m = /^draft-([0-9a-z]{4})$/.exec(slug);
  if (!m) return null;
  const { readdir } = await import("node:fs/promises");
  let names: string[] = [];
  try {
    names = (await readdir(QUEUE_DIR)).filter((n) => n.endsWith(`-${m[1]}.json`));
  } catch {
    return null;
  }
  for (const n of names) {
    try {
      const r = JSON.parse(await readFile(path.join(QUEUE_DIR, n), "utf8"));
      if (!r.draft) continue;
      const d = JSON.parse(await readFile(r.draft, "utf8"));
      return {
        id: r.id,
        publishedAt: r.publishedAt,
        notes: attachNotes(d.activities ?? [], d.collab_history ?? [], Array.isArray(d.open_questions) ? d.open_questions : []),
      };
    } catch {}
  }
  return null;
}

/** `/m/draft-XXXX`에 들어왔는데 초안이 메모리에 없으면(서버 재시작·코드 새로 읽기) 대기열에서 다시 만든다.
 *  🩸10-06 QA: 코드를 고치자 초안 페이지가 404가 됐다 — 메일 링크로 온 사람도 똑같이 겪는다. 운영 빌드에선 아무것도 안 한다. */
export async function rebuildLocalDraftBySlug(slug: string): Promise<boolean> {
  if (process.env.NODE_ENV !== "development" || process.env.SUPABASE_URL) return false;
  const m = /^draft-([0-9a-z]{4})$/.exec(slug);
  if (!m) return false;
  const { readdir } = await import("node:fs/promises");
  try {
    const name = (await readdir(QUEUE_DIR)).find((n) => n.endsWith(`-${m[1]}.json`));
    if (!name) return false;
    const r = JSON.parse(await readFile(path.join(QUEUE_DIR, name), "utf8"));
    if (!r.draft) return false;
    await buildLocalDraft(r.id);
    if (r.publishedAt) await repo.setMakerFlags(slug, { searchVisible: true }); // 게시한 초안은 다시 만들어도 게시 상태로
    return true;
  } catch {
    return false;
  }
}
