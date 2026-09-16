// 하루 가게 — 신청·수락·거절·취소 알림 (2026-09-14). 서버 전용.
//
// ⭐`notify.ts`와 같은 규율 하나: **알림이 본작업을 절대 막지 않는다.**
//   결제는 됐는데 메일이 안 나가서 손님에게 에러가 뜨면 최악이다. 그래서 이 파일의 함수는 throw하지 않고,
//   실패해도 콘솔에만 남기고 조용히 끝난다. 키가 없으면 스킵이고 에러가 아니다.
//
// 📮**시그니처는 채널을 모른다.** `notifyBookingPaid(booking, space, host, guest)`처럼 «사건과 당사자»만 받는다.
//   알림톡이 붙는 날 이 함수 안에 한 갈래를 더 두면 되고, 호출부(`rent-actions.ts`)는 한 줄도 안 바뀐다.
//
// 🔗링크 base는 `SITE_URL`이다. 로컬에서 찍히는 링크가 운영 주소인 건 의도한 것 — 메일은 어디서 보내든
//   받는 사람이 여는 곳은 하나다.
import { SITE_URL } from "./site";
import { bookingWhen, dateLabel } from "./rent-time";
import { accessHowLine, hostContactLine, withJosa } from "./rent-copy";
import type { Space, SpaceBooking } from "./types";
import type { Profile } from "./profiles";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** `notify.ts`와 같은 발신자. 도메인 인증 뒤 `NOTIFY_FROM` 하나만 바꾸면 둘 다 따라온다. */
const FROM = process.env.NOTIFY_FROM || "collab5 <onboarding@resend.dev>";

/** 상대 이름은 사용자 입력이라 `<`가 들어올 수 있다. HTML에 꽂기 전에 전부 거친다. */
function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function displayName(p: Profile | null, fallback: string): string {
  return p?.brandName?.trim() || fallback;
}

/** 본문 공통 틀 — 첫 문장 + 표 + 링크 버튼. 네 통이 같은 얼굴이어야 받는 사람이 「collab5 메일」로 알아본다. */
function layout(lead: string, rows: [string, string][], link: { href: string; label: string }, tail?: string): string {
  const tr = rows
    .filter(([, v]) => v.trim().length > 0)
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:4px 0;white-space:pre-line">${esc(v)}</td></tr>`,
    )
    .join("\n    ");
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">
  <p style="margin:0 0 16px">${esc(lead)}</p>
  <table style="border-collapse:collapse;font-size:15px">
    ${tr}
  </table>
  <p style="margin:20px 0 0"><a href="${esc(link.href)}" style="display:inline-block;padding:12px 20px;border-radius:12px;background:#98FF5C;color:#222;text-decoration:none;font-weight:500">${esc(link.label)}</a></p>
  ${tail ? `<p style="margin:16px 0 0;color:#666">${esc(tail)}</p>` : ""}
