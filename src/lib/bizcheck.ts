// 하루 가게 — 사업자 확인의 «순수» 규칙 (2026-09-18 대표: 공간 등록에 사업자 확인 필수)
//
// 🚨훅도 DB도 fetch도 없다. 등록 폼(클라이언트)과 서버 액션이 «같은 함수»로 검사한다.
//   화면과 서버가 규칙을 따로 적으면 화면은 통과시키고 서버는 막는(또는 그 반대) 날이 온다.
//   국세청 호출은 서버 전용 `nts-bizcheck.ts`에 따로 있다.
import type { BizCheckStatus } from "./types";

/** 숫자만 남긴다. 「123-45-67890」·「123 45 67890」 모두 같은 번호다. */
export function bizDigits(v: string): string {
  return (v ?? "").replace(/\D/g, "");
}

/** 화면에 보이는 모양 `123-45-67890`. 치는 중이면 친 만큼만 끊어 보여 준다. */
export function formatBizNumber(v: string): string {
  const d = bizDigits(v).slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

/** 🔢사업자등록번호 검증번호(마지막 자리) 계산 — 국세청이 번호를 매길 때 쓰는 가중합 규칙.
 *  가중치 1,3,7,1,3,7,1,3,5를 앞 아홉 자리에 곱해 더하고, 아홉째 자리×5의 십의 자리를 한 번 더 더한다.
 *  검증번호 = (10 − 합의 일의 자리) mod 10.
 *  ⚠️이걸 통과해도 «있는 사업자»라는 뜻은 아니다. 오타 대부분을 국세청에 묻기 전에 거르는 용도다. */
export function bizChecksumOk(v: string): boolean {
  const d = bizDigits(v);
  if (!/^\d{10}$/.test(d)) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(d[i]) * w[i];
  sum += Math.floor((Number(d[8]) * 5) / 10);
  return (10 - (sum % 10)) % 10 === Number(d[9]);
}

/** 번호 칸의 문제 한 줄. 문제가 없으면 빈 문자열. */
export function bizNumberProblem(v: string): string {
  const d = bizDigits(v);
  if (!d) return "사업자등록번호를 적어 주세요.";
  if (d.length !== 10) return "사업자등록번호는 숫자 열 자리예요.";
  if (!bizChecksumOk(d)) return "번호가 맞지 않아요. 사업자등록증의 열 자리를 다시 봐 주세요.";
  return "";
}

/** `YYYY-MM-DD`(날짜 입력) → `YYYYMMDD`(국세청 형식). 모양이 틀리면 빈 문자열. */
export function toOpenDate(isoDate: string): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(isoDate ?? "") ? isoDate.replace(/-/g, "") : "";
}

/** `YYYYMMDD` → `YYYY-MM-DD`. 날짜 입력칸에 도로 넣을 때. */
export function fromOpenDate(ymd: string): string {
  return /^\d{8}$/.test(ymd ?? "") ? `${ymd.slice(0, 4)}-${ymd.slice(4, 6)}-${ymd.slice(6, 8)}` : "";
}

/** 개업일 문제 한 줄. `today`는 KST `YYYY-MM-DD`(호출부가 넘긴다. 이 파일은 시계를 안 읽는다). */
export function openDateProblem(ymd: string, today: string): string {
  if (!/^\d{8}$/.test(ymd ?? "")) return "개업일을 골라 주세요.";
  const y = Number(ymd.slice(0, 4)), m = Number(ymd.slice(4, 6)), day = Number(ymd.slice(6, 8));
  const dt = new Date(Date.UTC(y, m - 1, day));
  // 2월 30일 같은 날은 Date가 3월로 넘겨 버린다. 되읽어서 같은지 본다.
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== day || y < 1900) {
    return "개업일을 다시 봐 주세요.";
  }
  if (ymd > today.replace(/-/g, "")) return "개업일이 오늘보다 뒤예요. 사업자등록증의 날짜를 다시 봐 주세요.";
  return "";
}

