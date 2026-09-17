import "server-only"; // 🔒클라이언트 컴포넌트가 import하면 빌드가 멈춘다. 서비스 롤 키로 DB를 읽는 파일이다(09-18 밤 QA SEC-09).
// 하루 가게 — 사장님이 정산 받을 계좌 (2026-09-17, 대표: 「오늘 다 구현」). 서버 전용.
//
// 🔒**계좌번호 원문은 이 파일과 관리자 정산 화면 밖으로 안 나간다.**
//   테이블(`host_payout_accounts`)은 RLS를 켜고 정책을 안 만들었다 — 서비스 롤 키로만 읽고 쓴다.
//   사장님 화면·서버 액션 응답에 싣는 값은 `toMasked`를 거친 것뿐이다.
// ⏳토스 지급대행 셀러 등록(셀러 id·상태 칸)은 계약 뒤에 붙인다. 지금은 계좌를 받아 두기만 한다.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { bankName, isBankCode, type PayoutHolderType } from "./banks";
// 🔢09-18 밤 QA(H-35) — 사업자등록번호는 «검증번호»까지 본다. 등록 폼이 쓰는 그 함수다(규칙을 두 벌로 적지 않는다).
import { bizNumberProblem } from "./bizcheck";
// 🧪09-17 목 데이터 — 읽기는 목 세계에서, 쓰기는 멈춘다. 개발 빌드 전용(`rent-mock.ts` 머리말).
import { getRentMock, rentMockOn } from "./rent-mock";

function db(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL;
  // ⚠️anon 키로 물러서지 않는다. 정책이 없는 테이블이라 anon이면 «빈 결과»가 와서 「계좌 없음」으로 잘못 읽힌다.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

// 유형 이름표는 `banks.ts`에 둔다 — 화면(클라이언트)이 이 파일을 값으로 가져오면 DB 클라이언트까지 딸려 간다.
export type { PayoutHolderType } from "./banks";

/** 원문 — 🚨관리자 정산 화면과 저장 액션 안에서만 쓴다. */
export interface PayoutAccount {
  userId: number;
  holderType: PayoutHolderType;
  holderName: string;
  businessNumber: string;
  bankCode: string;
  accountNumber: string;
  tossSellerId: string;
  tossSellerStatus: string;
  updatedAt: string;
}

/** 화면으로 내려보내는 모양. 계좌번호·사업자번호 원문이 없다. */
export interface PayoutAccountMasked {
  holderType: PayoutHolderType;
  holderName: string;
  bankCode: string;
  bankName: string;
  accountMasked: string;
  hasBusinessNumber: boolean;
}

export interface PayoutAccountInput {
  holderType: PayoutHolderType;
  holderName: string;
  businessNumber: string;
  bankCode: string;
  accountNumber: string;
}

/** `"1234567890123"` → `"•••••••••0123"`. 뒤 네 자리만 남긴다. 네 자리 이하면 전부 가린다. */
export function maskAccount(raw: string): string {
  const d = (raw ?? "").replace(/\D/g, "");
  if (d.length <= 4) return "•".repeat(d.length);
  return "•".repeat(d.length - 4) + d.slice(-4);
}

export function toMasked(a: PayoutAccount): PayoutAccountMasked {
  return {
    holderType: a.holderType,
    holderName: a.holderName,
    bankCode: a.bankCode,
    bankName: bankName(a.bankCode) || a.bankCode,
    accountMasked: maskAccount(a.accountNumber),
    hasBusinessNumber: a.businessNumber.length > 0,
  };
}

/** 입력 검사 — 서버 액션이 부른다. 통과하면 저장할 모양(숫자만 남긴 값)을, 아니면 사장님께 할 말을 돌려준다.
 *  순수 함수라 DB 없이 검사할 수 있다. */
export function validatePayoutInput(
  input: PayoutAccountInput,
): { ok: true; value: PayoutAccountInput } | { ok: false; message: string } {
  const holderType = input.holderType;
  if (holderType !== "individual" && holderType !== "sole_proprietor" && holderType !== "corporation") {
    return { ok: false, message: "예금주 유형이 비어 있어요. 개인·개인사업자·법인 중 하나예요." };
  }
  const holderName = (input.holderName ?? "").trim();
  if (holderName.length < 2) return { ok: false, message: "예금주 이름을 통장에 적힌 그대로 적어 주세요." };
  if (holderName.length > 60) return { ok: false, message: "예금주 이름이 너무 길어요." };
  if (!isBankCode(input.bankCode ?? "")) return { ok: false, message: "은행을 골라 주세요." };
  const accountNumber = (input.accountNumber ?? "").replace(/[\s-]/g, "");
  if (!/^\d{10,16}$/.test(accountNumber)) {
    return { ok: false, message: "계좌번호는 숫자 10~16자리예요. 하이픈은 빼도 되고 넣어도 돼요." };
  }
  let businessNumber = "";
  if (holderType !== "individual") {
    businessNumber = (input.businessNumber ?? "").replace(/[\s-]/g, "");
    // 자릿수만 세던 것을 국세청 검증번호 규칙까지 보게 바꿨다(09-18 밤 QA H-35). 오타 대부분을 여기서 거른다.
    const problem = bizNumberProblem(businessNumber);
    if (problem) return { ok: false, message: problem };
  }
  return { ok: true, value: { holderType, holderName, businessNumber, bankCode: input.bankCode, accountNumber } };
}

type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === "string" ? v : "");

