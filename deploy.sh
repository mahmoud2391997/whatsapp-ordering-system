#!/usr/bin/env bash
set -euo pipefail

# ─── Fresh Greens Deploy Script ──────────────────────────────────────
# Run this on the Hostinger VPS after pushing to main.
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────

APP_DIR="/var/www/fresh-greens"
LOG_DIR="/var/log/pm2"

echo "🚀 Starting deployment..."

# Ensure log directory exists
sudo mkdir -p "$LOG_DIR"

cd "$APP_DIR"

# 1. Pull latest code
echo "📥 Pulling latest code..."
git pull origin main

# 2. Install dependencies
echo "📦 Installing dependencies..."
npm ci --production=false

# 3. Generate Prisma client
echo "🔧 Generating Prisma client..."
npx prisma generate

# 4. Run database migrations (pg_trgm + any new migrations)
# The base schema is initialized once during VPS provisioning with `prisma db push`.
echo "🗄️  Running database migrations..."
npx prisma migrate deploy

# 5. Build Next.js
echo "🏗️  Building Next.js app..."
npm run build

# 6. Reload PM2 (not restart — preserves in-flight requests)
echo "🔄 Reloading PM2..."
pm2 reload ecosystem.config.js --env production

# 7. Save PM2 process list (survives reboot)
pm2 save

echo "✅ Deployment complete!"
echo "   App: https://yourdomain.com"
echo "   Health: https://yourdomain.com/api/health"
echo "   Dashboard: https://yourdomain.com/dashboard"
