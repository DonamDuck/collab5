// 하루 팝업 — 신청·수락·거절·취소 알림 (2026-09-14). 서버 전용.
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
//
// 📣09-19 대표 — 대표에게 가는 알림(검토 대기·환불 신청·하루 요약)은 `admin-notify.ts`로 모았다(슬랙, 없으면 메일).
//   손님·사장님 메일에 붙던 대표 참조(cc)는 뺐다.
import { rentMockOn } from "./rent-mock";
import type { AdminNotice } from "./admin-notify";
import { notifyAdmin } from "./admin-notify";
import type { AdminDailySummary, RemindRun } from "./rent-admin-daily";
import { KAKAO_CHAT_URL, SITE_URL } from "./site";
import { bookingWhen, dateLabel } from "./rent-time";
import {
  accessMeetLine, hostContactLine, withJosa, BROKER_NOTE, CONTACT_RULE_GUEST, CONTACT_RULE_GUEST_CONFIRMED, CONTACT_RULE_HOST,
  BOOKING_HEADLINE, COFFEE_CHAT_FREE, COFFEE_CHAT_WHEN_GUEST, COFFEE_CHAT_WHEN_HOST, HOST_REQUEST_STEPS,
  PRODUCT_HINT_GUEST, PRODUCT_LABEL, REFUND_TIMING_LINE,
} from "./rent-copy";
import type { Space, SpaceBooking } from "./types";
import { bizOnFile } from "./bizcheck";
import { bookingHasChat } from "./rent-products";
import type { ReviewWhy } from "./rent-review";
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

/** 🏷표 왼쪽 칸 이름 — **메일 열여덟 통이 이 한 벌만 쓴다**(09-18 메일 전수).
 *
 *  🩸09-18 대표: 「이메일 들보니깐 누가 아직 예전 항목 그대로 쓰는게 많은데?」 한 통(결제 → 사장님)을 고치고
 *    나머지 통의 같은 칸이 옛 이름으로 남았다. 칸 이름을 통마다 문자열로 적으면 또 갈라진다. 그래서 여기 한 곳에 모았다.
 *  ⭐기준(대표 09-18 「메일 제목과 라벨은 사람 말로」)
 *    · 행정 낱말만 늘어놓지 않는다 — 일시·금액·예정 ❌(「이용 일시」 → 「빌리는 날」, 「정산 예정 금액」 → 「받으실 돈」)
 *    · 질문형으로 억지로 귀엽게 만들지 않는다 — 누가·무엇을·그날까지 ❌
 *    · 대표가 직접 고른 두 이름이 본보기다 — 「성함」·「빌리는 공간」(#59·#61). 받는 사람이 한눈에 알아보는 쉬운 명사구.
 *  ⭐같은 뜻은 모든 메일에서 같은 이름이다. 받는 사람에 따라 달라야 하는 곳만 둘로 둔다(상대 연락처·받는/낸 돈).
 *  📏칸 폭이 88px로 고정이라 이름은 일곱 자 안쪽. 더 길면 폰에서 값 칸이 좁아진다. */
const LABEL = {
  name: "성함",
  /** 성함 칸이 생기기 전 옛 예약 — 브랜드명으로 물러서며 칸 이름도 바꾼다(`guestNameRow`). */
  nameFallback: "손님",
  guestContact: "손님 연락처",
  hostContact: "사장님 연락처",
  brand: "소개서",
  when: "빌리는 날",
  space: "빌리는 공간",
  product: "고르신 상품",
  address: "주소",
  plan: "손님 계획",
  chat: "커피챗",
  access: "이용 안내",
  todo: "챙기실 일",
  hostNote: "사장님 말씀",
  paid: "결제하신 돈",
  refund: "돌려드리는 돈",
  payout: "받으실 돈",
  payoutAccount: "정산 계좌",
  policy: "취소와 환불",
  steps: "앞으로 할 일",
  // ↓ 대표에게 가는 검토 알림에만 쓴다(09-18).
  reviewSpace: "올라온 공간",
  reviewOwner: "올린 사장님",
  reviewPrevName: "원래 이름",
  reviewPrevAddress: "원래 주소",
  reviewBiz: "사업자 확인",
  reviewPlace: "네이버 가게",
  // ↓ 보완 요청(09-19 저녁). 사장님 메일과 대표 알림(다시 보냄)이 같이 쓴다.
  fixWhat: "확인할 부분",
  fixAsked: "부탁드린 내용",
  fixNow: "지금 공간은",
  // ↓ 대표에게 가는 환불 신청 알림·아침 요약에만 쓴다(09-19).
  refundHost: "신청한 사장님",
  refundNote: "신청 사유",
  guestPaid: "손님이 낸 돈",
  dailyStuck: "붙잡힌 돈",
  dailyPaid: "어제 결제",
  dailyBack: "어제 취소·환불",
  dailyWaiting: "수락 대기",
  dailyRefund: "환불 신청",
  dailyReview: "검토 대기",
  dailyUse: "이용 예약",
  dailyRemind: "리마인드",
  // ↓ 대표 슬랙 거래 알림에만 쓴다(09-19 오후). 사람을 가리키는 칸은 회원 번호뿐이다(`buildDealNotice`).
  dealBooking: "예약 번호",
  dealOrder: "주문번호",
  dealPaid: "결제 금액",
  dealRefund: "환불액",
  dealSpace: "공간",
  dealWhen: "이용 날짜",
  dealProduct: "상품",
  dealGuest: "손님 회원 번호",
  dealHost: "사장님 회원 번호",
} as const;

/** 🪪사장님이 보는 손님 이름 칸(대표 09-18) — 신청 때 받은 성함(실명)이 먼저다. 이용 당일 신분을 맞춰 보는 이름이라서.
 *  옛 예약(성함 칸이 생기기 전)은 성함이 비어 있어 프로필 브랜드명으로 물러서고, 그땐 라벨도 「손님」으로 둔다.
 *  브랜드명을 「성함」 칸에 적으면 사장님이 그 이름으로 신분증을 맞춰 보게 된다. */
function guestNameRow(b: SpaceBooking, guest: Profile | null): [string, string] {
  const real = b.guestName?.trim();
  // 브랜드명까지 비면 「손님: 손님」이 됐다(09-18 메일 전수, 옛 예약 미리보기). 빈 칸을 문장으로 말한다.
  return real ? [LABEL.name, real] : [LABEL.nameFallback, displayName(guest, "이름을 안 남기셨어요")];
}

/** 📨제목의 날짜(대표 09-18) — 「9월 20일(일)」. 본문 표(`bookingWhen`)는 괄호 앞에 한 칸을 띄우지만,
 *  제목은 대표가 적은 모양 그대로 붙이고 뒤에 쉼표를 둔다. */
function subjectDate(iso: string): string {
  return dateLabel(iso).replace(" (", "(");
}

/** 본문 공통 틀 — 첫 문장 + 표 + 링크 버튼. 네 통이 같은 얼굴이어야 받는 사람이 「collab5 메일」로 알아본다.
 *
 *  🎨09-17 디자인팀 — 틀만 고쳐 열여섯 통이 같이 바뀐다. 문장(`lead`·`rows`·`tail`)은 그대로다.
 *   ① 머리에 「collab5 하루 팝업」 글자. 받은편지함에서 연 뒤 «어디서 온 메일인지»가 첫 줄에 선다. 이미지는 안 쓴다(차단되면 빈칸).
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

/** 🏦사장님이 정산 계좌를 등록하는 자리(09-17). `/rent/my`의 그 절로 곧장 내려간다. */
const PAYOUT_ACCOUNT_LINK = `${SITE_URL}/rent/my?tab=host#payout-account`;

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
//   주소 줄 앞의 줄바꿈은 한 칸으로, 나머지 줄바꿈은 「 / 」로. 한 칸으로만 펴면 단계·바뀐 항목의 경계가 사라졌다(09-18).
function textRows(rows: [string, string][]): string[] {
  return rows
    .filter(([, v]) => v.trim())
    .map(([k, v]) => `${k}: ${v.replace(/\n(?=https?:\/\/)/g, " ").replace(/\n/g, " / ")}`);
}

/** 버튼 아래 마지막 안내. 링크가 붙으면 글 끝에 밑줄 글자로 선다.
 *  💬09-18 완료 화면 대표 코멘트(#30) 「collab5에 궁금 사항이 있으신가요? 문의하기(밑줄)」를 메일에도 같은 자리에 옮겼다.
 *    전엔 카카오톡 주소가 날것으로 문장 끝에 찍혔다. */
type Tail = string | { text: string; href: string; label: string };

const ASK = (text: string): Tail => ({ text, href: KAKAO_CHAT_URL, label: "문의하기" });

function tailHtml(tail: Tail): string {
  const inner = typeof tail === "string"
    ? esc(tail)
    : `${esc(tail.text)} <a href="${esc(tail.href)}" style="color:${MAIL.body};text-decoration:underline;text-underline-offset:2px;white-space:nowrap">${esc(tail.label)}</a>`;
  return `<p style="margin:20px 0 0;color:${MAIL.mute};font-size:14px;word-break:keep-all">${inner}</p>`;
}

function tailText(tail: Tail): string {
  return typeof tail === "string" ? tail : `${tail.text} ${tail.label}: ${tail.href}`;
}

