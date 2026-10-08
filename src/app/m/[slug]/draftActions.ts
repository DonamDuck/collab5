"use server";

// [게시하기] — 초안 페이지를 공개로 바꾼다 (2026-10-06 로컬 시험판 · 10-08 운영).
// · 운영 = brands.status 'draft' → 'active'. 🔒**주인만** — 서버에서 세션 계정과 owner_user_id를 대조한다
//   (화면에서 버튼을 주인에게만 보여 줘도, 이 액션은 주소만 알면 누구나 부를 수 있다).
// · 로컬 시험판 = 대기열 파일에 publishedAt + «콜라보 찾기에 보이기» 켜기(가짜 로그인이라 주인 대조를 못 한다).
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { repo } from "@/lib/repo";
import { kstIso } from "@/lib/time";
import { getSessionUserId } from "@/lib/profiles";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

export async function publishDraftAction(formData: FormData) {
  const slug = String(formData.get("slug") ?? "");
  const draft = await repo.getDraftBySlug(slug);
  if (draft) {
    const uid = await getSessionUserId();
    if (!uid || draft.ownerUserId !== uid) throw new Error("이 초안을 신청하신 계정으로 로그인해 주세요.");
    if (!(await repo.publishDraft(slug))) throw new Error("게시하지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    redirect(`/m/${slug}?published=1`);
  }
  if (process.env.NODE_ENV !== "development") throw new Error("초안을 찾지 못했어요.");
  const m = /^draft-([0-9a-z]{4})$/.exec(slug);
  if (!m) throw new Error("초안 주소가 아니에요.");
  const name = (await readdir(QUEUE_DIR)).find((n) => n.endsWith(`-${m[1]}.json`));
  if (!name) throw new Error("신청을 찾지 못했어요.");
  const f = path.join(QUEUE_DIR, name);
  const r = JSON.parse(await readFile(f, "utf8"));
  await writeFile(f, JSON.stringify({ ...r, publishedAt: kstIso(new Date()) }, null, 2), "utf8");
  await repo.setMakerFlags(slug, { searchVisible: true });
  redirect(`/m/${slug}?published=1`);
}
