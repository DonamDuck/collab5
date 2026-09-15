-- 하루 가게 — 하루 단위 → «시간 단위», 커피챗, 카테고리 두 축 (2026-09-16)
-- 결정 정본 = 볼트 [[하루-가게]] §🗣 09-16 · [[의사결정-로그]] 2026-09-16
--
-- 🚨 실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
-- ✅ 추가만 한다. 옛 칸(tagline·hours·price_day·open_dates·mentor_*·use_type 등)은 **하나도 안 지운다.**
--    ⭐메모리 [[schema-rename-checklist]]: 확장은 DB 먼저, 축소는 백필→배포→DROP 순서다.
--      지금은 «확장»만 한다. 옛 칸 DROP은 새 화면이 배포되고 한참 뒤에 따로 한다.
-- ✅ 여러 번 실행해도 안전하다.

-- ── 겹침 검사를 위한 확장 ──
-- 시간 단위가 되면서 「같은 날 하나」가 아니라 「같은 시간대는 하나」가 됐다. 그 판정을 DB가 한다.
create extension if not exists btree_gist;

-- ── 공간 ──
alter table spaces
  -- 📂카테고리 «두 축» (대표 09-16). 한 목록으로 만들면 조합이 폭발한다 —
  --   카페 공간만 / 카페 + 머신 / 국밥집 화구까지 / 예쁜 식당을 라운지로… 를 업종 × 범위로 가른다.
  add column if not exists category text not null default ''      -- cafe·restaurant·workshop·studio·shop·lounge·etc
    check (category in ('', 'cafe', 'restaurant', 'workshop', 'studio', 'shop', 'lounge', 'etc')),
  add column if not exists scope text not null default 'space_only'
    check (scope in ('space_only', 'with_gear', 'whole_shop')),
  --   space_only = 공간만 (라운지 대관·촬영·모임)
  --   with_gear  = 공간 + 장비 (머신·화구·재봉틀을 쓴다)
  --   whole_shop = 가게 그대로 (간판·메뉴까지 그 가게로. 진짜 하루 사장)

  -- ⏱시간 단위 (대표 09-16: *「사람들마다 대관 가능한 시간이 다 다를 테니 후자가 맞다」*)
  --   눈금은 1시간이다. 30분은 가게가 그렇게 생각하지 않고 달력·요금·겹침이 두 배로 복잡해진다.
  --   대신 «최소 대여 시간»을 호스트가 정해서 30분의 필요를 덮는다.
  add column if not exists price_hour integer not null default 0,
  add column if not exists min_hours  integer not null default 2,
  -- 날짜별로 «열어 두는 시간대». [{"date":"2026-10-10","start":"10:00","end":"18:00"}]
  -- ⭐옛 open_dates(날짜만) + hours(공간 전체의 한 줄)를 대신한다. 날마다 다르게 열 수 있어야 해서 한 칸에 담는다.
  add column if not exists open_slots jsonb not null default '[]'::jsonb,

  -- ☕커피챗 (대표 09-16). 옛 mentor_* 를 대신한다.
  --   ⭐파는 것은 «비법»이 아니라 «현업 이야기»다 — 레시피를 한 줄도 안 주고도 들려줄 수 있다.
  --   설비 사용법·비밀번호 같은 필수 안내는 상품이 아니라 인수인계라 여기 안 들어간다(아래 access_how).
  add column if not exists coffee_chat         boolean not null default false,
  add column if not exists coffee_chat_minutes integer not null default 0,
  add column if not exists coffee_chat_price   integer not null default 0,
  add column if not exists coffee_chat_topics  text    not null default '',   -- 들려줄 수 있는 내용(여러 줄)

  -- 📨이용 안내를 «어떻게» 할지 호스트가 고른다 (대표 09-16).
  --   🚨비밀번호 같은 민감한 것은 **우리 화면을 안 거친다.** 담을 칸을 일부러 안 둔다 —
  --     안 가지고 있으면 샐 일도 없다. 옛 access_note(들어오는 법)는 그래서 안 쓴다.
  add column if not exists access_how text not null default 'sms'
    check (access_how in ('sms', 'onsite', 'both')),

  -- ☎️청약 «전»에 보여야 하는 것 (전자상거래법 제20조②, 시행 2026-07-21 개정).
  --   사업자 호스트의 성명·주소·전화번호를 확인해 청약 전에 소비자에게 제공해야 하고,
  --   안 하면 제20조의2②로 우리가 연대 책임을 진다.
  --   ⭐그래서 «매장 전화»는 상세에서 열고, 호스트 «개인 휴대폰»은 확정 후에 연다.
  add column if not exists contact_phone text not null default '',
  -- 📜호스트 약관 동의 시각. 약관규제법 제3조③④ — 중요 내용은 설명하고 동의받아야 계약 내용이 된다.
  add column if not exists host_terms_at timestamptz;

