-- 매거진 「잘 읽었어요 ❤️」 하트 — 글 1개 × 사람 1개(중복 없음, 취소 가능).
-- 대표가 Supabase SQL Editor에서 직접 실행한다.
--
-- ⭐구조를 `saved_brands`(찜)와 **똑같이** 잡았다 — 뜻이 같은 것은 같은 모양이어야
--   다음 사람이 하나만 배우면 된다. 복합 PK라 중복 하트가 구조적으로 불가능하고,
--   취소는 그냥 delete다(상태 컬럼을 두면 "0인데 행이 있는" 상태가 생긴다).
--
-- ⚠️`on delete cascade` 둘 다 필수 — 회원이 탈퇴하거나 글이 지워지면 하트도 같이 사라져야
--   집계가 유령을 세지 않는다.
create table if not exists magazine_likes (
  user_id    bigint not null references users(user_id)            on delete cascade,
  article_id bigint not null references magazine_articles(id)     on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- 글별 하트 수를 세는 게 가장 잦은 조회다(글 화면을 열 때마다).
create index if not exists idx_magazine_likes_article on magazine_likes(article_id);
-- 내가 누른 글 목록(나중에 /my에서 쓸 수 있게) — 찜 인덱스와 같은 모양.
create index if not exists idx_magazine_likes_user on magazine_likes(user_id, created_at desc);

alter table magazine_likes enable row level security;
-- ⚠️정책은 두지 않는다. 서버(service_role)만 이 표를 만지고, 클라이언트는 서버 액션을
--   통해서만 접근한다 — `saved_brands`와 같은 방식이다.
