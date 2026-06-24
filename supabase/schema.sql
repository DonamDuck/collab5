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
  soul            JSONB   NOT NULL DEFAULT '{}',
  trust           JSONB   NOT NULL DEFAULT '{}',
  collab_open     BOOLEAN NOT NULL DEFAULT true,
  created_at      TEXT    NOT NULL
);

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
