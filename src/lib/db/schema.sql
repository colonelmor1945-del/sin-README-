-- GTA 6 Money Lab - PostgreSQL schema
--
-- Design notes
--  * Money is stored in the smallest unit as BIGINT. Never FLOAT for money.
--  * In-game currency and real currency never share a column.
--  * Every game-data table carries a provenance column. The application is
--    contractually required to render it, so the database enforces the values.
--  * Payment state transitions are append-only in payment_events. The status
--    column on payments is a materialised view of the latest event.
--  * No table stores private keys, seed phrases, or plaintext passwords.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------- enums ----

CREATE TYPE plan_tier          AS ENUM ('free', 'pro', 'elite');
CREATE TYPE subscription_state AS ENUM ('none', 'trialing', 'active', 'past_due', 'canceled');
CREATE TYPE provenance         AS ENUM ('verified', 'community', 'estimated', 'ai_projection');
CREATE TYPE asset_kind         AS ENUM ('business', 'property', 'vehicle', 'service');
CREATE TYPE plan_strategy      AS ENUM ('fastest_money', 'safest', 'max_profit', 'low_investment', 'solo', 'multiplayer');
CREATE TYPE money_plan_state   AS ENUM ('draft', 'active', 'completed', 'abandoned');
CREATE TYPE message_role       AS ENUM ('user', 'assistant', 'system');
CREATE TYPE payment_status     AS ENUM ('pending', 'processing', 'confirmed', 'failed', 'expired', 'refunded');
CREATE TYPE payment_kind       AS ENUM ('subscription', 'credit_pack', 'support_contribution');
CREATE TYPE supporter_level    AS ENUM ('supporter', 'early_supporter', 'founding_supporter');
CREATE TYPE credit_entry_kind  AS ENUM ('grant', 'purchase', 'spend', 'refund', 'admin_adjustment');
CREATE TYPE user_role          AS ENUM ('member', 'editor', 'admin');

-- ---------------------------------------------------------------- users ----

CREATE TABLE users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email               CITEXT UNIQUE NOT NULL,
  username            TEXT UNIQUE NOT NULL CHECK (char_length(username) BETWEEN 3 AND 32),
  -- Authentication is delegated to the auth provider. No password column
  -- exists here on purpose; if you ever add one it stores an Argon2id hash.
  auth_provider       TEXT NOT NULL,
  auth_subject        TEXT NOT NULL,
  role                user_role NOT NULL DEFAULT 'member',
  plan                plan_tier NOT NULL DEFAULT 'free',
  subscription_status subscription_state NOT NULL DEFAULT 'none',
  subscription_ends_at TIMESTAMPTZ,
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (auth_provider, auth_subject)
);

CREATE INDEX users_plan_idx ON users (plan) WHERE deleted_at IS NULL;

CREATE TABLE user_profiles (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  -- In-game dollars. Not real money.
  current_money  BIGINT NOT NULL DEFAULT 0 CHECK (current_money >= 0),
  level          INT    NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 999),
  playing_style  plan_strategy NOT NULL DEFAULT 'fastest_money',
  goal           BIGINT NOT NULL DEFAULT 10000000 CHECK (goal > 0),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------ game data ----

