// 대표 알림 한 곳 (2026-09-19). 서버 전용.
//
// 🔁대표 09-19: 「이메일 말고 slack이나 채널톡 같은 서비스로 우회해서 무료로 알림 받을 수 있게」 → 슬랙으로 정했다.
//   그 전엔 하루 가게 메일이 전부 대표 참조(cc)로 한 통씩 더 갔고, 가입·검토 알림은 대표 메일로 따로 갔다.
//   이제 대표에게 가는 알림은 전부 이 파일 하나를 거친다.
//
// 📮**갈래는 둘이다.**
//   ① `SLACK_WEBHOOK_URL`이 있으면 슬랙 Incoming Webhook으로 보낸다. 🔒서버 전용 값이다(`NEXT_PUBLIC_`을 붙이면 주소가 화면으로 샌다).
//   ② 없으면 지금까지처럼 `ADMIN_EMAIL`로 메일을 보낸다. 슬랙이 실패해도 메일로 한 번 더 간다. 대표 알림이 조용히 빠지면 안 되는 일이라서다.
//   ⚠️단 **거래 알림(`slackOnly`)은 슬랙에만 간다** (대표 09-19 오후). 결제·취소·거절·환불 승인은 하루에 여러 건이라
//     메일로 물러서면 무료 한도(Resend)를 먹는다. 손님·사장님 메일에서 대표 참조를 뺀 이유와 같다.
//     슬랙 주소가 없거나 슬랙이 실패하면 조용히 건너뛴다. 결제 합계는 아침 요약에서 다시 본다.
//
// ⭐`notify.ts`·`rent-notify.ts`와 같은 규율 하나: **알림이 본작업을 막지 않는다.** throw하지 않고 실패는 콘솔에만 남긴다.
//   값이 없으면 스킵이고 에러가 아니다. 목 데이터 보기 중(개발 빌드 전용)엔 보내지 않는다.
//
// 🔒슬랙 글엔 전화번호·이메일을 싣지 않는다. 슬랙은 개인정보처리방침의 위탁 목록에 없는 곳이다.
//   누구인지는 링크를 눌러 우리 화면(검토·정산)에서 본다. 메일로 물러설 땐 원래 메일 글(`mail`)을 그대로 보낸다.
import { rentMockOn } from "./rent-mock";
import { SITE_URL } from "./site";

const RESEND_ENDPOINT = "https://api.resend.com/emails";
/** `notify.ts`·`rent-notify.ts`와 같은 발신자. */
const FROM = process.env.NOTIFY_FROM || "collab5 <onboarding@resend.dev>";
/** 메일 보내기와 같은 제한 시간. 느린 슬랙이 결제·저장 응답을 붙잡지 않게. */
const TIMEOUT_MS = 8000;

/** 대표에게 알릴 한 건 — 슬랙 글과 메일이 이 재료에서 같이 나온다. */
export interface AdminNotice {
  /** 무슨 일인가. 슬랙 맨 윗줄(굵은 머리)이다. 「[collab5]」는 붙이지 않는다. */
  title: string;
  /** 첫 문장. 왜 봐야 하는지. */
  lead: string;
  /** 칸 이름과 값. 값이 빈 칸은 빠진다. 값 안의 줄이 주소 하나뿐이면 누를 수 있는 링크가 된다.
   *  🔒전화번호·이메일은 넣지 않는다(머리말). */
  rows: [string, string][];
  /** 눌러서 갈 곳. 사이트 안 경로(`/rent/review`)면 사이트 주소를 앞에 붙인다. */
  link?: { href: string; label: string };
  /** 맨 끝 작은 글씨 한 줄. 이 알림이 언제 오는지 같은 것. */
  note?: string;
  /** 슬랙이 없을 때 대신 보낼 메일. 없으면 위 재료로 글자만 있는 메일을 만든다. */
  mail?: { subject: string; html: string; text: string };
  /** 💸슬랙에만 보낸다(거래 알림, 09-19 오후). 슬랙 주소가 없거나 실패해도 메일로 물러서지 않는다(머리말). */
  slackOnly?: boolean;
}

