-- Baseline schema for a fresh PostgreSQL database.
-- Later migrations add Salla columns, webhook idempotency, and status history.
-- Statements are idempotent so an existing database can record this migration safely.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS products (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  name_ar         text NOT NULL,
  category        text NOT NULL DEFAULT 'vegetables',
  unit            text NOT NULL DEFAULT 'kg',
  retail_price    numeric(10,2) NOT NULL DEFAULT 0,
  shop_price      numeric(10,2) NOT NULL DEFAULT 0,
  wholesale_price numeric(10,2) NOT NULL DEFAULT 0,
  stock           integer NOT NULL DEFAULT 0,
  image_url       text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  phone        text NOT NULL,
  type         text NOT NULL DEFAULT 'retail',
  location     text,
  total_orders integer NOT NULL DEFAULT 0,
  joined_at    date NOT NULL DEFAULT CURRENT_DATE
);

CREATE UNIQUE INDEX IF NOT EXISTS customers_phone_key ON customers (phone);

CREATE TABLE IF NOT EXISTS orders (
  id              text PRIMARY KEY,
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  customer_name   text NOT NULL,
  customer_type   text NOT NULL DEFAULT 'retail',
  total           numeric(10,2) NOT NULL DEFAULT 0,
  status          text NOT NULL DEFAULT 'pending',
  payment_status  text NOT NULL DEFAULT 'unpaid',
  location        text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);
CREATE INDEX IF NOT EXISTS orders_customer_id_idx ON orders (customer_id);

CREATE TABLE IF NOT EXISTS order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty          numeric(10,2) NOT NULL,
  unit         text NOT NULL DEFAULT 'kg',
  unit_price   numeric(10,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS conversations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name  text NOT NULL,
  phone          text NOT NULL,
  customer_type  text NOT NULL DEFAULT 'retail',
  status         text NOT NULL DEFAULT 'active',
  order_id       text,
  last_activity  text NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          text NOT NULL DEFAULT 'customer',
  text            text NOT NULL,
  time            text NOT NULL,
  type            text
);

CREATE INDEX IF NOT EXISTS messages_conversation_id_idx ON messages (conversation_id);

CREATE TABLE IF NOT EXISTS menu_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text NOT NULL,
  customer_name text NOT NULL,
  phone         text NOT NULL,
  customer_type text NOT NULL DEFAULT 'retail',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS menu_pages_slug_key ON menu_pages (slug);
CREATE INDEX IF NOT EXISTS menu_pages_slug_idx ON menu_pages (slug);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS menu_page_id uuid REFERENCES menu_pages(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS orders_menu_page_id_idx ON orders (menu_page_id);

CREATE TABLE IF NOT EXISTS transactions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id          text REFERENCES orders(id) ON DELETE SET NULL,
  amount            numeric(12,2) NOT NULL DEFAULT 0,
  currency          text NOT NULL DEFAULT 'SAR',
  status            text NOT NULL DEFAULT 'pending',
  payment_method    text,
  provider_id       text,
  provider_response jsonb,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS transactions_order_id_idx ON transactions (order_id);
CREATE INDEX IF NOT EXISTS transactions_status_idx ON transactions (status);

CREATE TABLE IF NOT EXISTS webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL DEFAULT 'system',
  event_type  text NOT NULL DEFAULT 'unknown',
  payload     jsonb NOT NULL DEFAULT '{}',
  processed   boolean NOT NULL DEFAULT false,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS webhook_events_source_idx ON webhook_events (source);
CREATE INDEX IF NOT EXISTS webhook_events_processed_idx ON webhook_events (processed);
CREATE INDEX IF NOT EXISTS webhook_events_created_at_idx ON webhook_events (created_at DESC);

CREATE TABLE IF NOT EXISTS system_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL DEFAULT 'info',
  service    text NOT NULL DEFAULT 'system',
  message    text NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS system_logs_service_idx ON system_logs (service);
CREATE INDEX IF NOT EXISTS system_logs_level_idx ON system_logs (level);
CREATE INDEX IF NOT EXISTS system_logs_created_at_idx ON system_logs (created_at DESC);
