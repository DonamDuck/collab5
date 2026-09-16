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
  if (how === "sms") return "예약이 확정되면 사장님이 문자로 이용 안내를 보내드려요.";
  if (how === "onsite") return "이용하시는 날 현장에서 사장님이 직접 안내해 드려요.";
  return "예약이 확정되면 문자로 안내드리고, 당일 현장에서도 한 번 더 알려드려요.";
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
