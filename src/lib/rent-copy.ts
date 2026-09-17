// 하루 가게 — 화면과 메일이 «같이» 쓰는 문장 (2026-09-16)
//
// ⭐`rent-time.ts`와 같은 규율이다. 거기가 계산을 한 벌로 모았다면 여기는 «말»을 한 벌로 모은다.
//   화면에 적은 안내와 메일에 적은 안내가 다르면, 손님은 둘 중 무엇을 믿어야 할지 모른다.
//   🩸실제로 09-16에 그런 자리가 둘 있었다. 날짜 서식이 화면용·메일용으로 갈라져 있었고,
//     커피챗 라벨이 화면마다 「사장님 시간 포함」과 「커피챗 포함」으로 달랐다.
// 🚨훅도 DB도 안 부른다. 서버 액션·메일·클라이언트 어디서든 부를 수 있어야 한다.
import type { AccessHow } from "./types";

/** 📨이용 안내를 «어떻게» 받게 되는지. 내용(비밀번호 등)은 우리가 안 가진다 — 방식만 말한다. */
export function accessHowLine(how: AccessHow): string {
  if (how === "sms") return "이용하시기 전에 사장님이 문자로 이용 안내를 보내드려요.";
  // 🩸09-16까지 손님 쪽은 「이용하시는 날 현장에서」였는데, 사장님이 고르는 말은 「일정 전에 미리 만나서」였다.
  //   만나는 날이 달랐다. 사장님이 약속한 쪽에 맞춘다.
  if (how === "onsite") return "이용하시기 전에 사장님이 직접 만나서 안내해 드려요.";
  return "문자로 미리 안내드리고, 이용 전에 직접 만나서 한 번 더 알려드려요.";
}

/** ☎️확정된 손님에게 여는 연락처. **가게 전화가 먼저다** — 사장님 개인 번호보다 그쪽이
 *  받는 사람도 편하고, 호스트 약관 제6조가 공개하기로 한 것도 그 번호다.
 *  ⚠️둘 다 없을 수 있다. 그때 빈 칸을 내보내면 손님이 「우리가 빠뜨렸다」고 읽으니 문장으로 말한다. */
export function hostContactLine(shopPhone: string, personalPhone?: string, email?: string): string {
  const parts = [shopPhone?.trim(), personalPhone?.trim(), email?.trim()].filter(Boolean);
  return parts.length > 0 ? Array.from(new Set(parts)).join(" · ") : "연락처를 안 적으셨어요";
}

/** 🧪화면이 「시험 결제」라고 말해야 하는가 — **클라이언트 쪽 판정.**
 *  서버는 비밀 키로 보고(`paymentsTestMode`), 화면은 공개 키로 본다. 둘 다 앞글자가 `test_`/`live_`다.
 *  ⚠️키가 아예 없으면 결제창을 건너뛰는 자리라 그것도 「시험」으로 본다. */
export function isTestPayment(): boolean {
  const k = process.env.NEXT_PUBLIC_TOSS_CLIENT_KEY || "";
  return !k || k.startsWith("test_");
}

/** 🇰🇷이름 뒤에 붙는 조사를 받침에 맞춘다 — `withJosa("소소하우스", "이/가")` → 「소소하우스가」.
 *
 *  🩸09-16까지 메일이 이름 뒤에 「이·을·은」을 그냥 붙였다. 받침 없는 이름이면
 *    「소소하우스이 신청했어요」가 사장님 메일함에 그대로 들어간다. 사람 이름이 틀리게 불리는 자리라 티가 크다.
 *  ⚠️한글이 아닌 글자로 끝나면(영문·숫자) 받침을 알 수 없다. 그때는 「이(가)」처럼 둘 다 적는다 —
 *    틀린 쪽 하나를 고르는 것보다 낫다. */
export function withJosa(word: string, pair: "이/가" | "을/를" | "은/는"): string {
  const [withBatchim, without] = pair.split("/");
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (!last || code < 0 || code > 11171) return `${word}${withBatchim}(${without})`;
  return `${word}${code % 28 === 0 ? without : withBatchim}`;
}

/** ☕커피챗을 «언제» 하는지 — 화면·팝업·메일이 이 한 줄만 쓴다(대표 09-17).
 *  🩸09-16 QA: 상세는 「협의한 날짜」, 손님 메일은 「그날」, 사장님 메일엔 말이 없었다. 4만원짜리 옵션의 이행일이 세 갈래였다.
 *  ⭐대표 결정 — 시간은 사장님이 정한다(*「알려줄 지식이나 마음가짐이 있는 분들이라면 알아서 잘 하실 거」*).
 *    그래서 우리가 날짜를 박지 않고, 누가 정하는지만 말한다. */
export const COFFEE_CHAT_WHEN_GUEST = "커피챗 시간은 예약 뒤에 사장님이 정해서 연락드려요.";
export const COFFEE_CHAT_WHEN_HOST = "커피챗 시간은 사장님이 정해서 손님께 알려 주세요.";

/** 📛예약 상태를 부르는 이름 — 하루 가게 맥락을 넣은 긴 문장(대표 09-17). 배지는 짧게, 제목·첫 줄은 이것. */
export const BOOKING_HEADLINE = {
  guestPaid: "하루 가게 예약이 완료됐어요",
  guestConfirmed: "예약 확정! 사장님 확인이 끝났어요",
  hostPaid: "하루 가게 요청이 들어왔어요",
} as const;

/** ⏱연락 규칙 — 사장님이 수락하고 2일 안에 손님께 공간 안내를 전한다(대표 09-17).
 *  ⭐손님 쪽과 사장님 쪽이 같은 약속을 서로 다른 방향에서 말한다. 한쪽만 고치면 약속이 둘이 된다.
 *  「이용일이 더 가까우면」 — 내일 쓰는 예약에 2일을 주면 안내가 이용 뒤에 올 수 있다. */
export const CONTACT_RULE_GUEST =
  "사장님이 예약을 확정하면 2일 안에 문자나 전화로 공간 안내를 드리는 게 규칙이에요. 이용일이 그보다 가까우면 그 전에 연락드려요.";
export const CONTACT_RULE_HOST =
  "수락하신 뒤 2일 안에 손님께 문자나 전화로 공간 안내를 전해 주세요. 출입 비밀번호나 기계 쓰는 법 같은 것들이요. 이용일이 그보다 가까우면 그 전에 전해 주세요.";

/** 🧭사장님이 등록 전에 보는 «요청이 들어오면» 네 단계(대표 09-17). 순서가 곧 정보라 번호를 붙여 보여 준다.
 *  ⚠️1단계는 «이메일»만 말한다. 대표 원문은 「이메일과 문자」인데 문자 발송은 아직 없다 — 붙이는 날 여기를 고친다. */
export const HOST_REQUEST_STEPS = [
  "요청이 들어오면 이메일로 바로 알려 드려요.",
  "날짜와 손님이 적은 계획을 읽어 보세요.",
  "이용 시작 전까지 수락하거나 거절해 주세요. 거절하시면 손님께 전액 돌아가요.",
  CONTACT_RULE_HOST,
] as const;