/** ⚖️맨 끝 작은 글씨 한 줄(09-19 통신판매중개자 고지). 본문과 선 하나로 갈라 «안내»가 아니라 «고지»로 읽히게 한다. */
function noteHtml(note: string): string {
  return `<p style="margin:24px 0 0;padding-top:14px;border-top:1px solid #EEEEF0;color:${MAIL.faint};font-size:12px;line-height:1.6;word-break:keep-all">${esc(note)}</p>`;
}

function layout(
  lead: string, rows: [string, string][], link: { href: string; label: string }, tail?: Tail, note?: string,
): string {
  const tr = rows
    .filter(([, v]) => v.trim().length > 0)
    .map(
      ([k, v]) =>
        `<tr><td style="width:88px;padding:5px 12px 5px 0;color:${MAIL.mute};vertical-align:top;white-space:nowrap">${esc(k)}</td><td style="padding:5px 0;color:${MAIL.body};word-break:keep-all;overflow-wrap:anywhere">${cell(v)}</td></tr>`,
    )
    .join("\n      ");
  const [head, rest] = splitLead(lead);
  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:${MAIL.ink};max-width:560px">
  <p style="margin:0 0 20px;font-size:13px;font-weight:600;color:${MAIL.faint};letter-spacing:0.01em">collab5 · 하루 팝업</p>
  ${head ? `<p style="margin:0 0 8px;font-size:20px;line-height:1.4;font-weight:700;color:${MAIL.ink};word-break:keep-all">${esc(head)}</p>` : ""}
  <p style="margin:0 0 20px;color:${MAIL.body};word-break:keep-all">${esc(rest)}</p>
  <div style="background:${MAIL.soft};border-radius:12px;padding:12px 16px">
    <table style="border-collapse:collapse;font-size:15px;width:100%">
      ${tr}
    </table>
  </div>
  <p style="margin:24px 0 0"><a href="${esc(link.href)}" style="display:inline-block;padding:13px 22px;border-radius:12px;background:${MAIL.kiwi};color:#222;text-decoration:none;font-weight:600">${esc(link.label)}</a></p>
  ${tail ? tailHtml(tail) : ""}
  ${note ? noteHtml(note) : ""}
</div>`;
}

/** 📨HTML과 글자판을 «한 번에» 만든다(09-18 메일 전수).
 *  🩸전엔 통마다 글자판을 따로 조립해서, 수락 → 손님 메일의 마지막 안내가 HTML에만 있고 글자판엔 빠져 있었다.
 *    버튼 이름도 글자판에선 「자세히 보기」·「예약 내역」처럼 HTML과 달랐다. 이제 같은 재료에서 둘이 같이 나온다. */
function compose(
  lead: string, rows: [string, string][], link: { href: string; label: string }, tail?: Tail, note?: string,
): { html: string; text: string } {
  const text = [
    lead,
    ``,
    ...textRows(rows),
    ``,
    `${link.label}: ${link.href}`,
    ...(tail ? [tailText(tail)] : []),
    ...(note ? [``, note] : []),
  ].join("\n");
  return { html: layout(lead, rows, link, tail, note), text };
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
  /** 🧮09-19 — 일부러 건너뛴 이유. 비어 있는데 `sent`가 false면 «보내려다 실패»다. 아침 요약이 실패만 센다. */
  skipped?: "mock" | "no-key" | "no-recipient";
  subject: string;
  html: string;
  text: string;
}

/** 한 통 보내기. ⚠️수신자가 비어 있으면(카카오 가입은 이메일이 없을 수 있다) 보낼 곳이 없으니 스킵. 에러가 아니다.
 *  🔻09-19 대표 — 대표(`ADMIN_EMAIL`) 참조(cc)를 뺐다. 「이메일 말고 slack이나 채널톡 같은 서비스로 우회해서 무료로」.
 *    거래마다 대표 메일이 한 통씩 더 나가 무료 한도를 먹었다. 대표가 봐야 하는 흐름은 슬랙 하루 요약(`buildAdminDaily`)이 맡는다. */
async function send(to: string, subject: string, html: string, text: string): Promise<MailResult> {
  const out: MailResult = { sent: false, subject, html, text };
  // 🧪09-18 목 데이터 보기 중(개발 빌드 전용)엔 보내지 않는다. 첫 울타리는 `rent-actions.ts` 액션 첫 줄.
  if (await rentMockOn()) {
    console.info(`[rent-notify] 스킵(목 데이터 보기 중) · ${subject}`);
    return { ...out, skipped: "mock" };
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.info(`[rent-notify] 스킵(RESEND_API_KEY 없음) → ${to || "(수신자 없음)"} · ${subject}`);
    return { ...out, skipped: "no-key" };
  }
  if (!to) {
    console.info(`[rent-notify] 스킵(수신자 이메일 없음) · ${subject}`);
    return { ...out, skipped: "no-recipient" };
  }
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
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

/** 커피챗을 같이 샀는가. 새 칸(`amountChat`)과 옛 칸(`amountMentor`) 둘 중 하나라도 돈이 있으면 샀다.
 *  🔁09-19 무료 커피챗은 값이 0이라 `withChat`까지 보는 한 벌(`bookingHasChat`)로 옮겼다. */
function boughtChat(b: SpaceBooking): boolean {
  return bookingHasChat(b);
}

/** ☕커피챗 칸 — 손님 메일 셋(결제·확정·전날)과 사장님 메일 셋(요청·수락·전날)이 같은 모양이다.
 *  「언제」 문장은 `rent-copy` 한 줄(대표 09-17)이고, 앞에 «샀다»는 사실만 받는 사람 쪽으로 붙인다.
 *  🩸09-18 전엔 확정 메일(손님)에 이 칸이 없었고, 전날 메일 둘은 «샀다»는 말 없이 시간 문장만 있었다. */
function chatRow(b: SpaceBooking, forHost: boolean): [string, string] {
  if (!boughtChat(b)) return [LABEL.chat, ""];
  // ☕09-19 무료 커피챗 — 값이 0이면 「무료」를 붙인다. 사장님은 돈을 안 받는 약속인지 여기서 알아야 하고, 손님은 결제액에 커피챗이 없는 이유를 안다.
  const free = !(b.amountChat > 0 || b.amountMentor > 0) ? `${COFFEE_CHAT_FREE} ` : "";
  return [LABEL.chat, forHost ? `손님이 ${free}커피챗도 함께 골랐어요. ${COFFEE_CHAT_WHEN_HOST}` : `${free}커피챗도 함께 예약하셨어요. ${COFFEE_CHAT_WHEN_GUEST}`];
}

/** 🛍고른 상품 한 줄(09-18) — 「공간 전체 · 자리에 시설과 장비까지 같이 써요」.
 *  사장님 메일엔 「손님이」를 붙인다. 공간 전체면 그날 시설까지 준비해 둬야 해서 사장님이 먼저 알아야 한다.
 *  ⭐이름은 `PRODUCT_LABEL` 한 벌. 화면(확인 팝업·결제·완료)과 같은 말이다. */
function productLine(b: SpaceBooking, forHost = false): string {
  return `${PRODUCT_LABEL[b.product]} · ${forHost ? "손님이 " : ""}${PRODUCT_HINT_GUEST[b.product]}`;
}

/** 🔗공간 페이지 — 유의 사항·사진을 그날 아침 다시 보는 자리(09-17 QA: 결제 완료 메일에 링크가 없었다). */
function spaceLink(space: Space): string {
  return `${SITE_URL}/rent/${encodeURIComponent(space.slug)}`;
}

/** 🏠손님 메일의 「빌리는 공간」 칸 — 이름 오른쪽에 「열어 보기」 칩(09-18 메일 전수).
 *  대표 #60 「소개서명 우측으로」를 같은 모양의 다른 자리에 옮겼다. 전엔 「공간 페이지」 칸이 따로 서서
 *    칸 이름만 있고 값은 칩 하나였다. 이름과 링크가 두 줄로 갈라져 읽혔던 소개서 칸과 같은 병이다. */
function spaceRowWithLink(space: Space): [string, string] {
  return [LABEL.space, `${space.name}\n${spaceLink(space)}`];
}

/** 💰사장님 몫 한 줄 — 요청 메일과 수락 메일이 같은 모양이다(09-18 메일 전수).
 *  🩸전엔 요청 메일은 「127,500원 (손님이 낸 돈 150,000원)」, 수락 메일은 「117,300원」만이라 같은 칸이 두 모양이었다.
 *  수수료율은 예약마다 적힌 값(`feeRate`)이다. 요율이 바뀌어도 이미 성사된 거래엔 그때 요율이 간다(호스트 약관 제9조). */
function payoutLine(b: SpaceBooking): string {
  const rate = Math.round((b.feeRate || 0) * 100);
  return `${won(b.amountPayout)}이에요. 손님이 결제한 ${won(b.amountTotal)}에서 수수료 ${rate}%를 뺐어요.`;
}

/** 취소·환불 규정 한 줄. 상세 페이지 «환불 규정» 절과 호스트 약관 제8조의 숫자 그대로다 — 바뀌면 셋 다.
 *  🔁09-19 대표 — 전액 창이 «결제하고 한 시간»에서 «사장님이 수락하신 뒤 한 시간»으로 옮겨 갔다(`GRACE_MINUTES`).
 *  🆕09-19 오후 대표 — 수락 전 취소는 전액(`CancelStage`). 이 메일은 결제 직후, 곧 수락 전에 나간다.
 *    그래서 손님이 지금 서 있는 구간(수락 전 전액)을 먼저 말하고, 수락 뒤 한 시간과 표를 차례로 붙인다. */
const CANCEL_POLICY_LINE =
  "사장님이 수락하시기 전에 취소하시면 전액 돌려드려요. 수락하신 뒤에도 한 시간 안이면 전액이고, 그 뒤엔 이용일 7일 전까지 전액, 3일 전까지 70%, 1일 전까지 50%를 돌려드려요. 당일은 환불이 없어요.";

/** 🏦계좌가 없을 때의 한 줄 — 공개 메일과 수락 메일이 같이 쓴다(09-18 메일 전수. 전엔 두 통의 말이 달랐다).
 *  「이용이 끝나면」 = 호스트 약관 제9조 「정산은 이용이 끝난 것을 확인한 뒤」. 날짜는 말하지 않는다(토스 계약 뒤 대표가 정한다).
 *  주소는 줄을 바꿔 둔다. `cell`이 문장 오른쪽에 「등록하기」 칩으로 붙인다. */
const PAYOUT_ACCOUNT_MISSING = `아직 등록 전이에요. 이용이 끝나면 받으실 돈을 보낼 곳이라 미리 적어 두세요.\n${PAYOUT_ACCOUNT_LINK}`;

// ─── 이 아래는 통마다 «무슨 일이 났나»만 적는다. 칸 이름은 위 `LABEL`, 틀은 `compose`. ───

/** ① 결제 완료 → 사장님. 손님이 누구인지·언제·얼마인지와 답하러 갈 곳.
 *  📇09-16 `guestBrand` — 손님이 신청 때 고른 소개서. 있으면 사장님이 누가 오는지 미리 볼 수 있게 링크를 단다. */
export function buildBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  guestBrand?: { name: string; slug: string },
): Mail {
  // 🔁09-16 대표 — 「신청했어요」 → 「예약이 들어왔어요」. 09-17 대표 결정 4로 한 번 더 — 사장님 쪽에 들어온 것은 «요청»,
  //   수락한 뒤가 «예약»이다. 제목 문장은 `BOOKING_HEADLINE.hostPaid` 한 벌을 쓴다.
  // ✂️09-18 대표 #57 — 「제목에 정보가 너무 많다」. 날짜와 무슨 일만 남기고 공간 이름·금액은 본문 표로 내렸다.
  //   공간이 여럿인 사장님은 지금 기준(소상공인 한 곳) 밖이라 제목에서 공간을 가르지 않는다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.hostPaid}`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const brandLine = guestBrand?.slug
    ? `${guestBrand.name.trim() || displayName(guest, "소개서")}\n${SITE_URL}/m/${encodeURIComponent(guestBrand.slug)}`
    : "";
  const rows: [string, string][] = [
    guestNameRow(booking, guest),
    [LABEL.brand, brandLine],
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking, true)],
    [LABEL.plan, booking.plan],
    // ☕사장님이 커피챗을 해 줘야 하는 신청인지 — 09-16까지 이 메일에 없었다.
    chatRow(booking, true),
    [LABEL.payout, payoutLine(booking)],
  ];
  // ❓«답해야 하나»를 첫 줄에서 말한다(09-17 QA). 🧭09-17 대표 — 요청 확인 → 수락·거절 → 2일 안에 공간 안내.
  // 🔁09-18 대표 #58 — 「연락처가 열려요」 → 「연락처를 보실 수 있어요」.
  const lead = `${BOOKING_HEADLINE.hostPaid}. 결제는 이미 끝났어요. 날짜와 손님이 적은 계획을 읽어 보시고 수락하거나 거절해 주세요. 수락하시면 손님 연락처를 보실 수 있어요.`;
  const tail = `거절은 이용 시작 전까지 할 수 있고, 손님께 전액 돌아가요. ${CONTACT_RULE_HOST}`;
  // ⚖️09-19 대표 — 결제 메일 끝에 통신판매중개자 한 줄(`BROKER_NOTE`).
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "들어온 요청 보기" }, tail, BROKER_NOTE) };
}

