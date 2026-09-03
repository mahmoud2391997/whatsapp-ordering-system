# Deployment & Database Setup Guide

## Status Summary

✅ **Code Deployed to Vercel**: https://whatsapp-ordering-system-teal.vercel.app
✅ **Git Repository Updated**: All code pushed to `whatsapp-menu-integration` branch
✅ **Migrations Created**: SQL migrations ready for Supabase
⏳ **Database Seeding**: Ready to run once migrations are applied

---

## Step 1: Provision the Production Database

For a database running on the same VPS, install PostgreSQL with the VPS setup
script, then create a dedicated database and user:

```bash
sudo -u postgres createuser --pwprompt fresh_greens
sudo -u postgres createdb -O fresh_greens fresh_greens
```

Set these values in `/var/www/fresh-greens/.env`:

```dotenv
DATABASE_URL=postgresql://fresh_greens:<password>@127.0.0.1:5432/fresh_greens
DIRECT_DATABASE_URL=postgresql://fresh_greens:<password>@127.0.0.1:5432/fresh_greens
```

Initialize the base schema once after cloning the application:

```bash
npx prisma generate
npx prisma db push
```

Future deployments use `npx prisma migrate deploy` through `deploy.sh`.

## Step 2: Supabase Migrations (Only If Using Supabase)

The project includes three migrations that create the complete database schema:

1. **`20260715013747_create_fresh_greens_schema.sql`** — Core tables (products, customers, orders, conversations, messages)
2. **`20260715015829_add_menu_pages_table.sql`** — Menu pages table for customer-specific ordering
3. **`20260715120000_seed_products.sql`** — Pre-seed 15 products (vegetables, fruits, herbs)

### To apply migrations:

#### Option A: Using Supabase CLI (Recommended)

```bash
# Install Supabase CLI if not already installed
npm install -g supabase

# Link your project
supabase link --project-ref <your-project-ref>

# Push migrations to Supabase
supabase db push
```

#### Option B: Manual via Supabase Dashboard

1. Go to your Supabase project → **SQL Editor**
2. Create a new query
3. Copy the contents of each migration file (in order):
   - `supabase/migrations/20260715013747_create_fresh_greens_schema.sql`
   - `supabase/migrations/20260715015829_add_menu_pages_table.sql`
   - `supabase/migrations/20260715120000_seed_products.sql`
4. Run each query (copy → paste → run)

**Note**: The products migration will pre-populate 15 products with tiered pricing

---

## Step 2: Seed Test Data

Once migrations are applied, seed the database with realistic test data (customers, conversations, orders):

```bash
# From project root
node --env-file-if-exists=/vercel/share/.env.project scripts/seed-database.js

# OR if you have .env.local set up locally:
node scripts/seed-database.js
```

This will create:
- **3 test customers**: retail buyer, shop owner, restaurant manager
- **9 menu pages**: 3 per customer for multiple ordering sessions
- **3 conversations**: completed, active, and waiting statuses
- **7 messages**: realistic order requests and bot replies
- **4 orders**: 2 completed (retail), 1 completed (shop), 1 pending (restaurant)
- **16 order items**: with realistic quantities and tiered pricing

**Expected Output**:
```
🌱 Starting database seeding...
✓ Tables exist
📝 Seeding customers...
✓ Seeded 3 customers
📋 Seeding menu pages...
✓ Seeded 9 menu pages
💬 Seeding conversations...
✓ Seeded 3 conversations
💬 Seeding messages...
✓ Seeded 7 messages
📦 Seeding orders...
✓ Seeded 4 orders
🛒 Seeding order items...
✓ Seeded 16 order items
✅ Database seeding completed successfully!
```

---

## Step 3: Set Environment Variables

Ensure these environment variables are set in your Vercel project:

### Required:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key
- `SUPABASE_JWT_SECRET` — JWT secret for auth
- `WHATSAPP_PHONE_NUMBER_ID` — Your WhatsApp phone number ID (1146219945250452)
- `WHATSAPP_ACCESS_TOKEN` — Your WhatsApp Business API token

### Set in Vercel Dashboard:
1. Go to your Vercel project → **Settings** → **Environment Variables**
2. Add each variable (only existing ones were already added)
3. Redeploy: `npx vercel deploy --prod`

---

## Database Schema Overview

### Tables Created:

1. **products** (15 items pre-seeded)
   - Tiered pricing: retail, shop, wholesale
   - Categories: vegetables, fruits, herbs

2. **customers** (3 test customers)
   - name, phone (unique), type, location, total_orders

3. **menu_pages** (9 per-customer pages)
   - slug, customer_name, phone, customer_type

4. **conversations** (3 active conversations)
   - customer_name, phone, status, last_activity

5. **messages** (7 messages)
   - conversation_id, sender (customer/bot), text, type

6. **orders** (4 test orders)
   - customer_name, total, status, payment_status

7. **order_items** (16 line items)
   - order_id, product_name, qty, unit, unit_price

---

## WhatsApp Integration Setup

### Webhook Already Configured:
✅ Bot detects orders → Creates menu page → Sends WhatsApp link to customer
✅ Customer reviews menu → Places order → Appears in dashboard
✅ Business confirms order → Sends WhatsApp template confirmation

### Template Configuration:
- Template Name: `jaspers_market_order_confirmation_v1`
- API Version: v25.0
- Parameters: Customer name, Order ID, Date

---

## Testing the System

### 1. Test Menu Pages
Visit: `https://whatsapp-ordering-system-teal.vercel.app/menu/[customer-id]`

Use one of the test menu page IDs from seeded data

### 2. Test Dashboard
Visit: `https://whatsapp-ordering-system-teal.vercel.app/dashboard`

See test orders and confirm them to test WhatsApp integration

### 3. Test WhatsApp (Manual)
Send a message to your WhatsApp Business account with a food order, and the bot should:
1. Parse your order with Gemini AI
2. Create a menu page with your unique customer ID
3. Send you the menu link via WhatsApp

---

## Troubleshooting

### Tables not found error:
→ Migrations haven't been applied. Run Step 1 above.

### Seed script fails:
→ Ensure all migrations are applied first
→ Check environment variables are set correctly
→ Verify Supabase service role key has sufficient permissions

### WhatsApp not sending messages:
→ Verify `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` are set
→ Check WhatsApp Business account is properly configured
→ Ensure template `jaspers_market_order_confirmation_v1` exists in your account

### Menu page returns 404:
→ Use valid customer-id from seeded data
→ Check menu_pages table has entries

---

## Next Steps

1. ✅ Apply migrations to Supabase
2. ✅ Seed database with test data
3. ✅ Verify WhatsApp credentials are set
4. ✅ Test the dashboard and menu pages
5. ✅ Send a test message to WhatsApp bot
6. ✅ Confirm order in dashboard and verify WhatsApp confirmation sent

---

**Deployed Production URL**: https://whatsapp-ordering-system-teal.vercel.app
**GitHub Branch**: whatsapp-menu-integration
**Last Updated**: July 15, 2026
