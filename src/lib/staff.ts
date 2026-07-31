// 사내(운영) 계정 판별 — **제품 기능이 아니라 테스트용 예외**다.
//
// 왜 필요한가: 07-31에 첫 실고객이 가입하면서 "내 소개서에는 콜라보 분석을 못 건다"는
// 원래 규칙을 되살렸다(자기 브랜드끼리 분석은 결과가 의미 없고, 유료 콜만 나간다).
// 다만 대표는 그 규칙 안에서 기능을 확인해야 해서 **대표 계정만 예외**로 둔다.
//
// ⚠️ 여기 계정을 늘리는 건 "이 사람은 제품 규칙 밖에서 논다"는 뜻이다. 편의로 늘리지 말 것.
// ⚠️ 소유·권한 판정에는 쓰지 마라 — 이건 UI·비용 예외용이고, 남의 데이터 접근 권한이 아니다.
const STAFF_USER_IDS = new Set<number>([2]); // 2 = 대표 계정(collab5, dudejrthd@gmail.com)

export function isStaffUser(userId?: number | null): boolean {
  return typeof userId === "number" && STAFF_USER_IDS.has(userId);
}