/** 보내는 쪽 — 문장은 `buildBookingPaid`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingPaid(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  guestBrand?: { name: string; slug: string },
): Promise<MailResult> {
  return sendMail(buildBookingPaid(booking, space, host, guest, guestBrand));
}

/** ①' 결제 완료 → 손님 (09-16 phase 1). 채팅이 없는 지금은 결제가 곧 예약 완료라, 손님이 알아야 할 것을 이 한 통에 다 담는다.
 *  사장님 연락처도 여기서 열린다 — 사장님 답을 기다리게 하지 않기로 했다(대표 09-16, `guestSeesHost`).
 *  🚨옛 「들어오는 법」(`space.accessNote`)은 넣지 않는다. 출입 비밀번호가 적혀 있을 수 있는 칸이다. */
export function buildBookingPaidToGuest(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  const hostName = displayName(host, "사장님");
  // 🔁09-17 대표 결정 4 — 제목·첫 줄은 `BOOKING_HEADLINE.guestPaid`. ✂️09-18 대표 #57과 같은 결 — 제목은 날짜와 무슨 일만.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.guestPaid}`;
  const link = `${SITE_URL}/rent/requests`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const meet = accessMeetLine(space.accessHow);
  const lead = `${BOOKING_HEADLINE.guestPaid}. 사장님 연락처와 이용 안내를 함께 담았어요.`;
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    spaceRowWithLink(space),
    [LABEL.product, productLine(booking)],
    [LABEL.address, space.address],
    [LABEL.paid, won(booking.amountTotal)],
    chatRow(booking, false),
    [LABEL.hostContact, `${hostName} · ${contact}`],
    [LABEL.access, [CONTACT_RULE_GUEST, meet].filter(Boolean).join(" ")],
    [LABEL.policy, CANCEL_POLICY_LINE],
  ];
  const tail = ASK("사장님과 연락이 잘 닿지 않으면 알려 주세요.");
  // ⚖️09-19 대표 — 결제 메일 끝에 통신판매중개자 한 줄(`BROKER_NOTE`).
  return { to: guest?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 예약 보기" }, tail, BROKER_NOTE) };
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
  const subject = `[collab5] ${subjectDate(booking.useDate)}, ${BOOKING_HEADLINE.guestConfirmed}`;
  const link = `${SITE_URL}/rent/done/${booking.id}`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const meet = accessMeetLine(space.accessHow);
  // 🩸09-16까지 「그날 오시기만 하면 돼요」 — 원상복구·판매 금지 같은 유의 사항이 있는 공간과 부딪혔다(09-17 QA).
  const lead = `${BOOKING_HEADLINE.guestConfirmed}. 가시기 전에 공간 페이지에서 유의 사항을 한 번 읽어 봐 주세요.`;
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    spaceRowWithLink(space),
    [LABEL.product, productLine(booking)],
    [LABEL.address, space.address],
    // 📨연락 규칙은 «수락이 막 끝난» 모양으로(`CONTACT_RULE_GUEST_CONFIRMED`). 결제 메일의 「확정하면」을 그대로 두면 끝난 일을 조건으로 말한다.
    [LABEL.access, [CONTACT_RULE_GUEST_CONFIRMED, meet].filter(Boolean).join(" ")],
    [LABEL.hostContact, `${hostName} · ${contact}`],
    [LABEL.hostNote, booking.hostMessage],
    // ☕확정 뒤 사장님 연락이 오면 커피챗 시간을 같이 정한다 — 바로 이 메일이 그 때라 여기에도 둔다.
    chatRow(booking, false),
  ];
  const tail = "사장님께 미리 연락해 두시는 것도 좋아요.";
  return { to: guest?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "예약 자세히 보기" }, tail) };
}

/** 보내는 쪽 — 문장은 `buildBookingConfirmed`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingConfirmed(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingConfirmed(booking, space, host, guest));
}

/** 사장님이 이용 «전날» 챙길 일. `accessHowLine`은 손님에게 하는 말이라 사장님 쪽으로 돌려 적는다. */
function hostTodoLine(how: Space["accessHow"]): string {
  if (how === "sms") return "이용 전에 손님께 문자나 전화로 이용 안내를 전해 주세요.";
  if (how === "onsite") return "이용 전에 손님을 직접 만나서 안내해 주세요.";
  return "문자나 전화로 먼저 안내해 주시고, 이용 전에 한 번 만나서 알려 주세요.";
}

/** 수락 메일의 챙기실 일 — 연락 규칙(`CONTACT_RULE_HOST`) 뒤에 «만나서 안내»만 더한다(09-18 메일 전수).
 *  🩸전엔 `hostTodoLine` + 규칙을 이어 붙여 「문자나 전화로」가 한 칸에 두 번 나왔다. */
