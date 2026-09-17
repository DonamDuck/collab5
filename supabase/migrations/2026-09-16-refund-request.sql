-- 하루 가게 — 사장님의 «관리자에게 환불 신청» (2026-09-16 대표)
--
-- 대표 결정: 확정된 예약을 사장님 사정으로 무를 땐 사장님이 바로 환불하지 않는다.
--   사장님이 「관리자에게 환불 신청하기」 → 우리가 사장님과 손님께 전화로 확인 → 관리자 승인 → 전액 환불.
--   (숙박업이 이렇게 한다 — 대표)
--
-- ⭐추가만 한다. 예약 상태를 하나 더 만들지 않고 «신청이 들어와 있다»는 사실만 적는다 —
--   신청 중에도 예약은 원래 상태(결제 완료·확정) 그대로 살아 있어야 하고, 관리자가 신청을 닫으면
--   아무 일도 없었던 것처럼 돌아가야 해서다. 승인하면 그때 `rent_sync`로 refunded + CANCELED가 된다.
-- 🔒신청이 걸린 예약은 이용일이 지나도 «다녀옴 · 지급 대기»로 넘기지 않는다(앱의 정리 작업이 거른다).

alter table space_bookings
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_request_note text not null default '';

create index if not exists idx_bookings_refund_requested
  on space_bookings(refund_requested_at)
  where refund_requested_at is not null;
