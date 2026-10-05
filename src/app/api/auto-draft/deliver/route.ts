// POST /api/auto-draft/deliver {id} — 아침 발송 대기(review) 신청을 넘긴다 (2026-10-05, 로컬 전용)
// 부르는 쪽 = scripts/auto-draft/queue done. 상태 done + 고객 안내 메일(lib/autoDraftDeliver.ts).
// 🚨개발 빌드에서만 산다 — 인증 없는 쓰기 경로라 운영에선 404.
import { NextResponse } from "next/server";
import { deliverDraft } from "@/lib/autoDraftDeliver";

export async function POST(req: Request) {
  if (process.env.NODE_ENV !== "development") return new NextResponse(null, { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id가 필요해요." }, { status: 400 });
  try {
    return NextResponse.json(await deliverDraft(body.id, { origin: new URL(req.url).origin, approved: false }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