function hostMeetLine(how: Space["accessHow"]): string {
  if (how === "onsite") return "이용 전에 손님을 직접 만나서 안내해 주세요.";
  if (how === "both") return "이용 전에 한 번 만나서 다시 알려 주세요.";
  return "";
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
  const lead = `${when} 예약을 수락하셨어요. 이제 손님께 직접 연락하실 수 있어요.`;
  // 「관리자에게 환불 신청하기」 = 내 하루 팝업의 그 버튼 이름 그대로(`my/Actions.tsx`). 확정 예약 줄에 뜬다.
  const tail =
    "사정이 생겨 이 예약을 무르셔야 하면 내 하루 팝업에서 「관리자에게 환불 신청하기」를 눌러 주세요. 저희가 두 분께 전화로 여쭤본 뒤 처리할게요.";
  const rows: [string, string][] = [
    guestNameRow(booking, guest),
    [LABEL.guestContact, guestContact],
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking, true)],
    [LABEL.plan, booking.plan],
    [LABEL.todo, [CONTACT_RULE_HOST, hostMeetLine(space.accessHow)].filter(Boolean).join(" ")],
    chatRow(booking, true),
    [LABEL.payout, payoutLine(booking)],
    // 🏦09-17 — 계좌가 없으면 이용일 뒤에 보낼 곳이 없다.
    [LABEL.payoutAccount, hasPayoutAccount === false ? PAYOUT_ACCOUNT_MISSING : ""],
  ];
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 하루 팝업 보기" }, tail) };
}

/** 보내는 쪽 — 문장은 `buildBookingConfirmedToHost`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingConfirmedToHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
  /** 🏦정산 받을 계좌가 있나(09-17). 모르면 undefined — 그땐 말하지 않는다(없는 줄 알고 조르지 않게). */
  hasPayoutAccount?: boolean,
): Promise<MailResult> {
  return sendMail(buildBookingConfirmedToHost(booking, space, host, guest, hasPayoutAccount));
}

/** ③ 거절 → 손님. 전액 환불이라는 사실이 첫 문장에 있어야 한다.
 *  ⚠️호출부는 토스 환불이 «성공한 뒤에만» 부른다(`decideBookingAction`). 실패면 이 메일은 안 나간다. */
export function buildBookingRejected(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  void host;
  // ✂️09-18 대표 #57과 같은 결 — 날짜와 무슨 일만. 금액·공간 이름은 본문으로. «전액»은 이 메일의 요점이라 남긴다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 사장님이 어렵다고 하셔서 전액 돌려드려요`;
  const link = `${SITE_URL}/rent`;
  const lead = `사장님이 이번엔 어렵다고 하셨어요. ${won(booking.amountTotal)}은 전액 돌려드려요.`;
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking)],
    // 💳금액은 한 줄, 들어오는 때는 다음 줄(09-18). 넷이 모두 「N원이에요.」로 시작해 한 금형으로 읽혔다.
    [LABEL.refund, `${won(booking.amountTotal)} 전액\n${REFUND_TIMING_LINE}`],
    [LABEL.hostNote, booking.hostMessage],
  ];
  return { to: guest?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "다른 공간 둘러보기" }) };
}

