-- Salla integration: authorization storage + linked columns on products/customers/orders

-- Salla OAuth authorizations
CREATE TABLE "salla_authorizations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "merchant_id" TEXT NOT NULL,
    "store_name" TEXT,
    "access_token" TEXT NOT NULL,
    "refresh_token" TEXT,
    "expires_at" TIMESTAMPTZ,
    "scopes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "last_sync_at" TIMESTAMPTZ,
    "last_sync_error" TEXT,
    "last_webhook_at" TIMESTAMPTZ,
    "webhook_ids" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "salla_authorizations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "salla_authorizations_merchant_id_key" ON "salla_authorizations" ("merchant_id");
CREATE INDEX "salla_authorizations_status_idx" ON "salla_authorizations" ("status");

-- Products: link to Salla catalog item
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "salla_product_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "products_salla_product_id_key" ON "products" ("salla_product_id");

-- Customers: link to Salla customer
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "salla_customer_id" TEXT;
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "salla_email" TEXT;

-- Orders: link to Salla order + sync state
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salla_order_id" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "orders_salla_order_id_key" ON "orders" ("salla_order_id");
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salla_sync_status" TEXT NOT NULL DEFAULT 'not_connected';
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salla_sync_error" TEXT;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "salla_synced_at" TIMESTAMPTZ;
