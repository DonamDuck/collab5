-- 하루 가게 — 사장님이 파는 상품을 셋으로 (2026-09-18 대표)
-- 대표: 「대관만, 공간 전체(대관·시설), 커피챗 이렇게 3개 상품을 설정할 수 있게 하고 가격도 각각,
--        고객은 신청할 때 이걸 선택할 수 있게」
-- ⭐추가만 한다(옛 scope·price_hour는 남긴다 — 확장은 DB 먼저, 축소는 맨 마지막). 두 번 돌려도 된다.
-- 커피챗은 이미 칸이 있다(coffee_chat·coffee_chat_minutes·coffee_chat_price·coffee_chat_topics).

-- ① 공간 상품 둘 — 켜기·시간당 값·무엇을 쓸 수 있는지 설명
alter table spaces
  add column if not exists rent_space_on    boolean not null default false,
  add column if not exists rent_space_price integer not null default 0,
  add column if not exists rent_space_note  text    not null default '',
  add column if not exists rent_full_on     boolean not null default false,
  add column if not exists rent_full_price  integer not null default 0,
  add column if not exists rent_full_note   text    not null default '';

-- 옛 공간 채우기: 범위가 «공간만»이면 대관만 상품, «장비까지·가게 통째»면 공간 전체 상품. 값은 옛 시간당 값.
--   이미 채워진 행(둘 중 하나라도 켜짐)은 건드리지 않는다.
update spaces set
  rent_space_on    = (scope = 'space_only'),
  rent_space_price = case when scope = 'space_only' then price_hour else 0 end,
  rent_full_on     = (scope <> 'space_only'),
  rent_full_price  = case when scope <> 'space_only' then price_hour else 0 end
where not rent_space_on and not rent_full_on;

-- ② 예약이 어느 상품을 샀는지. 옛 예약은 그 공간의 옛 범위로 채운다.
alter table space_bookings
  add column if not exists product text not null default 'space'
    check (product in ('space', 'full'));

update space_bookings b set product = 'full'
from spaces s
where b.space_id = s.id and s.scope <> 'space_only' and b.product = 'space';
