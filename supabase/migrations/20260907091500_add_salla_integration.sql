-- Add Salla integration fields to existing tables

-- Add Salla order ID to orders table
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS salla_order_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS salla_status TEXT,
ADD COLUMN IF NOT EXISTS salla_created_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS salla_updated_at TIMESTAMPTZ;

-- Create index for Salla order lookups
CREATE INDEX IF NOT EXISTS idx_orders_salla_order_id ON orders(salla_order_id);

-- Add Salla product ID to products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS salla_product_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS salla_status TEXT DEFAULT 'active',
ADD COLUMN IF NOT EXISTS salla_synced_at TIMESTAMPTZ;

-- Create index for Salla product lookups
CREATE INDEX IF NOT EXISTS idx_products_salla_product_id ON products(salla_product_id);

-- Add Salla customer ID to conversations table
ALTER TABLE conversations 
ADD COLUMN IF NOT EXISTS salla_customer_id TEXT UNIQUE;

-- Create index for Salla customer lookups
CREATE INDEX IF NOT EXISTS idx_conversations_salla_customer_id ON conversations(salla_customer_id);

-- Add Salla transaction ID to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS salla_payment_id TEXT,
ADD COLUMN IF NOT EXISTS salla_status TEXT;

-- Create index for Salla payment lookups
CREATE INDEX IF NOT EXISTS idx_transactions_salla_payment_id ON transactions(salla_payment_id);

-- Add Salla-specific columns to orders for better tracking
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'whatsapp',
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'pending';

-- Create index for sync status
CREATE INDEX IF NOT EXISTS idx_orders_sync_status ON orders(sync_status);

-- Add comments for documentation
COMMENT ON COLUMN orders.salla_order_id IS 'Order ID from Salla platform';
COMMENT ON COLUMN orders.salla_status IS 'Order status from Salla';
COMMENT ON COLUMN orders.source IS 'Order source: whatsapp, salla, or other';
COMMENT ON COLUMN orders.sync_status IS 'Sync status with Salla: pending, synced, failed';
COMMENT ON COLUMN products.salla_product_id IS 'Product ID from Salla platform';
COMMENT ON COLUMN products.salla_status IS 'Product status from Salla';
COMMENT ON COLUMN products.salla_synced_at IS 'Last sync timestamp with Salla';
COMMENT ON COLUMN conversations.salla_customer_id IS 'Customer ID from Salla platform';
COMMENT ON COLUMN transactions.salla_payment_id IS 'Payment transaction ID from Salla';
COMMENT ON COLUMN transactions.salla_status IS 'Payment status from Salla';
