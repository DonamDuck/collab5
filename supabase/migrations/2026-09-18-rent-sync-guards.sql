-- 하루 가게 — `rent_sync` 가드 (2026-09-18 밤 QA SC-02 · G-16)
--
-- 🚨**아직 실행하지 않았다.** 대표가 Supabase SQL Editor에서 직접 돌린다(운영 DB 쓰기는 대표 손으로, 09-18).
-- ⭐이 파일은 **함수 하나만 다시 만든다.** 표·칸·행·정책은 한 줄도 안 건드린다. 두 번 돌려도 같다.
--   함수 정의의 뿌리는 `2026-09-16-payments.sql` §3이다. 되돌리려면 그 파일의 함수 정의를 다시 돌리면 된다.
--
-- 무엇이 달라지나
--  ① **승인된 결제를 승인 «전» 상태로 되돌리지 않는다.** 결제가 DONE·PARTIAL_CANCELED·CANCELED인데
--     ABORTED·EXPIRED·READY·IN_PROGRESS·WAITING_FOR_DEPOSIT가 들어오면 «결제 칸을 아예 안 건드린다».
--     🩸09-18 밤 QA(SC-02): 결제 복귀 주소가 두 번 열리면 두 번째 승인이 「이미 처리된 결제」로 실패하는데,
--       그때 앱이 쓰던 ABORTED가 첫 승인의 DONE을 덮었다. 장부만 보면 «받은 적 없는 돈»이 된다.
--     같이 막는 것 = 이미 취소된 결제에 늦게 도착한 DONE·PARTIAL_CANCELED(순서가 뒤집힌 응답), 그리고 잔액이 도로 커지는 것.
--     ⚠️단 «다른 결제 시도»(paymentKey가 다름)가 오면 그건 새 시도다 — 승인된 결제가 아직 살아 있을 때만 막는다.
--  ② **취소(cancelled)는 결제 전·만료·결제 완료·확정에서만** 예약을 옮긴다. 거절·환불·다녀옴·이미 취소된 예약은 그대로 둔다.
--  ③ **환불(refunded)은 거절·결제 완료·확정에서만** 옮긴다.
--     🩸09-18 밤 QA(G-16): 손님 취소와 사장님 거절이 겹치면 늦게 도착한 쪽이 앞선 결과를 덮었다.
--       거절해서 환불까지 끝난 예약이 「손님 취소」로 뒤집히면, 이용일이 지난 뒤 정리 작업이 남은 돈을 사장님 지급 대기로 올린다.
--     ⭐②③에서 막는 것은 «예약 상태» 하나뿐이다. 토스 응답(돈의 상태)은 그대로 적는다 — 돈은 실제로 움직였고 장부는 토스를 따라야 한다.
--     ⚠️`pending`·`expired`도 취소를 받는 이유 = 승인 뒤 예약을 못 올려 «자동 환불»한 갈래가 그 상태에서 cancelled로 온다
--       (`confirmBookingAction`). 그 길을 막으면 돈은 돌려줬는데 신청이 만료로만 남는다.
--
-- 실행 전 / 실행 후
--  · 실행 전에도 앱은 09-18 밤 수정으로 **ABORTED를 쓰기 전에 예약·결제를 다시 읽는다**(창이 좁아졌을 뿐 완전히 닫히지는 않는다).
--  · 실행 후에는 겹쳐 들어와도 장부가 뒤집히지 않는다. 정상 흐름(승인·수락·거절·취소·환불·정리 작업)의 결과는 그대로다.
--  · 실행 시각은 아무 때나 괜찮다(잠금은 결제 한 줄뿐, 오래 걸리는 작업이 없다).

create or replace function rent_sync(
  p_order_id       text,
  p_booking_status text default null,
  p_toss           jsonb default null,
  p_payout_status  text default null
) returns void
language plpgsql
as $$
declare
  v_booking_id bigint;
  v_current    text;
  v_pay_status text;
  v_pay_key    text;
  v_new_status text;
  v_new_key    text;
  v_same_pay   boolean := true;
  v_apply_toss boolean := p_toss is not null;
  v_move_booking boolean := p_booking_status is not null;
