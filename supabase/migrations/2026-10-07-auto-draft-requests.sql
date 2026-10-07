-- 소개서 자동 만들기 «신청함» 테이블 신설 (2026-10-07)
-- 설계 = `src/lib/autoDraft.ts` 머리말 · 볼트 [[소개서-자동-만들기]]
--
-- 대표 10-07: 「신청까지 운영에 열기」. 운영(Vercel)엔 대표 컴퓨터의 대기열 폴더가 없으니
--   운영 사이트는 신청을 이 표에 쌓고, 대표 컴퓨터의 밤 작업이 이 표를 «읽어서» 로컬 대기열로 가져간다.
--   ⛔밤 작업은 이 표에 쓰지 않는다(예약 작업은 운영 DB에 쓰지 않는다 — 10-05 규칙). 그래서 상태 칸이 없다.
--     진행 상황은 로컬 대기열 파일이 들고 있고, 이 표는 «받은 신청함» 한 가지 역할만 한다.
--
-- 🚨 실행 방법: `scripts/db/sql -f supabase/migrations/2026-10-07-auto-draft-requests.sql --go` (대표 「고고」 뒤)
--    또는 Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
--
-- ✅ 추가만 한다(create). 기존 테이블은 하나도 건드리지 않는다. 여러 번 실행해도 안전하다(if not exists).
-- ⚠️ 스키마 확장 = 「DB 먼저 → 배포 나중」. 표가 없으면 운영 신청이 «받지 못했어요»로 실패한다(조용히 사라지지 않는다).

create table if not exists auto_draft_requests (
  -- 로컬 대기열 파일 이름과 같은 값(예: 20261007172232-fd93). 밤 작업이 이 id로 «이미 가져왔나»를 가른다.
  id            text primary key,
  created_at    timestamptz not null default now(),

  brand_name    text not null,
  region        text not null default '',
  business_type text not null default '',
  -- [{ kind: "instagram" | "blog" | ..., url }] — 서버가 다시 판별한 정규화 주소
  channels      jsonb not null default '[]'::jsonb,
  -- 초안이 완성되면 안내받을 이메일(계정 이메일과 다를 수 있다)
  email         text not null,
  note          text not null default '',
  -- 동의 문구 원문과 시각 — 무엇에 동의했는지가 남아야 나중에 다툼이 없다
  consent       jsonb not null,

  -- 요청한 계정 — 완성된 소개서를 이 계정에 연결한다
  auth_id       uuid,
  user_id       bigint references users(user_id) on delete set null,
  -- 그 계정의 로그인 이메일(안내 이메일과 다를 수 있다) — 완성본을 어느 계정에 연결할지 대표가 바로 알아보게
  account_email text not null default '',

  -- 접수 메일 결과(신청 직후 사이트가 한 번 적는다)
  receipt_at    timestamptz,
  receipt_error text
);

create index if not exists idx_auto_draft_requests_created on auto_draft_requests(created_at desc);

alter table auto_draft_requests enable row level security;
-- ⚠️정책은 두지 않는다. 서버(service_role)만 이 표를 만진다 — `brand_briefs`·`magazine_articles`와 같은 방식.
