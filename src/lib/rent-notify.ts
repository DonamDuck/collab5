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
import { KAKAO_CHAT_URL, SITE_URL } from "./site";
import { bookingWhen, dateLabel } from "./rent-time";
import {
  accessHowLine, hostContactLine, withJosa, CONTACT_RULE_GUEST, CONTACT_RULE_HOST,
  BOOKING_HEADLINE, COFFEE_CHAT_WHEN_GUEST, COFFEE_CHAT_WHEN_HOST,
} from "./rent-copy";
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

/** 커피챗을 같이 샀는가. 새 칸(`amountChat`)과 옛 칸(`amountMentor`) 둘 중 하나라도 돈이 있으면 샀다. */
function boughtChat(b: SpaceBooking): boolean {
  return b.amountChat > 0 || b.amountMentor > 0;
}

/** 💳환불이 «언제» 들어오는지 — 메일 네 통이 이 한 줄만 쓴다(09-17 QA).
 *  🩸09-16까지 「카드사에 따라 며칠 걸릴 수 있어요」와 완료 화면의 「사흘에서 닷새」가 달랐고,
 *    계좌이체·간편결제는 카드사가 아닌데 카드사를 말했다. */
const REFUND_TIMING_LINE = "결제한 수단으로 3~5일 안에 돌아가요.";

/** 🔗공간 페이지 — 유의 사항·사진을 그날 아침 다시 보는 자리(09-17 QA: 결제 완료 메일에 링크가 없었다). */
function spaceLink(space: Space): string {
  return `${SITE_URL}/rent/${encodeURIComponent(space.slug)}`;
}

/** 취소·환불 규정 한 줄. 상세 페이지 «환불 규정» 절과 호스트 약관 제8조의 숫자 그대로다 — 바뀌면 셋 다. */
const CANCEL_POLICY_LINE =
  "신청하고 한 시간 안에 취소하시면 전액 돌려드려요. 그 뒤로는 7일 전까지 전액, 3일 전까지 70%, 1일 전까지 50%이고 당일은 환불이 없어요.";

/** ① 결제 완료 → 사장님. 손님이 누구인지·언제·얼마인지와 답하러 갈 곳.
 *  📇09-16 `guestBrand` — 손님이 신청 때 고른 소개서. 있으면 사장님이 누가 오는지 미리 볼 수 있게 링크를 단다. */
export async function notifyBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  guestBrand?: { name: string; slug: string },
): Promise<MailResult> {
  const guestName = displayName(guest, "손님");
  const when = dateLabel(booking.useDate);
  // 🔁09-16 대표 — 「신청했어요」 → 「예약이 들어왔어요」. 09-17 대표 결정 4로 한 번 더 — 사장님 쪽에 들어온 것은 «요청»,
  //   수락한 뒤가 «예약»이다. 제목 문장은 `BOOKING_HEADLINE.hostPaid` 한 벌을 쓴다.
  const subject = `[collab5] ${when} ${space.name} · ${BOOKING_HEADLINE.hostPaid} · ${won(booking.amountTotal)}`;
  const link = `${SITE_URL}/rent/my`;
  const brandLine = guestBrand?.slug
    ? `${guestBrand.name.trim() || guestName}\n${SITE_URL}/m/${encodeURIComponent(guestBrand.slug)}`
    : "";
  const rows: [string, string][] = [
    ["누가", guestName],
    ["소개서", brandLine],
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["무엇을", booking.plan],
    // ☕사장님이 커피챗을 해 줘야 하는 신청인지 — 09-16까지 이 메일에 없었다. 「언제」는 `rent-copy` 한 줄(대표 09-17).
    ["커피챗", boughtChat(booking) ? `손님이 커피챗도 함께 골랐어요. ${COFFEE_CHAT_WHEN_HOST}` : ""],
    ["받으실 돈", `${won(booking.amountPayout)} (손님이 낸 돈 ${won(booking.amountTotal)})`],
  ];
  // ❓«답해야 하나»를 첫 줄에서 말한다(09-17 QA). phase 1은 결제가 곧 예약이라 안 눌러도 예약은 산다.
  //   그 말이 없으면 사장님은 이 메일이 «답하라»는 건지 «알고만 있으라»는 건지 모른다.
  // 🧭09-17 대표 — 요청 확인 → 수락·거절 → 2일 안에 공간 안내. «답하지 않아도 된다»던 문장은 이 절차와 부딪혀 뺐다.
  const lead = `${BOOKING_HEADLINE.hostPaid}. 결제는 이미 끝났어요. 날짜와 손님이 적은 계획을 읽어 보시고 수락하거나 거절해 주세요. 수락하시면 손님 연락처가 열려요.`;
  const tail = `거절은 이용 시작 전까지 할 수 있고, 손님께 전액 돌아가요. ${CONTACT_RULE_HOST}`;
  const text = [
    lead,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/\n/g, " ")}`),
    ``,
    `들어온 요청 보기: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "들어온 요청 보기" }, tail);
  return send(host?.email ?? "", subject, html, text);
}

