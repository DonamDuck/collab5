// 시각 표기 = KST(+09:00) 통일 (대표 07-27).
//
// ⚠️ 전제: DB의 timestamptz 컬럼은 '절대 시각'을 저장하며 이미 정확하다.
//    `2026-07-26 03:55:05+00`은 틀린 값이 아니라 **KST 12:55의 다른 표기**다(+00이 그 사실을 말해준다).
//    그래서 컬럼 타입은 건드리지 않는다 — timestamp(naive)로 바꾸면 오프셋 정보가 사라져
//    now() 비교·앱이 쓴 UTC 문자열과의 비교가 9시간씩 어긋난다(리포트 캐시가 바로 깨진다).
//
// 여기서 다루는 건 **우리가 문자열로 직접 찍어 넣는 시각**(jsonb 안의 created_at/updated_at 등)이다.
// 지금까지 `toISOString()`이 UTC 'Z'로 남겨서 대시보드에서 9시간 어긋나 보였다.
// 오프셋만 +09:00으로 명시하므로 **가리키는 순간은 완전히 동일**하고 Date.parse 비교도 그대로 안전하다.
//   before: 2026-07-26T03:55:05.184Z
//   after : 2026-07-26T12:55:05.184+09:00   ← 같은 순간, 사람이 읽기 쉬운 표기

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // 한국은 서머타임 없음 — 연중 고정 +09:00

/** 현재(또는 주어진) 시각을 KST 오프셋이 붙은 ISO 문자열로. 절대 시각은 보존된다. */
export function kstIso(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().replace("Z", "+09:00");
}

/** KST 기준 달력 날짜 `YYYY-MM-DD`. 일 단위 제한·집계 키에 쓴다.
 *  UTC 기준으로 자르면 한국에서 하루가 오전 9시에 바뀐다(자정 아님). */
export function kstDateKey(d: Date = new Date()): string {
  return new Date(d.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}
