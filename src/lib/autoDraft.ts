// 소개서 자동 만들기 신청 (2026-10-03, 로컬 시험판)
//
// 무엇: 고객이 /register 에서 채널(인스타·블로그·링크 모음…)을 알려주고 «읽어도 된다»에 동의하면
//   신청이 대기열에 쌓인다. 대표 컴퓨터의 Claude가 대기열을 꺼내 컨시어지 스킬
//   (collab-brandpage-creation-with-insta)을 그대로 돌려 초안을 만든다.
//
// 왜 대기열인가: 인스타 수확은 대표 계정 세션과 같은 IP를 쓴다. 하루에 감당할 수 있는 양이
//   정해져 있어서(09-29 실측: 프로필 og 70건 연속 뒤 막힘) 바로 만들어 줄 수가 없다.
//   그래서 **하루 DAILY_CAP 팀까지 순서대로** 만들고, 고객에겐 처음부터 기다린다고 알린다(대표 확정 10-03).
//
// 누가 판정하나: 컨시어지 때 대표가 하던 「넣을까 뺄까」는 이제 **고객**이 한다.
//   초안은 비공개로 시작하고, 고객이 훑어보고 공개한다(대표 10-03 — 스킬에 검증이 이미 달려 있다).

export const DAILY_CAP = 3;

export type ChannelKind =
  | "instagram"
  | "naver_blog"
  | "brunch"
  | "link_hub"
  | "notion"
  | "youtube"
  | "homepage";

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  instagram: "인스타그램",
  naver_blog: "네이버 블로그",
  brunch: "브런치",
  link_hub: "링크 모음",
  notion: "노션",
  youtube: "유튜브",
  homepage: "홈페이지",
};

export interface AutoDraftChannel {
  kind: ChannelKind;
  /** 고객이 적은 그대로가 아니라 정규화한 주소. 인스타는 https://instagram.com/{handle} */
  url: string;
}

export interface AutoDraftRequest {
  id: string;
  createdAt: string; // KST ISO
  status: "queued" | "working" | "done" | "failed";
  brandName: string;
  region: string;
  businessType: string;
  channels: AutoDraftChannel[];
  email: string;
  note: string;
  /** 동의 문구 원문과 시각 — 무엇에 동의했는지가 남아야 나중에 다툼이 없다 */
  consent: { text: string; at: string };
  /** 요청한 계정 — 초안을 여기에 바로 붙인다(이관 단계 없음). userId는 public.users.user_id */
  account?: { authId: string; email: string; userId: number | null };
}

/** 동의 문구 — 화면과 저장본이 같은 문장을 쓴다(문구를 바꾸면 이후 신청부터 새 문장이 남는다). */
export const CONSENT_TEXT =
  "알려드린 채널의 공개된 글과 사진을 collab5가 읽고, 소개서 초안을 만드는 데 동의해요.";

const LINK_HUB = /(^|\.)(linktr\.ee|litt\.ly|inpock\.co\.kr|inpk\.link|beacons\.ai|bio\.link|lnk\.bio)$/i;

/** 점이 든 맨말이 «웹 주소»로 읽히는 끝말. 여기 없으면 인스타 핸들로 본다(`hey.buddybody` 같은 핸들이 흔하다).
 *  🩸10-04 대표 첫 시험에서 `www.canvasgarden.shop`이 인스타 계정으로 읽혔다 — 끝말 목록에 shop이 없었다.
 *  ⚠️`dooroome.store`처럼 핸들이 웹 주소 모양인 경우도 있어서 완벽히는 못 가른다 →
 *    화면이 판별 결과를 옆에 보여 주고, 애매하면 「인스타면 @를 붙여 주세요」를 띄운다(`isAmbiguousBare`). */
const WEB_TLD = /\.(com|net|org|kr|co|io|me|ly|ee|shop|store|site|xyz|app|dev|info|biz|link|page|art|studio)$/i;

/** 고객이 넣은 한 줄 → 채널. 인스타는 @핸들만 적어도 받는다. 못 알아보면 null. */
export function parseChannel(raw: string): AutoDraftChannel | null {
  const v = raw.trim();
  if (!v) return null;
  // @가 붙으면 무조건 인스타. 맨말이면 www.로 시작하거나 웹 끝말로 끝날 때만 웹 주소로 본다.
  const bare = /^@?[A-Za-z0-9._]{2,30}$/.test(v);
  if (bare && (v.startsWith("@") || (!/^www\./i.test(v) && !WEB_TLD.test(v)))) {
    const h = v.replace(/^@+/, "");
    return { kind: "instagram", url: `https://instagram.com/${h}` };
  }
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
  } catch {
    return null;
  }
  if (!u.hostname.includes(".")) return null;
  const host = u.hostname.replace(/^www\.|^m\./, "").toLowerCase();
  if (host === "instagram.com") {
    const h = u.pathname.split("/").filter(Boolean)[0];
    if (!h) return null;
    return { kind: "instagram", url: `https://instagram.com/${h}` };
  }
  const url = `https://${u.hostname}${u.pathname.replace(/\/$/, "")}${u.search}`;
  if (host === "blog.naver.com") return { kind: "naver_blog", url };
  if (host === "brunch.co.kr") return { kind: "brunch", url };
  if (LINK_HUB.test(host)) return { kind: "link_hub", url };
  if (/notion\.(site|so)$/.test(host)) return { kind: "notion", url };
  if (/(^|\.)youtube\.com$|^youtu\.be$/.test(host)) return { kind: "youtube", url };
  return { kind: "homepage", url };
}

/** @도 주소 모양(http·/)도 없는 «점 든 맨말» — 인스타 핸들인지 홈페이지인지 고객에게 한 번 확인받을 자리. */
export function isAmbiguousBare(raw: string): boolean {
  const v = raw.trim();
  return /^[A-Za-z0-9._]{2,30}$/.test(v) && v.includes(".") && !/^www\./i.test(v);
}

export const EMAIL_RE =/^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 대기 순서 → 예상 날짜 수. 오늘 몫이 남아 있어도 보수적으로 「다음 날부터」 센다. */
export function etaDays(position: number): number {
  return Math.max(1, Math.ceil(position / DAILY_CAP));
}