/** ①' 결제 완료 → 손님 (09-16 phase 1). 채팅이 없는 지금은 결제가 곧 예약 완료라, 손님이 알아야 할 것을 이 한 통에 다 담는다.
 *  사장님 연락처도 여기서 열린다 — 사장님 답을 기다리게 하지 않기로 했다(대표 09-16).
 *  🚨옛 「들어오는 법」(`space.accessNote`)은 넣지 않는다. 출입 비밀번호가 적혀 있을 수 있는 칸이다. */
export async function notifyBookingPaidToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const hostName = displayName(host, "사장님");
  const when = dateLabel(booking.useDate);
  // 🔁09-17 대표 결정 4 — 제목·첫 줄은 `BOOKING_HEADLINE.guestPaid`. 첫 문장이 「~에 ~에서」로 길게 늘어지던 것(QA)도 같이 풀었다.
  const subject = `[collab5] ${when} ${space.name} · ${BOOKING_HEADLINE.guestPaid}`;
  const link = `${SITE_URL}/rent/requests`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const lead = `${BOOKING_HEADLINE.guestPaid}. 사장님 연락처와 그날 안내는 아래에 적어 뒀어요.`;
  const tail = `사장님과 연락이 잘 닿지 않으면 카카오톡으로 말씀해 주세요. ${KAKAO_CHAT_URL}`;
  const rows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    // 🏷「어디」와 「주소」가 나란히 서서 같은 정보 둘로 읽혔다(09-17 QA). 이름 칸은 「공간」이다.
    ["공간", space.name],
    ["주소", space.address],
    ["결제한 돈", won(booking.amountTotal)],
    // ☕🩸09-16까지 「그날 사장님과 이야기 나눌 시간이 있어요」 — 화면은 「협의한 날짜」였다. 이제 `rent-copy` 한 줄.
    ["커피챗", boughtChat(booking) ? `커피챗도 함께 예약하셨어요. ${COFFEE_CHAT_WHEN_GUEST}` : ""],
    ["사장님", `${hostName} · ${contact}`],
    ["이용 안내", `${accessHowLine(space.accessHow)} ${CONTACT_RULE_GUEST}`],
    ["공간 페이지", spaceLink(space)],
    ["취소하시면", CANCEL_POLICY_LINE],
  ];
  const text = [
    lead,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ``,
    `예약 내역: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "예약 내역 보기" }, tail);
  return send(guest?.email ?? "", subject, html, text);
}

/** ② 수락 → 손님. 손님은 결제 때 이미 「예약을 마쳤어요」를 받았다(①').
 *  그래서 「이제 확정이에요」라고 하면 상태가 한 번 더 바뀐 것처럼 읽힌다. 사장님이 «확인했다»는 소식으로 쓴다(09-16).
 *  🚨옛 「들어오는 법」(`space.accessNote`)은 09-16에 뺐다. 비밀번호는 사장님이 문자·현장에서 그때그때 전한다. */
export async function notifyBookingConfirmed(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const hostName = displayName(host, "사장님");
  const when = dateLabel(booking.useDate);
  // 🔁09-17 대표 결정 4 — 제목·첫 줄은 `BOOKING_HEADLINE.guestConfirmed`.
  const subject = `[collab5] ${when} ${space.name} · ${BOOKING_HEADLINE.guestConfirmed}`;
  const link = `${SITE_URL}/rent/done/${booking.id}`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  // 🩸09-16까지 「그날 오시기만 하면 돼요」 — 원상복구·판매 금지 같은 유의 사항이 있는 공간과 부딪혔다(09-17 QA).
  const lead = `${BOOKING_HEADLINE.guestConfirmed}. 가시기 전에 공간 페이지의 유의 사항을 한 번 봐 주세요.`;
  const rows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["주소", space.address],
    // 📨09-16 「들어오는 법」(옛 `accessNote`)에서 «안내 방식»으로. 비밀번호 같은 건 우리가 안 가진다.
    ["이용 안내", `${accessHowLine(space.accessHow)} ${CONTACT_RULE_GUEST}`],
    ["사장님", `${hostName} · ${contact}`],
    ["사장님 말씀", booking.hostMessage],
    ["공간 페이지", spaceLink(space)],
  ];
  const text = [
    lead,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ``,
    `자세히 보기: ${link}`,
  ].join("\n");
  const html = layout(
    lead,
    rows,
    { href: link, label: "예약 내용 보기" },
    "가시기 전에 사장님께 한 번 연락해 두시면 그날이 편해요.",
  );
  return send(guest?.email ?? "", subject, html, text);
}

/** 사장님이 그날까지 챙길 일. `accessHowLine`은 손님에게 하는 말이라 사장님 쪽으로 돌려 적는다. */
function hostTodoLine(how: Space["accessHow"]): string {
  if (how === "sms") return "이용 전에 손님께 문자로 이용 안내를 보내 주세요.";
  if (how === "onsite") return "이용 전에 손님을 직접 만나서 안내해 주세요.";
  return "문자로 먼저 안내해 주시고, 이용 전에 한 번 만나서 알려 주세요.";
}

/** ②' 수락 → 사장님 (09-16). 누른 것이 잘 들어갔다는 확인과, 그날 필요한 손님 연락처. */
export async function notifyBookingConfirmedToHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  const guestName = displayName(guest, "손님");
  const when = dateLabel(booking.useDate);
  // 🔁09-17 QA — 제목이 「수락이 잘 들어갔어요」였다. 방금 자기 손으로 누른 일을 되풀이하는 시스템 말이라,
  //   제목을 «그날 챙길 것»으로 바꿨다.
  const subject = `[collab5] ${when} ${space.name} · 손님 연락처와 그날 챙기실 일`;
  const link = `${SITE_URL}/rent/my`;
  // ☎️번호가 없는 손님이면 «이메일로만 연락된다»고 분명히 쓴다. 문자 안내를 고른 사장님이 할 일을 알 수 있게.
  // ☎️신청 때 받은 번호가 먼저다(09-17). 옛 예약만 프로필 번호로.
  const gPhone = booking.guestPhone?.trim() || guest?.phone?.trim() || "";
  const gEmail = guest?.email?.trim() ?? "";
  const guestContact = gPhone
    ? [gPhone, gEmail].filter(Boolean).join(" · ")
    : gEmail
      ? `이메일로만 연락돼요 · ${gEmail}`
      : "연락처를 안 남기셨어요";
  const lead = `${when} 예약을 수락하셨어요. 그날 오실 손님 연락처는 아래에 있어요.`;
  const tail =
    "사정이 생겨 이 예약을 무르셔야 하면 내 하루 가게에서 관리자에게 환불을 신청해 주세요. 저희가 두 분께 전화로 여쭤보고 처리할게요.";
  const rows: [string, string][] = [
    ["누가", guestName],
    ["연락처", guestContact],
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["무엇을", booking.plan],
    ["그날까지", `${hostTodoLine(space.accessHow)} ${CONTACT_RULE_HOST}`],
    ["커피챗", boughtChat(booking) ? `손님이 커피챗도 함께 골랐어요. ${COFFEE_CHAT_WHEN_HOST}` : ""],
    ["받으실 돈", won(booking.amountPayout)],
  ];
  const text = [
    lead,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`),
    ``,
    `내 하루 가게: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "내 하루 가게 보기" }, tail);
  return send(host?.email ?? "", subject, html, text);
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
    ["공간", space.name],
    ["환불", `${won(booking.amountTotal)} 전액. ${REFUND_TIMING_LINE}`],
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
  // 🔁09-17 QA — 「신청을 취소」였는데 손님 화면은 결제 뒤 «예약»이다. 사장님이 받은 건 이미 결제된 예약이라 «예약»으로.
  const subject = `[collab5] ${withJosa(guestName, "이/가")} ${when} ${space.name} 예약을 취소했어요`;
  const link = `${SITE_URL}/rent/my`;
  const rows: [string, string][] = [["언제", bookingWhen(booking)], ["공간", space.name]];
  const lead = `${withJosa(guestName, "이/가")} ${when} ${space.name} 예약을 취소했어요. 그 시간이 다시 비었어요.`;
  const text = [
    lead,
    ``,
    `내 하루 가게: ${link}`,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "내 하루 가게 보기" });
  return send(host?.email ?? "", subject, html, text);
}

/** ④' 손님 취소 → 손님 (09-16). 취소가 됐다는 사실과 얼마가 돌아가는지.
 *  `refundAmount`는 호출부가 규정표로 계산해 실제로 돌려준 금액이다. 여기서 다시 계산하지 않는다.
 *  0원이면 규정상 환불이 없는 경우다. 사과도 설득도 없이 담담하게 말하고, 물어볼 곳만 열어 둔다. */
export async function notifyBookingCancelledToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Promise<MailResult> {
  void host;
  const when = dateLabel(booking.useDate);
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const link = `${SITE_URL}/rent/requests`;
  const subject = refund > 0
    // 🔁09-17 QA — 환불 갈래만 「예약을」이 빠져 0원 갈래와 짝이 안 맞았다.
    ? `[collab5] ${when} ${space.name} 예약을 취소했어요 · ${won(refund)} 환불`
    : `[collab5] ${when} ${space.name} 예약을 취소했어요`;
  const lead = refund > 0
    ? `${when} ${space.name} 예약을 취소했어요. ${won(refund)}은 결제하신 수단으로 돌려드려요.`
    // 0원은 당일 취소뿐이다(`guestCancelRefundRate` — 1일 전까지는 50%라도 돌아간다). 「규정상·금액」 행정어를 뺐다.
    : `${when} ${space.name} 예약을 취소했어요. 당일 취소라 돌려드릴 돈이 없어요.`;
  const tail = refund > 0
    ? undefined
    : `규정이 궁금하시거나 따로 사정이 있으시면 카카오톡으로 편하게 물어보셔도 돼요. ${KAKAO_CHAT_URL}`;
  const rows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["결제한 돈", won(booking.amountTotal)],
    ["돌려드리는 돈", refund > 0 ? `${won(refund)}\n${REFUND_TIMING_LINE}` : "0원"],
  ];
  const text = [
    lead,
    ...rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/\n/g, " ")}`),
    ``,
    `예약 내역: ${link}`,
    ...(tail ? [tail] : []),
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "예약 내역 보기" }, tail);
  return send(guest?.email ?? "", subject, html, text);
}

