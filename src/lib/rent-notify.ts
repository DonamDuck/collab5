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
import { rentMockOn } from "./rent-mock";
import { KAKAO_CHAT_URL, SITE_URL } from "./site";
import { bookingWhen, dateLabel } from "./rent-time";
import {
  accessHowLine, hostContactLine, CONTACT_RULE_GUEST, CONTACT_RULE_HOST,
  BOOKING_HEADLINE, COFFEE_CHAT_WHEN_GUEST, COFFEE_CHAT_WHEN_HOST, HOST_REQUEST_STEPS,
  PRODUCT_HINT_GUEST, PRODUCT_LABEL,
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

/** 🪪사장님이 보는 손님 이름 칸(대표 09-18) — 신청 때 받은 성함(실명)이 먼저다. 이용 당일 신분을 맞춰 보는 이름이라서.
 *  옛 예약(성함 칸이 생기기 전)은 성함이 비어 있어 프로필 브랜드명으로 물러서고, 그땐 라벨도 「손님」으로 둔다.
 *  브랜드명을 「성함」 칸에 적으면 사장님이 그 이름으로 신분증을 맞춰 보게 된다. */
function guestNameRow(b: SpaceBooking, guest: Profile | null): [string, string] {
  const real = b.guestName?.trim();
  return real ? ["성함", real] : ["손님", displayName(guest, "손님")];
}

/** 📨제목의 날짜(대표 09-18) — 「9월 20일(일)」. 본문 표(`bookingWhen`)는 괄호 앞에 한 칸을 띄우지만,
 *  제목은 대표가 적은 모양 그대로 붙이고 뒤에 쉼표를 둔다. */
function subjectDate(iso: string): string {
  return dateLabel(iso).replace(" (", "(");
}

/** 본문 공통 틀 — 첫 문장 + 표 + 링크 버튼. 네 통이 같은 얼굴이어야 받는 사람이 「collab5 메일」로 알아본다.
 *
 *  🎨09-17 디자인팀 — 틀만 고쳐 열여섯 통이 같이 바뀐다. 문장(`lead`·`rows`·`tail`)은 그대로다.
 *   ① 머리에 「collab5 하루 가게」 글자. 받은편지함에서 연 뒤 «어디서 온 메일인지»가 첫 줄에 선다. 이미지는 안 쓴다(차단되면 빈칸).
 *   ② `lead`의 **첫 문장을 굵은 제목**으로 가른다. 「예약이 완료됐어요」가 뒤따르는 안내와 같은 15px라 한 덩어리로 읽혔다.
 *   ③ 항목 표를 옅은 판(사이트 `InfoPanel`과 같은 #F6F6F7 · 12px 모서리) 안에 넣고 라벨 폭을 88px로 고정한다.
 *      화면의 확인 팝업·완료 화면과 같은 모양이라, 메일과 화면을 나란히 대조하기 쉽다.
 *   ④ 값 안의 줄이 주소 하나뿐이면 누를 수 있는 링크로 바꾼다. 날것 주소가 좁은 폰에서 세 줄로 꺾였다.
 *  ⚠️인라인 스타일만 쓴다. 메일 앱 대부분이 `<style>`을 버린다. */
const MAIL = { ink: "#1a1a1a", body: "#333", mute: "#666", faint: "#999", soft: "#F6F6F7", kiwi: "#98FF5C" };

function splitLead(lead: string): [string, string] {
  // 「…요.」·「…요!」에서 한 번만 자른다. 못 자르면 전부 제목이 아니라 전부 본문이다(긴 제목이 더 나쁘다).
  const m = lead.match(/^(.{4,60}?[요다][.!?])\s+([\s\S]+)$/);
  // 제목 자리엔 마침표를 뗀다(느낌표·물음표는 말투라 둔다).
  return m ? [m[1].replace(/\.$/, ""), m[2]] : ["", lead];
}

/** 🔗값 안의 주소 줄을 작은 칩 링크로(대표 09-18 #60). 밑줄 글자였을 땐 소개서 이름 아래 줄로 떨어져
 *  이름과 링크가 따로 읽혔다. 이제 바로 윗줄 글 «오른쪽»에 붙는다. 주소만 있는 줄이면 칩 하나만 선다.
 *  칩 글자는 주소가 정한다. 정산 계좌 등록은 여는 게 아니라 적으러 가는 곳이라 「등록하기」다. */
function chip(href: string): string {
  const label = href === PAYOUT_ACCOUNT_LINK ? "등록하기" : "열어 보기";
  return `<a href="${esc(href)}" style="display:inline-block;padding:0 10px;border:1px solid #DCDCE0;border-radius:999px;background:#fff;color:${MAIL.ink};font-size:13px;font-weight:600;line-height:24px;text-decoration:none;white-space:nowrap;vertical-align:1px">${label}</a>`;
}

function cell(v: string): string {
  const out: string[] = [];
  for (const line of v.split("\n")) {
    const t = line.trim();
    if (/^https?:\/\/\S+$/.test(t)) {
      if (out.length > 0) out[out.length - 1] += ` <span style="white-space:nowrap">&nbsp;${chip(t)}</span>`;
      else out.push(chip(t));
    } else {
      out.push(esc(line));
    }
  }
  return out.join("<br>");
}

/** 글자만 받는 메일함용 줄. 값 안의 줄바꿈은 한 칸으로 편다(표가 아니라 「라벨: 값」 한 줄이라서). */
function textRows(rows: [string, string][]): string[] {
  return rows.filter(([, v]) => v).map(([k, v]) => `${k}: ${v.replace(/\n/g, " ")}`);
}

function layout(lead: string, rows: [string, string][], link: { href: string; label: string }, tail?: string): string {
  const tr = rows
    .filter(([, v]) => v.trim().length > 0)
    .map(
      ([k, v]) =>
        `<tr><td style="width:88px;padding:5px 12px 5px 0;color:${MAIL.mute};vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:5px 0;color:${MAIL.body};word-break:keep-all;overflow-wrap:anywhere">${cell(v)}</td></tr>`,
    )
    .join("\n      ");
  const [head, rest] = splitLead(lead);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:${MAIL.ink};max-width:560px">
  <p style="margin:0 0 20px;font-size:13px;font-weight:600;color:${MAIL.faint};letter-spacing:0.01em">collab5 · 하루 가게</p>
  ${head ? `<p style="margin:0 0 8px;font-size:20px;line-height:1.4;font-weight:700;color:${MAIL.ink};word-break:keep-all">${esc(head)}</p>` : ""}
  <p style="margin:0 0 20px;color:${MAIL.body};word-break:keep-all">${esc(rest)}</p>
  <div style="background:${MAIL.soft};border-radius:12px;padding:12px 16px">
    <table style="border-collapse:collapse;font-size:15px;width:100%">
      ${tr}
    </table>
  </div>
  <p style="margin:24px 0 0"><a href="${esc(link.href)}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:${MAIL.kiwi};color:#222;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>
  ${tail ? `<p style="margin:20px 0 0;color:${MAIL.mute};font-size:14px;word-break:keep-all">${esc(tail)}</p>` : ""}
</div>`;
}

/** 한 통의 내용 — 보내기 전 모양. 🧪09-17 `build*` 함수가 이걸 만들고, `notify*`가 `sendMail`로 보낸다.
 *  둘로 가른 이유 = 개발용 메일 미리보기(`/dev/rent-mail/[kind]`)가 보내지 않고 HTML만 보려고. 동작은 전과 같다. */
export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
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
  // 🧪09-18 목 데이터 보기 중(개발 빌드 전용)엔 보내지 않는다. 첫 울타리는 `rent-actions.ts` 액션 첫 줄.
  if (await rentMockOn()) {
    console.info(`[rent-notify] 스킵(목 데이터 보기 중) · ${subject}`);
    return out;
  }
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

function sendMail(m: Mail): Promise<MailResult> {
  return send(m.to, m.subject, m.html, m.text);
}

/** 커피챗을 같이 샀는가. 새 칸(`amountChat`)과 옛 칸(`amountMentor`) 둘 중 하나라도 돈이 있으면 샀다. */
function boughtChat(b: SpaceBooking): boolean {
  return b.amountChat > 0 || b.amountMentor > 0;
}

/** 🛍고른 상품 한 줄(09-18) — 「공간 전체 · 자리에 시설과 장비까지 같이 써요」.
 *  사장님 메일엔 「손님이」를 붙인다. 공간 전체면 그날 시설까지 준비해 둬야 해서 사장님이 먼저 알아야 한다.
 *  ⭐이름은 `PRODUCT_LABEL` 한 벌. 화면(확인 팝업·결제·완료)과 같은 말이다. */
function productLine(b: SpaceBooking, forHost = false): string {
  return `${PRODUCT_LABEL[b.product]} · ${forHost ? "손님이 " : ""}${PRODUCT_HINT_GUEST[b.product]}`;
}

/** 💳환불이 «언제» 들어오는지 — 메일 네 통이 이 한 줄만 쓴다(09-17 QA).
 *  🩸09-16까지 「카드사에 따라 며칠 걸릴 수 있어요」와 완료 화면의 「사흘에서 닷새」가 달랐고,
 *    계좌이체·간편결제는 카드사가 아닌데 카드사를 말했다. */
const REFUND_TIMING_LINE = "결제한 수단으로 3~5일 안에 돌아가요.";

/** 🔗공간 페이지 — 유의 사항·사진을 그날 아침 다시 보는 자리(09-17 QA: 결제 완료 메일에 링크가 없었다). */
function spaceLink(space: Space): string {
  return `${SITE_URL}/rent/${encodeURIComponent(space.slug)}`;
}

/** 🏦사장님이 정산 계좌를 등록하는 자리(09-17). `/rent/my`의 그 절로 곧장 내려간다. */
const PAYOUT_ACCOUNT_LINK = `${SITE_URL}/rent/my?tab=host#payout-account`;

/** 취소·환불 규정 한 줄. 상세 페이지 «환불 규정» 절과 호스트 약관 제8조의 숫자 그대로다 — 바뀌면 셋 다. */
const CANCEL_POLICY_LINE =
  "결제하고 한 시간 안에 취소하시면 전액 돌려드려요. 그 뒤로는 7일 전까지 전액, 3일 전까지 70%, 1일 전까지 50%이고 당일은 환불이 없어요.";

/** ① 결제 완료 → 사장님. 손님이 누구인지·언제·얼마인지와 답하러 갈 곳.
 *  📇09-16 `guestBrand` — 손님이 신청 때 고른 소개서. 있으면 사장님이 누가 오는지 미리 볼 수 있게 링크를 단다. */
export function buildBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  guestBrand?: { name: string; slug: string },
): Mail {
  const guestRow = guestNameRow(booking, guest);
  // 🔁09-16 대표 — 「신청했어요」 → 「예약이 들어왔어요」. 09-17 대표 결정 4로 한 번 더 — 사장님 쪽에 들어온 것은 «요청»,
  //   수락한 뒤가 «예약»이다. 제목 문장은 `BOOKING_HEADLINE.hostPaid` 한 벌을 쓴다.
  // ✂️09-18 대표 #57 — 「제목에 정보가 너무 많다」. 날짜와 무슨 일만 남기고 공간 이름·금액은 본문 표로 내렸다.
  //   공간이 여럿인 사장님은 지금 기준(소상공인 한 곳) 밖이라 제목에서 공간을 가르지 않는다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.hostPaid}`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const brandLine = guestBrand?.slug
    ? `${guestBrand.name.trim() || displayName(guest, "소개서")}\n${SITE_URL}/m/${encodeURIComponent(guestBrand.slug)}`
    : "";
  // 🏷09-18 대표 #59·#61·#62 — 라벨을 사람 말로. 「누가」→「성함」, 「공간」→「빌리는 공간」, 「언제」→「이용 일시」…
  //   ⭐같은 칸은 메일끼리 같은 이름이다. 한 통을 고치면 아래 다른 메일의 같은 칸도 같이 고친다.
  //   「무엇을」은 「하실 일」이 먼저 떠올랐지만 수락 메일의 「챙기실 일」과 한 표에 같은 꼴로 서서, 첫 문장이 부르는 이름(「손님이 적은 계획」)을 땄다.
  const rows: [string, string][] = [
    guestRow,
    ["소개서", brandLine],
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking, true)],
    ["손님 계획", booking.plan],
    // ☕사장님이 커피챗을 해 줘야 하는 신청인지 — 09-16까지 이 메일에 없었다. 「언제」는 `rent-copy` 한 줄(대표 09-17).
    ["커피챗", boughtChat(booking) ? `손님이 커피챗도 함께 골랐어요. ${COFFEE_CHAT_WHEN_HOST}` : ""],
    ["정산 예정 금액", `${won(booking.amountPayout)} (손님이 낸 돈 ${won(booking.amountTotal)})`],
  ];
  // ❓«답해야 하나»를 첫 줄에서 말한다(09-17 QA). phase 1은 결제가 곧 예약이라 안 눌러도 예약은 산다.
  //   그 말이 없으면 사장님은 이 메일이 «답하라»는 건지 «알고만 있으라»는 건지 모른다.
  // 🧭09-17 대표 — 요청 확인 → 수락·거절 → 2일 안에 공간 안내. «답하지 않아도 된다»던 문장은 이 절차와 부딪혀 뺐다.
  // 🔁09-18 대표 #58 — 「연락처가 열려요」 → 「연락처를 보실 수 있어요」.
  const lead = `${BOOKING_HEADLINE.hostPaid}. 결제는 이미 끝났어요. 날짜와 손님이 적은 계획을 읽어 보시고 수락하거나 거절해 주세요. 수락하시면 손님 연락처를 보실 수 있어요.`;
  const tail = `거절은 이용 시작 전까지 할 수 있고, 손님께 전액 돌아가요. ${CONTACT_RULE_HOST}`;
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `들어온 요청 보기: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "들어온 요청 보기" }, tail);
  return { to: host?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingPaid`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  guestBrand?: { name: string; slug: string },
): Promise<MailResult> {
  return sendMail(buildBookingPaid(booking, space, host, guest, guestBrand));
}

