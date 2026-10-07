// 자동 만들기 브리프(요약 리포트)를 로컬에서 여는 길 (2026-10-04, 로컬 전용)
//
// 운영에선 브리프가 `brand_briefs` 표에 들어가고 `/brief/{slug}`가 그걸 읽는다. 로컬엔 그 표가 없어서
//   대기열 파일의 `brief`(마크다운 파일 경로)를 읽어 같은 화면에 그린다. 그래서 대표가 «고객이 받을 화면 그대로» 본다.
// 🔒개발 서버 + 대기열에서 만든 주소(`draft-XXXX`, XXXX = 신청 id 끝 4자)에서만 돈다.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

export async function localDraftBrief(
  slug: string,
): Promise<{ brandName: string; markdown: string; publishedAt: string } | null> {
  if (process.env.NODE_ENV !== "development") return null;
  const m = /^draft-([0-9a-z]{4})$/.exec(slug);
  if (!m) return null;
  let names: string[] = [];
  try {
    names = (await readdir(QUEUE_DIR)).filter((n) => n.endsWith(`-${m[1]}.json`));
  } catch {
    return null;
  }
  for (const n of names) {
    try {
      const r = JSON.parse(await readFile(path.join(QUEUE_DIR, n), "utf8"));
      if (!r.brief) continue;
      const markdown = await readFile(r.brief, "utf8");
      return { brandName: r.brandName, markdown, publishedAt: String(r.doneAt ?? r.createdAt ?? "").slice(0, 10) };
    } catch {}
  }
  return null;
}
