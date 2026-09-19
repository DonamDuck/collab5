// 📨개발용 메일 미리보기 — 종류 이름으로 목 데이터 메일 한 통을 만든다 (2026-09-17 · 09-18 페이지로 옮김)
// ⭐`rent-notify.ts`·`notify.ts`의 `build*`를 그대로 부른다. 보내지 않는다. 실제 발송도 같은 `build*`를 거친다.
// 부르는 곳: 화면 미리보기 `app/dev/mail/[kind]/page.tsx`(코멘트 위젯이 붙는다) · 날것 `app/dev/rent-mail/[kind]/route.ts?raw=1`.
import {
  buildAdminDaily, buildAdminRefund, buildBookingCancelled, buildBookingCancelledToGuest, buildBookingConfirmed,
  buildBookingConfirmedToHost, buildBookingPaid, buildBookingPaidToGuest, buildBookingRejected, buildDealNotice,
  buildRefundRequestNotice, buildRemindGuest, buildRemindHost, buildSpaceFixRequest, buildSpacePublished, buildSpaceReviewNotice, type Mail,
} from "@/lib/rent-notify";
import { buildWorld, MOCK_IDS, type MockWorld } from "@/lib/rent-mock-data";
import { buildSignupNotice } from "@/lib/notify";
import { buildSlackPayload, type AdminNotice, type SlackPayload } from "@/lib/admin-notify";
import { summarizeDaily, type RemindRun } from "@/lib/rent-admin-daily";
import { addDaysIso, todayKst } from "@/lib/rent-time";
import { refundAmount } from "@/lib/rent-money";

/** 미리보기 한 건. 대표 알림(09-19)은 슬랙 글(`slack`)이 같이 온다 — 슬랙이 있으면 그게 가고, 없으면 메일이 간다.
 *  `slackOnly`는 거래 알림(09-19 오후)이다. 메일로 물러서지 않아서 화면이 메일 칸을 안 그린다. */
export type PreviewMail = Mail & { slack?: SlackPayload; slackOnly?: boolean };

/** 대표 알림 → 미리보기. 메일 칸은 «슬랙이 없을 때» 대표 메일로 가는 글이다(받는 사람은 `ADMIN_EMAIL`이라 비워 둔다). */
function admin(n: AdminNotice): PreviewMail {
  return {
    to: "", subject: n.mail?.subject ?? n.title, html: n.mail?.html ?? "", text: n.mail?.text ?? "",
    slack: buildSlackPayload(n), slackOnly: !!n.slackOnly,
  };
}

/** 🌅아침 요약 미리보기 — 목 세계 그대로 센다. 다만 목 결제는 전부 «이틀 전» 승인이라 「어제 결제」가 늘 0이 된다.
 *  그래서 살아 있는 예약(결제 완료·확정)의 결제만 승인 시각을 어제 오전 10시(KST)로 옮겨서 센다. 목 세계 자체는 안 고친다(캐시에 묶여 있다). */
function dailyPreview(w: MockWorld, remind: RemindRun | null): PreviewMail {
  const today = todayKst();
  const yesterday10 = `${addDaysIso(today, -1)}T01:00:00.000Z`;
  const live = new Set(w.bookings.filter((b) => b.status === "paid" || b.status === "confirmed").map((b) => b.orderId));
  const payments = w.payments.map((p) => (live.has(p.orderId) && p.approvedAt ? { ...p, approvedAt: yesterday10 } : p));
  // 🆕09-19 저녁 — 취소·환불된 예약도 «어제» 그 상태가 된 것으로 옮긴다(목 예약은 한 달 전 시각이라 「어제 취소·환불」이 늘 0이 된다).
  const bookings = w.bookings.map((b) => (b.status === "cancelled" || b.status === "refunded" ? { ...b, updatedAt: yesterday10 } : b));
  const summary = summarizeDaily({
    bookings, payments,
    spaceNames: new Map(w.spaces.map((sp) => [sp.id, sp.name])),
    // 🔁09-19 저녁 보완을 기다리는 곳(반려 시각 있음)은 검토 대기로 안 센다(`listSpacesForReview`와 같다).
    reviewPending: w.spaces.filter((sp) => sp.status === "pending" && !sp.reviewRejectedAt).length,
    reviewApproveOnly: w.spaces.filter((sp) => (sp.status === "open" || sp.status === "paused") && !!sp.bizCertPath && !sp.bizApprovedAt).length,
    remind,
  }, today);
  return admin(buildAdminDaily(summary, today, remind));
}


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