// ─── 슬랙 글 ───
// Block Kit(09-19 문서 확인): 머리(header)는 글자 150자, 칸 묶음(section fields)은 10칸·칸마다 2,000자,
//   본문(section text)은 3,000자까지다. 넘으면 슬랙이 통째로 거절한다(400 `invalid_blocks`). 그래서 자른다.
// 🔘링크는 버튼 대신 글자 링크로 둔다. 웹훅만 켠 앱의 버튼은 누를 때마다 «상호작용 주소가 없다»는 경고가 붙는다.

export type SlackText = { type: "plain_text" | "mrkdwn"; text: string; emoji?: boolean };
export type SlackBlock =
  | { type: "header"; text: SlackText }
  | { type: "section"; text?: SlackText; fields?: SlackText[] }
  | { type: "context"; elements: SlackText[] }
  | { type: "divider" };
export interface SlackPayload {
  /** 알림 미리보기(휴대폰 잠금 화면)에 뜨는 글. 블록이 있어도 채워야 한다. */
  text: string;
  blocks: SlackBlock[];
}

/** 슬랙 mrkdwn은 `&`·`<`·`>` 셋만 바꾸면 된다(슬랙 문서 「Escaping text」). 사용자 입력(공간 이름·사유)이 꼭 거친다. */
function slackEsc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cut(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

/** 사이트 안 경로면 사이트 주소를 붙인다. 슬랙은 채널 밖에서 열리니 상대 경로가 안 먹는다. */
export function absUrl(href: string): string {
  return /^https?:\/\//.test(href) ? href : `${SITE_URL}${href.startsWith("/") ? "" : "/"}${href}`;
}

/** 칸 값 → mrkdwn. 주소 한 줄은 「열어 보기」 링크로(메일의 칩과 같은 자리). */
function slackValue(v: string): string {
  return v
    .split("\n")
    .map((line) => {
      const t = line.trim();
      return /^https?:\/\/\S+$/.test(t) ? `<${t}|열어 보기>` : slackEsc(line);
    })
    .join("\n");
}

/** 슬랙에 실어 보낼 모양. 미리보기(`/dev/mail/admin-*`)도 이 함수를 부른다(보이는 글과 가는 글이 같게). */
export function buildSlackPayload(n: AdminNotice): SlackPayload {
  const rows = n.rows.filter(([, v]) => v.trim().length > 0);
  const blocks: SlackBlock[] = [
    { type: "header", text: { type: "plain_text", text: cut(n.title, 150), emoji: true } },
    { type: "section", text: { type: "mrkdwn", text: cut(slackEsc(n.lead), 3000) } },
  ];
  for (let i = 0; i < rows.length; i += 10) {
    blocks.push({
      type: "section",
      fields: rows.slice(i, i + 10).map(([k, v]) => ({ type: "mrkdwn", text: cut(`*${slackEsc(k)}*\n${slackValue(v)}`, 2000) })),
    });
  }
  if (n.link) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `<${absUrl(n.link.href)}|${slackEsc(n.link.label)}>` } });
  }
  if (n.note) blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: cut(slackEsc(n.note), 3000) }] });
  // 알림 미리보기 글은 머리와 첫 문장만. 칸까지 넣으면 잠금 화면에서 잘린다.
  return { text: cut(`${n.title} · ${n.lead}`, 300), blocks };
}

