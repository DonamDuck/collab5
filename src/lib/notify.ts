// 관리자 알림 메일 — 대표에게 "누가 가입했다"를 알린다. 서버 전용.
//
// ⭐ 설계 원칙 하나: **알림이 본래 작업을 절대 막지 않는다.**
//    가입은 성공했는데 메일 발송이 실패해서 사용자에게 에러가 뜨는 건 최악이다.
//    그래서 이 파일의 모든 함수는 throw하지 않고, 실패해도 콘솔에만 남기고 조용히 끝난다.
//    호출부에서 try/catch를 잊어도 안전하도록 여기서 스스로 삼킨다.
//
// ⚠️ 환경변수가 없으면 **조용히 스킵**한다(에러 아님). authEnabled()와 같은 패턴 —
//    로컬·미설정 환경에서 가입 테스트가 막히면 안 되기 때문이다.
//
// 발송은 Resend REST API를 fetch로 직접 친다. `resend` 패키지를 안 쓰는 이유:
// 요청이 POST 한 방이라 의존성을 늘릴 이유가 없고, 번들도 안 커진다.
import { kstIso } from "./time";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** 발신 주소 — 도메인 인증 전에는 Resend가 주는 onboarding@resend.dev만 쓸 수 있다.
 *  collab5.co.kr을 인증하고 나면 NOTIFY_FROM을 alert@collab5.co.kr 같은 값으로 바꾼다. */
const FROM = process.env.NOTIFY_FROM || "collab5 <onboarding@resend.dev>";

/** 가입 경로 — 이메일 폼과 구글 로그인이 서로 다른 함수를 타서, 어디로 들어왔는지 구분해 담는다. */
export type SignupOrigin = "email" | "google" | "kakao";

const ORIGIN_LABEL: Record<SignupOrigin, string> = {
  email: "이메일 가입",
  google: "구글 로그인",
  kakao: "카카오 로그인",
};

export interface SignupNotice {
  /** users.user_id 정수 PK. 조회 실패 시 null이 올 수 있다(그래도 메일은 보낸다). */
  userId: number | null;
  brandName: string;
  email: string;
  origin: SignupOrigin;
}

/** HTML 본문에 값을 꽂기 전 이스케이프. 브랜드명은 사용자 입력이라 `<`가 들어올 수 있다. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** `2026-08-04T15:32:11.123+09:00` → `2026-08-04 15:32` (메일에서 읽기 좋은 형태) */
function kstReadable(): string {
  return kstIso().slice(0, 16).replace("T", " ");
}

/**
 * 새 가입 알림을 대표에게 보낸다.
 *
 * 성공/실패 여부를 boolean으로 돌려주지만 **호출부가 무시해도 된다** — 로깅용이다.
 * RESEND_API_KEY나 ADMIN_EMAIL이 없으면 아무것도 안 하고 false를 준다(정상 상황).
 */
