-- collab5 스키마 (2026-07-05 재설계)
-- ⚠️ 재생성 스크립트: makers/collab_cards/view_events/reactions 를 DROP 후 재생성한다.
--    → 기존 테스트 데이터는 초기화된다. profiles(회원계정)·auth 는 유지.
-- ID = 정수 시퀀스(1,2,3…). 회원 ID(user_id·owner_user_id)는 Supabase Auth 소속이라 UUID 유지.
-- 시각 = created_at/updated_at 통일(timestamptz, DB가 자동). updated_at은 트리거로 수정 시 자동 갱신.
-- Supabase 대시보드 > SQL Editor 에서 전체 실행.

-- ── updated_at 자동 갱신 트리거 함수 ──
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 기존 테이블 제거 (자식→부모 순) ──
drop table if exists reactions   cascade;
drop table if exists view_events cascade;
drop table if exists collab_cards cascade;
drop table if exists makers       cascade;
drop table if exists profiles     cascade;  -- 정수 user_id 도입 위해 재생성(회원 프로필 초기화, auth 계정은 유지)

-- ── 업체 프로필 ──
create table makers (
  id               bigint generated always as identity primary key,
  slug             text unique not null,
  name             text    not null,
  one_liner        text    not null,
  cover_image_url  text,
  logo_url         text,
  region           text,
  size             text,
  offers           text[]  not null default '{}',
  seeks            text[]  not null default '{}',
  target_audience  text[]  not null default '{}',
  collab_history   jsonb   not null default '[]',
  photos           jsonb   not null default '[]',
  story            text    not null default '',
  activities       jsonb   not null default '[]',
  offers_note      text    not null default '',
  seeks_note       text    not null default '',
  soul             jsonb   not null default '{}',
  trust            jsonb   not null default '{}',
  collab_open      boolean not null default true,
  owner_uuid       uuid,               -- 소유 계정 = auth.users(id) UUID(세션 매칭용). profiles.uuid 와 조인.
  claim_token_hash text,               -- 수정 비밀번호 해시(비회원 소유권)
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index idx_makers_slug  on makers(slug);
create index idx_makers_owner on makers(owner_uuid);
drop trigger if exists trg_makers_updated on makers;
create trigger trg_makers_updated before update on makers
  for each row execute function set_updated_at();
alter table makers enable row level security;  -- 정책 없음 = anon 잠금(서버 service_role만)

-- ── 콜라보 카드 ──
create table collab_cards (
  id            bigint generated always as identity primary key,
  slug          text unique not null,
  from_maker_id bigint references makers(id) on delete cascade,
  proposal      jsonb not null,
  created_at    timestamptz not null default now()
);
create index idx_cards_slug  on collab_cards(slug);
create index idx_cards_maker on collab_cards(from_maker_id);
alter table collab_cards enable row level security;

-- ── 카드 view 이벤트 (append-only → created_at만) ──
create table view_events (
  id         bigint generated always as identity primary key,
  card_id    bigint not null references collab_cards(id) on delete cascade,
  ref        text,
  created_at timestamptz not null default now()
);
create index idx_views_card on view_events(card_id);
alter table view_events enable row level security;

-- ── RSVP 반응 (append-only → created_at만) ──
create table reactions (
  id         bigint generated always as identity primary key,
  card_id    bigint not null references collab_cards(id) on delete cascade,
  type       text not null,
  created_at timestamptz not null default now()
);
create index idx_reactions_card on reactions(card_id);
alter table reactions enable row level security;

-- ── 계정 프로필 ──
-- user_id = 정수 시퀀스(1,2,3, 친화적 PK). uuid = auth.users(id) 링크(로그인 계정 매칭).
create table profiles (
  user_id       bigint generated always as identity primary key,
  uuid          uuid not null unique references auth.users(id) on delete cascade,
  brand_name    text not null,
  phone         text not null default '',
  email         text not null default '',   -- 가입 중복검사용(대소문자 무시 조회). auth.users는 직접 SELECT 불가라 여기 보관.
  profile_image text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_profiles_uuid on profiles(uuid);
create index idx_profiles_email on profiles(lower(email));
create index idx_profiles_phone on profiles(phone);
create index idx_profiles_brand on profiles(brand_name);
drop trigger if exists trg_profiles_updated on profiles;
create trigger trg_profiles_updated before update on profiles
  for each row execute function set_updated_at();
alter table profiles enable row level security;
