-- 소개서 «비공개 초안» 상태 (2026-10-08, 자동 만들기 2단계)
-- 설계 = `src/lib/autoDraft.ts` 머리말 · 볼트 [[소개서-자동-만들기]]
--
-- 대표 10-08: 고객 약속을 「비공개 상태의 소개서 초안을 메일로 먼저 안내 드리고, 확인해 주신 후 직접 공개 처리하실 수
--   있어요」로 바꿨다. 운영에서 이 약속을 지키려고 소개서에 세 번째 상태 'draft'를 둔다.
--   · draft = 주인(owner_user_id)만 `/m/{slug}`로 볼 수 있고, 검색·홈·사이트맵·다른 사람에겐 없는 것과 같다.
--     ⭐기존 읽기 코드가 전부 `status='active'`로 거르고 있어서, 새 상태는 «기본이 숨김»이다(빠뜨린 곳이 있어도 새지 않는다).
--   · 주인이 「게시하기」를 누르면 draft → active.
--   · draft_notes = 항목마다 «collab5가 여쭤봐요» 질문. 게시하면 비운다.
--
-- 🚨 실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다(제약 변경이라 scripts/db/sql 로는 안 돈다).
-- ✅ 기존 행은 하나도 안 바뀐다(active·inactive 그대로). 여러 번 실행해도 안전하다.
-- ⚠️ 확장이라 「DB 먼저 → 배포 나중」.

alter table brands drop constraint if exists makers_status_check;
alter table brands add constraint makers_status_check
  check (status = any (array['active'::text, 'inactive'::text, 'draft'::text]));

alter table brands add column if not exists draft_notes jsonb;

notify pgrst, 'reload schema';
