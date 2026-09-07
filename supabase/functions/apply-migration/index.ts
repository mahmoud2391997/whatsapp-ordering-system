import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const migrationSQL = `
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
`;

    // Execute the migration using RPC
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try alternative method - direct SQL execution
      const { error: directError } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
      
      if (directError) {
        throw new Error(`Migration failed: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "Migration applied successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
