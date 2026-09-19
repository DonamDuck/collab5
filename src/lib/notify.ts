// 관리자 알림 — 대표에게 "누가 가입했다"를 알린다. 서버 전용.
//
// 📣09-19 대표 — 대표 알림은 슬랙으로 모았다(`admin-notify.ts`). 슬랙이 없으면 전처럼 `ADMIN_EMAIL` 메일로 간다.
//   메일 글은 `buildSignupMail`이 그대로 만들고, 슬랙 글은 `buildSignupNotice`가 같은 재료에서 만든다.
//
// ⭐ 설계 원칙 하나: **알림이 본래 작업을 절대 막지 않는다.**
//    가입은 성공했는데 메일 발송이 실패해서 사용자에게 에러가 뜨는 건 최악이다.
//    그래서 이 파일의 모든 함수는 throw하지 않고, 실패해도 콘솔에만 남기고 조용히 끝난다.
//    호출부에서 try/catch를 잊어도 안전하도록 여기서 스스로 삼킨다.
//
// ⚠️ 환경변수가 없으면 **조용히 스킵**한다(에러 아님). authEnabled()와 같은 패턴 —
//    로컬·미설정 환경에서 가입 테스트가 막히면 안 되기 때문이다.
//
// 보내는 일(슬랙 웹훅·Resend REST API를 fetch로 직접)은 `admin-notify.ts`가 한다. 패키지를 안 쓰는 이유는 같다 —
// 요청이 POST 한 방이라 의존성을 늘릴 이유가 없고, 번들도 안 커진다.
import { kstIso } from "./time";
import { notifyAdmin, type AdminNotice } from "./admin-notify";

/** 가입 경로 — 이메일 폼과 구글 로그인이 서로 다른 함수를 타서, 어디로 들어왔는지 구분해 담는다. */
export type SignupOrigin = "email" | "google" | "kakao";

const ORIGIN_LABEL: Record<SignupOrigin, string> = {
  email: "이메일로 가입",
  google: "구글 계정으로 가입",
  kakao: "카카오 계정으로 가입",
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

/** 가입 알림 한 통의 제목·본문. 보내는 함수와 개발용 미리보기(`/dev/rent-mail/signup-*`)가 같이 쓴다(09-18).
 *  ⭐미리보기가 따로 글을 만들면 보이는 글과 가는 글이 갈라진다. 그래서 글 만들기를 여기 하나로 뺐다. */
export function buildSignupMail(n: SignupNotice): { subject: string; text: string; html: string } {
  const when = `${kstReadable()} (한국 시간)`;
  const originLabel = ORIGIN_LABEL[n.origin];
  const idText = n.userId === null ? "번호를 못 읽어 왔어요" : `#${n.userId}`;
  const brand = n.brandName?.trim() ?? "";

  // 🔁09-18 메일 전수 — 대표 결정 「메일 제목과 라벨은 사람 말로」를 가입 알림에도 옮겼다.
  //   제목 「새 가입 — 느린오후」는 대시로 잇는 꼴이었고, 표 칸(ID·업체명·가입 시각)은 행정 낱말이었다.
  // 🙋09-17 브랜드명이 선택이 됐다. 비면 이메일로 대신 부른다(그래야 받은편지함에서 누구인지 보인다).
  const subject = `[collab5] ${brand || n.email} 님이 새로 가입했어요`;
  const lead = "새로운 브랜드가 collab5에 가입했어요.";
  // 세 번째 값 = 굵게 쓸까. 번호와 브랜드 이름이 알아볼 열쇠라 굵게 두고, 빈 값을 대신하는 말은 굵게 두지 않는다.
  const rows: [string, string, boolean][] = [
    ["회원 번호", idText, n.userId !== null],
    ["브랜드 이름", brand || "비워 두셨어요", !!brand],
    ["이메일", n.email, false],
    ["가입한 방법", originLabel, false],
    ["가입한 때", when, false],
  ];

  const text = [lead, ``, ...rows.map(([k, v]) => `${k}: ${v}`)].join("\n");

  const tr = rows
    .map(([k, v, bold]) =>
      `<tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;word-break:keep-all;overflow-wrap:anywhere">${bold ? `<strong>${esc(v)}</strong>` : esc(v)}</td></tr>`,
    )
    .join("\n    ");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">
  <p style="margin:0 0 16px">새로운 브랜드가 <strong>collab5</strong>에 가입했어요.</p>
  <table style="border-collapse:collapse;font-size:15px">
    ${tr}
  </table>
</div>`;
  return { subject, text, html };
}

/** 슬랙 글 — 메일과 같은 칸에서 이메일만 뺐다. 🔒슬랙은 개인정보 위탁 목록 밖이라 연락처를 안 싣는다(`admin-notify.ts` 머리말).
 *  브랜드명이 비어 있으면 제목을 회원 번호로 부른다(메일 제목은 이메일로 부른다). */
export function buildSignupNotice(n: SignupNotice): AdminNotice {
  const brand = n.brandName?.trim() ?? "";
  const who = brand || (n.userId === null ? "새 회원" : `회원 #${n.userId}`);
  return {
    title: `${who} 님이 새로 가입했어요`,
    lead: "새로운 브랜드가 collab5에 가입했어요.",
    rows: [
      ["회원 번호", n.userId === null ? "번호를 못 읽어 왔어요" : `#${n.userId}`],
      ["브랜드 이름", brand || "비워 두셨어요"],
      ["가입한 방법", ORIGIN_LABEL[n.origin]],
      ["가입한 때", `${kstReadable()} (한국 시간)`],
    ],
    mail: buildSignupMail(n),
  };
}

/**
 * 새 가입 알림을 대표에게 보낸다. 슬랙이 있으면 슬랙, 없으면 `ADMIN_EMAIL` 메일(`notifyAdmin`).
 *
 * 성공/실패 여부를 boolean으로 돌려주지만 **호출부가 무시해도 된다** — 로깅용이다.
 * 슬랙 주소도 메일 키·주소도 없으면 아무것도 안 하고 false를 준다(정상 상황).
 * 🧪목 데이터 보기 중(개발 빌드 전용)엔 보내지 않는다(`notifyAdmin` 첫 줄). 첫 울타리는 가입 액션 첫 줄.
 */
export async function notifySignup(n: SignupNotice): Promise<boolean> {
  return (await notifyAdmin(buildSignupNotice(n))).sent;
}
