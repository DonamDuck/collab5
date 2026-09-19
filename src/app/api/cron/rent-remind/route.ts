import { NextResponse } from "next/server";
import { runRentRemind } from "@/lib/rent-remind";
import { sendAdminDaily, type RemindRun } from "@/lib/rent-admin-daily";

// GET /api/cron/rent-remind — 하루 가게 이용 전날 리마인드 (2026-09-17)
//
// ⏰Vercel Cron이 매일 00:00 UTC(= KST 09:00)에 부른다(`vercel.json`).
// 🔒Vercel Cron은 `CRON_SECRET` 환경변수가 있으면 `Authorization: Bearer <그 값>`을 실어 보낸다.
//   그 헤더가 아니면 401이다. ⚠️환경변수가 비어 있으면 누구도 통과하지 못하게 막는다 —
//   빈 값끼리 비교해 「Bearer 」 한 줄로 열리는 구멍을 두지 않는다.
export const dynamic = "force-dynamic";
// ⏱09-18 밤 QA(SC-09) — 60초로는 하루치가 안 끝날 수 있었다(한 통에 8초 제한이 붙어 있다).
//   Vercel 문서(09-18 확인, fluid compute 기본 켜짐): 최대 실행 시간은 Hobby 300초·Pro 800초, 기본값도 300초다.
//   그래서 300으로 올린다. ⚠️프로젝트에서 fluid compute가 꺼져 있으면 Hobby 상한이 60초라 배포가 막힌다 — 대표 확인용으로 보고서에 적었다.
export const maxDuration = 300;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // 📣09-19 대표 — 리마인드가 끝나면 대표에게 아침 요약 한 통(슬랙, 없으면 메일). 리마인드가 도중에 던져도 요약은 간다.
  //   그 한 통이 «크론이 돌았다»는 표시라서, 리마인드 실패도 요약 안에서 말한다(`remind: null`).
  let remind: RemindRun | null = null;
  try {
    const r = await runRentRemind();
    remind = { checked: r.checked, sent: r.sent, failed: r.failed, heldToday: r.heldToday, noMailKey: r.noMailKey };
  } catch (e) {
    console.error("[cron/rent-remind] 리마인드 실패 — 요약만 보낸다", e);
  }
  const daily = await sendAdminDaily(remind);
  return NextResponse.json({ ...(remind ?? { remind: "failed" }), daily: daily.channel, counted: daily.counted });
}