/** 등록증 파일로 받는 형식. 버킷(`host-docs`)의 허용 형식과 같은 목록이다(SQL `2026-09-18-rent-bizcheck.sql`). */
export const BIZ_CERT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
};
export const BIZ_CERT_MAX_BYTES = 10 * 1024 * 1024;

/** 서버가 발급한 경로 모양 `{user_id}/{uuid}.{ext}`. 🔒이 사람의 폴더인지까지 본다(남의 등록증 경로를 끼워 넣지 못하게). */
export function bizCertPathOk(path: string, userId: number): boolean {
  const exts = Array.from(new Set(Object.values(BIZ_CERT_TYPES))).join("|");
  return new RegExp(`^${userId}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\\.(${exts})$`).test(path ?? "");
}

/** 네 칸 중 하나라도 적었나. 고치기에서 «옛 공간이라 비어 있음»과 «쓰다 만 것»을 가른다. */
export function hasAnyBiz(b: { bizNumber: string; bizOwnerName: string; bizOpenDate: string; bizCertPath: string }): boolean {
  return !!(bizDigits(b.bizNumber) || b.bizOwnerName.trim() || b.bizOpenDate.trim() || b.bizCertPath.trim());
}

/** 🧾이 저장에 사업자 정보가 필요한가 — 등록 폼(화면)과 서버 액션이 «같은 함수»로 판정한다 (09-18 밤 QA H-03).
 *  필요한 경우
 *   ① 새 공간 · ② 아직 안 올린 초안
 *   ③ 이미 사업자 정보가 있던 공간(한 번 낸 것은 지우지 못한다) · ④ 넷 중 하나라도 적은 고치기
 *   ⑤ 🆕**옛 공간(09-18 전, 넷 다 비어 있음)이 이름이나 주소를 바꿀 때.** 가게가 바뀌면 검토 대기로 내려가는데
 *      공개의 조건이 사업자 확인이라, 그냥 두면 검토 대기에서 멈춘 채 사장님은 이유를 모른다.
 *  ⚠️옛 공간이 «다른 칸만» 고치는 건 그대로 저장된다(대표 설계 — 공개 중인 공간의 저장을 막지 않는다). */
export function needsBizInfo(
  prev: {
    status?: string; name: string; address: string;
    bizNumber: string; bizOwnerName: string; bizOpenDate: string; bizCertPath: string;
  } | null,
  next: {
    name: string; address: string;
    bizNumber: string; bizOwnerName: string; bizOpenDate: string; bizCertPath: string;
  },
): boolean {
  if (!prev || prev.status === "draft") return true;
  if (hasAnyBiz(prev) || hasAnyBiz(next)) return true;
  return prev.name.trim() !== next.name.trim() || prev.address.trim() !== next.address.trim();
}

/** 🏷공간 상세의 「사업자 확인된 가게」 — 관리자가 등록증을 보고 승인했고 «그리고» 국세청 기록과 맞을 때만.
 *  ⚠️키가 없던 때(none)·조회 실패(error)로 관리자가 눈으로 보고 공개한 공간엔 안 붙는다(대표 09-17 설계). */
export function bizVerified(sp: { bizApprovedAt?: string; bizCheckStatus: BizCheckStatus }): boolean {
  return !!sp.bizApprovedAt && sp.bizCheckStatus === "valid";
}

/** 관리자 검토 화면의 상태 칩 글자. */
export const BIZ_CHECK_LABEL: Record<BizCheckStatus, string> = {
  none: "국세청 조회 전",
  valid: "국세청 기록과 일치",
  mismatch: "국세청 기록과 다름",
  closed: "휴업·폐업",
  error: "조회 실패",
};

/** 사장님께 보이는 말 — 등록 폼이 그 칸 밑에 띄운다(대표 설계 문안). */
export const BIZ_MISMATCH_LINE = "국세청 기록과 달라요. 번호·대표자 이름·개업일을 사업자등록증 그대로 적어 주세요.";
