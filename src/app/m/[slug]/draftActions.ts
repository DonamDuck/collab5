"use server";

// [게시하기] — 초안 페이지(로컬 시험판)를 공개로 바꾼다 (2026-10-06, 대표 «사장님이 맨 마지막에 게시하기»).
// 대기열 파일에 publishedAt을 남기고, 소개서를 «콜라보 찾기에 보이기»로 켠다.
// 🔒로컬 전용. 🔜운영판에선 «초안 → 게시» 상태 칸을 따로 두고, 주인만 누를 수 있게 서버에서 막는다.
import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { repo } from "@/lib/repo";
import { kstIso } from "@/lib/time";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

export async function publishDraftAction(formData: FormData) {
  if (process.env.NODE_ENV !== "development") throw new Error("로컬 개발 서버에서만 쓸 수 있어요.");
  const slug = String(formData.get("slug") ?? "");
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
