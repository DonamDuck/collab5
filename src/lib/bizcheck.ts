// 하루 가게 — 사업자 확인의 «순수» 규칙 (2026-09-18 대표: 공간 등록에 사업자 확인 필수)
//
// 🚨훅도 DB도 fetch도 없다. 등록 폼(클라이언트)과 서버 액션이 «같은 함수»로 검사한다.
//   화면과 서버가 규칙을 따로 적으면 화면은 통과시키고 서버는 막는(또는 그 반대) 날이 온다.
//   국세청 호출은 서버 전용 `nts-bizcheck.ts`에 따로 있다.
import type { BizCheckDetail, BizCheckStatus } from "./types";

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

// ─── 🧪로컬 테스트 번호 (대표 09-19 저녁) ───
// 대표 원문: *「로컬은 임의 통과 가능한 사업자등록번호 넣고 다 통과하게 하구.」*
//   로컬(3003)은 운영 DB를 쓴다. 09-18 전에 만든 시험 공간 셋(id 1·2·3)은 번호가 비어 목록에서 빠지는데(`spaceListed`),
//   대표가 고치기 화면으로 채워 계속 시험하려면 국세청에 없는 번호로도 통과하는 길이 있어야 한다.
// 🚨**개발 서버(`next dev`)에서만 통과한다.** 운영 빌드(`next build`·Vercel 미리보기 포함)에선 세 겹으로 막는다.
//   ① 저장 — `bizNumberProblem`이 형식 오류로 돌려보낸다(화면과 서버가 같은 함수)
//   ② 이미 저장된 행 — `bizOnFile`이 「번호 없음」과 같게 읽는다. 로컬에서 운영 DB에 들어간 번호가 운영 목록·신청에 새지 않는다
//   ③ 목록 질의 — `listOpenSpaces`가 DB 단계에서 이 번호를 거른다(코드에서만 거르면 60개로 자른 뒤에 빠진다)
// ⚠️`000-00-00000`은 검증번호 규칙(`bizChecksumOk`)을 «통과한다»(가중합이 0이라 검증번호도 0). 그래서 번호 모양만으로는 못 막고
//   위 세 곳이 이 상수를 직접 본다.

/** 로컬 테스트 사업자등록번호(숫자만). 화면엔 `000-00-00000`으로 보인다. 누가 봐도 시험 번호인 모양으로 골랐다. */
export const TEST_BIZ_NUMBER = "0000000000";

/** 지금 테스트 번호를 받아 주는 판인가 = 개발 서버. 클라이언트 번들에서도 Next가 `NODE_ENV`를 빌드 때 박아 넣는다. */
export function testBizAllowed(): boolean {
  return process.env.NODE_ENV === "development";
}

/** 테스트 번호인가(하이픈·공백은 걷고 본다). 판이 어디든 모양만 본다. */
export function isTestBizNumber(v: string): boolean {
  return bizDigits(v) === TEST_BIZ_NUMBER;
}

/** 🧪개발 서버에서 테스트 번호면 국세청에 묻지 않고 「일치」로 적는다. 조회 원문엔 `reason: "local-test"`가 남는다(검토 화면이 그 말을 띄운다).
 *  그 밖엔 null — 호출부(`saveSpaceAction`)가 원래대로 국세청에 묻는다. */
export function localTestCheck(number: string): { status: "valid"; detail: BizCheckDetail } | null {
  if (!testBizAllowed() || !isTestBizNumber(number)) return null;
  return { status: "valid", detail: { reason: "local-test", valid: "01", bSttCd: "01", bStt: "로컬 테스트 번호" } };
}

/** 개발 서버의 사업자 칸 밑 한 줄. 운영 빌드에선 빈 문자열(그 줄이 안 그려진다). */
export function testBizHint(): string {
  return testBizAllowed() ? `로컬 테스트: ${formatBizNumber(TEST_BIZ_NUMBER)} 번호를 넣으면 통과해요. 등록증은 아무 이미지나 올려도 돼요.` : "";
}

/** 번호 칸의 문제 한 줄. 문제가 없으면 빈 문자열. */
export function bizNumberProblem(v: string): string {
  const d = bizDigits(v);
  if (!d) return "사업자등록번호를 적어 주세요.";
  if (d.length !== 10) return "사업자등록번호는 숫자 열 자리예요.";
  // 🧪테스트 번호 — 개발 서버면 검증번호 검사를 건너뛰고 통과, 운영이면 오타와 같은 말로 막는다(시험 번호가 있다는 것도 안 알린다).
  if (isTestBizNumber(d)) return testBizAllowed() ? "" : "번호가 맞지 않아요. 사업자등록증의 열 자리를 다시 봐 주세요.";
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

/** 🏠주소를 바꿨나 — 등록 폼과 서버(`saveSpaceAction`)가 같은 비교를 쓴다. 앞뒤 공백만 걷고 글자 그대로 본다(상세 주소의 층·호수까지).
 *  바꾸면 검토 대기로 내려간다(대표 09-16). 🔁09-19 저녁 대표 — 등록증을 새로 받던 규칙(`addressCertProblem`, 09-19 오후)은 뺐다.
 *    글자 그대로 비교라 층·호수 오타만 고쳐도 막혔다. 등록증과 주소가 맞는지는 관리자가 검토 화면에서 눈으로 본다. */
export function addressMoved(prev: { address: string } | null, nextAddress: string): boolean {
  return !!prev && prev.address.trim() !== (nextAddress ?? "").trim();
}

/** 🚪사업자등록번호가 적혀 있나 (대표 09-19 오후).
 *  대표 원문: *「사업자 정보가 빈 옛 공간이 뭐야..? 등록할 때 무조건 필수로 사업자등록번호 있어야 상품 등록하잖아!」*
 *  새 공간은 이미 넷 다 필수다(`needsBizInfo`). 번호가 빈 공간은 09-18 전에 만든 시험 공간뿐이라, 규칙으로 손님 앞에서 뺀다. */
export function bizOnFile(sp: { bizNumber: string }): boolean {
  const d = bizDigits(sp.bizNumber);
  // 🧪로컬 테스트 번호는 개발 서버에서만 «있는» 번호다. 운영에선 빈 번호와 같다(위 테스트 번호 머리말 ②).
  return d.length > 0 && (testBizAllowed() || d !== TEST_BIZ_NUMBER);
}

/** 🚪손님 앞에 서는 공간인가 = 공개 중(`open`) + 사업자등록번호 있음.
 *  목록·검색·사이트맵·소개서 카드·공간 상세·판매자 정보가 «이 한 벌»로 가른다. 신청·결제 승인은 `validateBookingRequest`가 같은 뜻으로 막는다.
 *  공개 투영(`SpacePublic`)엔 번호가 없어서 대신 `bizOnFile`(참거짓)을 받는다(`toPublic`이 채운다). */
export function spaceListed(sp: { status: string } & ({ bizNumber: string } | { bizOnFile: boolean })): boolean {
  if (sp.status !== "open") return false;
  return "bizOnFile" in sp ? sp.bizOnFile : bizOnFile(sp);
}

/** 사장님께 하는 말 — 번호가 빈 공간의 내 하루 가게 줄과 고치기 화면이 같이 쓴다. 검토 대기면 «다시»가 거짓이라 뺀다. */
export function bizMissingLine(status: string): string {
  return status === "pending"
    ? "사업자 정보를 채워 주셔야 열어 드릴 수 있어요."
    : "사업자 정보를 채워 주셔야 다시 열 수 있어요.";
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