create index if not exists idx_spaces_category on spaces(category);

-- ── 신청·예약 ──
alter table space_bookings
  -- 빌리는 시각. 옛 hours("10:00~18:00" 한 줄)를 대신한다.
  add column if not exists start_time time,
  add column if not exists end_time   time,
  add column if not exists hours_count integer not null default 0,   -- 끝 − 시작 (시간). 금액 근거를 행에 박아 둔다
  -- ☕커피챗 값. 옛 amount_mentor / with_mentor 를 대신한다.
  add column if not exists with_chat  boolean not null default false,
  add column if not exists amount_chat integer not null default 0;

-- 🚨옛 「같은 공간 같은 날 하나」 제약을 내린다. 시간 단위에서는 하루에 여럿이 들어온다.
drop index if exists uq_bookings_space_date;

-- 같은 공간에서 «시간이 겹치는» 살아 있는 예약은 하나뿐.
--   ⭐`pending`은 일부러 뺀다 — 결제창까지 갔다 닫은 사람이 남의 시간을 막으면 안 된다.
--     먼저 결제를 끝낸 사람이 이긴다(승인 직후 paid로 올릴 때 이 제약이 걸린다).
--   ⚠️시각이 아직 안 담긴 옛 행은 제외한다(start_time is not null).
alter table space_bookings drop constraint if exists no_time_overlap;
alter table space_bookings add constraint no_time_overlap
  exclude using gist (
    space_id with =,
    tsrange(use_date + start_time, use_date + end_time, '[)') with &&
  )
  where (status in ('paid', 'confirmed', 'done') and start_time is not null and end_time is not null);

-- ── 옛 데이터를 새 칸으로 옮겨 둔다 (한 번만 의미가 있고 여러 번 돌려도 안전하다) ──
-- 하루 값 → 시간당 값. 「10:00~20:00」 같은 한 줄에서 시간 수를 뽑아 나눈다. 못 뽑으면 8시간으로 친다.
update spaces set price_hour = greatest(1000, round(price_day / 8.0)::int)
  where price_hour = 0 and price_day > 0;
-- 비는 날 + 이용 시간 → 시간대 목록
update spaces set open_slots = (
  select coalesce(jsonb_agg(jsonb_build_object(
    'date', d,
    'start', coalesce(nullif(split_part(hours, '~', 1), ''), '10:00'),
    'end',   coalesce(nullif(split_part(hours, '~', 2), ''), '18:00')
  )), '[]'::jsonb)
  from jsonb_array_elements_text(open_dates) as d
) where open_slots = '[]'::jsonb and jsonb_array_length(open_dates) > 0;
-- 알려주기 → 커피챗
update spaces set coffee_chat = true, coffee_chat_minutes = mentor_minutes, coffee_chat_price = mentor_price
  where coffee_chat = false and mentor_minutes > 0;
-- 쓰임새 → 범위. as_is(원래 목적대로)는 장비를 쓰는 쪽, open(대관)은 공간만.
update spaces set scope = case when use_type = 'as_is' then 'with_gear' else 'space_only' end
  where scope = 'space_only' and use_type = 'as_is';

-- 옛 예약의 시각을 공간의 이용 시간에서 채운다(테스트 데이터 정리용).
update space_bookings b set
  start_time = coalesce(nullif(split_part(b.hours, '~', 1), ''), '10:00')::time,
  end_time   = coalesce(nullif(split_part(b.hours, '~', 2), ''), '18:00')::time
  where b.start_time is null;
update space_bookings set hours_count = greatest(1, extract(hour from (end_time - start_time))::int)
  where hours_count = 0 and start_time is not null;
update space_bookings set with_chat = with_mentor, amount_chat = amount_mentor
  where amount_chat = 0 and amount_mentor > 0;