export async function notifySignup(n: SignupNotice): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ADMIN_EMAIL;
  // 키 미설정 = 아직 안 켰다는 뜻. 에러로 취급하지 않는다.
  if (!apiKey || !to) return false;

  const when = kstReadable();
  const originLabel = ORIGIN_LABEL[n.origin];
  const idText = n.userId === null ? "(조회 실패)" : `#${n.userId}`;

  const subject = `[collab5] 새 가입 — ${n.brandName}`;

  const text = [
    `새로운 브랜드가 collab5에 가입했어요.`,
    ``,
    `ID: ${idText}`,
    `업체명: ${n.brandName}`,
    `이메일: ${n.email}`,
    `가입 경로: ${originLabel}`,
    `가입 시각: ${when} (KST)`,
  ].join("\n");

  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">
  <p style="margin:0 0 16px">새로운 브랜드가 <strong>collab5</strong>에 가입했어요.</p>
  <table style="border-collapse:collapse;font-size:15px">
    <tr><td style="padding:4px 16px 4px 0;color:#666">ID</td><td style="padding:4px 0"><strong>${esc(idText)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#666">업체명</td><td style="padding:4px 0"><strong>${esc(n.brandName)}</strong></td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#666">이메일</td><td style="padding:4px 0">${esc(n.email)}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#666">가입 경로</td><td style="padding:4px 0">${esc(originLabel)}</td></tr>
    <tr><td style="padding:4px 16px 4px 0;color:#666">가입 시각</td><td style="padding:4px 0">${esc(when)} <span style="color:#888">(KST)</span></td></tr>
  </table>
</div>`;

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM, to: [to], subject, text, html }),
      // 메일 서버가 느려도 가입 응답을 오래 붙잡지 않는다.
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[notify] 가입 알림 실패", res.status, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    // 네트워크 오류·타임아웃 — 알림은 포기하고 가입 흐름은 그대로 진행시킨다.
    console.error("[notify] 가입 알림 예외", e);
    return false;
  }
}

/**
 * 소개서 자동 만들기 — 고객에게 «초안이 준비됐어요» 안내 (2026-10-05).
 *
 * 가입 알림과 같은 원칙: throw하지 않는다. 대신 무엇 때문에 못 보냈는지를 돌려준다 —
 * 가입 알림은 놓쳐도 대표가 DB를 보면 되지만, 이 메일은 고객이 기다리고 있어서 «못 보냈다»가 보여야 한다.
 * ⚠️발신 주소는 NOTIFY_FROM. 비어 있으면 Resend 시험 주소(onboarding@resend.dev)라 Resend 계정 주인에게만 간다.
 */
/** 고객 안내 메일의 발신·답장 주소 (대표 10-06: 「notice@collab5.co.kr」).
 *  가입 알림(alert@)과 갈라 둔다 — 고객이 받는 메일에 «alert»가 찍히면 시스템 경고처럼 보인다.
 *  보내는 주소는 받는 메일함이 없으니, 고객 답장은 DRAFT_MAIL_REPLY_TO(대표 메일)로 받는다. 비어 있으면 NOTIFY_FROM을 쓴다. */
const DRAFT_FROM = process.env.DRAFT_MAIL_FROM || FROM;
const DRAFT_REPLY_TO = process.env.DRAFT_MAIL_REPLY_TO || "";

/** 안내 메일 내용(제목·글·HTML). 신청함의 «메일 미리보기»(/dev/auto-draft/mail)도 이걸 그대로 그린다. */
export function draftReadyMail(n: { brandName: string; url: string }): { subject: string; text: string; html: string } {
  const subject = `[collab5] 「${n.brandName}」 소개서 초안이 준비됐어요`;
  const text = [
    `안녕하세요, collab5예요.`,
    ``,
    `요청해 주신 「${n.brandName}」의 소개서 초안이 완성됐어요.`,
    `아직 공개되지 않은 상태라, 지금은 요청하신 분만 볼 수 있어요.`,
    ``,
    n.url,
    ``,
    `그동안 올리신 글과 사진을 읽고 만들었지만, 저희가 잘못 읽은 곳이 있을 수 있어요.`,
    `항목마다 저희가 여쭤보고 싶은 것을 남겨 두었어요. 신청하신 계정으로 로그인하시면 바로 고칠 수 있고, 맨 아래 「게시하기」를 누르면 그때부터 모든 분이 소개서를 볼 수 있어요.`,
    `초안이 마음에 들지 않으시면 언제든 직접 삭제하실 수도 있어요.`,
    ``,
    `collab5 — 내 이야기로 시작하는 콜라보 공간`,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.75;color:#1a1a1a;max-width:520px">
  <p style="margin:0 0 16px">안녕하세요, <strong>collab5</strong>예요.</p>
  <p style="margin:0 0 16px">요청해 주신 <strong>「${esc(n.brandName)}」</strong>의 소개서 초안이 완성됐어요.<br>아직 공개되지 않은 상태라, 지금은 요청하신 분만 볼 수 있어요.</p>
  <p style="margin:0 0 24px"><a href="${esc(n.url)}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#98ff5c;color:#1f5c00;font-weight:700;text-decoration:none">초안 소개서 보기</a></p>
  <p style="margin:0 0 8px;color:#444">그동안 올리신 글과 사진을 읽고 만들었지만, 저희가 잘못 읽은 곳이 있을 수 있어요. 항목마다 저희가 여쭤보고 싶은 것을 남겨 두었어요. 신청하신 계정으로 로그인하시면 바로 고칠 수 있고, 맨 아래 「게시하기」를 누르면 그때부터 모든 분이 소개서를 볼 수 있어요.</p>
  <p style="margin:0 0 24px;color:#444">초안이 마음에 들지 않으시면 언제든 직접 삭제하실 수도 있어요.</p>
  <p style="margin:0;color:#888;font-size:13px">collab5 — 내 이야기로 시작하는 콜라보 공간</p>
</div>`;

  return { subject, text, html };
}

/** 신청 접수 메일(대표 10-07: *「소개서 작성 요청하면 이메일로 요청 완료했다고 하나 보내는 거 어때?」*).
 *  1~2일을 기다리는 동안 «내 신청이 들어갔나»를 메일함에서 확인할 수 있게 한다. 알려 주신 채널도 같이 적어
 *  잘못 적은 주소를 고객이 먼저 알아채게 한다. 답장 받는 곳이 있을 때만 «답장해 주세요»를 넣는다
 *  (보내는 주소 notice@는 받는 메일함이 없다). */
