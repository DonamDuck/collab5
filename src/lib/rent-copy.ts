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