/** ①' 결제 완료 → 손님 (09-16 phase 1). 채팅이 없는 지금은 결제가 곧 예약 완료라, 손님이 알아야 할 것을 이 한 통에 다 담는다.
 *  사장님 연락처도 여기서 열린다 — 사장님 답을 기다리게 하지 않기로 했다(대표 09-16).
 *  🚨옛 「들어오는 법」(`space.accessNote`)은 넣지 않는다. 출입 비밀번호가 적혀 있을 수 있는 칸이다. */
export function buildBookingPaidToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const hostName = displayName(host, "사장님");
  // 🔁09-17 대표 결정 4 — 제목·첫 줄은 `BOOKING_HEADLINE.guestPaid`. 첫 문장이 「~에 ~에서」로 길게 늘어지던 것(QA)도 같이 풀었다.
  // ✂️09-18 대표 #57과 같은 결 — 제목은 날짜와 무슨 일만. 공간 이름은 본문 표에 있다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.guestPaid}`;
  const link = `${SITE_URL}/rent/requests`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const lead = `${BOOKING_HEADLINE.guestPaid}. 사장님 연락처와 그날 안내는 아래에 적어 뒀어요.`;
  const tail = `사장님과 연락이 잘 닿지 않으면 카카오톡으로 말씀해 주세요. ${KAKAO_CHAT_URL}`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    // 🏷「어디」와 「주소」가 나란히 서서 같은 정보 둘로 읽혔다(09-17 QA). 이름 칸은 「빌리는 공간」이다(09-18 대표 #61).
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    ["주소", space.address],
    // 💳확인 팝업·결제 화면의 「결제 금액」과 같은 이름(09-18).
    ["결제 금액", won(booking.amountTotal)],
    // ☕🩸09-16까지 「그날 사장님과 이야기 나눌 시간이 있어요」 — 화면은 「협의한 날짜」였다. 이제 `rent-copy` 한 줄.
    ["커피챗", boughtChat(booking) ? `커피챗도 함께 예약하셨어요. ${COFFEE_CHAT_WHEN_GUEST}` : ""],
    ["사장님", `${hostName} · ${contact}`],
    ["이용 안내", `${accessHowLine(space.accessHow)} ${CONTACT_RULE_GUEST}`],
    ["공간 페이지", spaceLink(space)],
    ["취소하시면", CANCEL_POLICY_LINE],
  ];
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `예약 내역: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "예약 내역 보기" }, tail);
  return { to: guest?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingPaidToGuest`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingPaidToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingPaidToGuest(booking, space, host, guest));
}

