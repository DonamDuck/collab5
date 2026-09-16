import { NextResponse } from "next/server";
import { runRentRemind } from "@/lib/rent-remind";

// GET /api/cron/rent-remind — 하루 가게 이용 전날 리마인드 (2026-09-17)
//
// ⏰Vercel Cron이 매일 00:00 UTC(= KST 09:00)에 부른다(`vercel.json`).
// 🔒Vercel Cron은 `CRON_SECRET` 환경변수가 있으면 `Authorization: Bearer <그 값>`을 실어 보낸다.
//   그 헤더가 아니면 401이다. ⚠️환경변수가 비어 있으면 누구도 통과하지 못하게 막는다 —
//   빈 값끼리 비교해 「Bearer 」 한 줄로 열리는 구멍을 두지 않는다.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { checked, sent } = await runRentRemind();
  return NextResponse.json({ checked, sent });
}
