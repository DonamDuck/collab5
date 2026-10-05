// 자동 만들기 — 완성된 초안을 고객에게 «넘기는» 한 단계 (2026-10-05, 로컬 시험판)
//
// 넘긴다 = 상태 done + 고객 안내 메일. 두 길에서 부른다.
//   ① 처음 REVIEW_FIRST 건: 신청함에서 대표가 [승인] → approveAction
//   ② 그 뒤: 대기열 스크립트 `queue done` → /api/auto-draft/deliver
// ⭐메일이 실패해도 상태는 done으로 둔다(초안은 이미 있다). 대신 mailError를 남겨 신청함에 빨갛게 보인다 —
//   고객이 기다리는 메일이라 «조용히 실패»하면 안 된다.
// 🔜운영판에선 여기서 초안을 고객 계정에 붙이고(owner_user_id), 주소는 운영 도메인이 된다.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { notifyDraftReady } from "./notify";
import { kstIso } from "./time";
import type { AutoDraftRequest } from "./autoDraft";

const QUEUE_DIR = path.join(process.cwd(), "_workspace", "auto-draft-queue");

export async function deliverDraft(
  id: string,
  opts: { origin: string; approved: boolean },
): Promise<{ mailed: boolean; why?: string }> {
  const safe = id.replace(/[^0-9a-z-]/gi, "");
  const f = path.join(QUEUE_DIR, `${safe}.json`);
  const req = JSON.parse(await readFile(f, "utf8")) as AutoDraftRequest & { slug?: string };
  const slug = req.slug || `draft-${safe.slice(-4)}`;
  const base = (process.env.NEXT_PUBLIC_SITE_URL || opts.origin).replace(/\/$/, "");
  const r = await notifyDraftReady({ to: req.email, brandName: req.brandName, url: `${base}/m/${slug}` });
  const now = kstIso(new Date());
  const next: AutoDraftRequest = {
    ...req,
    status: "done",
    ...(opts.approved ? { approvedAt: now } : {}),
    ...(r.ok ? { mailedAt: now, mailError: undefined } : { mailError: r.why }),
  };
  await writeFile(f, JSON.stringify(next, null, 2), "utf8");
  return r.ok ? { mailed: true } : { mailed: false, why: r.why };
}
