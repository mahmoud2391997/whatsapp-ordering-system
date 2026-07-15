/*
# Menu Pages — Per-Customer Menu with Cart Checkout

Adds a `menu_pages` table so every customer gets a unique, shareable menu page URL.
Orders placed from a menu page are tagged with `menu_page_id` so the dashboard
and WhatsApp conversation flow can trace which page originated the order.

## New Tables
1. **menu_pages** — unique per-customer menu page
   - id (uuid PK)
   - slug (text, UNIQUE) — short code used in the URL: /menu/<slug>
   - customer_name (text)
   - phone (text)
   - customer_type (text, default 'retail')
   - created_at (timestamptz)

## Modified Tables
- **orders** — adds nullable `menu_page_id` column (FK → menu_pages.id, ON DELETE SET NULL)
  so orders created from a menu page are traceable to that page.

## Security
- RLS enabled on `menu_pages`.
- Single-tenant no-auth app: `TO anon, authenticated` with `USING (true)` / `WITH CHECK (true)`.
*/

-- ── menu_pages ──
CREATE TABLE IF NOT EXISTS menu_pages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug          text UNIQUE NOT NULL,
  customer_name text NOT NULL,
  phone         text NOT NULL,
  customer_type text NOT NULL DEFAULT 'retail',
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_menu_pages" ON menu_pages;
CREATE POLICY "anon_select_menu_pages" ON menu_pages FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_menu_pages" ON menu_pages;
CREATE POLICY "anon_insert_menu_pages" ON menu_pages FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_menu_pages" ON menu_pages;
CREATE POLICY "anon_update_menu_pages" ON menu_pages FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_menu_pages" ON menu_pages;
CREATE POLICY "anon_delete_menu_pages" ON menu_pages FOR DELETE
  TO anon, authenticated USING (true);

-- ── Add menu_page_id to orders ──
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'orders' AND column_name = 'menu_page_id'
  ) THEN
    ALTER TABLE orders ADD COLUMN menu_page_id uuid REFERENCES menu_pages(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_menu_page_id ON orders(menu_page_id);
CREATE INDEX IF NOT EXISTS idx_menu_pages_slug ON menu_pages(slug);
