import { NextResponse } from "next/server";
import { runRentRemind } from "@/lib/rent-remind";
import { sendAdminDaily, type RemindRun } from "@/lib/rent-admin-daily";
import { reconcileLedger, sendLedgerAlert, type LedgerRun } from "@/lib/rent-ledger";
import { addDaysIso, todayKst } from "@/lib/rent-time";
import { sweepBookings, type SweepRun } from "@/lib/spaces";

// GET /api/cron/rent-remind — 하루 팝업 이용 전날 리마인드 (2026-09-17)
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

/** 🧹크론 한 번에 정리 작업이 토스에 되물을 최대 수(페이지를 열 때는 3건, `SWEEP_PAGE_TOSS_LOOKUPS`).
 *  한 건에 최대 10초라 토스가 느려도 여기서 크게 붙잡히지 않는다(한 번 답을 못 받으면 그 회차엔 더 안 묻는다). */
const CRON_TOSS_LOOKUPS = 50;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // 🧹09-27 D7 — 정리 작업을 «맨 먼저» 돌린다. 전엔 사람이 /rent/my·신청 내역·정산 화면을 열어야만 돌아서,
  //   아무도 안 연 날엔 만료·이용 완료·지급 대기가 안 넘어간 채로 아침 요약이 셌다(수락 대기·붙잡힌 돈 숫자가 어긋난다).
  //   페이지를 열 때 도는 것은 그대로 둔다. 조건절이 «지금 상태»를 보고, 결제 되묻기의 환불은 멱등키로 나가서 겹쳐 돌아도 된다.
  //   ⚠️Vercel 문서(09-27 확인): 크론은 가끔 같은 회차를 두 번 부르거나 한 회차를 빠뜨린다. 그래서 이 작업들이 멱등이어야 한다.
  let sweep: SweepRun | null = null;
  try {
    sweep = await sweepBookings({ tossLookups: CRON_TOSS_LOOKUPS });
  } catch (e) {
    console.error("[cron/rent-remind] 정리 작업 실패 — 리마인드·요약은 그대로 간다", e);
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
  // 📒09-27 D6 — 전날(KST) 토스 거래와 우리 장부를 맞대 본다. 알려 주기만 하고 고치지 않는다(`rent-ledger.ts`).
  //   어긋남이 있으면 슬랙 거래 알림 한 통, 결과는 아침 요약에 한 줄. 도중에 던지면 요약에 「멈췄어요」로 선다(null).
  const today = todayKst();
  let ledger: LedgerRun | null = null;
  try {
    ledger = await reconcileLedger(addDaysIso(today, -1));
    await sendLedgerAlert(ledger);
  } catch (e) {
    console.error("[cron/rent-remind] 장부 대조 실패 — 요약엔 멈췄다고 적는다", e);
  }
  const daily = await sendAdminDaily(remind, today, { ledger, sweep });
  return NextResponse.json({
    ...(remind ?? { remind: "failed" }), daily: daily.channel, counted: daily.counted, sweep: sweep ?? "failed",
    ledger: !ledger ? "failed" : ledger.ok ? { checked: ledger.checked, mismatches: ledger.mismatches.length, unchecked: ledger.unchecked } : { skipped: ledger.reason },
  });
}
