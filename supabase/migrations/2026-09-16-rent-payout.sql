-- 하루 가게 — 정산 재료 두 칸 (2026-09-16)
--
-- ⭐**추가만 한다.** 지우는 칸이 없어 코드보다 먼저 돌려도 안전하다(확장은 DB 먼저).
--
-- ① amount_refunded — 이 예약에서 손님께 «돌려준» 돈.
--    호스트 약관 제8조: 「환불된 예약은 호스트 정산에서 제외되며, 환불되지 않은 금액은 정산 시 함께 지급됩니다」.
--    그런데 09-16까지 환불액을 어디에도 남기지 않았다. 3일 전 취소(70% 환불)의 나머지 30%를
--    사장님께 드릴 근거가 행에 없었다. 취소·거절할 때 여기 적는다.
--
-- ② paid_out_at — 사장님께 «입금한» 시각. 비어 있으면 아직 안 드린 것이다.
--    입금 자체는 대표가 손으로 한다(1단계). 이 칸은 「줬나 안 줬나」를 두 번 주거나 빠뜨리지 않게 하는 장부다.

alter table space_bookings
  add column if not exists amount_refunded integer not null default 0,
  add column if not exists paid_out_at timestamptz;

-- 옛 행 채우기 — `refunded`는 거절 뒤 전액 환불이 «끝난» 예약이다(거절은 언제나 전액, 대표 09-13).
--   🚨`rejected`는 채우지 않는다. 코드에서 그 상태는 「거절했는데 **환불이 실패한**」 자리다
--     (`decideBookingAction`: `refunded ? "refunded" : "rejected"`). 돌려주지 못한 돈을 돌려줬다고 적으면 안 된다.
--   ⚠️손님 취소(`cancelled`)도 그때 몇 %였는지 남은 기록이 없어 채우지 않는다. 시험 데이터뿐이라 영향이 없다.
update space_bookings
  set amount_refunded = amount_total
  where status = 'refunded' and amount_refunded = 0;
