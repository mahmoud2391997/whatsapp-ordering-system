/*
# Integration Support Tables

Adds three tables required to support the external integrations:
WhatsApp Business API, HyperPay, SendGrid, Gemini, and Cloudinary.

## New Tables

1. **transactions** — payment transactions linked to orders (HyperPay events)
   - id, order_id (FK), amount, currency, status, payment_method,
     provider_id (HyperPay transaction ID), provider_response (JSONB),
     created_at, updated_at

2. **webhook_events** — full audit log of every inbound webhook (Meta, HyperPay)
   - id, source (whatsapp|hyperpay|system), event_type, payload (JSONB),
     processed, error, created_at

3. **system_logs** — application-level event log for AI parsing, emails, errors
   - id, level (info|warn|error), service, message, metadata (JSONB), created_at

## Security
- RLS enabled on all three tables.
- All policies use `TO anon, authenticated USING (true)` — single-tenant no-auth app.

## Notes
- `transactions.provider_response` stores the raw HyperPay JSON for audit.
- `webhook_events.payload` stores the full raw body for replay/debugging.
- Indexes on order_id, source, created_at for query performance.
*/

-- ── transactions ──
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

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_transactions" ON transactions;
CREATE POLICY "anon_select_transactions" ON transactions FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_transactions" ON transactions;
CREATE POLICY "anon_insert_transactions" ON transactions FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_transactions" ON transactions;
CREATE POLICY "anon_update_transactions" ON transactions FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_transactions" ON transactions;
CREATE POLICY "anon_delete_transactions" ON transactions FOR DELETE
  TO anon, authenticated USING (true);

-- ── webhook_events ──
CREATE TABLE IF NOT EXISTS webhook_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source      text NOT NULL DEFAULT 'system',
  event_type  text NOT NULL DEFAULT 'unknown',
  payload     jsonb NOT NULL DEFAULT '{}',
  processed   boolean NOT NULL DEFAULT false,
  error       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_webhook_events" ON webhook_events;
CREATE POLICY "anon_select_webhook_events" ON webhook_events FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_webhook_events" ON webhook_events;
CREATE POLICY "anon_insert_webhook_events" ON webhook_events FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_webhook_events" ON webhook_events;
CREATE POLICY "anon_update_webhook_events" ON webhook_events FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_webhook_events" ON webhook_events;
CREATE POLICY "anon_delete_webhook_events" ON webhook_events FOR DELETE
  TO anon, authenticated USING (true);

-- ── system_logs ──
CREATE TABLE IF NOT EXISTS system_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level      text NOT NULL DEFAULT 'info',
  service    text NOT NULL DEFAULT 'system',
  message    text NOT NULL,
  metadata   jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_system_logs" ON system_logs;
CREATE POLICY "anon_select_system_logs" ON system_logs FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_system_logs" ON system_logs;
CREATE POLICY "anon_insert_system_logs" ON system_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_system_logs" ON system_logs;
CREATE POLICY "anon_update_system_logs" ON system_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_system_logs" ON system_logs;
CREATE POLICY "anon_delete_system_logs" ON system_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ── Indexes ──
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_provider_id ON transactions(provider_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_source ON webhook_events(source);
CREATE INDEX IF NOT EXISTS idx_webhook_events_processed ON webhook_events(processed);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON webhook_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_logs_service ON system_logs(service);
CREATE INDEX IF NOT EXISTS idx_system_logs_level ON system_logs(level);
CREATE INDEX IF NOT EXISTS idx_system_logs_created_at ON system_logs(created_at DESC);

-- ── updated_at trigger for transactions ──
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_transactions_updated_at ON transactions;
CREATE TRIGGER set_transactions_updated_at
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
