-- Align deployed database with prisma/schema.prisma.
--
-- Drift found via information_schema comparison:
--   products.synced_at          missing
--   orders.customer_phone       missing (NOT NULL on schema)
--   orders.payment_method       missing
--   orders.notes                missing
--   orders.updated_at           missing
--   orders.idempotency_key      missing (unique partial index on schema)
--   order_status_history        table declared in schema but never created

-- Products: timestamp of the last successful catalog sync
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMPTZ;

-- Orders: columns required by the Order model and the checkout flow
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_phone" TEXT NOT NULL DEFAULT '';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_method" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "notes" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "idempotency_key" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_key" ON "orders" ("idempotency_key") WHERE "idempotency_key" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "orders_customer_phone_idx" ON "orders" ("customer_phone");
CREATE INDEX IF NOT EXISTS "orders_created_at_idx" ON "orders" ("created_at" DESC);

-- order_status_history: mirror of the Prisma model (FK matches what Prisma generates)
CREATE TABLE IF NOT EXISTS "order_status_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "order_id" TEXT NOT NULL,
    "old_status" TEXT NOT NULL,
    "new_status" TEXT NOT NULL,
    "reason" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_status_history_order_id_fkey'
  ) THEN
    ALTER TABLE "order_status_history"
      ADD CONSTRAINT "order_status_history_order_id_fkey"
      FOREIGN KEY ("order_id") REFERENCES "orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "order_status_history_order_id_idx" ON "order_status_history" ("order_id");
CREATE INDEX IF NOT EXISTS "order_status_history_created_at_idx" ON "order_status_history" ("created_at" DESC);

-- RLS parity with every other table in this database (single-tenant, public anon/authenticated)
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_select_order_status_history" ON order_status_history;
CREATE POLICY "anon_select_order_status_history" ON order_status_history FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_order_status_history" ON order_status_history;
CREATE POLICY "anon_insert_order_status_history" ON order_status_history FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_order_status_history" ON order_status_history;
CREATE POLICY "anon_update_order_status_history" ON order_status_history FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_order_status_history" ON order_status_history;
CREATE POLICY "anon_delete_order_status_history" ON order_status_history FOR DELETE
  TO anon, authenticated USING (true);