/** ② 수락 → 손님. 손님은 결제 때 이미 「예약을 마쳤어요」를 받았다(①').
 *  그래서 「이제 확정이에요」라고 하면 상태가 한 번 더 바뀐 것처럼 읽힌다. 사장님이 «확인했다»는 소식으로 쓴다(09-16).
 *  🚨옛 「들어오는 법」(`space.accessNote`)은 09-16에 뺐다. 비밀번호는 사장님이 문자·현장에서 그때그때 전한다. */
export function buildBookingConfirmed(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const hostName = displayName(host, "사장님");
  // 🔁09-17 대표 결정 4 — 제목·첫 줄은 `BOOKING_HEADLINE.guestConfirmed`. 09-18 — 제목에서 공간 이름을 뺐다(대표 #57과 같은 결).
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.guestConfirmed}`;
  const link = `${SITE_URL}/rent/done/${booking.id}`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  // 🩸09-16까지 「그날 오시기만 하면 돼요」 — 원상복구·판매 금지 같은 유의 사항이 있는 공간과 부딪혔다(09-17 QA).
  const lead = `${BOOKING_HEADLINE.guestConfirmed}. 가시기 전에 공간 페이지의 유의 사항을 한 번 봐 주세요.`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    ["주소", space.address],
    // 📨09-16 「들어오는 법」(옛 `accessNote`)에서 «안내 방식»으로. 비밀번호 같은 건 우리가 안 가진다.
    ["이용 안내", `${accessHowLine(space.accessHow)} ${CONTACT_RULE_GUEST}`],
    ["사장님", `${hostName} · ${contact}`],
    ["사장님 말씀", booking.hostMessage],
    ["공간 페이지", spaceLink(space)],
  ];
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `자세히 보기: ${link}`,
  ].join("\n");
  const html = layout(
    lead,
    rows,
    { href: link, label: "예약 내용 보기" },
    "가시기 전에 사장님께 한 번 연락해 두시면 그날이 편해요.",
  );
  return { to: guest?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingConfirmed`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingConfirmed(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingConfirmed(booking, space, host, guest));
}

