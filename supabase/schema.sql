-- collab5 MVP 스키마
-- Supabase 대시보드 > SQL Editor에서 전체 실행
-- RLS는 MVP 단계에서 비활성 (인증 추가 시 활성화 예정)

-- ── 업체 프로필 ──
CREATE TABLE IF NOT EXISTS makers (
  id              TEXT PRIMARY KEY,
  slug            TEXT UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  one_liner       TEXT NOT NULL,
  cover_image_url TEXT,
  logo_url        TEXT,
  region          TEXT,
  size            TEXT,
  offers          TEXT[]  NOT NULL DEFAULT '{}',
  seeks           TEXT[]  NOT NULL DEFAULT '{}',
  target_audience TEXT[]  NOT NULL DEFAULT '{}',
  collab_history  JSONB   NOT NULL DEFAULT '[]',
  photos          JSONB   NOT NULL DEFAULT '[]',
  story           TEXT    NOT NULL DEFAULT '',
  activities      JSONB   NOT NULL DEFAULT '[]',
  offers_note     TEXT    NOT NULL DEFAULT '',
  seeks_note      TEXT    NOT NULL DEFAULT '',
  soul            JSONB   NOT NULL DEFAULT '{}',
  trust           JSONB   NOT NULL DEFAULT '{}',
  collab_open     BOOLEAN NOT NULL DEFAULT true,
  created_at      TEXT    NOT NULL
);

-- 기존 배포 DB 업그레이드용 (이미 makers 테이블이 있으면 컬럼만 추가)
ALTER TABLE makers ADD COLUMN IF NOT EXISTS collab_history JSONB NOT NULL DEFAULT '[]';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS photos JSONB NOT NULL DEFAULT '[]';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS story       TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS activities  JSONB NOT NULL DEFAULT '[]';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS offers_note TEXT  NOT NULL DEFAULT '';
ALTER TABLE makers ADD COLUMN IF NOT EXISTS seeks_note  TEXT  NOT NULL DEFAULT '';

-- ── 콜라보 카드 ──
CREATE TABLE IF NOT EXISTS collab_cards (
  id             TEXT PRIMARY KEY,
  slug           TEXT UNIQUE NOT NULL,
  from_maker_id  TEXT REFERENCES makers(id) ON DELETE CASCADE,
  proposal       JSONB NOT NULL,
  created_at     TEXT  NOT NULL
);

-- ── North Star: 카드 view 이벤트 ──
CREATE TABLE IF NOT EXISTS view_events (
  id       TEXT PRIMARY KEY,
  card_id  TEXT NOT NULL,
  at       TEXT NOT NULL,
  ref      TEXT
);

-- ── RSVP 반응 ──
CREATE TABLE IF NOT EXISTS reactions (
  id       TEXT PRIMARY KEY,
  card_id  TEXT NOT NULL,
  type     TEXT NOT NULL,
  at       TEXT NOT NULL
);

-- ── 인덱스 ──
CREATE INDEX IF NOT EXISTS idx_makers_slug        ON makers(slug);
CREATE INDEX IF NOT EXISTS idx_cards_slug         ON collab_cards(slug);
CREATE INDEX IF NOT EXISTS idx_cards_maker        ON collab_cards(from_maker_id);
CREATE INDEX IF NOT EXISTS idx_views_card         ON view_events(card_id);
CREATE INDEX IF NOT EXISTS idx_reactions_card     ON reactions(card_id);

-- ── 2026-07-05 인증·소유권 ──────────────────────────────
-- 소개서 소유권(플랜 B에서 사용): 소유 계정 + 익명 생성 관리 키(해시)
ALTER TABLE makers ADD COLUMN IF NOT EXISTS owner_user_id UUID;
ALTER TABLE makers ADD COLUMN IF NOT EXISTS claim_token_hash TEXT;
CREATE INDEX IF NOT EXISTS idx_makers_owner ON makers(owner_user_id);

-- 계정 프로필 (가입 시 생성) — 브랜드명·휴대폰·로고(리사이즈 base64, Storage 이전 전 MVP)
CREATE TABLE IF NOT EXISTS profiles (
  user_id       UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  brand_name    TEXT NOT NULL,
  phone         TEXT NOT NULL DEFAULT '',
  profile_image TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; -- 정책 없음 = anon 잠금(서버 service_role만)
