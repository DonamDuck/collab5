// 하루 가게 — 이용 전날 리마인드 (2026-09-17). 서버 전용. 부르는 곳은 `/api/cron/rent-remind` 하나다.
//
// ⏰Vercel Cron이 매일 00:00 UTC(= KST 09:00)에 부른다(`vercel.json`). 그 시각의 «내일»(KST)이 대상이다.
import { getProfileById } from "./profiles";
import { getSpaceFull, listBookingsToRemind, listSpacesByIds, markReminded } from "./spaces";
import { notifyRemindGuest, notifyRemindHost } from "./rent-notify";
import { todayKst } from "./rent-time";

/** `YYYY-MM-DD`에 n일을 더한다. 날짜 글자끼리만 계산한다 — 시각을 섞으면 KST/UTC가 다시 어긋난다. */
export function addDaysIso(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

export async function runRentRemind(today = todayKst()): Promise<{ date: string; checked: number; sent: number }> {
  const date = addDaysIso(today, 1);
  const list = await listBookingsToRemind(date);
  let sent = 0;
  // 공간 요약은 한 번에 읽는다. 원본(주소·가게 전화)은 slug로 한 번 더 — 같은 공간이면 한 번만.
  const briefs = await listSpacesByIds(list.map((b) => b.spaceId));
  const fullCache = new Map<string, Awaited<ReturnType<typeof getSpaceFull>>>();

  for (const b of list) {
    // 🔒표시를 «먼저» 한다(조건부: `reminded_at is null`인 행만). 작업이 겹쳐 두 번 돌아도
    //   먼저 적은 쪽만 참을 받아 보내고, 나머지는 여기서 건너뛴다. 보낸 뒤에 적으면 둘 다 보낸다.
    // ⚠️그래서 메일이 둘 다 실패해도 표시는 남는다. 의도한 것이다 — 실패를 이유로 표시를 안 하면
    //   메일 서버가 죽은 날 매 실행마다 같은 예약을 다시 잡아 재시도가 쌓인다. 리마인드는 «있으면 좋은» 알림이고
    //   예약·연락처는 결제 메일과 화면에 이미 있다. 실패는 로그로 남기고 다음으로 간다.
    if (!(await markReminded(b.id))) continue;
    try {
      const brief = briefs.get(b.spaceId);
      if (!brief) continue;
      if (!fullCache.has(brief.slug)) fullCache.set(brief.slug, await getSpaceFull(brief.slug));
      const space = fullCache.get(brief.slug);
      if (!space) continue;
      const [host, guest] = await Promise.all([getProfileById(space.ownerUserId), getProfileById(b.guestUserId)]);
      const [g, h] = await Promise.all([
        notifyRemindGuest(b, space, host, guest),
        notifyRemindHost(b, space, host, guest),
      ]);
      if (g.sent) sent++;
      if (h.sent) sent++;
    } catch (e) {
      console.error(`[rent-remind] 예약 ${b.id} 리마인드 실패(표시는 남김)`, e);
    }
  }
  return { date, checked: list.length, sent };
}
