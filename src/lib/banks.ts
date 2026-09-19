// 하루 팝업 — 정산 받을 은행 목록 (2026-09-17)
//
// 📎출처: 토스페이먼츠 «기관 코드» 문서의 은행 코드표 https://docs.tosspayments.com/codes/org-codes (09-17 확인)
//   코드는 그 표의 «숫자 두 자리»를 그대로 쓴다. 지급대행 셀러 등록 API가 은행을 이 코드로 받는다 —
//   번역표를 따로 두지 않으려고 우리 저장값도 같은 코드다.
// ⭐전부 넣지 않았다. 사장님이 실제로 쓸 법한 곳(시중·지방·인터넷은행·상호금융)만 골랐다.
//   목록에 없는 은행이 필요하다는 말이 오면 위 표에서 한 줄 더한다.
// 🚨훅도 DB도 안 부른다. 서버 액션(검증)과 화면(고르개)이 같은 목록을 본다.

export interface Bank {
  code: string;
  name: string;
}

export const BANKS: readonly Bank[] = [
  { code: "06", name: "국민은행" },
  { code: "88", name: "신한은행" },
  { code: "20", name: "우리은행" },
  { code: "81", name: "하나은행" },
  { code: "11", name: "농협은행" },
  { code: "12", name: "지역농축협" },
  { code: "03", name: "기업은행" },
  { code: "90", name: "카카오뱅크" },
  { code: "92", name: "토스뱅크" },
  { code: "89", name: "케이뱅크" },
  { code: "71", name: "우체국" },
  { code: "45", name: "새마을금고" },
  { code: "48", name: "신협" },
  { code: "07", name: "수협은행" },
  { code: "23", name: "SC제일은행" },
  { code: "27", name: "씨티은행" },
  { code: "31", name: "iM뱅크(대구)" },
  { code: "32", name: "부산은행" },
  { code: "39", name: "경남은행" },
  { code: "34", name: "광주은행" },
  { code: "37", name: "전북은행" },
  { code: "35", name: "제주은행" },
  { code: "02", name: "산업은행" },
];

export function bankName(code: string): string {
  return BANKS.find((b) => b.code === code)?.name ?? "";
}

export function isBankCode(code: string): boolean {
  return BANKS.some((b) => b.code === code);
}

/** 예금주 유형 — 테이블 `holder_type` 체크 제약과 같은 세 값. */
export type PayoutHolderType = "individual" | "sole_proprietor" | "corporation";

export const HOLDER_TYPE_LABEL: Record<PayoutHolderType, string> = {
  individual: "개인",
  sole_proprietor: "개인사업자",
  corporation: "법인",
};
