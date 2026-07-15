/*
# Fresh Greens — WhatsApp Ordering System Schema

Creates the full database schema for a fruit & vegetable ordering system that
operates through a WhatsApp AI bot. This is a single-tenant demo app (no sign-in
screen), so all tables use `TO anon, authenticated` RLS policies so the anon-key
frontend can read/write its own data.

## New Tables

1. **products** — catalogue of fruits, vegetables, and herbs with tiered pricing
   - id, name, name_ar, category, unit, retail_price, shop_price, wholesale_price,
     stock, image_url, created_at

2. **customers** — people who order via WhatsApp
   - id, name, phone (unique), type (retail/shop/restaurant), location,
     total_orders, joined_at

3. **orders** — orders placed through WhatsApp conversations
   - id, customer_id (FK), customer_name, customer_type, total, status,
     payment_status, location, created_at

4. **order_items** — line items belonging to an order
   - id, order_id (FK), product_id (FK), product_name, qty, unit, unit_price

5. **conversations** — WhatsApp chat sessions
   - id, customer_name, phone, customer_type, status (active/completed/waiting),
     order_id, last_activity

6. **messages** — individual messages in a conversation
   - id, conversation_id (FK), sender (customer/bot), text, time, type

## Security
- RLS enabled on every table.
- All tables use `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`
  because this is a single-tenant demo with no sign-in screen — the data is
  intentionally shared/public.
*/

-- ── products ──
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

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE
  TO anon, authenticated USING (true);

-- ── customers ──
CREATE TABLE IF NOT EXISTS customers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  phone        text UNIQUE NOT NULL,
  type         text NOT NULL DEFAULT 'retail',
  location     text,
  total_orders integer NOT NULL DEFAULT 0,
  joined_at    date NOT NULL DEFAULT CURRENT_DATE
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ── orders ──
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

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE
  TO anon, authenticated USING (true);

-- ── order_items ──
CREATE TABLE IF NOT EXISTS order_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     text NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id   uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  qty          numeric(10,2) NOT NULL,
  unit         text NOT NULL DEFAULT 'kg',
  unit_price   numeric(10,2) NOT NULL DEFAULT 0
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE
  TO anon, authenticated USING (true);

-- ── conversations ──
CREATE TABLE IF NOT EXISTS conversations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name  text NOT NULL,
  phone          text NOT NULL,
  customer_type  text NOT NULL DEFAULT 'retail',
  status         text NOT NULL DEFAULT 'active',
  order_id       text,
  last_activity  text NOT NULL DEFAULT ''
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_conversations" ON conversations;
CREATE POLICY "anon_select_conversations" ON conversations FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_conversations" ON conversations;
CREATE POLICY "anon_insert_conversations" ON conversations FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_conversations" ON conversations;
CREATE POLICY "anon_update_conversations" ON conversations FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_conversations" ON conversations;
CREATE POLICY "anon_delete_conversations" ON conversations FOR DELETE
  TO anon, authenticated USING (true);

-- ── messages ──
CREATE TABLE IF NOT EXISTS messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender          text NOT NULL DEFAULT 'customer',
  text            text NOT NULL,
  time            text NOT NULL,
  type            text
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_messages" ON messages;
CREATE POLICY "anon_select_messages" ON messages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_messages" ON messages;
CREATE POLICY "anon_insert_messages" ON messages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_messages" ON messages;
CREATE POLICY "anon_update_messages" ON messages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_messages" ON messages;
CREATE POLICY "anon_delete_messages" ON messages FOR DELETE
  TO anon, authenticated USING (true);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
