// 하루 팝업 — 이용 전날 리마인드 (2026-09-17). 서버 전용. 부르는 곳은 `/api/cron/rent-remind` 하나다.
//
// ⏰Vercel Cron이 매일 00:00 UTC(= KST 09:00)에 부른다(`vercel.json`). 그 시각의 «내일»(KST)이 기본 대상이다.
//
// 🩸09-18 밤 QA(SC-09·H-33) — 빠지는 자리가 셋이었다.
//   ①**크론이 빠진 날.** 다음 날 09시엔 「내일」만 봐서 그날 쓰는 예약은 영영 못 받는다 → 대상을 «오늘·내일»로 넓혔다.
//   ②**당일 오전에 결제한 내일 예약.** 대표 판단 추천(늦게 결제한 예약엔 안 보냄)대로, 결제 승인 때 이용일이 내일 이하이면
//     그 자리에서 보냄 표시를 찍는다(`confirmBookingAction`). 방금 받은 결제 완료 메일에 같은 내용이 다 들어 있다.
//   ③**한 건씩 보내다 시간 제한에 걸리면 남은 예약이 통째로 빠졌다** → 다섯 건씩 묶어 보내고 라우트 제한을 300초로 올렸다.
//
// ⏭**「오늘」 제목은 아직이다.** 메일 문안(`rent-notify.ts`)이 「내일」로 박혀 있어서, 오늘 건을 지금 보내면 거짓말이 된다.
//   그래서 오늘 건은 «대상까지만» 세고 보내지 않는다(`heldToday`). 빌더에 날짜 인자가 붙으면 `TODAY_READY`만 켜면 나간다.
import { getProfileById } from "./profiles";
import { getSpaceFull, listBookingsToRemind, listSpacesByIds, markReminded } from "./spaces";
import { notifyRemindGuest, notifyRemindHost } from "./rent-notify";
import { addDaysIso, bookingStarted, nowHhmmKst, todayKst } from "./rent-time";
import type { Space, SpaceBooking } from "./types";

/** 한 번에 몇 건씩 보내나. 메일 한 통에 8초 제한이 걸려 있어 한 건씩 보내면 하루치가 시간 제한에 밀린다. */
const BATCH = 5;

/** ⏭메일 문안이 「오늘」을 말할 수 있게 되면 참으로. 그때부터 오늘 이용 예약에도 리마인드가 나간다. */
const TODAY_READY = false;

/** 보낼 대상을 오늘·내일로 가른다. **이미 시작한 예약은 뺀다** — 시작한 뒤의 「곧 만나요」는 늦은 말이다.
 *  순수 함수라 DB 없이 셀 수 있다(크론이 무엇을 보낼지 먼저 재 보는 자리). */
export function remindTargets(
  list: SpaceBooking[], today = todayKst(), now = nowHhmmKst(),
): { today: SpaceBooking[]; tomorrow: SpaceBooking[] } {
  const out: { today: SpaceBooking[]; tomorrow: SpaceBooking[] } = { today: [], tomorrow: [] };
  for (const b of list) {
    if (bookingStarted(b, today, now)) continue;
    (b.useDate === today ? out.today : out.tomorrow).push(b);
  }
  return out;
}

export async function runRentRemind(today = todayKst()): Promise<{
  date: string; checked: number; sent: number; heldToday: number;
  /** 🧮09-19 보내려다 실패한 통수(아침 요약이 대표에게 알린다). 받는 사람이 없거나 키가 없어 건너뛴 건 안 센다. */
  failed: number;
  /** `RESEND_API_KEY`가 없어 한 통도 못 보내는 날인가. */
  noMailKey: boolean;
}> {
  const tomorrow = addDaysIso(today, 1);
  const list = await listBookingsToRemind([today, tomorrow]);
  const targets = remindTargets(list, today);
  const send = TODAY_READY ? [...targets.today, ...targets.tomorrow] : targets.tomorrow;

  // 공간 요약은 한 번에 읽는다. 원본(주소·가게 전화)은 slug로 한 번 더 — 같은 공간이면 한 번만(약속을 담아 둔다).
  const briefs = await listSpacesByIds(send.map((b) => b.spaceId));
  const fullCache = new Map<string, Promise<Space | null>>();
  const full = (slug: string) => {
    const hit = fullCache.get(slug);
    if (hit) return hit;
    const p = getSpaceFull(slug);
    fullCache.set(slug, p);
    return p;
  };

  async function one(b: SpaceBooking): Promise<{ sent: number; failed: number }> {
    const none = { sent: 0, failed: 0 };
    // 🔒표시를 «먼저» 한다(조건부: `reminded_at is null`인 행만). 작업이 겹쳐 두 번 돌아도
    //   먼저 적은 쪽만 참을 받아 보내고, 나머지는 여기서 건너뛴다. 보낸 뒤에 적으면 둘 다 보낸다.
    // ⚠️그래서 메일이 둘 다 실패해도 표시는 남는다. 의도한 것이다 — 실패를 이유로 표시를 안 하면
    //   메일 서버가 죽은 날 매 실행마다 같은 예약을 다시 잡아 재시도가 쌓인다. 리마인드는 «있으면 좋은» 알림이고
    //   예약·연락처는 결제 메일과 화면에 이미 있다. 실패는 로그로 남기고 다음으로 간다.
    if (!(await markReminded(b.id))) return none;
    try {
      const brief = briefs.get(b.spaceId);
      if (!brief) return none;
      const space = await full(brief.slug);
      if (!space) return none;
      const [host, guest] = await Promise.all([getProfileById(space.ownerUserId), getProfileById(b.guestUserId)]);
      const both = await Promise.all([
        notifyRemindGuest(b, space, host, guest),
        notifyRemindHost(b, space, host, guest),
      ]);
      return {
        sent: both.filter((m) => m.sent).length,
        // 건너뛴 것(`skipped`)은 실패가 아니다. 이메일 없는 카카오 가입 손님이 있다.
        failed: both.filter((m) => !m.sent && !m.skipped).length,
      };
    } catch (e) {
      console.error(`[rent-remind] 예약 ${b.id} 리마인드 실패(표시는 남김)`, e);
      // 조회 단계에서 던졌다 — 두 통 다 못 나갔다.
      return { sent: 0, failed: 2 };
    }
  }

  let sent = 0;
  let failed = 0;
  for (let i = 0; i < send.length; i += BATCH) {
    const done = await Promise.all(send.slice(i, i + BATCH).map(one));
    sent += done.reduce((a, r) => a + r.sent, 0);
    failed += done.reduce((a, r) => a + r.failed, 0);
  }
  if (!TODAY_READY && targets.today.length > 0) {
    console.warn(`[rent-remind] 오늘(${today}) 쓰는 예약 ${targets.today.length}건은 「오늘」 문안이 준비되면 보낸다`);
  }
  return {
    date: tomorrow, checked: list.length, sent, heldToday: TODAY_READY ? 0 : targets.today.length,
    failed, noMailKey: !process.env.RESEND_API_KEY,
  };
}
