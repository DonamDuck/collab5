-- collab5 스키마 (2026-07-25 대공사 반영 — maker→brand 개명 · uuid→정수 user_id 전환)
--
-- 🚨 재생성 스크립트다. 전체 실행하면 아래 테이블이 DROP 후 재생성되어 **데이터가 전부 사라진다.**
--    운영 DB에 함부로 돌리지 말 것. 신규 환경 구축·로컬 재현용.
--    운영 중 스키마 변경은 개별 `alter table`로 하고, 이 파일도 함께 갱신할 것.
--
-- 규칙
--  · id = 정수 시퀀스(1,2,3…). 회원 참조도 정수 `users.user_id` 기준(auth uuid는 users.uuid 링크로만 보관).
--  · 시각 = created_at/updated_at(timestamptz). updated_at은 트리거로 자동 갱신.
--  · RLS 활성 + 정책 없음 = anon 전면 잠금. 서버가 service_role 키로만 접근.
--  · 앱 매핑 = lib/repo.ts(snake_case ↔ camelCase), 도메인 타입 = lib/types.ts
--  · 문서 = Obsidian [[DB-스키마]] · 개명 대조표는 같은 노트 §2026-07-25 대공사
--
-- Supabase 대시보드 > SQL Editor 에서 전체 실행.

-- ── updated_at 자동 갱신 트리거 함수 ──
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ── 기존 테이블 제거 (자식 → 부모 순) ──
drop table if exists reactions        cascade;
drop table if exists card_view_events cascade;
drop table if exists collab_requests  cascade;
drop table if exists saved_brands     cascade;
drop table if exists collab_cards     cascade;
drop table if exists brands           cascade;
drop table if exists users            cascade;