export function buildPreviewMail(kind: string): PreviewMail | null {
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
    // 📨09-18 밤 QA SC-15 — 첫 문장이 갈리는 갈래 중 지도에 없던 둘. 손님 취소는 «전액»(수락 전 · 수락 뒤 한 시간 안 · 7일 전까지),
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
    //   📣09-19부터 대표 알림은 슬랙이 먼저다. 미리보기에 슬랙 글과 «슬랙이 없을 때» 메일을 같이 띄운다.
    case "space-review-new": { const x = pickSpace(full, MOCK_IDS.space.pendingNoKey); return admin(buildSpaceReviewNotice(x.sp, x.owner, null)); }
    case "space-review-mismatch": { const x = pickSpace(full, MOCK_IDS.space.pending); return admin(buildSpaceReviewNotice(x.sp, x.owner, null)); }
    case "space-review-changed": {
      const x = pickSpace(full, MOCK_IDS.space.full);
      const now = {
        ...x.sp, status: "pending" as const, name: "느린오후 로스터리 2층 작업실", address: "서울 성동구 연무장길 00, 3층",
        // 이름·주소가 바뀌면 옛 네이버 매칭은 지운다(`saveSpaceAction`). 네이버 키가 없는 경우의 모양이다.
        placeName: "", placeAddress: "", placeLat: undefined, placeLng: undefined, placeMatchedAt: undefined,
      };
      return admin(buildSpaceReviewNotice(now, x.owner, { name: x.sp.name, address: x.sp.address, status: x.sp.status }));
    }
    // 🧾09-19 저녁 — 번호가 빈 공개 공간(S10)이 처음 채워 검토로 내려왔다. 이름·주소는 그대로다.
    case "space-review-bizfirst": {
      const x = pickSpace(full, MOCK_IDS.space.noBiz);
      const now = {
        ...x.sp, status: "pending" as const, bizNumber: "0000112347", bizOwnerName: "김느린", bizOpenDate: "20210315",
        bizCertPath: `${x.sp.ownerUserId}/00000000-0000-4000-8000-000000009112.jpg`, bizName: "느린오후 로스터리",
        bizCheckStatus: "valid" as const, bizCheckDetail: { valid: "01", bSttCd: "01", bStt: "계속사업자", taxType: "부가가치세 일반과세자" },
      };
      return admin(buildSpaceReviewNotice(now, x.owner, { name: x.sp.name, address: x.sp.address, status: x.sp.status, why: "biz-first" }));
    }
    // 🔁09-19 저녁 보완 요청 → 사장님 메일. 공개 중이던 공간(목록에서 내려감 + 예약 그대로) / 검토 대기 중이던 공간.
    case "space-fix-request": { const x = pickSpace(full, MOCK_IDS.space.needsFix); return buildSpaceFixRequest(x.sp, x.owner, x.sp.reviewNote ?? "", true); }
    case "space-fix-request-pending": { const x = pickSpace(full, MOCK_IDS.space.pendingNoKey); return buildSpaceFixRequest(x.sp, x.owner, "사업자등록증이 잘 안 보여요.\n휴대폰으로 밝은 곳에서 다시 찍어 올려 주세요.", false); }
    // 🔁보완해서 다시 보냄 → 대표 슬랙. 사유(부탁드린 내용)가 칸에 실린다.
    case "space-review-resubmit": {
      const x = pickSpace(full, MOCK_IDS.space.needsFix);
      const now = { ...x.sp, reviewRejectedAt: undefined, address: "서울 성동구 연무장길 00, 2층" };
      return admin(buildSpaceReviewNotice(now, x.owner, { name: x.sp.name, address: x.sp.address, status: "pending", why: "resubmit", fixNote: x.sp.reviewNote }));
    }
    case "remind-guest": { const x = pick(full, B.confirmed); return buildRemindGuest(x.b, x.sp, x.host, x.guest); }
    case "remind-host": { const x = pick(full, B.confirmed); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "remind-host-unaccepted": { const x = pick(full, B.paid); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "stress-paid-host": { const x = pick(buildWorld("stress"), B.stressPaid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    // ⏱09-19 30분 단위 예약 — 메일의 「언제」 줄(`bookingWhen`)이 「2시간 30분」으로 서는지 본다.
    case "paid-host-halfhour": { const x = pick(full, B.halfPaid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    // ☕09-19 무료 커피챗(대표 #93) — 같은 예약을 손님 쪽 메일로. 커피챗 칸이 「무료 커피챗도 함께 예약하셨어요」로 서는지 본다.
    case "paid-guest-freechat": { const x = pick(full, B.halfPaid); return buildBookingPaidToGuest(x.b, x.sp, x.host, x.guest); }
    case "confirmed-guest-halfhour": { const x = pick(full, B.halfConfirmed); return buildBookingConfirmed(x.b, x.sp, x.host, x.guest); }
    // 가입 알림은 받는 사람이 운영자 한 명이라 `to`를 비워 둔다(실제로는 슬랙, 없으면 `ADMIN_EMAIL`).
    case "signup-email": return admin(buildSignupNotice({ userId: 9001, brandName: "느린오후", email: "slow.afternoon@example.com", origin: "email" }));
    case "signup-kakao-noname": return admin(buildSignupNotice({ userId: 9010, brandName: "", email: "new.member@example.com", origin: "kakao" }));
    case "signup-google-long": return admin(buildSignupNotice({ userId: null, brandName: "오래된 골목 끝집에서 매일 아침 여섯 시에 문을 여는 동네 사람들의 부엌 겸 작업실", email: "a.very.long.mailbox.name.for.layout.testing@subdomain.example.com", origin: "google" }));
    // 📣09-19 대표 알림 새 셋 — 사장님 환불 신청 · 아침 요약(할 일 있음 / 조용한 날 / 크론이 넘어진 날).
    case "admin-refund-request": { const x = pick(full, B.refundReq); return admin(buildRefundRequestNotice(x.b, x.sp, x.host, x.b.refundRequestNote)); }
    case "admin-daily": return dailyPreview(full, { checked: 3, sent: 3, failed: 1, heldToday: 1, noMailKey: false });
    case "admin-daily-quiet": return dailyPreview(buildWorld("empty"), { checked: 0, sent: 0, failed: 0, heldToday: 0, noMailKey: false });
    case "admin-daily-trouble": return admin(buildAdminDaily(null, todayKst(), null));
    // 💸09-19 오후 대표 — 거래 알림(슬랙 전용). 금액은 액션이 토스에 보낸 값과 같은 셈으로 넣는다.
    case "admin-payment": { const x = pick(full, B.paid); return admin(buildDealNotice("paid", x.b, x.sp)); }
    case "admin-cancel": { const x = pick(full, B.cancelledFuture); return admin(buildDealNotice("guest-cancel", x.b, x.sp, refundAmount(x.b.amountTotal, 70))); }
    case "admin-cancel-full": { const x = pick(full, B.paid); return admin(buildDealNotice("guest-cancel", { ...x.b, status: "cancelled" }, x.sp, x.b.amountTotal)); }
    case "admin-cancel-sameday": { const x = pick(full, B.cancelledPast); return admin(buildDealNotice("guest-cancel", x.b, x.sp, 0)); }
    case "admin-reject": { const x = pick(full, B.refunded); return admin(buildDealNotice("host-reject", x.b, x.sp, x.b.amountTotal)); }
    case "admin-reject-failed": { const x = pick(full, B.rejected); return admin(buildDealNotice("host-reject-failed", x.b, x.sp)); }
    // 🆕09-19 저녁 — 결제 승인 직후 시간이 차서 자동 환불 · 그 환불마저 실패(손님 돈이 붙잡힘). 결제 직전의 신청(pending)을 쓴다.
    case "admin-auto-refund": { const x = pick(full, B.pending); return admin(buildDealNotice("auto-refund", { ...x.b, status: "cancelled" }, x.sp, x.b.amountTotal)); }
    case "admin-auto-refund-failed": { const x = pick(full, B.pending); return admin(buildDealNotice("auto-refund-failed", { ...x.b, status: "rejected" }, x.sp)); }
    case "admin-refund-approved": { const x = pick(full, B.refundReq); return admin(buildDealNotice("admin-refund", { ...x.b, status: "refunded" }, x.sp, x.b.amountTotal)); }
    default: return null;
  }
}

