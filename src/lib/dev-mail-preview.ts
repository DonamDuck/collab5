// 📨개발용 메일 미리보기 — 종류 이름으로 목 데이터 메일 한 통을 만든다 (2026-09-17 · 09-18 페이지로 옮김)
// ⭐`rent-notify.ts`·`notify.ts`의 `build*`를 그대로 부른다. 보내지 않는다. 실제 발송도 같은 `build*`를 거친다.
// 부르는 곳: 화면 미리보기 `app/dev/mail/[kind]/page.tsx`(코멘트 위젯이 붙는다) · 날것 `app/dev/rent-mail/[kind]/route.ts?raw=1`.
import {
  buildAdminRefund, buildBookingCancelled, buildBookingCancelledToGuest, buildBookingConfirmed,
  buildBookingConfirmedToHost, buildBookingPaid, buildBookingPaidToGuest, buildBookingRejected,
  buildRemindGuest, buildRemindHost, buildSpacePublished, buildSpaceReview, type Mail,
} from "@/lib/rent-notify";
import { buildWorld, MOCK_IDS, type MockWorld } from "@/lib/rent-mock-data";
import { buildSignupMail } from "@/lib/notify";


/** 공간 하나와 그 주인 — 검토 알림(대표에게 가는 메일) 미리보기용. */
function pickSpace(w: MockWorld, slug: string) {
  const sp = w.spaces.find((x) => x.slug === slug)!;
  const owner = w.profiles.find((p) => p.id === sp.ownerUserId) ?? null;
  return { sp, owner };
}

function pick(w: MockWorld, bookingId: number) {
  const b = w.bookings.find((x) => x.id === bookingId)!;
  const sp = w.spaces.find((x) => x.id === b.spaceId)!;
  const host = w.profiles.find((p) => p.id === sp.ownerUserId) ?? null;
  const guest = w.profiles.find((p) => p.id === b.guestUserId) ?? null;
  const brand = w.makers.find((m) => m.slug === b.guestBrandSlug);
  return { b, sp, host, guest, brand: brand ? { name: brand.name, slug: brand.slug } : undefined };
}