/** 사장님이 그날까지 챙길 일. `accessHowLine`은 손님에게 하는 말이라 사장님 쪽으로 돌려 적는다. */
function hostTodoLine(how: Space["accessHow"]): string {
  if (how === "sms") return "이용 전에 손님께 문자나 전화로 이용 안내를 전해 주세요.";
  if (how === "onsite") return "이용 전에 손님을 직접 만나서 안내해 주세요.";
  return "문자나 전화로 먼저 안내해 주시고, 이용 전에 한 번 만나서 알려 주세요.";
}

/** ②' 수락 → 사장님 (09-16). 누른 것이 잘 들어갔다는 확인과, 그날 필요한 손님 연락처. */
export function buildBookingConfirmedToHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  /** 🏦정산 받을 계좌가 있나(09-17). 모르면 undefined — 그땐 말하지 않는다(없는 줄 알고 조르지 않게). */
  hasPayoutAccount?: boolean,
): Mail {
  const when = dateLabel(booking.useDate);
  // 🔁09-17 QA — 제목이 「수락이 잘 들어갔어요」였다. 방금 자기 손으로 누른 일을 되풀이하는 시스템 말이라,
  //   제목을 «그날 챙길 것»으로 바꿨다. 09-18 — 공간 이름을 빼고 날짜 뒤 한 문장으로(대표 #57과 같은 결).
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 손님 연락처와 그날 챙기실 일을 보내 드려요`;
  const link = `${SITE_URL}/rent/my?tab=host`;
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
    guestNameRow(booking, guest),
    ["연락처", guestContact],
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking, true)],
    ["손님 계획", booking.plan],
    // 🏷09-18 「그날까지」 → 「챙기실 일」. 제목의 「그날 챙기실 일」과 같은 말이다.
    ["챙기실 일", `${hostTodoLine(space.accessHow)} ${CONTACT_RULE_HOST}`],
    ["커피챗", boughtChat(booking) ? `손님이 커피챗도 함께 골랐어요. ${COFFEE_CHAT_WHEN_HOST}` : ""],
    ["정산 예정 금액", won(booking.amountPayout)],
    // 🏦09-17 — 계좌가 없으면 이용일 뒤에 보낼 곳이 없다. 정산 날짜는 말하지 않는다(토스 계약 뒤 대표가 정한다).
    //   09-18 — 주소를 줄을 바꿔 두면 `cell`이 문장 오른쪽에 「등록하기」 칩으로 붙인다(날것 주소가 표에 그대로 찍혔다).
    ["정산 계좌", hasPayoutAccount === false ? `정산 받을 계좌를 등록해 주세요.\n${PAYOUT_ACCOUNT_LINK}` : ""],
  ];
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `내 하루 가게: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "내 하루 가게 보기" }, tail);
  return { to: host?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingConfirmedToHost`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingConfirmedToHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  /** 🏦정산 받을 계좌가 있나(09-17). 모르면 undefined — 그땐 말하지 않는다(없는 줄 알고 조르지 않게). */
  hasPayoutAccount?: boolean,
): Promise<MailResult> {
  return sendMail(buildBookingConfirmedToHost(booking, space, host, guest, hasPayoutAccount));
}

/** ③ 거절 → 손님. 전액 환불이라는 사실이 첫 문장에 있어야 한다. */
export function buildBookingRejected(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  void host;
  // ✂️09-18 대표 #57과 같은 결 — 날짜와 무슨 일만. 금액·공간 이름은 본문으로. «전액»은 이 메일의 요점이라 남긴다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 사장님이 어렵다고 하셔서 전액 돌려드려요`;
  const link = `${SITE_URL}/rent`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    // 🏷09-18 「환불」 → 「돌려드리는 돈」. 손님 취소 메일의 같은 칸과 이름을 맞췄다.
    ["돌려드리는 돈", `${won(booking.amountTotal)} 전액. ${REFUND_TIMING_LINE}`],
    ["사장님 말씀", booking.hostMessage],
  ];
  const text = [
    `사장님이 이번엔 어렵다고 하셨어요. ${won(booking.amountTotal)}은 전액 돌려드려요.`,
    ...textRows(rows),
    ``,
    `다른 공간 보기: ${link}`,
  ].join("\n");
  const html = layout(
    `사장님이 이번엔 어렵다고 하셨어요. ${won(booking.amountTotal)}은 전액 돌려드려요.`,
    rows,
    { href: link, label: "다른 공간 보기" },
  );
  return { to: guest?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingRejected`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingRejected(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingRejected(booking, space, host, guest));
}

/** ④ 손님 취소 → 사장님. 한 줄이면 된다. 그날이 다시 비는 날이 됐다는 것만. */
export function buildBookingCancelled(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const when = dateLabel(booking.useDate);
  // 🔁09-17 QA — 「신청을 취소」였는데 손님 화면은 결제 뒤 «예약»이다. 사장님이 받은 건 이미 결제된 예약이라 «예약»으로.
  // ✂️09-18 대표 #57과 같은 결 — 제목에서 손님 이름·공간 이름을 뺐다. 🪪이름은 표의 「성함」 칸이 든다.
  //   실명을 문장 주어로 세우면 「한서윤이 취소했어요」처럼 맨이름이 돼서, 문장은 「손님이」로 두고 이름은 표로 보낸다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 손님이 예약을 취소했어요`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const rows: [string, string][] = [
    guestNameRow(booking, guest),
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking, true)],
  ];
  const lead = `손님이 ${when} ${space.name} 예약을 취소했어요. 그 시간이 다시 비었어요.`;
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `내 하루 가게: ${link}`,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "내 하루 가게 보기" });
  return { to: host?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingCancelled`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingCancelled(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingCancelled(booking, space, host, guest));
}

/** ④' 손님 취소 → 손님 (09-16). 취소가 됐다는 사실과 얼마가 돌아가는지.
 *  `refundAmount`는 호출부가 규정표로 계산해 실제로 돌려준 금액이다. 여기서 다시 계산하지 않는다.
 *  0원이면 규정상 환불이 없는 경우다. 사과도 설득도 없이 담담하게 말하고, 물어볼 곳만 열어 둔다. */
export function buildBookingCancelledToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Mail {
  void host;
  const when = dateLabel(booking.useDate);
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const link = `${SITE_URL}/rent/requests`;
  // 🔁09-17 QA — 환불 갈래만 「예약을」이 빠져 0원 갈래와 짝이 안 맞았다.
  // ✂️09-18 대표 #57과 같은 결 — 날짜와 무슨 일만. 돌려드리는 금액은 첫 문장과 표가 말한다. 그래서 두 갈래 제목이 같아졌다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 예약을 취소했어요`;
  const lead = refund > 0
    ? `${when} ${space.name} 예약을 취소했어요. ${won(refund)}은 결제하신 수단으로 돌려드려요.`
    // 0원은 당일 취소뿐이다(`guestCancelRefundRate` — 1일 전까지는 50%라도 돌아간다). 「규정상·금액」 행정어를 뺐다.
    : `${when} ${space.name} 예약을 취소했어요. 당일 취소라 돌려드릴 돈이 없어요.`;
  const tail = refund > 0
    ? undefined
    : `규정이 궁금하시거나 따로 사정이 있으시면 카카오톡으로 편하게 물어보셔도 돼요. ${KAKAO_CHAT_URL}`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    ["결제 금액", won(booking.amountTotal)],
    ["돌려드리는 돈", refund > 0 ? `${won(refund)}\n${REFUND_TIMING_LINE}` : "0원"],
  ];
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `예약 내역: ${link}`,
    ...(tail ? [tail] : []),
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "예약 내역 보기" }, tail);
  return { to: guest?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildBookingCancelledToGuest`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingCancelledToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Promise<MailResult> {
  return sendMail(buildBookingCancelledToGuest(booking, space, host, guest, refundAmount));
}

/** ⑤ 관리자 승인 환불 → 손님·사장님 둘 다 (09-16).
 *  사장님 사정으로 확정 예약을 무를 때: 사장님이 「관리자에게 환불 신청」 → 우리가 양쪽에 전화로 확인 → 승인 → 환불.
 *  두 사람 다 전화로 이미 들은 이야기라, 메일은 «처리가 끝났다»는 확인이다. 한쪽이 실패해도 다른 쪽은 나간다. */
export function buildAdminRefund(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Mail[] {
  const when = dateLabel(booking.useDate);
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const full = refund >= booking.amountTotal;
  const amount = full ? `${won(refund)} 전액` : won(refund);
  // ✂️09-18 대표 #57과 같은 결 — 두 통 다 제목은 날짜와 무슨 일만. 금액·공간·손님 이름은 본문으로.
  const sDate = subjectDate(booking.useDate);

  // → 손님
  const gLink = `${SITE_URL}/rent`;
  const gSubject = `[collab5] ${sDate}, 예약이 취소돼 ${full ? "전액" : "결제하신 돈을"} 돌려드렸어요`;
  const gLead = `사장님 사정으로 ${when} ${space.name} 예약이 취소됐어요. 결제하신 돈은 ${full ? "전액" : `${won(refund)}만큼`} 돌려드렸어요.`;
  const gTail = "갑자기 일정이 바뀌어 번거로우셨죠. 다른 날 공간이 필요하시면 여기서 다시 찾아보세요.";
  const gRows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    ["돌려드린 돈", `${amount}\n${REFUND_TIMING_LINE}`],
  ];
  const gText = [
    gLead,
    ...textRows(gRows),
    ``,
    `다른 하루 가게: ${gLink}`,
    gTail,
  ].join("\n");
  const gHtml = layout(gLead, gRows, { href: gLink, label: "다른 하루 가게 둘러보기" }, gTail);

  // → 사장님
  const hLink = `${SITE_URL}/rent/my?tab=host`;
  const hSubject = `[collab5] ${sDate}, 신청하신 환불을 처리했어요`;
  // 🪪손님 이름은 문장에서 빼고 표의 「성함」 칸으로(09-18). 실명이 문장 주어로 서면 맨이름이 된다.
  const hLead = `신청하신 환불을 처리했어요. ${when} 예약은 취소됐고, 손님께 ${amount}을 돌려드렸어요.`;
  const hTail = "확인 전화에 시간 내 주셔서 고마워요.";
  const hRows: [string, string][] = [
    guestNameRow(booking, guest),
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking, true)],
    // 🏷09-18 「환불한 돈」 → 「돌려드린 돈」(손님 쪽 같은 메일과 같은 이름). 「정산」 → 「정산 예정 금액」(요청 메일과 같은 이름).
    ["돌려드린 돈", amount],
    // 표 칸 모양을 맞춘다 — 값 자리에 문장만 있으면 다른 줄과 어긋나 보였다(QA).
    ["정산 예정 금액", "없어요 (이 예약은 정산에서 빠져요)"],
  ];
  const hText = [hLead, ...textRows(hRows), ``, `내 하루 가게: ${hLink}`, hTail].join("\n");
  const hHtml = layout(hLead, hRows, { href: hLink, label: "내 하루 가게 보기" }, hTail);

  return [
    { to: guest?.email ?? "", subject: gSubject, html: gHtml, text: gText },
    { to: host?.email ?? "", subject: hSubject, html: hHtml, text: hText },
  ];
}

/** 보내는 쪽 — 문장은 `buildAdminRefund`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyAdminRefund(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null, refundAmount: number,
): Promise<MailResult[]> {
  return Promise.all(buildAdminRefund(booking, space, host, guest, refundAmount).map(sendMail));
}

/** ⑥ 공간 공개 → 사장님 (09-17). 검토를 마치고 목록에 올렸다는 소식과, 요청이 오면 할 일.
 *  ⚠️호출부가 «원래 공개가 아니었을 때만» 부른다. 이미 열린 공간을 또 누르면 메일이 또 가면 안 된다. */
export function buildSpacePublished(
  space: Space, host: Profile | null, hasPayoutAccount?: boolean,
): Mail {
  // ✂️09-18 대표 #57과 같은 결 — 공간 이름은 본문 첫 문장에 있다. 지금 기준은 사장님 한 분에 공간 한 곳이다.
  const subject = `[collab5] 올리신 공간이 하루 가게 목록에 올라갔어요`;
  const link = spaceLink(space);
  const lead = `${space.name} 공간을 하루 가게 목록에 열어 드렸어요. 이제 손님들이 보고 예약할 수 있어요.`;
  // 네 단계는 순서가 곧 정보라 번호를 붙인다(`HOST_REQUEST_STEPS` 주석과 같은 이유).
  const steps = HOST_REQUEST_STEPS.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const rows: [string, string][] = [
    ["앞으로 할 일", steps],
    // 09-18 — 주소는 줄을 바꿔 둔다. `cell`이 문장 오른쪽에 「등록하기」 칩으로 붙인다.
    ["정산 계좌", hasPayoutAccount === false ? `아직 등록 전이에요. 손님이 이용한 날이 지나면 받으실 돈을 보낼 곳이라 미리 적어 두세요.\n${PAYOUT_ACCOUNT_LINK}` : ""],
  ];
  const tail = "가게 사정으로 한동안 쉬고 싶으면 내 하루 가게에서 「잠시 쉬기」를 눌러 두세요. 목록에서만 빠지고 이미 받은 예약은 그대로예요.";
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `내 공간 보기: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "내 공간 보기" }, tail);
  return { to: host?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildSpacePublished`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifySpacePublished(
  space: Space, host: Profile | null, hasPayoutAccount?: boolean,
): Promise<MailResult> {
  return sendMail(buildSpacePublished(space, host, hasPayoutAccount));
}

/** ⑦ 이용 전날 → 손님 (09-17). 내일 몇 시 어디인지, 누구에게 연락하면 되는지.
 *  우리는 사장님이 안내를 보냈는지 모른다(기록이 없다). 그래서 «못 받았으면» 갈 곳만 열어 둔다. */
export function buildRemindGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const hostName = displayName(host, "사장님");
  const start = booking.startTime || "";
  // ✂️09-18 대표 #57과 같은 결 — 「내일」이 날짜 자리다. 공간 이름은 본문으로.
  const subject = `[collab5] 내일${start ? ` ${start}` : ""}, 하루 가게 예약이 있어요`;
  const link = `${SITE_URL}/rent/requests`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const lead = `내일은 ${space.name} 예약한 날이에요. 시간과 주소를 한 번 더 적어 둘게요.`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["빌리는 공간", space.name],
    ["신청 상품", productLine(booking)],
    ["주소", space.address],
    ["사장님", `${hostName} · ${contact}`],
    ["커피챗", boughtChat(booking) ? COFFEE_CHAT_WHEN_GUEST : ""],
    ["공간 페이지", spaceLink(space)],
  ];
  const tail = `사장님께 이용 안내를 아직 못 받으셨나요? 카카오톡으로 알려 주시면 저희가 사장님께 먼저 연락해 볼게요. ${KAKAO_CHAT_URL}`;
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `예약 내역: ${link}`,
    tail,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: "예약 내역 보기" }, tail);
  return { to: guest?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildRemindGuest`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyRemindGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildRemindGuest(booking, space, host, guest));
}