/** 보내는 쪽 — 문장은 `buildBookingRejected`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyBookingRejected(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildBookingRejected(booking, space, host, guest));
}

/** ④ 손님 취소 → 사장님. 그날이 다시 비는 날이 됐다는 것만. */
export function buildBookingCancelled(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Mail {
  // 🔁09-17 QA — 「신청을 취소」였는데 손님 화면은 결제 뒤 «예약»이다. 사장님이 받은 건 이미 결제된 예약이라 «예약»으로.
  // ✂️09-18 대표 #57과 같은 결 — 제목에서 손님 이름·공간 이름을 뺐다. 🪪이름은 표의 「성함」 칸이 든다.
  //   실명을 문장 주어로 세우면 「한서윤이 취소했어요」처럼 맨이름이 돼서, 문장은 「손님이」로 두고 이름은 표로 보낸다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 손님이 예약을 취소했어요`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const rows: [string, string][] = [
    guestNameRow(booking, guest),
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking, true)],
  ];
  // 「다시 비었어요」 = 겹침 제약(`no_time_overlap`)이 paid·confirmed·done만 막는다. 취소된 예약은 자리를 안 잡는다.
  const lead = `손님이 예약을 취소했어요. 그 시간이 다시 비었어요.`;
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 하루 팝업 보기" }) };
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
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const full = refund >= booking.amountTotal;
  const link = `${SITE_URL}/rent/requests`;
  // ✂️09-18 대표 #57과 같은 결 — 날짜와 무슨 일만. 돌려드리는 금액은 첫 문장과 표가 말한다.
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 예약을 취소했어요`;
  // ✂️09-18 메일 전수 — 첫 문장에서 날짜·공간 이름을 뺐다. 제목과 표에 이미 있고, 굵은 제목 줄이 두 줄로 꺾였다.
  const lead = refund === 0
    // 0원은 수락하고 한 시간이 지난 당일 취소뿐이다(`guestCancelRefundPercent` — 수락 전은 전액, 1일 전까지는 50%라도 돌아간다).
    ? `예약을 취소했어요. 당일 취소라 돌려드릴 돈이 없어요.`
    : full
      ? `예약을 취소했어요. 결제하신 ${won(booking.amountTotal)}을 전액 돌려드려요.`
      : `예약을 취소했어요. 취소 규정에 따라 ${won(refund)}을 돌려드려요.`;
  const tail = refund > 0 ? undefined : ASK("규정이 궁금하시거나 따로 사정이 있으시면 편하게 물어봐 주세요.");
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking)],
    [LABEL.paid, won(booking.amountTotal)],
    [LABEL.refund, refund === 0 ? "없어요" : `${won(refund)}${full ? " 전액" : ""}\n${REFUND_TIMING_LINE}`],
  ];
  return { to: guest?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 예약 보기" }, tail) };
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
  const refund = Math.max(0, Math.floor(refundAmount || 0));
  const full = refund >= booking.amountTotal;
  const amount = full ? `${won(refund)} 전액` : won(refund);
  // ✂️09-18 대표 #57과 같은 결 — 두 통 다 제목은 날짜와 무슨 일만. 금액·공간·손님 이름은 본문으로.
  const sDate = subjectDate(booking.useDate);

  // → 손님
  const gLink = `${SITE_URL}/rent`;
  // 🔁09-18 메일 전수 — 제목 「예약이 취소돼 전액 돌려드렸어요」가 거절 메일 제목(「…하셔서 전액 돌려드려요」)과 한 틀이었다.
  //   이 메일의 요점은 «왜 취소됐나»라 그쪽을 제목에 세우고, 금액은 첫 문장과 표로 보냈다.
  const gSubject = `[collab5] ${sDate}, 사장님 사정으로 예약이 취소됐어요`;
  const gLead = `사장님 사정으로 예약이 취소됐어요. 갑자기 일정이 바뀌어 번거로우셨죠. ${full ? "결제하신 돈은 모두" : `결제하신 돈 중 ${won(refund)}을`} 돌려드려요.`;
  const gRows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking)],
    [LABEL.refund, `${amount}\n${REFUND_TIMING_LINE}`],
  ];
  const g = compose(gLead, gRows, { href: gLink, label: "다른 공간 둘러보기" });

  // → 사장님
  const hLink = `${SITE_URL}/rent/my?tab=host`;
  const hSubject = `[collab5] ${sDate}, 신청하신 환불을 처리했어요`;
  // 🪪손님 이름은 문장에서 빼고 표의 「성함」 칸으로(09-18). 실명이 문장 주어로 서면 맨이름이 된다.
  const hLead = `신청하신 환불을 처리했어요. 예약은 취소됐고, 손님께 ${amount}을 돌려드렸어요.`;
  const hTail = "확인 전화에 시간 내 주셔서 고마워요.";
  const hRows: [string, string][] = [
    guestNameRow(booking, guest),
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, productLine(booking, true)],
    [LABEL.refund, amount],
    // 호스트 약관 제8조 「환불된 예약은 호스트 정산에서 제외」. 관리자 환불은 남은 돈 전액이라 사장님 몫이 없다.
    [LABEL.payout, "없어요. 이 예약은 정산에서 빠져요."],
  ];
  const h = compose(hLead, hRows, { href: hLink, label: "내 하루 팝업 보기" }, hTail);

  return [
    { to: guest?.email ?? "", subject: gSubject, ...g },
    { to: host?.email ?? "", subject: hSubject, ...h },
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
  // 🔁09-18 메일 전수 — 「올리신 공간이 … 올라갔어요」가 한 문장에 «올리다»를 두 번 썼다. 무슨 일이 끝났는지(검토)를 앞에 둔다.
  const subject = `[collab5] 검토를 마치고 공간을 목록에 열었어요`;
  const link = spaceLink(space);
  const lead = `${withJosa(space.name, "을/를")} 하루 팝업 목록에 열어 드렸어요. 이제 손님들이 보고 예약할 수 있어요.`;
  // 네 단계는 순서가 곧 정보라 번호를 붙인다(`HOST_REQUEST_STEPS` 주석과 같은 이유).
  const steps = HOST_REQUEST_STEPS.map((line, i) => `${i + 1}. ${line}`).join("\n");
  const rows: [string, string][] = [
    [LABEL.steps, steps],
    [LABEL.payoutAccount, hasPayoutAccount === false ? PAYOUT_ACCOUNT_MISSING : ""],
  ];
  // 🔁09-18 메일 전수 — 마지막 안내 여섯 통이 「~면」으로 열려 한 금형이었다. 이 통은 조건 없이 할 수 있는 일로 말한다.
  const tail = "내 하루 팝업의 「잠시 쉬기」로 한동안 목록에서 빼 둘 수 있어요. 이미 받은 예약은 그대로예요.";
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 공간 보기" }, tail) };
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
  const subject = `[collab5] 내일${start ? ` ${start}` : ""}, 하루 팝업 예약이 있어요`;
  const link = `${SITE_URL}/rent/requests`;
  const contact = hostContactLine(space.contactPhone, host?.phone, host?.email);
  const lead = `내일은 ${withJosa(space.name, "을/를")} 예약하신 날이에요. 시간과 주소를 한 번 더 적어 둘게요.`;
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    spaceRowWithLink(space),
    [LABEL.product, productLine(booking)],
    [LABEL.address, space.address],
    [LABEL.hostContact, `${hostName} · ${contact}`],
    chatRow(booking, false),
  ];
  // 손님 약관 제10조 — 「연락이 없으면 회사 고객센터로 알려 주세요」.
  const tail = ASK("사장님께 이용 안내를 아직 못 받으셨나요? 저희가 사장님께 먼저 연락해 볼게요.");
  return { to: guest?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "내 예약 보기" }, tail) };
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
    ? `[collab5] 내일${start ? ` ${start}` : ""}, 하루 팝업 손님이 오세요`
    : `[collab5] 내일${start ? ` ${start}` : ""}, 아직 수락하지 않은 예약이 있어요`;
  const link = `${SITE_URL}/rent/my?tab=host`;
  const gPhone = booking.guestPhone?.trim() || guest?.phone?.trim() || "";
  const gEmail = guest?.email?.trim() ?? "";
  const guestContact = accepted ? [gPhone, gEmail].filter(Boolean).join(" · ") || "연락처를 안 남기셨어요" : "";
  const lead = accepted
    ? `내일 ${space.name}에 손님이 와요. 이용 안내를 아직 못 전하셨다면 오늘 챙겨 주세요.`
    : `내일 ${space.name}에 손님이 와요. 아직 수락 전인 예약이라, 오늘 들어가서 수락해 주세요.`;
  // 🔁09-18 메일 전수 — 칸 순서를 요청·수락 메일과 같게(성함이 맨 위). 「오늘 챙기실 일」 → 「챙기실 일」(수락 메일과 같은 이름).
  const rows: [string, string][] = [
    guestNameRow(booking, guest),
    [LABEL.guestContact, guestContact],
    [LABEL.when, bookingWhen(booking)],
    [LABEL.product, productLine(booking, true)],
    [LABEL.plan, booking.plan],
    // 🔁09-18 대표 #58 — 「연락처가 열리니」 → 「연락처를 보실 수 있으니」.
    [LABEL.todo, accepted
      ? hostTodoLine(space.accessHow)
      : "수락하시면 손님 연락처를 보실 수 있어요. 그때 바로 이용 안내를 보내 주세요."],
    chatRow(booking, true),
  ];
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: accepted ? "내 하루 팝업 보기" : "수락하러 가기" }) };
}

/** 보내는 쪽 — 문장은 `buildRemindHost`가 만든다(09-17 메일 미리보기 `/dev/rent-mail`이 같은 함수를 부른다). */
export async function notifyRemindHost(
  booking: SpaceBooking, space: Space, host: Profile | null, guest: Profile | null,
): Promise<MailResult> {
  return sendMail(buildRemindHost(booking, space, host, guest));
}

/** 검토로 내려가기 «전» 공간의 모양 — 새 공간이면 null. */
export type SpaceReviewPrev = Pick<Space, "name" | "address" | "status"> & {
  /** 🧾09-19 저녁 이번 저장이 검토로 간 이유(`spaceSaveReview`). 없으면 이름·주소를 비교해 가른다(옛 호출부·미리보기). */
  why?: ReviewWhy;
  /** 🔁보완해서 다시 보냈을 때 — 관리자가 남겼던 사유. 알림에 「부탁드린 내용」으로 싣는다. */
  fixNote?: string;
};

/** 🚫공개가 막힌 공간인가 — `publishSpaceAction`의 세 관문과 같다(빈 사업자 정보 · 기록과 다름 · 휴업·폐업). */
function bizBlocked(sp: Space): boolean {
  // 🧪`bizOnFile` — 운영에선 로컬 테스트 번호도 빈 번호다(`publishSpaceAction`과 같은 판정).
  return !bizOnFile(sp) || !sp.bizOwnerName || !sp.bizOpenDate || !sp.bizCertPath
    || sp.bizCheckStatus === "mismatch" || sp.bizCheckStatus === "closed";
}

/** 🧾국세청 조회 결과를 대표가 읽는 말로(09-18). 칩 글자(`BIZ_CHECK_LABEL`)는 검토 화면 몫이고, 메일은 «그래서 열 수 있나»까지 말한다.
 *  판정은 `publishSpaceAction`과 같다 — 다름·휴업·폐업·빈 칸은 못 열고, 조회 전·실패는 등록증을 보고 연다.
 *  🔒사업자등록번호·대표자 이름 원문은 싣지 않는다. 메일은 전달·보관되는 물건이라 검토 화면에서만 본다. */
function bizCheckLine(sp: Space): string {
  const d = sp.bizCheckDetail;
  if (!sp.bizNumber || !sp.bizOwnerName || !sp.bizOpenDate || !sp.bizCertPath) return "사업자 정보나 등록증이 비어 있어요. 사장님이 채우시기 전엔 열 수 없어요.";
  switch (sp.bizCheckStatus) {
    case "valid": {
      const more = [d?.bStt, d?.taxType].filter(Boolean).join(" · ");
      return `국세청 기록과 맞아요.${more ? ` ${more}로 나와요.` : ""}`;
    }
    case "mismatch":
      return "국세청 기록과 달라요. 번호·대표자 이름·개업일 중 하나가 달라서, 사장님이 고치시기 전엔 열 수 없어요.";
    case "closed":
      return "휴업이나 폐업으로 나와요. 이대로는 열 수 없어요.";
    case "error":
      return "국세청 조회가 실패했어요. 등록증을 보고 정해 주세요. 열어도 확인 표시는 안 붙어요.";
    default:
      return d?.reason === "no-key"
        ? "국세청 키가 없어 아직 조회 전이에요. 등록증을 보고 정해 주세요. 열어도 확인 표시는 안 붙어요."
        : "아직 조회 전이에요. 등록증을 보고 정해 주세요. 열어도 확인 표시는 안 붙어요.";
  }
}

/** 🏪네이버 상호 매칭 한 줄(09-18). 검토 화면의 「네이버」 칸과 같은 사실을 말한다. */
function placeLine(sp: Space): string {
  return sp.placeMatchedAt && sp.placeName
    ? `같은 가게가 있어요. ${sp.placeName} · ${sp.placeAddress}`
    : "같은 가게를 못 찾았어요. 상세 지도엔 주소 핀만 보여요.";
}

/** ⑧ 공간이 검토 대기로 들어왔다 → 대표 (09-18).
 *  대표: 「나한테도 메일 오나? 내가 등록 처리해 줘야 하는데 어떻게 확인하지?」. 전엔 검토 대기가 생겨도 아무 알림이 없었다.
 *  ⚠️호출부(`saveSpaceAction`)가 «처음 검토 대기로 들어올 때만» 부른다 — 새 공간이거나, 검토 대기가 아니던 공간의 이름·주소가 바뀌었을 때.
 *    검토 대기 중에 사장님이 여러 번 고쳐 저장해도 더 안 간다. 그래서 메일 뒤에 바뀐 것은 검토 화면이 맞다고 끝에 적는다.
 *  받는 사람은 운영자 한 명이라 `to`를 비워 두고 보내는 쪽이 `ADMIN_EMAIL`로 채운다(가입 알림과 같은 방식). */
export function buildSpaceReviewNotice(space: Space, owner: Profile | null, prev: SpaceReviewPrev | null): AdminNotice {
  const renamed = !!prev && prev.name.trim() !== space.name.trim();
  const moved = !!prev && prev.address.trim() !== space.address.trim();
  const again = !!prev && (renamed || moved);
  // 🔁09-19 저녁 — 보완을 부탁드린 공간을 사장님이 고쳐 다시 보냈다. 이름·주소를 바꿨어도 이 말이 먼저다(관리자가 기다리던 답이라서).
  const resubmit = prev?.why === "resubmit";
  // 🧾09-19 저녁 — 번호가 비어 있던 공간이 처음 채웠다. 이름·주소는 그대로라 「새로 올라와」도 「바뀌어」도 아니다.
  const bizFirst = !again && prev?.why === "biz-first";
  const what = renamed && moved ? "이름과 주소가" : renamed ? "이름이" : "주소가";
  const whatObj = renamed && moved ? "이름과 주소를" : renamed ? "이름을" : "주소를";
  const whatBare = renamed && moved ? "이름과 주소" : renamed ? "이름" : "주소";
  const subject = resubmit
    ? `[collab5] ${space.name}, 보완해서 다시 보냈어요`
    : again
    ? `[collab5] ${space.name}, ${what} 바뀌어 다시 검토를 기다려요`
    : bizFirst
      ? `[collab5] ${space.name}, 사업자 정보를 채워 검토를 기다려요`
      : `[collab5] ${space.name}, 새로 올라와 검토를 기다려요`;
  const link = `${SITE_URL}/rent/review`;
  // 공개 중이던 공간은 검토 대기로 내려가는 순간 목록에서 빠진다(목록은 `open`만 읽는다). 대표가 서두를 이유라 첫 문장 뒤에 말한다.
  const wasListed = prev?.status === "open";
  const lead = resubmit
    ? `보완을 부탁드린 공간을 사장님이 고쳐서 다시 보내셨어요. 부탁드린 부분이 맞게 고쳐졌는지 봐 주세요.${again ? ` 매장 ${whatBare}도 바꾸셨어요.` : ""}`
    : again
    ? `공간이 다시 검토를 기다려요. 사장님이 매장 ${whatObj} 바꾸셨어요.${wasListed ? " 다시 열 때까지 목록에서 빠져 있어요." : ""}`
    : bizFirst
      // 번호가 없던 공간은 원래 목록에 없었다(`spaceListed`). 「목록에서 빠져요」는 거짓이라 안 붙인다.
      ? `사업자 정보가 비어 있던 공간에 사장님이 처음 채우셨어요. ${bizBlocked(space) ? "다만 지금은 열 수 없는 상태라, 아래 사업자 확인 칸을 먼저 봐 주세요." : "등록증과 국세청 조회 결과를 보고 공개할지 정해 주세요."}`
      : bizBlocked(space)
      // 열 수 없는 상태면 «정해 주세요»가 헛걸음이다. 막힌 이유는 표의 사업자 확인 칸이 말한다(`publishSpaceAction`과 같은 판정).
      ? `새 공간이 검토를 기다려요. 다만 지금은 열 수 없는 상태라, 아래 사업자 확인 칸을 먼저 봐 주세요.`
      : `새 공간이 검토를 기다려요. 사업자등록증과 국세청 조회 결과를 보고 공개할지 정해 주세요.`;
  const ownerLine = [owner?.brandName?.trim(), owner?.email?.trim()].filter(Boolean).join(" · ") || "프로필을 못 읽었어요";
  // 🔒슬랙 칸엔 사장님 이메일을 안 싣는다(`admin-notify.ts` 머리말). 누구인지는 검토 화면이 보여 준다.
  const ownerBrand = owner ? owner.brandName?.trim() || "브랜드 이름을 비워 두셨어요" : "프로필을 못 읽었어요";
  const rows: [string, string][] = [
    // 바뀐 공간은 새 값 바로 밑에 «전» 값을 둔다(한 칸에 화살표로 몰았더니 폰에서 네 줄로 꺾였다).
    [LABEL.reviewSpace, `${space.name}\n${spaceLink(space)}`],
    [LABEL.fixAsked, resubmit ? (prev?.fixNote ?? "").trim() : ""],
    [LABEL.reviewPrevName, renamed ? prev!.name : ""],
    [LABEL.address, space.address],
    [LABEL.reviewPrevAddress, moved ? prev!.address : ""],
    [LABEL.reviewOwner, ownerLine],
    [LABEL.reviewBiz, bizCheckLine(space)],
    [LABEL.reviewPlace, placeLine(space)],
  ];
  const tail = "이 메일은 검토 대기로 들어온 그때 한 번만 가요. 그 뒤에 사장님이 더 고치신 내용은 검토 화면에 있어요.";
  const go = { href: link, label: "검토하러 가기" };
  return {
    title: subject.replace(/^\[collab5\] /, ""),
    lead,
    rows: rows.map(([k, v]): [string, string] => (k === LABEL.reviewOwner ? [k, ownerBrand] : [k, v])),
    link: go,
    note: "검토 대기로 들어온 그때 한 번만 알려요. 그 뒤에 사장님이 더 고치신 내용은 검토 화면에 있어요.",
    mail: { subject, ...compose(lead, rows, go, tail) },
  };
}

/** ⑫ 보완 요청 → 사장님 (09-19 저녁 대표).
 *  대표 원문: *「보완해 달라는 이메일과, 사장님 입장에서 보완해서 재제출할 수 있는 환경을 만들어 주자!」*
 *  ✍️관리자 말투(「반려되었습니다」·「요건 미충족」)를 쓰지 않는다. 무엇을 봐 달라는지, 고치면 어떻게 되는지, 어디서 고치는지.
 *  사유는 관리자가 적은 글 그대로 싣는다(칩 문장도 해요체로 적어 두었다, `FIX_REASON_CHIPS`).
 *  @param wasListed 공개 중이라 손님 목록에 서 있던 공간인가. 그랬으면 «잠시 내려 두었다»와 «예약은 그대로»를 같이 말한다. */
export function buildSpaceFixRequest(space: Space, host: Profile | null, note: string, wasListed: boolean): Mail {
  const subject = `[collab5] ${space.name}, 한 번 더 확인해 주세요`;
  const lead = `${withJosa(space.name, "을/를")} 읽어 보다가 확인이 필요한 부분이 생겼어요. 아래 내용을 고쳐서 다시 보내 주시면 이어서 볼게요.`;
  const rows: [string, string][] = [
    [LABEL.fixWhat, note.trim()],
    [LABEL.fixNow, wasListed
      ? "고쳐 주실 때까지 목록에서 잠시 내려 두었어요. 이미 받은 예약은 그대로예요."
      : "고쳐 주실 때까지 검토를 잠시 멈춰 두었어요."],
  ];
  const link = `${SITE_URL}/rent/${encodeURIComponent(space.slug)}/edit`;
  const tail = ASK("어떻게 고치면 될지 헷갈리시면 편하게 물어봐 주세요.");
  return { to: host?.email ?? "", subject, ...compose(lead, rows, { href: link, label: "고치고 다시 보내기" }, tail) };
}

/** 보내는 쪽 — 문장은 `buildSpaceFixRequest`가 만든다(미리보기 `/dev/mail/space-fix-request`가 같은 함수를 부른다). */
export async function notifySpaceFixRequest(space: Space, host: Profile | null, note: string, wasListed: boolean): Promise<MailResult> {
  return sendMail(buildSpaceFixRequest(space, host, note, wasListed));
}

/** 메일로 보면 이 모양이다(슬랙이 없을 때 대표가 받는 글 · 미리보기 `/dev/mail/space-review-*`). */
export function buildSpaceReview(space: Space, owner: Profile | null, prev: SpaceReviewPrev | null): Mail {
  const n = buildSpaceReviewNotice(space, owner, prev);
  return { to: "", subject: n.mail!.subject, html: n.mail!.html, text: n.mail!.text };
}

/** 보내는 쪽 — 대표 알림 한 곳(`notifyAdmin`)으로. 슬랙이 있으면 슬랙, 없으면 `ADMIN_EMAIL` 메일. 둘 다 없으면 조용히 건너뛴다. */
export async function notifySpaceReview(
  space: Space, owner: Profile | null, prev: SpaceReviewPrev | null,
) {
  return notifyAdmin(buildSpaceReviewNotice(space, owner, prev));
}

/** ⑨ 사장님의 «관리자에게 환불 신청» → 대표 (09-19).
 *  🩸그 전엔 신청이 들어와도 아무 알림이 없었다. 대표가 정산 화면을 열어야 보였는데, 처리할 사람은 대표 한 명뿐이다.
 *  🔒손님·사장님 연락처는 싣지 않는다(`admin-notify.ts` 머리말). 전화할 번호는 정산 화면의 그 줄에 있다.
 *  ⚠️호출부(`requestRefundAction`)가 «이번에 처음 적었을 때만» 부른다. 이미 신청된 예약을 또 눌러도 안 간다. */
export function buildRefundRequestNotice(
  booking: SpaceBooking, space: Space, host: Profile | null, note: string,
): AdminNotice {
  const subject = `[collab5] ${subjectDate(booking.useDate)}, 사장님이 환불을 신청했어요`;
  const lead = "사장님 사정으로 이 예약을 무르고 싶다고 하셨어요. 사장님과 손님께 전화로 확인하신 뒤 정산 화면에서 승인하거나 닫아 주세요.";
  const rows: [string, string][] = [
    [LABEL.when, bookingWhen(booking)],
    [LABEL.space, space.name],
    [LABEL.product, PRODUCT_LABEL[booking.product]],
    [LABEL.refundHost, displayName(host, "브랜드 이름을 비워 두셨어요")],
    [LABEL.guestPaid, won(booking.amountTotal)],
    [LABEL.refundNote, note.trim() || "적지 않으셨어요"],
  ];
  const go = { href: `${SITE_URL}/rent/payouts`, label: "정산 화면에서 처리하기" };
  const tail = "두 분 연락처는 정산 화면의 이 신청 줄에 있어요. 승인하시면 손님께 남은 돈 전액이 돌아가요.";
  return {
    title: subject.replace(/^\[collab5\] /, ""),
    lead, rows, link: go, note: tail,
    mail: { subject, ...compose(lead, rows, go, tail) },
  };
}

/** 보내는 쪽 — 대표 알림 한 곳(`notifyAdmin`)으로. */
export async function notifyRefundRequest(booking: SpaceBooking, space: Space, host: Profile | null, note: string) {
  return notifyAdmin(buildRefundRequestNotice(booking, space, host, note));
}

/** 💸거래 알림의 갈래 — 돈이 들어오거나 나간 순간. 거절했는데 환불이 실패한 경우는 대표 손이 필요해서 따로 둔다.
 *  🆕09-19 저녁 — 결제 승인 직후 그 시간이 차서 자동 환불한 때(`auto-refund`)와 그 환불마저 실패한 때(`auto-refund-failed`). */
export type DealKind =
  | "paid" | "guest-cancel" | "host-reject" | "host-reject-failed" | "admin-refund"
  | "auto-refund" | "auto-refund-failed";

/** ⑪ 거래 알림 → 대표 슬랙 (09-19 오후).
 *  대표 원문: *「결제 알림 — 슬랙에 그렇게 해줘. 식별 가능한 정보 예약 ID라든지 등과 금액, 회원 번호 등등」*.
 *  🔒사람은 **회원 번호**로만 가리킨다. 이름·이메일·전화는 싣지 않는다(슬랙은 개인정보처리방침의 위탁 목록에 없다).
 *    누구인지는 정산 화면에서 회원 번호·주문번호로 찾는다.
 *  📮슬랙에만 간다(`slackOnly`). 슬랙 주소가 없으면 조용히 건너뛰고 메일로 물러서지 않는다(`admin-notify.ts` 머리말).
 *  @param refund 실제로 돌려준 금액. 호출부가 토스에 보낸 값을 그대로 넘긴다(여기서 다시 계산하지 않는다). 결제 알림엔 없다. */
export function buildDealNotice(kind: DealKind, booking: SpaceBooking, space: Space, refund = 0): AdminNotice {
  const total = booking.amountTotal;
  const back = Math.max(0, Math.floor(refund || 0));
  const kept = Math.max(0, total - back);
  const [title, lead] =
    kind === "paid"
      ? [`결제가 들어왔어요 · ${won(total)}`, "손님이 결제를 마쳤어요. 사장님이 수락하거나 거절하기를 기다리는 중이에요."]
      : kind === "guest-cancel"
        ? back === 0
          ? ["손님이 예약을 취소했어요 · 환불 없음", "당일 취소라 돌려드린 돈은 없어요. 결제한 돈은 이용일이 지나면 사장님 정산으로 가요."]
          : back >= total
            ? [`손님이 예약을 취소했어요 · ${won(back)} 환불`, "손님이 예약을 취소해서 결제한 돈을 전액 돌려드렸어요."]
            : [`손님이 예약을 취소했어요 · ${won(back)} 환불`, `취소 규정에 따라 ${won(back)}을 돌려드렸어요. 남은 ${won(kept)}은 이용일이 지나면 사장님 정산으로 가요.`]
        : kind === "host-reject"
          ? [`사장님이 거절했어요 · ${won(back)} 전액 환불`, "사장님이 신청을 거절해서 손님께 결제한 돈을 전부 돌려드렸어요."]
          : kind === "host-reject-failed"
            ? ["사장님이 거절했는데 환불이 안 됐어요", "토스 환불이 실패해서 손님 돈이 아직 그대로예요. 정산 화면의 손이 필요한 예약에서 확인해 주세요."]
            : kind === "auto-refund"
              ? [`시간이 차서 자동 환불했어요 · ${won(back)}`, "손님이 결제를 마친 사이에 다른 분이 같은 시간을 먼저 잡았어요. 예약은 안 생겼고, 결제한 돈은 바로 전액 돌려드렸어요."]
              : kind === "auto-refund-failed"
                // 🚨한눈에 보이게 머리부터 그 말로 선다. 손님은 결제를 마쳤는데 예약도 환불도 없는 상태다.
                ? [`손님 돈이 붙잡혀 있어요 · ${won(total)}`, "결제는 됐는데 그 사이 시간이 차서 예약을 못 만들었고, 자동 환불까지 실패했어요. 토스 관리자 화면에서 직접 환불해 주세요. 정산 화면의 손이 필요한 예약에도 떠 있어요."]
                : [`환불 승인을 마쳤어요 · ${won(back)}`, "관리자 승인으로 손님께 남은 돈을 돌려드렸어요. 이 예약은 사장님 정산에서 빠져요."];
  const notBack = kind === "host-reject-failed" || kind === "auto-refund-failed";
  const refundRow: [string, string][] =
    kind === "paid" ? [] : [[LABEL.dealRefund, notBack ? "아직 못 돌려드렸어요" : back === 0 ? "없어요" : won(back)]];
  const rows: [string, string][] = [
    [LABEL.dealBooking, String(booking.id)],
    [LABEL.dealOrder, booking.orderId],
    [LABEL.dealPaid, won(total)],
    ...refundRow,
    [LABEL.dealSpace, `${space.name} (공간 번호 ${space.id})`],
    [LABEL.dealWhen, bookingWhen(booking)],
    [LABEL.dealProduct, `${PRODUCT_LABEL[booking.product]}${boughtChat(booking) ? " · 커피챗" : ""}`],
    [LABEL.dealGuest, String(booking.guestUserId)],
    [LABEL.dealHost, String(space.ownerUserId)],
  ];
  return {
    title, lead, rows,
    link: { href: `${SITE_URL}/rent/payouts`, label: "정산 화면 열기" },
    note: "거래 알림은 슬랙에만 와요. 이름과 연락처는 싣지 않아요.",
    slackOnly: true,
  };
}

/** 보내는 쪽 — 대표 알림 한 곳(`notifyAdmin`)으로. 슬랙이 없으면 건너뛴다. */
export async function notifyDeal(kind: DealKind, booking: SpaceBooking, space: Space, refund = 0) {
  return notifyAdmin(buildDealNotice(kind, booking, space, refund));
}

/** 🆕09-27 D4 — 정리 작업이 결제 시간이 지난 신청을 닫기 전에 토스에 되물어 본 결과 중 대표가 알아야 할 셋(`rent-recover.ts`).
 *  · `refunded` 승인 응답이 끊겨 돈만 나간 결제를 찾아 전액 돌려줬다
 *  · `refund-failed` 찾았는데 환불이 실패했다(예약은 `rejected`, 손이 필요한 예약)
 *  · `gave-up` 하루 동안 결론을 못 내서(토스가 답을 안 줌·입금 대기 취소 실패) 더 묻지 않고 신청을 닫았다 */
export type RecoverKind = "refunded" | "refund-failed" | "gave-up";

/** 알림에 싣는 사실. 예약·공간을 못 읽었으면 빈 칸으로 두고 주문번호로 찾는다. */
export interface RecoverFacts {
  orderId: string;
  bookingId: number;
  /** 결제 줄에 적힌 금액(손님이 낸 돈, 또는 내려던 돈). */
  paid: number;
  /** 실제로 돌려준 금액(토스에 보낸 잔액 그대로). */
  refund: number;
  useDate?: string;
  startTime?: string;
  endTime?: string;
  guestUserId?: number;
  space: { id: number; name: string; ownerUserId: number } | null;
  /** 결론을 못 낸 까닭(오류 글자). 그만 물었을 때만 싣는다. */
  why?: string;
}

/** ⑬ 결제 되묻기 알림 → 대표 슬랙 (09-27, 대표 결정 D4).
 *  거래 알림(`buildDealNotice`)과 같은 규칙이다. 🔒사람은 회원 번호로만 가리키고 이름·연락처는 싣지 않는다. 📮슬랙에만 간다. */
export function buildRecoverNotice(kind: RecoverKind, f: RecoverFacts): AdminNotice {
  const [title, lead] =
    kind === "refunded"
      ? [`끊긴 결제를 찾아 자동 환불했어요 · ${won(f.refund)}`, "손님이 결제를 마쳤는데 승인 응답이 우리 서버에 닿지 않아 예약이 안 생겼어요. 정리 작업이 토스에 되물어 찾아냈고, 결제한 돈을 전액 돌려드렸어요."]
      : kind === "refund-failed"
        ? [`손님 돈이 붙잡혀 있어요 · ${won(f.paid)}`, "승인 응답이 끊겨 예약이 안 생긴 결제를 찾았는데 돌려드리는 환불이 실패했어요. 토스 관리자 화면에서 직접 환불해 주세요. 정산 화면의 손이 필요한 예약에도 떠 있어요."]
        : ["토스에 결제를 확인하지 못한 채 신청을 닫았어요", "결제를 시도한 흔적이 있는 신청을 하루 동안 토스에 되물었는데 결론을 내지 못했어요. 돈이 빠져나갔는지 토스 관리자 화면에서 이 주문번호로 찾아봐 주세요. 까닭은 맨 아래 칸에 있어요."];
  const rows: [string, string][] = [
    [LABEL.dealBooking, String(f.bookingId)],
    [LABEL.dealOrder, f.orderId],
    [LABEL.dealPaid, won(f.paid)],
    [LABEL.dealRefund, kind === "refunded" ? won(f.refund) : kind === "refund-failed" ? "아직 못 돌려드렸어요" : ""],
    [LABEL.dealSpace, f.space ? `${f.space.name} (공간 번호 ${f.space.id})` : ""],
    [LABEL.dealWhen, f.useDate ? bookingWhen({ useDate: f.useDate, startTime: f.startTime, endTime: f.endTime }) : ""],
    [LABEL.dealGuest, f.guestUserId ? String(f.guestUserId) : ""],
    [LABEL.dealHost, f.space ? String(f.space.ownerUserId) : ""],
    ["토스 응답", kind === "gave-up" ? (f.why ?? "").slice(0, 200) : ""],
  ];
  return {
    title, lead, rows,
    link: { href: `${SITE_URL}/rent/payouts`, label: "정산 화면 열기" },
    note: "거래 알림은 슬랙에만 와요. 이름과 연락처는 싣지 않아요.",
    slackOnly: true,
  };
}

/** 보내는 쪽 — 대표 알림 한 곳(`notifyAdmin`)으로. 슬랙이 없으면 건너뛴다. */
export async function notifyRecover(kind: RecoverKind, f: RecoverFacts) {
  return notifyAdmin(buildRecoverNotice(kind, f));
}

/** ⑭ 환불을 확인하지 못한 손님 취소 → 대표 슬랙 (09-27, 대표 결정 D5).
 *  토스가 200을 줬는데 본문이 그 취소의 결제 객체가 아니었다. 예약은 그대로 두었고 손님께는 「확인하지 못했다」고 말했다.
 *  같은 멱등키로 다시 부르면 같은 응답이 와서 손님이 다시 눌러도 안 풀린다. 그래서 대표가 토스 관리자 화면에서 본다.
 *  🔒거래 알림과 같은 규칙(회원 번호만, 슬랙에만).
 *  @param refund 돌려드리려던 금액(취소 규정으로 센 값, 토스에 보낸 값 그대로). */
export function buildRefundUnconfirmedNotice(booking: SpaceBooking, space: Space, refund: number): AdminNotice {
  const rows: [string, string][] = [
    [LABEL.dealBooking, String(booking.id)],
    [LABEL.dealOrder, booking.orderId],
    [LABEL.dealPaid, won(booking.amountTotal)],
    ["돌려드릴 돈", won(Math.max(0, Math.floor(refund || 0)))],
    [LABEL.dealSpace, `${space.name} (공간 번호 ${space.id})`],
    [LABEL.dealWhen, bookingWhen(booking)],
    [LABEL.dealGuest, String(booking.guestUserId)],
    [LABEL.dealHost, String(space.ownerUserId)],
  ];
  return {
    title: `손님 취소의 환불을 확인하지 못했어요 · ${won(Math.max(0, Math.floor(refund || 0)))}`,
    lead: "손님이 예약을 취소했는데 토스가 환불 결과를 제대로 돌려주지 않았어요. 예약은 그대로 두었어요. 토스 관리자 화면에서 이 주문번호가 환불됐는지 보시고, 안 됐으면 거기서 돌려드려 주세요. 정산 화면의 손이 필요한 예약에도 떠 있어요.",
    rows,
    link: { href: `${SITE_URL}/rent/payouts`, label: "정산 화면 열기" },
    note: "거래 알림은 슬랙에만 와요. 이름과 연락처는 싣지 않아요.",
    slackOnly: true,
  };
}

/** 보내는 쪽 — 대표 알림 한 곳(`notifyAdmin`)으로. */
export async function notifyRefundUnconfirmed(booking: SpaceBooking, space: Space, refund: number) {
  return notifyAdmin(buildRefundUnconfirmedNotice(booking, space, refund));
}

/** 「3시간」·「2일」 — 결제한 지 얼마나 됐나. 하루가 안 되면 시간, 넘으면 날로. */
function agoLabel(iso: string, now: number): string {
  const mins = Math.max(0, Math.floor((now - Date.parse(iso)) / 60_000));
  if (!Number.isFinite(mins)) return "얼마쯤";
  if (mins < 60) return `${mins}분`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}시간`;
  return `${Math.floor(mins / (24 * 60))}일`;
}