function toAccount(r: Row): PayoutAccount {
  return {
    userId: typeof r.user_id === "number" ? r.user_id : Number(r.user_id ?? 0),
    holderType: (s(r.holder_type) || "individual") as PayoutHolderType,
    holderName: s(r.holder_name),
    businessNumber: s(r.business_number),
    bankCode: s(r.bank_code),
    accountNumber: s(r.account_number),
    tossSellerId: s(r.toss_seller_id),
    tossSellerStatus: s(r.toss_seller_status),
    updatedAt: s(r.updated_at),
  };
}

/** 🚨원문. 권한 확인은 호출부 책임(본인 또는 관리자). */
export async function getPayoutAccount(userId: number): Promise<PayoutAccount | null> {
  const m = await getRentMock();
  if (m) return m.data.payoutAccounts.find((a) => a.userId === userId) ?? null;
  const c = db();
  if (!c || !userId) return null;
  const { data, error } = await c.from("host_payout_accounts").select("*").eq("user_id", userId).maybeSingle();
  if (error) { console.error(`[payout-accounts] get failed user=${userId}: ${error.message}`); return null; }
  return data ? toAccount(data as Row) : null;
}

/** 계좌가 있나 — 메일에 「계좌를 등록해 주세요」를 붙일지 정할 때. 읽기에 실패하면 undefined(모른다)라서
 *  테이블이 아직 없거나 키가 없는 날에 있는 사람까지 조르지 않는다. */
export async function hasPayoutAccount(userId: number): Promise<boolean | undefined> {
  const m = await getRentMock();
  if (m) return m.data.payoutAccounts.some((a) => a.userId === userId);
  const c = db();
  if (!c || !userId) return undefined;
  const { data, error } = await c.from("host_payout_accounts").select("user_id").eq("user_id", userId).maybeSingle();
  if (error) return undefined;
  return !!data;
}

/** 정산 화면이 판매자 여럿을 한 번에 읽는다. 🚨원문 — 관리자 화면에서만. */
export async function listPayoutAccounts(userIds: number[]): Promise<Map<number, PayoutAccount>> {
  const out = new Map<number, PayoutAccount>();
  const ids = Array.from(new Set(userIds.filter((x) => x > 0)));
  const m = await getRentMock();
  if (m) {
    for (const a of m.data.payoutAccounts) if (ids.includes(a.userId)) out.set(a.userId, a);
    return out;
  }
  const c = db();
  if (!c || ids.length === 0) return out;
  const { data, error } = await c.from("host_payout_accounts").select("*").in("user_id", ids);
  if (error) { console.error(`[payout-accounts] list failed: ${error.message}`); return out; }
  for (const r of data ?? []) {
    const a = toAccount(r as Row);
    out.set(a.userId, a);
  }
  return out;
}

/** 한 사람에 한 줄 upsert. ⚠️검증(`validatePayoutInput`)과 권한은 호출부가 먼저 한다.
 *  🔁계좌가 바뀌면 토스 셀러 등록도 다시 해야 한다 — 셀러 칸을 비워 «다시 등록할 것»으로 되돌린다. */
export async function savePayoutAccount(userId: number, input: PayoutAccountInput): Promise<PayoutAccount | null> {
  if (await rentMockOn()) return null;
  const c = db();
  if (!c) return null;
  const { data, error } = await c.from("host_payout_accounts").upsert({
    user_id: userId,
    holder_type: input.holderType,
    holder_name: input.holderName,
    business_number: input.businessNumber,
    bank_code: input.bankCode,
    account_number: input.accountNumber,
    toss_seller_id: "",
    toss_seller_status: "",
  }, { onConflict: "user_id" }).select().maybeSingle();
  if (error) { console.error(`[payout-accounts] save failed user=${userId}: ${error.message}`); return null; }
  return data ? toAccount(data as Row) : null;
}
