// 자동 만들기 — 완성된 초안을 고객에게 «넘기는» 한 단계 (2026-10-05, 로컬 시험판)
//
// 넘긴다 = 상태 done + 고객 안내 메일. 두 길에서 부른다.
//   ① 대표가 신청함에서 [지금 보내기] → approveAction
//   ② 아침 9시 예약 작업: `queue morning` → /api/auto-draft/deliver
// ⭐메일이 실패해도 상태는 done으로 둔다(초안은 이미 있다). 대신 mailError를 남겨 신청함에 빨갛게 보인다 —
//   고객이 기다리는 메일이라 «조용히 실패»하면 안 된다.
// 🌐10-07: 운영에서 온 신청(source "prod")은 고객 대신 «대표에게» 넘긴다(notifyDraftHandoff).
//   운영엔 아직 비공개 초안 상태가 없어 고객에게 로컬 링크를 줄 수 없어서다. 대표가 고객 확인을 받고 운영에 올린다.
// 🔜운영판 2단계에선 여기서 초안을 고객 계정에 붙이고(owner_user_id), 주소는 운영 도메인이 된다.
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { notifyDraftHandoff, notifyDraftReady } from "./notify";
import { buildLocalDraft, localDraftState } from "./autoDraftLocal";
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
  // 로컬 서버를 다시 켜면 초안 페이지가 비워진다 → 링크가 빈 페이지로 가지 않게 보내기 직전에 다시 만든다
  const slug = await buildLocalDraft(safe);
  const base = (process.env.NEXT_PUBLIC_SITE_URL || opts.origin).replace(/\/$/, "");
  let r: { ok: true } | { ok: false; why: string };
  if (req.source === "prod") {
    // 🌐운영 신청 — 고객 대신 «대표에게» 알린다. 운영 초안 올리기·고객 메일은 대표가 신청함 버튼으로(autoDraftPush, 10-08).
    //   상태는 review 그대로 둔다(버튼이 거기서 보인다). 같은 초안으로 아침마다 다시 보내지 않게 handoffAt을 본다.
    if (req.handoffAt) return { mailed: false, why: "이미 대표에게 알렸어요" };
    const origin = opts.origin.replace(/\/$/, ""); // 대표 컴퓨터에서만 열리는 주소 — 운영 도메인(NEXT_PUBLIC_SITE_URL)을 쓰면 안 된다
    const state = await localDraftState(slug);
    const n = state?.notes;
    const questions = n ? n.general.length + [...n.activities, ...n.collabs].reduce((k, q) => k + q.length, 0) : 0;
    const h = await notifyDraftHandoff({
      brandName: req.brandName,
      url: `${origin}/m/${slug}`,
      inboxUrl: `${origin}/dev/auto-draft`,
      customerEmail: req.email,
      accountEmail: req.account?.email ?? "",
      questions,
    });
    const at = kstIso(new Date());
    await writeFile(f, JSON.stringify({ ...req, ...(h.ok ? { handoffAt: at } : { mailError: h.why }) }, null, 2), "utf8");
    return h.ok ? { mailed: true } : { mailed: false, why: h.why };
  } else {
    r = await notifyDraftReady({ to: req.email, brandName: req.brandName, url: `${base}/m/${slug}` });
  }
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