</div>`;
}

export interface MailResult {
  /** 실제로 나갔는가. 키 없음·수신자 없음·전송 실패 전부 false — 호출부는 무시해도 된다. */
  sent: boolean;
  subject: string;
  html: string;
  text: string;
}

/** 한 통 보내기. 대표(`ADMIN_EMAIL`)에게 같은 내용을 cc로 한 통 더 — 초기엔 대표가 모든 거래를 봐야 한다.
 *  ⚠️수신자가 비어 있으면(카카오 가입은 이메일이 없을 수 있다) 보낼 곳이 없으니 스킵. 에러가 아니다. */
async function send(to: string, subject: string, html: string, text: string): Promise<MailResult> {
  const out: MailResult = { sent: false, subject, html, text };
  const apiKey = process.env.RESEND_API_KEY;
  const admin = (process.env.ADMIN_EMAIL ?? "").trim();
  if (!apiKey) {
    console.info(`[rent-notify] 스킵(RESEND_API_KEY 없음) → ${to || "(수신자 없음)"} · ${subject}`);
    return out;
  }
  if (!to) {
    console.info(`[rent-notify] 스킵(수신자 이메일 없음) · ${subject}`);
    return out;
  }
  const cc = admin && admin.toLowerCase() !== to.toLowerCase() ? [admin] : undefined;
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], ...(cc ? { cc } : {}), subject, text, html }),
      // 메일 서버가 느려도 결제 응답을 오래 붙잡지 않는다.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[rent-notify] 발송 실패", res.status, subject, await res.text().catch(() => ""));
      return out;
    }
    out.sent = true;
    return out;
  } catch (e) {
    console.error("[rent-notify] 발송 예외", subject, e);
    return out;
  }
}

/** ① 결제 완료 → 사장님. 손님이 누구인지·언제·얼마인지와 답하러 갈 곳. */
export async function notifyBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const guestName = displayName(guest, "손님");
  const when = dateLabel(booking.useDate);
  const subject = `[collab5] ${withJosa(guestName, "이/가")} ${when} ${withJosa(space.name, "을/를")} 신청했어요 · ${won(booking.amountTotal)}`;
  const link = `${SITE_URL}/rent/my`;
  const rows: [string, string][] = [
    ["누가", guestName],
    ["언제", bookingWhen(booking)],
    ["어디", space.name],
    ["무엇을", booking.plan],
    // ☕사장님이 커피챗을 해 줘야 하는 신청인지 — 09-16까지 이 메일에 없었다.
    ["커피챗", booking.amountChat > 0 || booking.amountMentor > 0 ? "같이 신청했어요" : ""],
    ["받으실 돈", `${won(booking.amountPayout)} (손님이 낸 돈 ${won(booking.amountTotal)})`],
  ];
  const text = [
    `${withJosa(guestName, "이/가")} ${when} ${withJosa(space.name, "을/를")} 신청했어요.`,
    ...rows.map(([k, v]) => `${k}: ${v}`),
    ``,
    `답하러 가기: ${link}`,
    `거절하시면 손님께 전액 돌아가요.`,
  ].join("\n");
  const html = layout(
    `${withJosa(guestName, "이/가")} ${when} ${withJosa(space.name, "을/를")} 신청했어요. 결제는 이미 끝났어요.`,
    rows,
    { href: link, label: "받은 신청 보기" },
    "거절하시면 손님께 전액 돌아가요.",
  );
  return send(host?.email ?? "", subject, html, text);
}

/** ② 수락 → 손님. 주소·들어오는 법·사장님 연락처가 여기서 처음 열린다.
 *  🚨이 함수는 «확정된 뒤»에만 불러야 한다. 확정 전에 주소가 나가면 설계 §이탈의 구멍이 그대로 뚫린다. */
export async function notifyBookingConfirmed(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const hostName = displayName(host, "사장님");
  const when = dateLabel(booking.useDate);
  const subject = `[collab5] 확정됐어요 · ${when} ${space.name}`;
  const link = `${SITE_URL}/rent/done/${booking.id}`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const rows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    ["어디", space.name],
    ["주소", space.address],
    // 📨09-16 「들어오는 법」(옛 `accessNote`)에서 «안내 방식»으로. 비밀번호 같은 건 우리가 안 가진다.
    //   옛 공간은 그 글이 아직 남아 있어서 있으면 같이 보낸다.
    ["이용 안내", accessHowLine(space.accessHow)],
    ["들어오는 법", space.accessNote],
    ["사장님", `${hostName} · ${contact}`],
    ["사장님 말씀", booking.hostMessage],
  ];
  const text = [
    `${withJosa(hostName, "이/가")} 수락했어요. ${when} ${withJosa(space.name, "은/는")} 이제 확정이에요.`,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ``,
    `자세히 보기: ${link}`,
  ].join("\n");
  const html = layout(
    `${withJosa(hostName, "이/가")} 수락했어요. ${when} ${withJosa(space.name, "은/는")} 이제 확정이에요.`,
    rows,
    { href: link, label: "확정 내용 보기" },
    "가시기 전에 사장님께 한 번 연락해 두시면 그날이 편해요.",
  );
  return send(guest?.email ?? "", subject, html, text);
}

/** ③ 거절 → 손님. 전액 환불이라는 사실이 첫 문장에 있어야 한다. */
export async function notifyBookingRejected(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  void host;
  const when = dateLabel(booking.useDate);
  const subject = `[collab5] 이번엔 어렵대요 · ${when} ${space.name} · ${won(booking.amountTotal)} 전액 환불`;
  const link = `${SITE_URL}/rent`;
  const rows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    ["어디", space.name],
    ["환불", `${won(booking.amountTotal)} 전액 (카드사에 따라 며칠 걸릴 수 있어요)`],
    ["사장님 말씀", booking.hostMessage],
  ];
  const text = [
    `사장님이 이번엔 어렵다고 하셨어요. ${won(booking.amountTotal)}은 전액 돌려드려요.`,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ``,
    `다른 공간 보기: ${link}`,
  ].join("\n");
  const html = layout(
    `사장님이 이번엔 어렵다고 하셨어요. ${won(booking.amountTotal)}은 전액 돌려드려요.`,
    rows,
    { href: link, label: "다른 공간 보기" },
  );
  return send(guest?.email ?? "", subject, html, text);
}

/** ④ 손님 취소 → 사장님. 한 줄이면 된다. 그날이 다시 비는 날이 됐다는 것만. */
export async function notifyBookingCancelled(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const guestName = displayName(guest, "손님");
  const when = dateLabel(booking.useDate);
  const subject = `[collab5] ${withJosa(guestName, "이/가")} ${when} ${space.name} 신청을 취소했어요`;
  const link = `${SITE_URL}/rent/my`;
  const rows: [string, string][] = [["언제", bookingWhen(booking)], ["어디", space.name]];
  const text = [
    `${withJosa(guestName, "이/가")} ${when} ${space.name} 신청을 취소했어요. 그 시간은 다시 신청을 받을 수 있어요.`,
    ``,
    `내 하루 가게: ${link}`,
  ].join("\n");
  const html = layout(
    `${withJosa(guestName, "이/가")} ${when} ${space.name} 신청을 취소했어요. 그 시간은 다시 신청을 받을 수 있어요.`,
    rows,
    { href: link, label: "내 하루 가게 보기" },
  );
  return send(host?.email ?? "", subject, html, text);
}
