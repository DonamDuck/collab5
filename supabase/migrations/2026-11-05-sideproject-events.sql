-- 딴짓(사이드 프로젝트) 페이지 열림 · 내려받기 기록 표 신설 (2026-11-05)
-- 설계 = `src/lib/sideprojectEvents.ts` 머리말
--
-- 대표 11-04: 「딴짓에서 다운로드한 횟수, 딴짓 페이지 조회 수 측정」. GA4는 광고 차단·파일 이름 누락으로 숫자가 비어서
--   우리 서버가 직접 한 줄씩 적는다. 페이지 열림은 비컨(/api/sideproject/event), 내려받기는 중간 주소(/sideproject/dl/...)가 적는다.
--   앱이 스스로 하는 업데이트(version.json을 읽고 zip을 바로 받는 길)는 적지 않는다.
--
-- 🚨 실행 방법: `scripts/db/sql -f supabase/migrations/2026-11-05-sideproject-events.sql --go` (대표 「고고」 뒤)
--    또는 Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
--
-- ✅ 추가만 한다(create). 기존 테이블은 하나도 건드리지 않는다. 여러 번 실행해도 안전하다(if not exists).
-- ⚠️ 스키마 확장 = 「DB 먼저 → 배포 나중」. 표가 없으면 기록만 조용히 빠지고 페이지·내려받기는 그대로 된다.

create table if not exists sideproject_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  kind        text not null check (kind in ('view', 'download')),
  -- monitoralign | limitglance | hanmadi | list(딴짓 목록 페이지)
  project     text not null,
  -- 열린 페이지 주소, 또는 받은 파일 이름
  path        text not null default '',
  -- 내려받기일 때 mac | windows
  os          text not null default '',
  version     text not null default '',
  -- Vercel이 붙여 주는 나라 두 글자(KR, JP …)
  country     text not null default '',
  -- 타고 온 사이트 이름만(google.com). 직접 들어오면 빈칸
  referrer    text not null default '',
  -- 같은 날 같은 사람을 가리는 익명 번호(IP+브라우저+날짜를 섞은 값). IP는 저장하지 않는다
  visitor     text not null default '',
  -- 대표 본인 기기(?me=1 로 표시한 브라우저)
  mine        boolean not null default false
);
create index if not exists idx_sideproject_events_created on sideproject_events(created_at desc);
create index if not exists idx_sideproject_events_project on sideproject_events(project, kind);
-- 정책 없이 RLS만 켠다 = 바깥(anon)은 읽기·쓰기 불가, 서버(service_role)만 쓴다
alter table sideproject_events enable row level security;
