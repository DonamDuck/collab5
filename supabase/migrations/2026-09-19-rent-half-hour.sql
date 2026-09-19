-- 하루 가게 — 30분 단위 (2026-09-19 대표)
-- 대표: 「사장님은 공간의 open 시간을 30분 단위로 선택할 수 있다. 9시 30분 ~ 12시의 자투리도 가능.
--        고객은 공간 빌릴 때 시간을 30분 단위로 선택할 수 있다.」
--
-- ⭐추가만 한다. 옛 칸(`spaces.min_hours`·`space_bookings.hours_count`, 둘 다 integer)은 그대로 둔다.
--   두 번 돌려도 된다(칸은 if not exists, 채우기는 빈 행만).
-- ⭐코드는 이 SQL «전»에도 돈다.
--   · 예약: 새 칸이 없으면 그 칸만 빼고 저장하고, 읽을 때 시작·끝 시각의 차이로 길이를 센다(`spaces.ts` toBooking).
--   · 공간: 최소 시간이 정시(1·2·3시간…)면 옛 칸만으로 저장된다. 1시간 30분처럼 반 시간을 고르면 이 SQL이 먼저다
--     (옛 칸에 못 담아서 조용히 2시간으로 바뀌는 대신 저장이 실패한다).
-- ✅시간 겹침 배제 제약(`2026-09-16-daily-shop-hourly.sql`의 tsrange)은 `time` 칸이라 30분 구간도 그대로 막는다. 바꿀 것 없다.

-- ① 공간 — 최소 대여 시간(분). 1시간 30분 = 90.
--   ⚠️기본값을 두지 않는다. 옛 코드가 새 공간을 넣으면 이 칸은 비고(null), 새 코드는 비면 옛 `min_hours`를 읽는다.
--     기본값(예: 120)을 두면 옛 코드가 넣은 3시간 공간이 2시간으로 읽힌다.
alter table spaces
  add column if not exists min_minutes integer;

update spaces set min_minutes = min_hours * 60
where min_minutes is null;

-- ② 예약 — 이용 길이(분). 금액의 근거라 행에 박아 둔다(옛 hours_count와 같은 이유).
--   옛 행은 시작·끝 시각의 차이로 채운다. 시각이 없는 아주 옛 행은 옛 시간 수 × 60.
alter table space_bookings
  add column if not exists minutes_count integer not null default 0;

update space_bookings
set minutes_count = (extract(epoch from (end_time - start_time)) / 60)::int
where minutes_count = 0 and start_time is not null and end_time is not null and end_time > start_time;

update space_bookings
set minutes_count = hours_count * 60
where minutes_count = 0 and hours_count > 0;

-- 확인용(돌린 뒤 한 번 보면 된다):
--   select count(*) filter (where min_minutes is null) as spaces_unfilled from spaces;
--   select count(*) filter (where minutes_count = 0) as bookings_unfilled from space_bookings;
