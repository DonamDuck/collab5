// 매거진 표시 포맷 (2026-08-10)
// ⚠️`lib/time.ts`의 kstIso/kstDateKey는 **저장·비교용**(ISO·YYYY-MM-DD)이라 화면 문구로는 안 맞는다.
//    여기 있는 건 사람이 읽는 라벨 전용.

/** 발행일 라벨 — "2026년 8월 9일".
 *  ⚠️`timeZone: "Asia/Seoul"`을 반드시 준다. 안 주면 서버(UTC)와 브라우저(KST)가 **다른 날짜**를 그려
 *  하이드레이션 경고가 나고, 자정 근처 글은 하루 어긋나 보인다. */
export function kstDateLabel(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(d);
}
