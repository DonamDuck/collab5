-- 브리프 테이블 신설 (2026-09-14)
-- 설계 = `docs/superpowers/specs/2026-09-14-brief-page-design.md`
--
-- 🚨 실행 방법: Supabase 대시보드 > SQL Editor 에 **이 파일만** 붙여넣어 실행한다.
--    ⛔`supabase/schema.sql` 전체를 돌리면 안 된다 — 그건 DROP을 포함한 재생성 스크립트다.
--
-- ✅ 이 파일은 **추가만** 한다(create). 기존 테이블은 하나도 건드리지 않는다.
-- ✅ 여러 번 실행해도 안전하다(if not exists).
--
-- ⚠️ 스키마 **확장**은 「DB 먼저 → 배포 나중」이 맞는 순서다(축소는 반대).
--    🔗[[schema-rename-checklist]] — 축소는 화면이 깨져 즉시 들키지만 확장은 조용히 샌다.
--    단 이번 건은 코드가 「테이블 없으면 코드 안 목록으로 떨어지게」 되어 있어
--    순서가 뒤바뀌어도 화면이 죽지 않는다.

create table if not exists brand_briefs (
  id            bigint generated always as identity primary key,

  -- 어느 소개서의 브리프인가. 🔑**주소도 이 브랜드의 slug를 그대로 쓴다** — `/brief/{slug}` ↔ `/m/{slug}`.
  --   ⭐짐작 못 할 문자열이라 소개서와 «같은 수준»의 노출이 된다. 새 규칙을 만들지 않는다.
  brand_id      bigint not null references brands(id) on delete cascade,

  -- 🔑**누가 볼 수 있는가.** 대표 확정(09-14) = 「브리프 주인만」.
  --   ⚠️`brands.owner_user_id`와 **따로 둔다.** 소개서는 「전달 대기」로 owner를 비워 두는 기간이 있고
  --     (런북 §전달 대기), 그 사이에도 브리프는 특정인에게 붙어 있어야 한다.
  --   ⚠️**소개서를 이관해도 이 값은 자동으로 안 따라간다.** 대표가 손으로 맞춘다(대표 확정 09-14).
  --     👉런북의 이관 체크리스트에 이 칸을 추가해야 한다. 🔗[[ownership-transfer-ripples]]
  --   null = 아직 연결 전 = **아무도 못 본다**(대표만). 비번 같은 우회 수단을 두지 않는다.
  owner_user_id bigint references users(user_id) on delete set null,

  -- 본문을 **마크다운 원문 그대로** 담는다.
  -- ⭐매거진은 Tiptap JSON으로 저장하는데 여기선 «마크다운»이다. 이유는 작업 방식이 달라서다 —
  --   매거진은 사이트 «안»에 편집기가 있고, 브리프는 **노션에서 쓰고 복사해 온다**(대표 확정 09-14).
  --   JSON으로 저장하면 노션 → JSON → 화면으로 변환이 둘이 되고, 「노션이 정본」이라는 규칙이 흐려진다.
  -- ⚠️HTML로는 저장하지 않는다 — 매거진이 정한 규율은 여기서도 지킨다.
  markdown      text not null default '',

  -- 대표가 퇴고하는 곳은 여전히 노션이다. 사이트는 «발행본»이고 노션이 정본이다.
  -- 링크를 같이 들고 있어야 「다시 받아오기」를 할 때 어디서 받는지 안 잃는다.
  notion_url    text not null default '',

  status        text not null default 'draft'
                check (status in ('draft', 'published')),
  published_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 🔒**한 소개서에 브리프는 하나다.** 둘이 되면 `/brief/{slug}`가 어느 것인지 못 고른다.
--   ⭐주소가 brand의 slug라서 이건 「좋으면 좋은 것」이 아니라 **구조상 필수**다.
create unique index if not exists idx_brand_briefs_brand on brand_briefs(brand_id);

-- `/my`의 「요약 보고서」 절 = "내 것 중 발행된 것만 최신순" 한 가지 패턴뿐이다.
create index if not exists idx_brand_briefs_owner
  on brand_briefs(owner_user_id, status, published_at desc);

alter table brand_briefs enable row level security;
-- ⚠️정책은 두지 않는다. 서버(service_role)만 이 표를 만지고 클라이언트는 서버를 통해서만 온다 —
--   `magazine_articles`·`saved_brands`와 같은 방식이다.
--   🚨**그래서 「주인만」 판정은 서버 코드가 한다.** RLS에 기대지 않는다.
--     매거진이 같은 자리에서 구멍을 냈다(`magazine-auth.ts`):
--     *「클라이언트의 버튼 숨김은 UX일 뿐 보안이 아니다」*.