/** 리마인드 한 줄. 요약이 «크론이 돌았다»는 표시라, 무엇을 했는지를 숫자로 말한다. */
function remindLine(r: RemindRun | null): string {
  if (!r) return "도중에 멈췄어요. Vercel 로그에서 rent-remind를 봐 주세요.";
  const held = r.heldToday > 0 ? `\n오늘 쓰는 예약 ${r.heldToday}건은 오늘용 문안이 아직 없어 건너뛰었어요.` : "";
  if (r.noMailKey) return `메일 키(RESEND_API_KEY)가 없어 보내지 않았어요.${held}`;
  if (r.sent === 0 && r.failed === 0) return `보낼 내일 예약이 없었어요.${held}`;
  return `${r.sent}통 보냈어요.${r.failed > 0 ? ` ${r.failed}통은 실패했어요.` : ""}${held}`;
}

/** 어제 돈이 돌아간 일 한 칸 — 건수가 있는 갈래만 한 줄씩. 다 0이면 「없었어요」. */
function moneyBackLine(m: AdminDailySummary["moneyBack"]): string {
  const refundOf = (r: number) => (r > 0 ? `환불 ${won(r)}` : "환불 없음");
  const lines = [
    m.guestCancel.count > 0 ? `손님 취소 ${m.guestCancel.count}건 · ${refundOf(m.guestCancel.refund)}` : "",
    m.hostReject.count > 0 ? `사장님 거절 ${m.hostReject.count}건 · ${refundOf(m.hostReject.refund)}` : "",
    m.adminRefund.count > 0 ? `관리자 환불 ${m.adminRefund.count}건 · ${won(m.adminRefund.refund)}` : "",
    m.autoRefund.count > 0 ? `결제 직후 자동 환불 ${m.autoRefund.count}건 · ${won(m.autoRefund.refund)}` : "",
  ].filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : "없었어요";
}