-- ── 계정 (구 profiles) ──
-- user_id = 정수 시퀀스(친화적 PK, 소유권·찜·제안이 전부 이 값을 참조).
-- uuid    = auth.users(id) 링크 — 로그인 세션 매칭 전용.
-- ⚠️ public.users 이지 auth.users 가 아니다(별개 테이블).
create table users (
  user_id       bigint generated always as identity primary key,
  uuid          uuid not null unique references auth.users(id) on delete cascade,
  brand_name    text not null,
  phone         text not null default '',
  email         text not null default '',   -- 가입 중복검사용(대소문자 무시 조회). auth.users는 직접 SELECT 불가라 여기 보관.
  profile_image text not null default '',   -- ⏭ Storage 이전 예정(현재 리사이즈 base64)
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index idx_users_uuid  on users(uuid);
create index idx_users_email on users(lower(email));
create index idx_users_phone on users(phone);
create index idx_users_brand on users(brand_name);
drop trigger if exists trg_users_updated on users;
create trigger trg_users_updated before update on users
  for each row execute function set_updated_at();
alter table users enable row level security;

-- ── 브랜드 소개서 (구 makers) ──
-- 공개 상세페이지(/m/[slug]) + 검색 대상. 사진·이력·활동·쇼케이스·enrichment는 jsonb 통째 저장(MVP).
create table brands (
  id                 bigint generated always as identity primary key,
  slug               text unique not null,        -- 공개 URL. 한글명은 랜덤핸들 m-xxxxxx 폴백
  name               text    not null,            -- 상호(브랜드명)
  one_liner          text    not null,            -- 한두 문장 소개
  description        text,                        -- 자세히 소개 "우리는 이런 브랜드에요" (07-25 trust.description에서 분리)
  region             text,                        -- 주소에서 deriveRegion() 자동 추출
  offers             text[]  not null default '{}',  -- 가능한 콜라보 유형(CollabType 7종)
  seeks              text[]  not null default '{}',  -- 구 희망 유형(07-22 칩 통합으로 사실상 미사용, 읽기 합집합 호환)
  target_audience    text[]  not null default '{}',
  keywords           text[]  not null default '{}',  -- 브랜드 표현 키워드 칩 (구 soul.values)
  collab_history     jsonb   not null default '[]',
  activities         jsonb   not null default '[]',
  photos             jsonb   not null default '[]',  -- Storage public URL 배열(07-11 이전 생성분은 base64 잔존)
  showcases          jsonb   not null default '[]',  -- 선택 블록 6종: metrics·reviews·team·press·space·custom (구 blocks)
  story              text    not null default '',    -- 왜 시작했나
  offers_description text    not null default '',    -- 제공 협업 서술 (구 offers_note)
  seeks_description  text    not null default '',    -- 찾는 파트너 서술 (구 seeks_note)
  trust              jsonb   not null default '{}',  -- 채널·위치 {instagram?, homepage?, address?, mapUrl?} — description은 위 컬럼으로 분리됨
  enrichment         jsonb,                          -- AI 크롤 스냅샷(고객이 선택한 칩만). 생성 시 기록·수정 시 보존
  intro_file_url     text,                           -- 소개자료 PDF URL
  collab_open        boolean not null default true,  -- 콜라보 열림/닫힘
  search_visible     boolean not null default true,  -- 검색 노출 on/off
  status             text    not null default 'active' check (status in ('active','inactive')),
                                                     -- 소프트 삭제: /my 삭제 = inactive(행 보관). 전 조회 함수가 active만 필터
  owner_user_id      bigint references users(user_id) on delete set null,  -- 소유 계정(구 owner_uuid)
  edit_password_hash text,                           -- 비회원 생성 시 수정 비밀번호 해시(구 claim_token_hash)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index idx_brands_slug  on brands(slug);
create index idx_brands_owner on brands(owner_user_id);
drop trigger if exists trg_brands_updated on brands;
create trigger trg_brands_updated before update on brands
  for each row execute function set_updated_at();
alter table brands enable row level security;

-- ── 콜라보 카드 (청첩장형 제안, /c 라우트 — 소개서와 별개 제품) ──
create table collab_cards (
  id            bigint generated always as identity primary key,
  slug          text unique not null,          -- 공유 링크 {fromSlug}-xxxxx
  from_brand_id bigint not null references brands(id) on delete cascade,  -- 구 from_maker_id
  proposal      jsonb not null,                -- {toName, why, picture, expectedEffect}
  created_at    timestamptz not null default now()
);
create index idx_cards_slug  on collab_cards(slug);
create index idx_cards_brand on collab_cards(from_brand_id);
alter table collab_cards enable row level security;

-- ── 카드 view 이벤트 (append-only, 구 view_events) ──
create table card_view_events (
  id         bigint generated always as identity primary key,
  card_id    bigint not null references collab_cards(id) on delete cascade,
  ref        text,                              -- 유입 출처 라벨
  created_at timestamptz not null default now()
);
create index idx_card_views_card on card_view_events(card_id);
alter table card_view_events enable row level security;

-- ── RSVP 반응 (append-only, 보조지표) ──
create table reactions (
  id         bigint generated always as identity primary key,
  card_id    bigint not null references collab_cards(id) on delete cascade,
  type       text not null,                     -- "관심" | "패스"
  created_at timestamptz not null default now()
);
create index idx_reactions_card on reactions(card_id);
alter table reactions enable row level security;

-- ── 찜(저장, 구 saved_makers) ──
-- 로그인 유저가 관심 브랜드를 저장. 복합 PK로 중복 방지.
-- 방향성 시그널(누가 누굴 찜했나) → 컨시어지 매칭·북극성 연료.
create table saved_brands (
  user_id    bigint not null references users(user_id) on delete cascade,   -- 구 user_uuid
  brand_id   bigint not null references brands(id)     on delete cascade,   -- 구 maker_id
  created_at timestamptz not null default now(),
  primary key (user_id, brand_id)
);
create index idx_saved_brands_user on saved_brands(user_id, created_at desc);
alter table saved_brands enable row level security;

-- ── 콜라보 제안 인텐트 (append-only) ──
-- "콜라보 시작하기" 클릭 계측. P3(연락) 선행지표 = 북극성 퍼널 첫 계측 지점.
create table collab_requests (
  id            bigint generated always as identity primary key,
  from_user_id  bigint references users(user_id) on delete set null,          -- 구 from_user_uuid (비로그인 null)
  from_brand_id bigint references brands(id) on delete set null,              -- 어떤 소개서로 제안했나(제안자 여럿일 때 선택값, nullable)
  to_brand_id   bigint not null references brands(id) on delete cascade,      -- 구 to_maker_id
  channel       text not null,                   -- "instagram" | "homepage" | "email"
  created_at    timestamptz not null default now()
);
create index idx_collab_requests_brand on collab_requests(to_brand_id, created_at desc);
create index idx_collab_requests_from_brand on collab_requests(from_brand_id);
alter table collab_requests enable row level security;

-- ── 삭제 전파(CASCADE) 체인 ──
--   auth.users ──CASCADE──▶ users ──CASCADE──▶ saved_brands
--                                 └─SET NULL─▶ brands.owner_user_id / collab_requests.from_user_id
--   brands ──CASCADE──▶ collab_cards ──CASCADE──▶ card_view_events / reactions
--          └─CASCADE──▶ saved_brands / collab_requests
-- ⚠️ /my 삭제는 하드 DELETE가 아니라 status='inactive' 소프트 삭제라 CASCADE가 발동하지 않는다.
