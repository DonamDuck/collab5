-- 하루 가게 — 사장님 도구 여섯 가지 중 DB가 필요한 셋 (2026-09-17 대표: 「오늘 다 하는 거 목표」)
-- ⭐전부 «추가»만 한다. 기존 행·칸은 안 건드린다. 두 번 돌려도 된다.

-- ① 요일 계속 열기 — [{ "dow": 1, "start": "09:00", "end": "17:00" }, …]
--    이 규칙이 있으면 앞으로 12주 동안 그 요일이 저절로 열린다. 달마다 다시 와서 누르지 않아도 된다.
alter table spaces
  add column if not exists repeat_weekly jsonb not null default '[]'::jsonb;

-- ② 이용 전날 리마인드 — 보낸 시각. 하루 한 번 도는 작업이 같은 예약에 두 번 보내지 않게.
alter table space_bookings
  add column if not exists reminded_at timestamptz;

-- ③ 정산 받을 계좌 — 사장님 한 분에 한 줄.
--    🔒RLS를 켜고 정책을 안 만든다 = 서버(service role)만 읽고 쓴다. 화면엔 뒷자리만 보인다.
--    토스 지급대행 셀러 등록 결과(셀러 id·상태)도 여기 붙는다. 등록 API는 계약 뒤에 붙인다.
create table if not exists host_payout_accounts (
  user_id            bigint primary key references users(user_id) on delete cascade,
  holder_type        text not null check (holder_type in ('individual', 'sole_proprietor', 'corporation')),
  holder_name        text not null,
  business_number    text not null default '',
  bank_code          text not null,
  account_number     text not null,
  toss_seller_id     text not null default '',
  toss_seller_status text not null default '',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table host_payout_accounts enable row level security;
drop trigger if exists trg_host_payout_accounts_updated on host_payout_accounts;
create trigger trg_host_payout_accounts_updated before update on host_payout_accounts
  for each row execute function set_updated_at();
