-- 매거진 아티클 테이블 신설 (2026-08-10)
-- 스펙 = Obsidian [[매거진-기능-개발지시]] §3
--
-- 🚨 실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
--    ⛔`supabase/schema.sql` 전체를 돌리면 안 된다 — 그건 DROP을 포함한 재생성 스크립트라
--      기존 소개서·회원 데이터가 전부 사라진다.
--
-- ✅ 이 파일은 **추가만** 한다(create/alter). 기존 테이블은 하나도 건드리지 않는다.
-- ✅ 여러 번 실행해도 안전하다(if not exists / drop trigger if exists).
--
-- 실행 순서
--   ① 이 파일          ← 테이블 생성
--   ② (선택) 2026-08-10-magazine-seed.sql  ← 렌더 확인용 더미 1건
--
-- ⚠️ 스키마 확장은 **DB 먼저 → 배포 나중**이 맞는 순서다(축소는 반대).
--    코드가 없는 컬럼을 참조하면 PostgREST가 400을 내고 목록이 통째로 빈다.
--    단 이번 건은 코드가 "테이블 없으면 빈 목록"으로 떨어지게 되어 있어 순서가 뒤바뀌어도 화면이 죽진 않는다.

create table if not exists magazine_articles (
  id            bigint generated always as identity primary key,
  slug          text not null unique,                    -- 공개 URL: /magazine/{slug}
  status        text not null default 'draft'
                check (status in ('draft', 'published')), -- 초안은 목록·검색에 안 뜬다
  title         text not null,                           -- 문장형 제목
  subtitle      text not null default '',                -- "캔버스가든 × 두더지요가원 · 요가 토우 워크숍"
  editor_name   text not null default '안톤',
  location      text not null default '',
  cover_image   text not null default '',                -- Storage public URL. 목록 썸네일 + OG 겸용
  summary       text not null default '',                -- 목록 카드 + 메타 디스크립션
  fact_box      jsonb not null default '[]'::jsonb,      -- [{label, value}] — 개수 가변(호마다 다름)
  brand_links   jsonb not null default '[]'::jsonb,      -- [{slug, name, tagline}] — /m/{slug}로 잇는 동선
  body          jsonb not null default '{}'::jsonb,      -- Tiptap JSON document (HTML로 저장하지 않는다)
  published_at  timestamptz,                             -- 발행 시각. draft면 null
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 목록 조회 = "발행된 것만 최신순" 한 가지 패턴뿐이라 복합 인덱스 하나면 충분하다.
create index if not exists idx_magazine_status_pub
  on magazine_articles(status, published_at desc);

-- updated_at 자동 갱신 — 기존 set_updated_at() 함수 재사용(schema.sql 상단에 이미 있다).
drop trigger if exists trg_magazine_updated on magazine_articles;
create trigger trg_magazine_updated before update on magazine_articles
  for each row execute function set_updated_at();

-- RLS 활성 + **정책 없음** = anon 전면 잠금.
-- 이 프로젝트는 서버가 service_role 키로만 DB에 닿는다(schema.sql 상단 규칙).
alter table magazine_articles enable row level security;
