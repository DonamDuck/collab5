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