/** ⑦' 이용 전날 → 사장님 (09-17). 내일 누가 몇 시에 오는지와 오늘 챙길 것.
 *  🔒손님 번호는 «수락한 예약»에만 싣는다. 사장님 쪽 연락처 문은 `isRevealed`(수락 뒤) 하나다 —
 *    리마인드가 그 문을 옆으로 열면 수락 버튼의 뜻이 사라진다. 수락 전이면 수락하러 갈 곳을 말한다. */
export function buildRemindHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const start = booking.startTime || "";
  const accepted = booking.status === "confirmed";
  // ✂️09-18 대표 #57과 같은 결 — 「내일 몇 시」 뒤에 무슨 일만. 손님 이름은 표의 「성함」 칸이 든다.
  //   수락 전이면 할 일이 다르니 제목부터 갈라 말한다(전엔 두 갈래 제목이 같았다).
  const subject = accepted
    ? `[collab5] 내일${start ? ` ${start}` : ""}, 하루 가게 손님이 오세요`
    : `[collab5] 내일${start ? ` ${start}` : ""}, 아직 수락하지 않은 예약이 있어요`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const gPhone = booking.guestPhone?.trim() || guest?.phone?.trim() || "";
  const gEmail = guest?.email?.trim() ?? "";
  const guestContact = accepted ? [gPhone, gEmail].filter(Boolean).join(" · ") || "연락처를 안 남기셨어요" : "";
  const lead = accepted
    ? `내일 ${space.name}에 손님이 와요. 손님 연락처와 오늘 챙기실 일을 적어 뒀어요.`
    : `내일 ${space.name}에 손님이 와요. 아직 수락 전인 예약이라, 오늘 들어가서 수락해 주세요.`;
  const rows: [string, string][] = [
    ["이용 일시", bookingWhen(booking)],
    ["신청 상품", productLine(booking, true)],
    guestNameRow(booking, guest),
    ["연락처", guestContact],
    ["손님 계획", booking.plan],
    // 🔁09-18 대표 #58 — 「연락처가 열리니」 → 「연락처를 보실 수 있으니」.
    ["오늘 챙기실 일", accepted
      ? `${hostTodoLine(space.accessHow)} 아직 못 하셨다면 오늘 챙겨 두시면 내일이 편해요.`
      : "결제는 끝났고 손님은 내일 오세요. 수락하시면 손님 연락처를 보실 수 있으니, 그때 이용 안내를 보내 주세요."],
    ["커피챗", boughtChat(booking) ? COFFEE_CHAT_WHEN_HOST : ""],
  ];
  const text = [
    lead,
    ...textRows(rows),
    ``,
    `내 하루 가게: ${link}`,
  ].join("\n");
  const html = layout(lead, rows, { href: link, label: accepted ? "내 하루 가게 보기" : "수락하러 가기" });
  return { to: host?.email ?? "", subject, html, text };
}

/** 보내는 쪽 — 문장은 `buildRemindHost`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyRemindHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildRemindHost(booking, space, host, guest));
}