CREATE TABLE assets (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  kind          asset_kind NOT NULL,
  region        TEXT NOT NULL,
  price         BIGINT NOT NULL CHECK (price >= 0),
  daily_net     BIGINT NOT NULL DEFAULT 0,
  upkeep        BIGINT NOT NULL DEFAULT 0,
  unlock_level  INT NOT NULL DEFAULT 1,
  note          TEXT NOT NULL DEFAULT '',
  provenance    provenance NOT NULL,
  source_url    TEXT,
  published     BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Time series behind the economy tracker. One row per observation.
CREATE TABLE asset_prices (
  id          BIGSERIAL PRIMARY KEY,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  price       BIGINT NOT NULL,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  provenance  provenance NOT NULL
);

CREATE INDEX asset_prices_asset_time_idx ON asset_prices (asset_id, observed_at DESC);

CREATE TABLE missions (
  id             TEXT PRIMARY KEY,
  name           TEXT NOT NULL,
  strand         TEXT NOT NULL,
  region         TEXT NOT NULL,
  payout         BIGINT NOT NULL CHECK (payout >= 0),
  duration_min   INT NOT NULL CHECK (duration_min > 0),
  difficulty     INT NOT NULL CHECK (difficulty BETWEEN 1 AND 5),
  crew_required  INT NOT NULL DEFAULT 1 CHECK (crew_required >= 1),
  best_strategy  TEXT NOT NULL DEFAULT '',
  prerequisites  TEXT[] NOT NULL DEFAULT '{}',
  tips           TEXT[] NOT NULL DEFAULT '{}',
  image_url      TEXT,
  provenance     provenance NOT NULL,
  source_url     TEXT,
  published      BOOLEAN NOT NULL DEFAULT true,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX missions_payout_idx ON missions (payout DESC) WHERE published;

CREATE TABLE map_locations (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  kind        TEXT NOT NULL,
  region      TEXT NOT NULL,
  -- Percentages of the rendered map viewport, not real world coordinates.
  x           NUMERIC(5,2) NOT NULL CHECK (x BETWEEN 0 AND 100),
  y           NUMERIC(5,2) NOT NULL CHECK (y BETWEEN 0 AND 100),
  detail      TEXT NOT NULL DEFAULT '',
  value       BIGINT NOT NULL DEFAULT 0,
  provenance  provenance NOT NULL,
  published   BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX map_locations_kind_idx ON map_locations (kind) WHERE published;

CREATE TABLE user_assets (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  asset_id    TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, asset_id)
);

CREATE TABLE user_missions (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  mission_id   TEXT NOT NULL REFERENCES missions(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, mission_id)
);

-- ----------------------------------------------------------- money plans ---

CREATE TABLE money_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal          BIGINT NOT NULL,
  starting_cash BIGINT NOT NULL,
  strategy      plan_strategy NOT NULL,
  summary       TEXT NOT NULL,
  risks         TEXT[] NOT NULL DEFAULT '{}',
  status        money_plan_state NOT NULL DEFAULT 'draft',
  -- Which provider produced it, so output quality can be compared later.
  generated_by  TEXT NOT NULL,
  model_id      TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX money_plans_user_idx ON money_plans (user_id, created_at DESC);

CREATE TABLE money_plan_steps (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id       UUID NOT NULL REFERENCES money_plans(id) ON DELETE CASCADE,
  step_order    INT NOT NULL,
  title         TEXT NOT NULL,
  detail        TEXT NOT NULL,
  kind          TEXT NOT NULL,
  est_minutes   INT NOT NULL,
  est_profit    BIGINT NOT NULL,
  required_cash BIGINT NOT NULL DEFAULT 0,
  completed_at  TIMESTAMPTZ,
  UNIQUE (plan_id, step_order)
);

-- ------------------------------------------------------ ai conversations ---

CREATE TABLE ai_conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_conversations_user_idx ON ai_conversations (user_id, created_at DESC);

CREATE TABLE ai_messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES ai_conversations(id) ON DELETE CASCADE,
  role            message_role NOT NULL,
  content         TEXT NOT NULL,
  -- Cost accounting. Populated from the provider response.
  input_tokens    INT,
  output_tokens   INT,
  cache_read_tokens INT,
  model_id        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ai_messages_conversation_idx ON ai_messages (conversation_id, created_at);

-- Rolling counter behind the free-tier daily quota. Cheap to check.
CREATE TABLE ai_usage_daily (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  usage_day DATE NOT NULL,
  queries   INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_day)
);

-- --------------------------------------------------------------- credits ---

CREATE TABLE lab_credits (
  user_id    UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance    INT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only ledger. lab_credits.balance is the running total and must only
-- ever be updated in the same transaction that inserts here.
CREATE TABLE credit_transactions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount      INT NOT NULL CHECK (amount <> 0),
  kind        credit_entry_kind NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- Set for spend rows so a refund can find the originating call.
  reference   TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX credit_transactions_user_idx ON credit_transactions (user_id, created_at DESC);

-- -------------------------------------------------------------- payments ---

CREATE TABLE payments (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES users(id) ON DELETE SET NULL,
  provider       TEXT NOT NULL,
  kind           payment_kind NOT NULL,
  -- Real money, in the smallest unit of the currency. 499 = 4.99 EUR.
  amount_minor   BIGINT NOT NULL CHECK (amount_minor > 0),
  currency       CHAR(3) NOT NULL,
  status         payment_status NOT NULL DEFAULT 'pending',
  -- Provider-side identifier. Unique per provider so webhooks are idempotent.
  provider_ref   TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_ref),
  UNIQUE (idempotency_key)
);

CREATE INDEX payments_user_idx ON payments (user_id, created_at DESC);
CREATE INDEX payments_status_idx ON payments (status) WHERE status IN ('pending', 'processing');

CREATE TABLE crypto_payments (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id            UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  asset                 TEXT NOT NULL,            -- BTC, USDC
  network               TEXT NOT NULL,            -- bitcoin, lightning, base
  -- Receiving address or invoice. Public data. Private keys never touch this
  -- database and are held by the payment processor.
  destination           TEXT NOT NULL,
  transaction_reference TEXT,
  confirmations         INT NOT NULL DEFAULT 0,
  required_confirmations INT NOT NULL DEFAULT 1,
  expires_at            TIMESTAMPTZ,
  UNIQUE (payment_id)
);

-- Append-only audit trail. Every webhook and every manual action lands here.
CREATE TABLE payment_events (
  id          BIGSERIAL PRIMARY KEY,
  payment_id  UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  from_status payment_status,
  to_status   payment_status NOT NULL,
  source      TEXT NOT NULL,          -- webhook, admin, reconciliation job
  -- Raw provider payload, retained for dispute handling.
  payload     JSONB NOT NULL DEFAULT '{}'::jsonb,
  signature_verified BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX payment_events_payment_idx ON payment_events (payment_id, created_at);

CREATE TABLE support_contributions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id) ON DELETE SET NULL,
  payment_id      UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  amount_minor    BIGINT NOT NULL,
  currency        CHAR(3) NOT NULL,
  supporter_level supporter_level NOT NULL,
  -- The contributor decides whether their badge is visible. Default private.
  is_public       BOOLEAN NOT NULL DEFAULT false,
  display_name    TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- audit ----

CREATE TABLE audit_log (
  id         BIGSERIAL PRIMARY KEY,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  action     TEXT NOT NULL,
  subject    TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}'::jsonb,
  ip_hash    TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX audit_log_actor_idx ON audit_log (actor_id, created_at DESC);
CREATE INDEX audit_log_action_idx ON audit_log (action, created_at DESC);

-- ------------------------------------------------------------ intel feed ---

CREATE TYPE news_category AS ENUM ('official', 'patch', 'economy', 'rumour', 'community');

CREATE TABLE news_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title        TEXT NOT NULL,
  summary      TEXT NOT NULL,
  -- The editorial rule: an entry only runs if it changes a number somewhere
  -- in the platform, or is a widely circulated claim we checked and rejected.
  impact       TEXT NOT NULL,
  category     news_category NOT NULL,
  source       TEXT NOT NULL,
  source_url   TEXT,
  provenance   provenance NOT NULL,
  published_at DATE NOT NULL DEFAULT CURRENT_DATE,
  author_id    UUID REFERENCES users(id) ON DELETE SET NULL,
  published    BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX news_items_feed_idx ON news_items (published_at DESC) WHERE published;
CREATE INDEX news_items_category_idx ON news_items (category, published_at DESC) WHERE published;

-- Cross-links an entry to the records it changes, so the economy tracker and
-- mission pages can surface "why did this number move".
CREATE TABLE news_item_affects (
  news_id     UUID NOT NULL REFERENCES news_items(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('asset', 'mission', 'map_location')),
  entity_id   TEXT NOT NULL,
  PRIMARY KEY (news_id, entity_type, entity_id)
);