/** ⑩ 아침 요약 → 대표 (09-19). 리마인드 크론이 끝나면 한 통(`sendAdminDaily`).
 *  대표 09-19 — 거래마다 가던 참조 메일을 끊고, 대신 하루치를 한 번에 본다. 숫자가 다 0이어도 간다(크론이 돌았다는 표시).
 *  @param s 못 셌으면 null(DB 읽기 실패). 그땐 0이라고 하지 않고 못 셌다고 말한다.
 *  @param now 「결제한 지 N시간」을 셀 기준. 미리보기가 고정값을 넘긴다. */
export function buildAdminDaily(
  s: AdminDailySummary | null, today: string, remind: RemindRun | null, now = Date.now(),
): AdminNotice {
  const subject = `[collab5] ${subjectDate(today)} 하루 팝업 아침 요약`;
  const todo: string[] = [];
  if (s?.waiting.count) todo.push(`수락을 기다리는 요청 ${s.waiting.count}건`);
  if (s?.refundRequests) todo.push(`환불 신청 ${s.refundRequests}건`);
  if (s?.reviewPending) todo.push(`검토 대기 공간 ${s.reviewPending}곳`);
  // 🚨09-19 저녁 대표 [4] — 환불이 실패해 손님 돈이 붙잡힌 예약이 있으면 그 말이 맨 먼저 선다. 다른 할 일은 그 뒤에 붙인다.
  const stuck = s?.stuck.count ? s.stuck : null;
  const lead = !s
    ? "오늘은 숫자를 못 셌어요. 예약을 읽어 오다 실패했어요. 리마인드가 한 일은 아래에 있어요."
    : stuck
      ? `손님 돈이 붙잡혀 있어요. 환불이 실패한 예약 ${stuck.count}건, ${won(stuck.amount)}이에요. 토스에서 직접 돌려드려야 해요.${todo.length > 0 ? ` 그 밖에 ${todo.join(", ")}이 있어요.` : ""}`
      : todo.length > 0
        ? `오늘 봐 주실 게 있어요. ${todo.join(", ")}이에요.`
        : "오늘은 따로 처리하실 일이 없어요.";
  const rows: [string, string][] = s
    ? [
      // 값이 빈 칸은 슬랙·메일이 둘 다 뺀다. 붙잡힌 돈이 없는 날엔 이 줄이 아예 안 선다.
      [LABEL.dailyStuck, stuck ? `${stuck.count}건 · ${won(stuck.amount)}\n${SITE_URL}/rent/payouts` : ""],
      [LABEL.dailyPaid, s.paidYesterday.count > 0 ? `${s.paidYesterday.count}건 · ${won(s.paidYesterday.amount)}` : "없었어요"],
      [LABEL.dailyBack, moneyBackLine(s.moneyBack)],
      [LABEL.dailyWaiting, s.waiting.count > 0 && s.waiting.oldest
        ? `${s.waiting.count}건\n가장 오래 기다린 건 ${s.waiting.oldest.spaceName} ${dateLabel(s.waiting.oldest.useDate)} 예약이에요. 결제한 지 ${agoLabel(s.waiting.oldest.paidAt, now)} 됐어요.`
        : "없어요"],
      [LABEL.dailyRefund, s.refundRequests > 0 ? `${s.refundRequests}건\n${SITE_URL}/rent/payouts` : "없어요"],
      [LABEL.dailyReview, s.reviewPending + s.reviewApproveOnly > 0
        ? `${[s.reviewPending > 0 ? `공개 전 ${s.reviewPending}곳` : "", s.reviewApproveOnly > 0 ? `확인 표시 전 ${s.reviewApproveOnly}곳` : ""].filter(Boolean).join(" · ")}\n${SITE_URL}/rent/review`
        : "없어요"],
      [LABEL.dailyUse, `오늘 ${s.useToday}건 · 내일 ${s.useTomorrow}건`],
      [LABEL.dailyRemind, remindLine(remind)],
    ]
    : [[LABEL.dailyRemind, remindLine(remind)]];
  const go = { href: `${SITE_URL}/rent/payouts`, label: "정산 화면 열기" };
  const tail = "매일 아침 9시 리마인드가 끝나면 와요. 숫자가 다 0이어도 와요. 안 온 날은 크론이 멈춘 거예요.";
  return {
    title: subject.replace(/^\[collab5\] /, ""),
    lead, rows, link: go, note: tail,
    mail: { subject, ...compose(lead, rows, go, tail) },
  };
}