export function draftRequestedMail(n: {
  brandName: string;
  position: number;
  etaDays: number;
  dailyCap: number;
  channels: string[];
}): { subject: string; text: string; html: string } {
  const subject = `[collab5] 「${n.brandName}」 소개서 초안 요청을 받았어요`;
  const when = `${n.etaDays}~${n.etaDays + 1}일`;
  const canReply = !!DRAFT_REPLY_TO;
  const text = [
    `안녕하세요, collab5예요.`,
    ``,
    `「${n.brandName}」 소개서 초안 요청을 잘 받았어요.`,
    `하루 ${n.dailyCap}팀씩 순서대로 만들고 있고, 지금 대기 ${n.position}번째예요. ${when} 안에 초안이 완성되면 이 주소로 다시 안내해 드릴게요.`,
    ``,
    `알려 주신 채널`,
    ...n.channels.map((c) => `· ${c}`),
    ``,
    `초안은 공개되지 않은 상태로 만들어져요. 받아 보시고 「게시하기」를 누르셔야 다른 분들께 보여요.`,
    ...(canReply ? [`잘못 적은 주소가 있거나 더 알려 주실 것이 있으면 이 메일에 답장해 주세요.`] : []),
    ``,
    `collab5 — 내 이야기로 시작하는 콜라보 공간`,
  ].join("\n");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.75;color:#1a1a1a;max-width:520px">
  <p style="margin:0 0 16px">안녕하세요, <strong>collab5</strong>예요.</p>
  <p style="margin:0 0 16px"><strong>「${esc(n.brandName)}」</strong> 소개서 초안 요청을 잘 받았어요.<br>하루 ${n.dailyCap}팀씩 순서대로 만들고 있고, 지금 대기 <strong>${n.position}번째</strong>예요. ${when} 안에 초안이 완성되면 이 주소로 다시 안내해 드릴게요.</p>
  <div style="margin:0 0 20px;padding:12px 16px;border-radius:8px;background:#f5f7f2">
    <p style="margin:0 0 4px;font-size:13px;color:#666">알려 주신 채널</p>
    ${n.channels.map((c) => `<p style="margin:0;font-size:14px;color:#1a1a1a;word-break:break-all">${esc(c)}</p>`).join("\n    ")}
  </div>
  <p style="margin:0 0 ${canReply ? "8px" : "24px"};color:#444">초안은 공개되지 않은 상태로 만들어져요. 받아 보시고 「게시하기」를 누르셔야 다른 분들께 보여요.</p>
  ${canReply ? `<p style="margin:0 0 24px;color:#444">잘못 적은 주소가 있거나 더 알려 주실 것이 있으면 이 메일에 답장해 주세요.</p>` : ""}
  <p style="margin:0;color:#888;font-size:13px">collab5 — 내 이야기로 시작하는 콜라보 공간</p>
</div>`;
  return { subject, text, html };
}

export async function notifyDraftRequested(n: {
  to: string;
  brandName: string;
  position: number;
  etaDays: number;
  dailyCap: number;
  channels: string[];
}): Promise<{ ok: true } | { ok: false; why: string }> {
  return sendDraftMail(n.to, draftRequestedMail(n), "접수 안내");
}

export async function notifyDraftReady(n: {
  to: string;
  brandName: string;
  url: string;
}): Promise<{ ok: true } | { ok: false; why: string }> {
  return sendDraftMail(n.to, draftReadyMail(n), "초안 안내");
}

/** 고객 안내 메일 공통 발송 — 접수·완성 두 통이 같은 발신·답장 주소를 쓴다. throw하지 않는다. */
async function sendDraftMail(
  to: string,
  { subject, text, html }: { subject: string; text: string; html: string },
  label: string,
): Promise<{ ok: true } | { ok: false; why: string }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { ok: false, why: "RESEND_API_KEY 없음" };
  // 로컬 가짜 로그인 주소(local@dev.invalid)는 Resend가 «받았다»고 답한 뒤 반송된다(10-07 실측) — 반송이 쌓이면 발신 평판이 깎인다
  if (/\.invalid$/i.test(to.trim())) return { ok: false, why: "테스트 주소(.invalid)라 보내지 않았어요" };

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: DRAFT_FROM,
        to: [to],
        ...(DRAFT_REPLY_TO ? { reply_to: DRAFT_REPLY_TO } : {}),
        subject,
        text,
        html,
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[notify] ${label} 실패`, res.status, body);
      return { ok: false, why: `발송 실패 ${res.status} ${body.slice(0, 160)}` };
    }
    return { ok: true };
  } catch (e) {
    console.error(`[notify] ${label} 예외`, e);
    return { ok: false, why: `발송 예외 ${e instanceof Error ? e.message : String(e)}` };
  }
}