begin
  -- 결제 줄을 먼저 잡는다. 같은 주문의 호출은 여기서 한 줄로 선다(그 뒤에 읽는 상태는 최신이다).
  select booking_id, status, payment_key into v_booking_id, v_pay_status, v_pay_key
    from payments where order_id = p_order_id for update;
  if not found then
    raise exception 'rent_sync: payments에 order_id=% 가 없다', p_order_id;
  end if;

  -- 🚦예약은 «지금 상태»를 보고 옮긴다 (09-16 점검 v2).
  if v_booking_id is not null and p_booking_status is not null then
    select status into v_current from space_bookings where id = v_booking_id for update;
    -- 만료는 «아직 결제 전»에서만. 그 사이 승인됐으면 조용히 아무것도 안 한다.
    if p_booking_status = 'expired' and v_current <> 'pending' then
      return;
    end if;
    -- 다녀옴은 확정(또는 phase 1의 결제 완료)에서만.
    if p_booking_status = 'done' and v_current not in ('confirmed', 'paid') then
      return;
    end if;
    -- 결제 완료는 결제 전·만료에서만. 이미 취소·환불된 예약에 승인이 오는 건 있으면 안 되는 일이라 오류로 멈춘다.
    if p_booking_status = 'paid' and v_current not in ('pending', 'expired') then
      raise exception 'rent_sync: order=% 는 % 상태라 paid로 못 옮긴다', p_order_id, v_current;
    end if;
    -- 🆕②③ 겹쳐 들어온 취소·환불이 앞선 결과를 덮지 못하게. 예약만 그대로 두고 돈의 상태는 아래에서 그대로 적는다.
    if p_booking_status = 'cancelled' and v_current not in ('paid', 'confirmed', 'pending', 'expired') then
      v_move_booking := false;
    end if;
    if p_booking_status = 'refunded' and v_current not in ('rejected', 'paid', 'confirmed') then
      v_move_booking := false;
    end if;
  end if;

  -- 🆕① 돈의 상태는 «앞으로만» 간다. 승인된 결제에 승인 전 상태가 오면 결제 칸을 안 건드린다.
  if p_toss is not null then
    v_new_status := p_toss->>'status';
    v_new_key    := nullif(p_toss->>'paymentKey', '');
    -- 키가 없으면(우리가 만든 ABORTED·EXPIRED 같은 것) 지금 결제와 같은 것으로 본다.
    v_same_pay   := v_new_key is null or v_pay_key is null or v_new_key = v_pay_key;
    if v_same_pay
       and v_pay_status in ('DONE', 'PARTIAL_CANCELED', 'CANCELED')
       and v_new_status in ('READY', 'IN_PROGRESS', 'WAITING_FOR_DEPOSIT', 'ABORTED', 'EXPIRED') then
      v_apply_toss := false;
    end if;
    -- 순서가 뒤집혀 늦게 도착한 응답(이미 취소된 결제에 DONE·부분취소 / 부분취소된 결제에 DONE).
    if v_same_pay and v_pay_status = 'CANCELED' and v_new_status in ('DONE', 'PARTIAL_CANCELED') then
      v_apply_toss := false;
    end if;
    if v_same_pay and v_pay_status = 'PARTIAL_CANCELED' and v_new_status = 'DONE' then
      v_apply_toss := false;
    end if;
    -- 살아 있는 승인 결제를 «다른 시도»가 덮지 못하게. 취소가 끝난 결제(CANCELED)는 새 시도로 갈아탈 수 있다.
    if not v_same_pay and v_pay_status in ('DONE', 'PARTIAL_CANCELED') then
      v_apply_toss := false;
    end if;
  end if;

  if v_apply_toss then
    update payments set
      payment_key    = coalesce(nullif(p_toss->>'paymentKey', ''), payment_key),
      status         = coalesce(p_toss->>'status', status),
      -- 잔액은 같은 결제 안에서 «줄기만» 한다. 늦게 온 응답이 환불 전 잔액으로 되돌리지 못하게.
      balance_amount = case
                         when (p_toss->>'balanceAmount') is null then balance_amount
                         when v_same_pay then least(balance_amount, (p_toss->>'balanceAmount')::integer)
                         else (p_toss->>'balanceAmount')::integer
                       end,
      method         = coalesce(p_toss->>'method', method),
      approved_at    = coalesce((p_toss->>'approvedAt')::timestamptz, approved_at),
      -- 🩸토스는 환불이 없으면 `"cancels": null`을 보낸다. «배열일 때만» 펼친다(09-16 실결제에서 터졌다).
      canceled_at    = coalesce(
                         case when jsonb_typeof(p_toss->'cancels') = 'array'
                              then (select max((c->>'canceledAt')::timestamptz) from jsonb_array_elements(p_toss->'cancels') c)
                         end,
                         canceled_at),
      toss_raw       = p_toss
    where order_id = p_order_id;
  end if;

  if p_payout_status is not null then
    update payments set
      payout_status       = p_payout_status,
      payout_amount       = case when p_payout_status in ('WAITING', 'REQUESTED')
                                 then floor(balance_amount * (1 - fee_rate))::integer
                                 else payout_amount end,
      payout_requested_at = case when p_payout_status = 'REQUESTED' then now() else payout_requested_at end,
      payout_done_at      = case when p_payout_status = 'DONE' then now() else payout_done_at end
    where order_id = p_order_id;
  end if;

  if v_move_booking and v_booking_id is not null then
    update space_bookings set status = p_booking_status where id = v_booking_id;
  end if;
end;
$$;

-- 🔒공개 키로 못 부르게(이 줄들은 `2026-09-16-payments.sql`과 같다. `create or replace`는 권한을 지우지 않지만 한 번 더 못 박아 둔다).
revoke execute on function rent_sync(text, text, jsonb, text) from public, anon, authenticated;
grant  execute on function rent_sync(text, text, jsonb, text) to service_role;
