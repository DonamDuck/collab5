-- 결제 테이블 — 예약과 돈을 두 테이블로 가른다 (2026-09-16, 대표 확정)
--
-- 🧭대표 결정 셋
--   ①정산은 토스 «지급대행»이다 — 돈이 우리 계좌를 거치지 않는다(볼트 [[결제-모듈-토스]]).
--   ②테이블은 «둘»이다. `space_bookings`(무슨 일이 있었나) + `payments`(돈이 어디 있나).
--     환불 이력·지급 기록을 따로 테이블로 떼지 않는다 — 대표: *「3개 테이블 각각 만드는 건 낭비」*.
--     환불 이력은 토스 응답 전체(`toss_raw`) 안에 있고, 지급은 결제 한 줄에 칸으로 붙인다.
--   ③상태는 «같이» 움직인다. 예약이 취소되면 결제가 CANCELED가 되고 둘 다 updated_at이 갱신된다.
--     두 줄을 따로 쓰면 한쪽만 바뀌는 날이 오므로, 옮기는 일은 아래 함수 `rent_sync` 한 곳에서 «한 트랜잭션»으로 한다.
--   그리고 1팀(리포트 유료화)이 나중에 이 테이블을 같이 쓴다. 그래서 이름이 `rent_payments`가 아니라 `payments`다.
--
-- ⭐**추가만 한다.** 예약 테이블의 옛 돈 칸(payment_key·amount_*)은 지우지 않는다(축소는 배포 뒤).
-- 🗑이 파일이 `2026-09-16-rent-payout.sql`(amount_refunded·paid_out_at)을 대신한다. 그 파일은 돌리지 않았다.

