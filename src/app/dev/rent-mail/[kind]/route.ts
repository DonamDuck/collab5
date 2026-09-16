import { NextResponse, type NextRequest } from "next/server";
import {
  buildAdminRefund, buildBookingCancelled, buildBookingCancelledToGuest, buildBookingConfirmed,
  buildBookingConfirmedToHost, buildBookingPaid, buildBookingPaidToGuest, buildBookingRejected,
  buildRemindGuest, buildRemindHost, buildSpacePublished, type Mail,
} from "@/lib/rent-notify";
import { buildWorld, MOCK_IDS, type MockWorld } from "@/lib/rent-mock-data";

// 📨하루 가게 메일 미리보기 (2026-09-17) · 개발 빌드 전용
//
// ⭐`rent-notify.ts`의 `build*`를 목 데이터로 불러 **HTML을 그대로** 돌려준다. 보내지 않는다(`send`를 안 부른다).
//   실제 발송 함수(`notify*`)도 같은 `build*`를 거치므로 여기 보이는 글이 사장님·손님이 받는 글이다.
// `?raw=1`이면 머리(제목·받는 사람) 없이 메일 본문만. 운영에선 404.
// 종류 목록(`MOCK_MAIL_KINDS`)은 `rent-mock-data.ts`에 둔다. route 파일은 정해진 이름(GET 등)만 내보낼 수 있다.
const DEV = process.env.NODE_ENV === "development";

function pick(w: MockWorld, bookingId: number) {
  const b = w.bookings.find((x) => x.id === bookingId)!;
  const sp = w.spaces.find((x) => x.id === b.spaceId)!;
  const host = w.profiles.find((p) => p.id === sp.ownerUserId) ?? null;
  const guest = w.profiles.find((p) => p.id === b.guestUserId) ?? null;
  const brand = w.makers.find((m) => m.slug === b.guestBrandSlug);
  return { b, sp, host, guest, brand: brand ? { name: brand.name, slug: brand.slug } : undefined };
}

function build(kind: string): Mail | null {
  const full = buildWorld("full");
  const B = MOCK_IDS.booking;
  switch (kind) {
    case "paid-host": { const x = pick(full, B.paid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    case "paid-guest": { const x = pick(full, B.paid); return buildBookingPaidToGuest(x.b, x.sp, x.host, x.guest); }
    case "confirmed-guest": { const x = pick(full, B.confirmed); return buildBookingConfirmed(x.b, x.sp, x.host, x.guest); }
    case "confirmed-host": { const x = pick(full, B.confirmed); return buildBookingConfirmedToHost(x.b, x.sp, x.host, x.guest, true); }
    case "confirmed-host-noaccount": { const x = pick(full, B.confirmed); return buildBookingConfirmedToHost(x.b, x.sp, x.host, x.guest, false); }
    // 거절 메일은 «거절한 순간» 모양이라 환불 실패로 남은 예약(rejected)을 그대로 쓴다.
    case "rejected-guest": { const x = pick(full, B.rejected); return buildBookingRejected(x.b, x.sp, x.host, x.guest); }
    case "cancelled-host": { const x = pick(full, B.cancelledFuture); return buildBookingCancelled(x.b, x.sp, x.host, x.guest); }
    case "cancelled-guest": { const x = pick(full, B.cancelledFuture); return buildBookingCancelledToGuest(x.b, x.sp, x.host, x.guest, Math.round(x.b.amountTotal * 0.7)); }
    case "cancelled-guest-sameday": { const x = pick(full, B.cancelledPast); return buildBookingCancelledToGuest(x.b, x.sp, x.host, x.guest, 0); }
    case "admin-refund-guest": { const x = pick(full, B.refundReq); return buildAdminRefund({ ...x.b, status: "refunded" }, x.sp, x.host, x.guest, x.b.amountTotal)[0]; }
    case "admin-refund-host": { const x = pick(full, B.refundReq); return buildAdminRefund({ ...x.b, status: "refunded" }, x.sp, x.host, x.guest, x.b.amountTotal)[1]; }
    case "published": { const x = pick(full, B.paid); return buildSpacePublished(x.sp, x.host, false); }
    case "remind-guest": { const x = pick(full, B.confirmed); return buildRemindGuest(x.b, x.sp, x.host, x.guest); }
    case "remind-host": { const x = pick(full, B.confirmed); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "remind-host-unaccepted": { const x = pick(full, B.paid); return buildRemindHost(x.b, x.sp, x.host, x.guest); }
    case "stress-paid-host": { const x = pick(buildWorld("stress"), B.stressPaid); return buildBookingPaid(x.b, x.sp, x.host, x.guest, x.brand); }
    default: return null;
  }
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function GET(req: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  if (!DEV) return new NextResponse(null, { status: 404 });
  const { kind } = await params;
  const mail = build(kind);
  if (!mail) return new NextResponse(`모르는 메일이에요: ${kind}`, { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const html = req.nextUrl.searchParams.get("raw") === "1"
    ? mail.html
    : `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(mail.subject)}</title>
<body style="margin:0;background:#f4f4f5;font-family:-apple-system,sans-serif">
<div style="max-width:640px;margin:0 auto;padding:16px">
  <p style="margin:0 0 4px;font-size:13px;color:#888;word-break:break-all"><a href="/dev/rent-map#mail" style="color:#888">← 지도로</a> · 받는 사람 ${esc(mail.to || "(없음)")} · 보내지 않은 미리보기</p>
  <p style="margin:0 0 12px;font-size:16px;font-weight:600;color:#222">${esc(mail.subject)}</p>
  <div style="background:#fff;border-radius:12px;padding:20px">${mail.html}</div>
  <details style="margin-top:12px;font-size:13px;color:#555"><summary>글자만 받는 메일함에서 보이는 모양</summary><pre style="white-space:pre-wrap">${esc(mail.text)}</pre></details>
</div></body>`;
  return new NextResponse(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}