export function buildPreviewMail(kind: string): Mail | null {
  const full = buildWorld("full");
  const B = MOCK_IDS.booking;
  switch (kind) {
    case "paid-host": { const x = pick(full, B.paid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    case "paid-guest": { const x = pick(full, B.paid); return buildBookingPaidToGuest(x.b, x.sp, x.host, x.guest); }
    case "confirmed-guest": { const x = pick(full, B.confirmed); return buildBookingConfirmed(x.b, x.sp, x.host, x.guest); }
    case "confirmed-host": { const x = pick(full, B.confirmed); return buildBookingConfirmedToHost(x.b, x.sp, x.host, x.guest, true); }
    case "confirmed-host-noaccount": { const x = pick(full, B.confirmed); return buildBookingConfirmedToHost(x.b, x.sp, x.host, x.guest, false); }
    // 🫙옛 예약 — 성함·손님 번호·이메일이 다 빈 손님. 빈 칸 대신 서는 말(「손님」 칸·「연락처를 안 남기셨어요」)을 본다.
    case "confirmed-host-minimal": { const x = pick(buildWorld("minimal"), B.minimalConfirmed); return buildBookingConfirmedToHost(x.b, x.sp, x.host, x.guest, true); }
    // 거절 메일은 «거절한 순간» 모양이라 환불 실패로 남은 예약(rejected)을 그대로 쓴다.
    case "rejected-guest": { const x = pick(full, B.rejected); return buildBookingRejected(x.b, x.sp, x.host, x.guest); }
    case "cancelled-host": { const x = pick(full, B.cancelledFuture); return buildBookingCancelled(x.b, x.sp, x.host, x.guest); }
    case "cancelled-guest": { const x = pick(full, B.cancelledFuture); return buildBookingCancelledToGuest(x.b, x.sp, x.host, x.guest, Math.round(x.b.amountTotal * 0.7)); }
    case "cancelled-guest-sameday": { const x = pick(full, B.cancelledPast); return buildBookingCancelledToGuest(x.b, x.sp, x.host, x.guest, 0); }
    // 📨09-18 밤 QA SC-15 — 첫 문장이 갈리는 갈래 중 지도에 없던 둘. 손님 취소는 «전액»(결제 한 시간 안 · 7일 전까지),
    //   관리자 환불은 «일부»(결제 줄의 남은 돈이 낸 돈보다 적을 때) 문장이 따로 있다.
    case "cancelled-guest-full": { const x = pick(full, B.cancelledFuture); return buildBookingCancelledToGuest(x.b, x.sp, x.host, x.guest, x.b.amountTotal); }
    case "admin-refund-guest-partial": { const x = pick(full, B.refundReq); return buildAdminRefund({ ...x.b, status: "refunded" }, x.sp, x.host, x.guest, Math.round(x.b.amountTotal * 0.5))[0]; }
    case "admin-refund-guest": { const x = pick(full, B.refundReq); return buildAdminRefund({ ...x.b, status: "refunded" }, x.sp, x.host, x.guest, x.b.amountTotal)[0]; }
    case "admin-refund-host": { const x = pick(full, B.refundReq); return buildAdminRefund({ ...x.b, status: "refunded" }, x.sp, x.host, x.guest, x.b.amountTotal)[1]; }
    case "published": { const x = pick(full, B.paid); return buildSpacePublished(x.sp, x.host, false); }
    // 📨09-18 메일 전수 — 발송 경로(`publishSpaceAction`)는 계좌 유무를 둘 다 넘기는데 미리보기엔 «없을 때»만 있었다.
    case "published-account": { const x = pick(full, B.paid); return buildSpacePublished(x.sp, x.host, true); }
    // 🧾09-18 공간 검토 알림 → 대표. 받는 사람은 `ADMIN_EMAIL` 한 명이라 `to`가 비어 있다(가입 알림과 같다).
    //   ⚠️목 세계 객체는 캐시에 묶여 있어 고치지 않고 펼쳐서 새로 만든다.
    case "space-review-new": { const x = pickSpace(full, MOCK_IDS.space.pendingNoKey); return buildSpaceReview(x.sp, x.owner, null); }
    case "space-review-mismatch": { const x = pickSpace(full, MOCK_IDS.space.pending); return buildSpaceReview(x.sp, x.owner, null); }
    case "space-review-changed": {
      const x = pickSpace(full, MOCK_IDS.space.full);
      const now = {
        ...x.sp, status: "pending" as const, name: "느린오후 로스터리 2층 작업실", address: "서울 성동구 연무장길 00, 3층",
        // 이름·주소가 바뀌면 옛 네이버 매칭은 지운다(`saveSpaceAction`). 네이버 키가 없는 경우의 모양이다.
        placeName: "", placeAddress: "", placeLat: undefined, placeLng: undefined, placeMatchedAt: undefined,
      };
      return buildSpaceReview(now, x.owner, { name: x.sp.name, address: x.sp.address, status: x.sp.status });
    }
    case "remind-guest": { const x = pick(full, B.confirmed); return buildRemindGuest(x.b, x.sp, x.host, x.guest); }
    case "remind-host": { const x = pick(full, B.confirmed); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "remind-host-unaccepted": { const x = pick(full, B.paid); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "stress-paid-host": { const x = pick(buildWorld("stress"), B.stressPaid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    // 가입 알림은 받는 사람이 운영자 한 명이라 `to`를 비워 둔다(실제로는 `ADMIN_EMAIL`).
    case "signup-email": return { to: "", ...buildSignupMail({ userId: 9001, brandName: "느린오후", email: "slow.afternoon@example.com", origin: "email" }) };
    case "signup-kakao-noname": return { to: "", ...buildSignupMail({ userId: 9010, brandName: "", email: "new.member@example.com", origin: "kakao" }) };
    case "signup-google-long": return { to: "", ...buildSignupMail({ userId: null, brandName: "오래된 골목 끝집에서 매일 아침 여섯 시에 문을 여는 동네 사람들의 부엌 겸 작업실", email: "a.very.long.mailbox.name.for.layout.testing@subdomain.example.com", origin: "google" }) };
    default: return null;
  }
}