-- ─── 1. payments ─────────────────────────────────────────────────────────────
create table if not exists payments (
  id                  bigint generated always as identity primary key,

  -- 🔑토스와 우리를 잇는 열쇠 둘. order_id는 우리가 결제창을 열기 전에 만들고, payment_key는 승인 뒤에 생긴다.
  order_id            text not null unique,
  payment_key         text unique,                                   -- 승인 전엔 null(null은 여럿이어도 unique에 안 걸린다)

  -- 📦어디서 온 결제인가. 리포트 유료화가 붙는 날 값을 하나 더한다.
  purpose             text not null check (purpose in ('rent_booking')),
  -- 🔁한 예약에 결제 «시도»는 여럿일 수 있다(카드 인증 실패 → 다시 시도). unique를 안 건 이유.
  --   지켜야 할 규칙은 「승인된 결제는 하나」이고, 그건 아래 부분 unique 인덱스가 건다.
  booking_id          bigint references space_bookings(id) on delete restrict,
  buying_user_id      bigint references users(user_id) on delete set null,   -- 돈을 낸 사람(대표 09-16 이름)
  selling_user_id     bigint references users(user_id) on delete set null,   -- 돈을 받을 사람 = 공간 주인(대표 09-16)
  -- ⚠️사람 칸 둘은 «set null»이다. 회원 탈퇴가 하드 삭제라(매거진 하트가 cascade인 것과 같은 구조),
  --   restrict로 걸면 결제 기록이 있는 회원은 탈퇴를 못 한다. 기록은 남기고(전자상거래법 제6조) 사람 칸만 빈다 —
  --   누가 냈는지는 `toss_raw`로 되짚는다. 예약(booking_id)은 restrict — 예약은 사람이 아니라 «거래»라 지우면 안 된다.
  --   selling_user_id는 리포트 유료화처럼 판매자가 «우리»인 결제엔 처음부터 비어 있다.
  --   토스 셀러 id(지급대행 등록 뒤 생김)는 결제가 아니라 «사람»에 붙는 값이라 여기 두지 않는다.
  -- ⚠️두 FK 모두 restrict다. 돈이 오간 기록은 예약·회원을 지워도 같이 사라지면 안 된다
  --   (전자상거래법 제6조 — 대금 결제 기록 보존). 시험 데이터를 지울 땐 결제 줄을 먼저 지운다.

  -- 💰금액 — 이름은 토스 필드를 따른다. amount = totalAmount(처음 낸 돈, 환불해도 안 바뀜)
  --   balance_amount = balanceAmount(환불하고 «남은» 돈). 사장님 몫은 이 남은 돈에서 계산한다(호스트 약관 제8조).
  amount              integer not null check (amount > 0),
  balance_amount      integer not null check (balance_amount >= 0),
  method              text not null default '',                     -- 카드·간편결제… (토스 method)

  -- 🚦돈의 상태 — **토스 Payment.status 이름 그대로**(2026-09-16 토스 문서와 대조). 번역표를 두지 않는다.
  status              text not null default 'READY'
                      check (status in ('READY', 'IN_PROGRESS', 'WAITING_FOR_DEPOSIT', 'DONE',
                                        'CANCELED', 'PARTIAL_CANCELED', 'ABORTED', 'EXPIRED')),
  approved_at         timestamptz,
  canceled_at         timestamptz,                                   -- 마지막 취소 시각
  -- 🔻환불 이력 칸(`cancels`)은 두지 않는다(대표 09-16). 토스는 응답마다 지금까지의 환불을 «전부» 실어 보내므로
  --   이력은 `toss_raw->'cancels'`에 이미 있다. 정산 계산에 필요한 건 남은 돈(balance_amount) 하나뿐이다.

  -- 🏦지급(토스 지급대행) — 결제 한 줄 = 사장님 한 분께 한 번. 리포트 결제는 NONE으로 남는다.
  fee_rate            numeric(5,4) not null default 0.15,            -- 행마다 박는다. 요율이 바뀌어도 옛 거래는 그때 값
  payout_amount       integer not null default 0,                    -- 보낼 돈(남은 돈 − 수수료)의 스냅샷
  payout_status       text not null default 'NONE'
                      check (payout_status in ('NONE', 'WAITING', 'REQUESTED', 'DONE', 'FAILED')),
  payout_ref          text not null default '',                      -- 토스 지급 요청 id
  payout_requested_at timestamptz,
  payout_done_at      timestamptz,

  toss_raw            jsonb,                                         -- 마지막으로 받은 토스 응답 전체(되짚기용)
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_payments_status on payments(status, created_at desc);
create index if not exists idx_payments_payout on payments(payout_status) where payout_status in ('WAITING', 'REQUESTED', 'FAILED');
create index if not exists idx_payments_buyer  on payments(buying_user_id, created_at desc);   -- 손님의 결제 내역
create index if not exists idx_payments_seller on payments(selling_user_id, created_at desc);  -- 정산은 판매자별로 모은다
create index if not exists idx_payments_booking on payments(booking_id, created_at desc);      -- 예약의 «마지막» 시도를 찾는다
-- 🔒한 예약에 «승인된» 결제는 하나. 실패·만료 줄은 여럿 쌓여도 된다.
create unique index if not exists uq_payments_booking_approved
  on payments(booking_id)
  where booking_id is not null and status in ('DONE', 'PARTIAL_CANCELED', 'CANCELED');

-- 🔒정책 없음 = 공개 키(anon)로는 한 줄도 못 읽고 못 쓴다. 서버가 service_role로만 닿는다(spaces·space_bookings와 같은 규율).
--   이걸 빠뜨리면 Supabase가 새 테이블을 공개 API로 열어 두어서, 누구나 남의 결제 내역을 읽을 수 있다.
alter table payments enable row level security;

drop trigger if exists trg_payments_updated on payments;
create trigger trg_payments_updated before update on payments
  for each row execute function set_updated_at();

-- ─── 2. 예약 상태에 «expired» 하나 더 ──────────────────────────────────────────
-- 토스 결제는 30분이 지나면 EXPIRED다(토스 문서). 예약도 같이 움직여야 하는데 짝이 될 상태가 없었다.
-- 그래서 결제창만 열고 떠난 신청이 `pending`으로 영원히 쌓였다(시험 데이터 15줄이 그 흔적).
-- ⚠️제약 이름을 짐작하지 않는다. 09-13 생성문은 칸 안에 check를 적어서 이름을 Postgres가 붙였다.
--   이름이 짐작과 다르면 drop이 조용히 넘어가고, 옛 제약이 살아남아 'expired'를 계속 막는다.
--   그래서 status 칸을 보는 check 제약을 «찾아서» 전부 내린다.
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'space_bookings'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%status%'
  loop
    execute format('alter table space_bookings drop constraint %I', r.conname);
  end loop;
end $$;
alter table space_bookings add constraint space_bookings_status_check
  check (status in ('pending', 'paid', 'confirmed', 'rejected', 'refunded', 'cancelled', 'done', 'expired'));

-- ─── 3. 한 트랜잭션으로 두 줄을 같이 옮기는 함수 ──────────────────────────────
-- 🔒예약 상태와 결제 상태는 «반드시» 이 함수로 같이 바꾼다. 앱이 두 번 나눠 쓰면 가운데서 끊기는 날
--   예약은 취소됐는데 결제는 DONE인 줄이 생긴다. plpgsql 함수 안은 하나의 트랜잭션이라 둘 다 되거나 둘 다 안 된다.
-- 인자
--   p_order_id       어느 결제인가
--   p_booking_status 예약을 무엇으로(null이면 예약은 그대로)
--   p_toss           토스 Payment 응답(null이면 결제 칸은 그대로). 돈의 상태는 «우리가 계산하지 않고» 토스 응답에서 옮긴다.
--   p_payout_status  지급 상태를 무엇으로(null이면 그대로)
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
begin
  select booking_id into v_booking_id from payments where order_id = p_order_id for update;
  if not found then
    raise exception 'rent_sync: payments에 order_id=% 가 없다', p_order_id;
  end if;

  if p_toss is not null then
    update payments set
      payment_key    = coalesce(nullif(p_toss->>'paymentKey', ''), payment_key),
      status         = coalesce(p_toss->>'status', status),
      balance_amount = coalesce((p_toss->>'balanceAmount')::integer, balance_amount),
      method         = coalesce(p_toss->>'method', method),
      approved_at    = coalesce((p_toss->>'approvedAt')::timestamptz, approved_at),
      -- 🩸09-16 실결제에서 터졌다: 토스는 환불이 없으면 `"cancels": null`을 보낸다. JSON의 null은 SQL NULL이 아니라서
      --   coalesce를 그냥 지나가고, jsonb_array_elements가 「cannot extract elements from a scalar」로 함수를 통째로 죽였다.
      --   그래서 모든 승인이 「시간이 찼어요 → 자동 환불」로 빠졌다. «배열일 때만» 펼친다.
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
      -- 💸금액은 «대기·요청» 단계에서만 계산한다. 요청한 뒤(완료·실패)엔 손대지 않는다 —
      --   요청과 완료 사이에 환불이 나면 완료 시점에 금액이 줄어 «실제로 보낸 돈»과 장부가 어긋난다.
      payout_amount       = case when p_payout_status in ('WAITING', 'REQUESTED')
                                 then floor(balance_amount * (1 - fee_rate))::integer
                                 else payout_amount end,
      payout_requested_at = case when p_payout_status = 'REQUESTED' then now() else payout_requested_at end,
      payout_done_at      = case when p_payout_status = 'DONE' then now() else payout_done_at end
    where order_id = p_order_id;
  end if;

  if p_booking_status is not null and v_booking_id is not null then
    update space_bookings set status = p_booking_status where id = v_booking_id;
  end if;
end;
$$;

-- 🔒**공개 키로 못 부르게 막는다.** Supabase는 public 스키마의 함수를 공개 API(`/rpc/rent_sync`)로 열어 둔다.
--   안 막으면 누구나 남의 예약을 취소 상태로 바꾸거나 지급을 DONE으로 찍을 수 있다. 서버(service_role)만 부른다.
revoke execute on function rent_sync(text, text, jsonb, text) from public, anon, authenticated;
grant  execute on function rent_sync(text, text, jsonb, text) to service_role;

-- ─── 4. 옛 예약에서 결제 줄 채우기 ────────────────────────────────────────────
-- ⚠️운영 DB엔 시험 예약만 있다(09-16 조회: 18줄 — pending 15 · paid 1 · confirmed 1 · cancelled 1).
insert into payments (order_id, payment_key, purpose, booking_id, buying_user_id, selling_user_id,
                      amount, balance_amount, status, fee_rate, payout_amount, payout_status, created_at)
select
  b.order_id,
  nullif(b.payment_key, ''),
  'rent_booking',
  b.id,
  b.guest_user_id,
  sp.owner_user_id,
  b.amount_total,
  case when b.status in ('refunded', 'cancelled') then 0 else b.amount_total end,
  case
    when b.status = 'pending' and b.created_at < now() - interval '30 minutes' then 'EXPIRED'
    when b.status = 'pending'                                                  then 'READY'
    when b.status in ('paid', 'confirmed', 'done')                             then 'DONE'
    when b.status = 'rejected'                                                 then 'DONE'      -- 거절했는데 환불 «실패» — 돈은 아직 승인 상태
    when b.status in ('refunded', 'cancelled')                                 then 'CANCELED'  -- 옛 손님 취소는 몇 % 돌려줬는지 기록이 없어 전액으로 본다(시험 데이터)
  end,
  b.fee_rate,
  case when b.status = 'done' then b.amount_payout else 0 end,
  case when b.status = 'done' then 'WAITING' else 'NONE' end,
  b.created_at
from space_bookings b
join spaces sp on sp.id = b.space_id
where b.amount_total > 0
  and not exists (select 1 from payments p where p.order_id = b.order_id);

-- 30분 넘게 결제를 안 끝낸 신청은 예약도 expired로 — 결제와 짝을 맞춘다.
update space_bookings set status = 'expired'
  where status = 'pending' and created_at < now() - interval '30 minutes';
