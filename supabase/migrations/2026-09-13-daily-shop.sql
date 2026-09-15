-- 하루 가게 — 공간 대여 테이블 둘 신설 (2026-09-13)
-- 스펙 = docs/superpowers/specs/2026-09-13-daily-shop-design.md
--
-- 🚨 실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
--    ⛔`supabase/schema.sql` 전체를 돌리면 안 된다 — DROP을 포함한 재생성 스크립트다.
--
-- ✅ 추가만 한다. 기존 테이블(users·brands)은 하나도 안 건드린다.
-- ✅ 여러 번 실행해도 안전하다(if not exists).
--
-- ⭐ 설계에서 온 제약 둘
--   ① 소개서와 «독립»이다 — 소개서 없는 사람도 공간을 올린다. `brand_slug`는 선택이고 FK가 아니다.
--      소개서가 지워지거나 개명돼도 거래 기록은 남아야 하므로 문자열로 담는다(매거진 `brand_links`와 같은 이유).
--   ② 결제가 «먼저»다 — 신청은 결제가 끝나야 성립한다(대표 09-13, 이탈 방지).
--      `pending`은 결제창으로 보내기 직전의 자리일 뿐이고, 호스트에게는 `paid`부터 보인다.

-- ── 공간 ──
create table if not exists spaces (
  id             bigint generated always as identity primary key,
  slug           text not null unique,                   -- 공개 URL: /rent/{slug}
  owner_user_id  bigint not null references users(user_id) on delete cascade,
  brand_slug     text not null default '',               -- 연결된 소개서. ⚠️FK 아님(위 ① 참조). 빈 문자열 = 연결 안 함

  name           text not null,                          -- "을지로 2층 작업실"
  tagline        text not null default '',               -- 한 줄
  body           text not null default '',               -- 공간 이야기. ⭐우리가 대신 써 주는 자리
  photos         jsonb not null default '[]'::jsonb,     -- [url]

  -- 위치 — 🚨확정 «전»에는 `area`만 보여준다(대표 09-13 이탈 방지). `address`는 서버에서 가린다.
  area           text not null default '',               -- "중구 을지로3가" — 목록·카드에 노출
  address        text not null default '',               -- 전체 주소 — 확정 후에만
  lat            double precision,
  lng            double precision,

  -- 두 갈래 (대표 09-13): 원래 목적대로 빌리기 / 대관(게스트가 용도를 정함)
  use_type       text not null default 'both'
                 check (use_type in ('as_is', 'open', 'both')),
  facilities     jsonb not null default '[]'::jsonb,     -- ["재봉틀","가마","빔프로젝터"] — 'as_is'가 고르는 축
  capacity       integer,                                -- 최대 인원 — 'open'이 고르는 축
  hours          text not null default '',               -- "10:00~22:00"

  rules          text not null,                          -- ⭐「우리 집 규칙」. 빈칸 금지 — 폼에서 막는다
  price_day      integer not null default 0,             -- 하루 값(원)
  mentor_minutes integer not null default 0,             -- 사장님이 알려주는 시간(분). 0이면 안 판다
  mentor_price   integer not null default 0,             -- 그 값(원) — 옵션 상품(대표 09-13)
  open_dates     jsonb not null default '[]'::jsonb,     -- ["2026-10-05"] ⭐실사 결과 이 데이터가 0건이었다

  -- 🚨1단계는 음식·음료를 안 받는다. 남의 영업신고 시설에서 남이 팔면 무신고 영업이다
  --   (식품위생법 제37조 ④ → 제97조). 폼에서 물어보고 true면 등록을 막는다.
  serves_food    boolean not null default false,
  -- 전대차 확인 — 임대인 동의 없는 전대는 계약 해지 사유라 등록 시 본인 확인을 받는다.
  sublease_ok    boolean not null default false,

  status         text not null default 'draft'
                 check (status in ('draft', 'pending', 'open', 'paused')),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- 목록 = "공개된 것만 최신순" + 동네 거르기. 이 두 패턴뿐이라 인덱스 둘이면 충분하다.
create index if not exists idx_spaces_status  on spaces(status, created_at desc);
create index if not exists idx_spaces_owner   on spaces(owner_user_id);
create index if not exists idx_spaces_area    on spaces(area);

drop trigger if exists trg_spaces_updated on spaces;
create trigger trg_spaces_updated before update on spaces
  for each row execute function set_updated_at();

alter table spaces enable row level security;   -- 정책 없음 = anon 전면 잠금. 서버가 service_role로만 닿는다


-- ── 신청·예약 ──
-- ⭐상태 흐름
--     pending ──결제 승인──> paid ──호스트 수락──> confirmed ──그날 지나면──> done
--        │                    └────호스트 거절────> refunded
--        │                    └────게스트 취소────> cancelled
--        └──결제창에서 이탈──> 그대로 남는다(만료 청소는 나중에)
--
-- 🚨**`pending`은 「결제창으로 보내기 직전」의 자리다.** 토스 결제창은 사이트를 떠났다가 돌아오는
--   구조라, 돌아왔을 때 「누가 어느 날짜에 무엇을 하려 했는지」를 되찾을 곳이 필요하다.
--   ⭐**호스트에게는 `paid` 이상만 보인다.** 그래서 대표 09-13의 「미리 연결되면 직거래로 샌다」는
--     그대로 막힌다 — 돈이 들어오기 전엔 사장님이 이 행의 존재조차 모른다.
--   ⚠️환불률은 우리가 정한다. 호스트 자율은 전자상거래법 제35조로 무효가 될 수 있다.
create table if not exists space_bookings (
  id             bigint generated always as identity primary key,
  space_id       bigint not null references spaces(id) on delete cascade,
  guest_user_id  bigint not null references users(user_id) on delete cascade,
  guest_brand_slug text not null default '',             -- 게스트 소개서. ⚠️FK 아님

  use_date       date not null,                          -- 빌리는 날
  hours          text not null default '',               -- "10:00~18:00"
  plan           text not null,                          -- ⭐게스트가 쓴 「그날 무엇을 할 건지」
  headcount      integer,

  with_mentor    boolean not null default false,         -- 사장님 시간을 같이 샀는가
  amount_space   integer not null default 0,             -- 공간 값
  amount_mentor  integer not null default 0,             -- 사장님 시간 값
  amount_total   integer not null default 0,             -- 게스트가 실제로 낸 돈
  fee_rate       numeric(5,4) not null default 0.15,     -- 우리 수수료율. ⚠️행마다 박는다 — 요율이 바뀌어도 옛 거래는 그때 값으로 정산해야 한다
  amount_payout  integer not null default 0,             -- 호스트에게 갈 돈 = total - (total * fee_rate)

  payment_key    text not null default '',               -- 토스 paymentKey
  order_id       text not null unique,                   -- 우리가 만드는 주문번호
  status         text not null default 'pending'
                 check (status in ('pending', 'paid', 'confirmed', 'rejected', 'refunded', 'cancelled', 'done')),
  host_message   text not null default '',               -- 수락·거절 시 호스트가 남기는 한 줄
  decided_at     timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_bookings_space on space_bookings(space_id, use_date);
create index if not exists idx_bookings_guest on space_bookings(guest_user_id, created_at desc);
create index if not exists idx_bookings_status on space_bookings(status, created_at desc);

-- 같은 공간 같은 날짜에 «살아 있는» 예약은 하나뿐. 거절·환불·취소된 건 다시 열려야 하므로 부분 인덱스로 건다.
-- ⭐`pending`은 **일부러 뺐다.** 결제창까지 갔다가 그냥 닫은 사람이 남의 날짜를 막으면 안 된다.
--   그 대신 승인 직후 `paid`로 올릴 때 이 인덱스가 걸려서, 먼저 결제한 사람이 이긴다.
create unique index if not exists uq_bookings_space_date
  on space_bookings(space_id, use_date)
  where status in ('paid', 'confirmed', 'done');

drop trigger if exists trg_bookings_updated on space_bookings;
create trigger trg_bookings_updated before update on space_bookings
  for each row execute function set_updated_at();

alter table space_bookings enable row level security;