/** 글자만 있는 대체 메일 — `mail`을 안 준 알림이 슬랙 없이 나갈 때. 제목은 다른 메일과 같은 「[collab5] 」로 연다. */
function plainMail(n: AdminNotice): { subject: string; html: string; text: string } {
  const rows = n.rows.filter(([, v]) => v.trim().length > 0);
  const text = [
    n.lead,
    "",
    ...rows.map(([k, v]) => `${k}: ${v.replace(/\n/g, " / ")}`),
    ...(n.link ? ["", `${n.link.label}: ${absUrl(n.link.href)}`] : []),
    ...(n.note ? ["", n.note] : []),
  ].join("\n");
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const tr = rows
    .map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#666;white-space:nowrap;vertical-align:top">${esc(k)}</td><td style="padding:4px 0;word-break:keep-all;overflow-wrap:anywhere">${esc(v).replace(/\n/g, "<br>")}</td></tr>`)
    .join("");
  const html = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Apple SD Gothic Neo',sans-serif;font-size:15px;line-height:1.7;color:#1a1a1a">
  <p style="margin:0 0 16px">${esc(n.lead)}</p>
  <table style="border-collapse:collapse;font-size:15px">${tr}</table>
  ${n.link ? `<p style="margin:16px 0 0"><a href="${esc(absUrl(n.link.href))}">${esc(n.link.label)}</a></p>` : ""}
  ${n.note ? `<p style="margin:16px 0 0;color:#999;font-size:13px">${esc(n.note)}</p>` : ""}
</div>`;
  return { subject: `[collab5] ${n.title}`, html, text };
}

async function postSlack(url: string, payload: SlackPayload, title: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // 웹훅은 성공하면 200과 글자 「ok」를 준다. 실패는 400·403·404에 사유 글자(`invalid_blocks`·`no_service` 등)다.
    if (!res.ok) {
      // 🔒웹훅 주소는 로그에 안 남긴다. 그 주소를 아는 사람은 누구나 우리 채널에 글을 쓸 수 있다.
      console.error("[admin-notify] 슬랙 실패", res.status, title, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[admin-notify] 슬랙 예외", title, e);
    return false;
  }
}

async function postMail(to: string, apiKey: string, m: { subject: string; html: string; text: string }): Promise<boolean> {
  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: FROM, to: [to], subject: m.subject, text: m.text, html: m.html }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      console.error("[admin-notify] 메일 실패", res.status, m.subject, await res.text().catch(() => ""));
      return false;
    }
    return true;
  } catch (e) {
    console.error("[admin-notify] 메일 예외", m.subject, e);
    return false;
  }
}

export interface AdminNotifyResult {
  sent: boolean;
  /** 실제로 나간 길. 둘 다 안 됐으면 `none`. */
  channel: "slack" | "email" | "none";
}

/** 대표에게 한 건 보낸다. 슬랙이 있으면 슬랙, 없거나 실패하면 메일(거래 알림은 슬랙만). 호출부는 결과를 무시해도 된다. */
export async function notifyAdmin(n: AdminNotice): Promise<AdminNotifyResult> {
  if (await rentMockOn()) {
    console.info(`[admin-notify] 스킵(목 데이터 보기 중) · ${n.title}`);
    return { sent: false, channel: "none" };
  }
  const hook = (process.env.SLACK_WEBHOOK_URL ?? "").trim();
  if (n.slackOnly) {
    if (!hook) {
      console.info(`[admin-notify] 스킵(SLACK_WEBHOOK_URL 없음 · 슬랙 전용 거래 알림) · ${n.title}`);
      return { sent: false, channel: "none" };
    }
    // 실패는 `postSlack`이 콘솔에 남긴다. 메일로 한 번 더 보내지 않는다(머리말 ⚠️).
    const ok = await postSlack(hook, buildSlackPayload(n), n.title);
    return { sent: ok, channel: ok ? "slack" : "none" };
  }
  if (hook) {
    if (await postSlack(hook, buildSlackPayload(n), n.title)) return { sent: true, channel: "slack" };
    console.warn(`[admin-notify] 슬랙이 실패해 메일로 한 번 더 보낸다 · ${n.title}`);
  }
  const apiKey = process.env.RESEND_API_KEY;
  const to = (process.env.ADMIN_EMAIL ?? "").trim();
  if (!apiKey || !to) {
    console.info(`[admin-notify] 스킵(${hook ? "슬랙 실패 뒤 " : ""}${!apiKey ? "RESEND_API_KEY" : "ADMIN_EMAIL"} 없음) · ${n.title}`);
    return { sent: false, channel: "none" };
  }
  const ok = await postMail(to, apiKey, n.mail ?? plainMail(n));
  return { sent: ok, channel: ok ? "email" : "none" };
}