/** ⑤ 관리자 승인 환불 → 손님·사장님 둘 다 (09-16).
 *  사장님 사정으로 확정 예약을 무를 때: 사장님이 「관리자에게 환불 신청」 → 우리가 양쪽에 전화로 확인 → 승인 → 환불.
 *  두 사람 다 전화로 이미 들은 이야기라, 메일은 «처리가 끝났다»는 확인이다. 한쪽이 실패해도 다른 쪽은 나간다. */
export async function notifyAdminRefund(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Promise<MailResult[]> {
  const guestName = displayName(guest, "손님");
  const when = dateLabel(booking.useDate);
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const full = refund >= booking.amountTotal;
  const amount = full ? `${won(refund)} 전액` : won(refund);

  // → 손님
  const gLink = `${SITE_URL}/rent`;
  const gSubject = `[collab5] ${when} ${space.name} 예약, ${full ? "전액" : won(refund)} 돌려드렸어요`;
  const gLead = `사장님 사정으로 ${when} ${space.name} 예약이 취소됐어요. 결제하신 돈은 ${full ? "전액" : `${won(refund)}만큼`} 돌려드렸어요.`;
  const gTail = "갑자기 일정이 바뀌어 번거로우셨죠. 다른 날 공간이 필요하시면 여기서 다시 찾아보세요.";
  const gRows: [string, string][] = [
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["돌려드린 돈", `${amount}\n${REFUND_TIMING_LINE}`],
  ];
  const gText = [
    gLead,
    ...gRows.map(([k, v]) => `${k}: ${v.replace(/\n/g, " ")}`),
    ``,
    `다른 하루 가게: ${gLink}`,
    gTail,
  ].join("\n");
  const gHtml = layout(gLead, gRows, { href: gLink, label: "다른 하루 가게 둘러보기" }, gTail);

  // → 사장님
  const hLink = `${SITE_URL}/rent/my`;
  const hSubject = `[collab5] 신청하신 환불을 처리했어요 · ${when} ${guestName}`;
  const hLead = `신청하신 환불을 처리했어요. ${when} 예약은 취소됐고, ${withJosa(guestName, "은/는")} ${amount}을 돌려받았어요.`;
  const hTail = "확인 전화에 시간 내 주셔서 고마워요.";
  const hRows: [string, string][] = [
    ["누가", guestName],
    ["언제", bookingWhen(booking)],
    ["공간", space.name],
    ["환불한 돈", amount],
    // 표 칸 모양을 맞춘다 — 값 자리에 문장만 있으면 다른 줄과 어긋나 보였다(QA).
    ["정산", "없음 (이 예약은 정산에서 빠져요)"],
  ];
  const hText = [hLead, ...hRows.map(([k, v]) => `${k}: ${v}`), ``, `내 하루 가게: ${hLink}`, hTail].join("\n");
  const hHtml = layout(hLead, hRows, { href: hLink, label: "내 하루 가게 보기" }, hTail);

  return Promise.all([
    send(guest?.email ?? "", gSubject, gHtml, gText),
    send(host?.email ?? "", hSubject, hHtml, hText),
  ]);
}
