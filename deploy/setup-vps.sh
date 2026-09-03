#!/usr/bin/env bash
set -euo pipefail

# ─── Fresh Greens VPS Initial Setup ─────────────────────────────────
# Run this ONCE on a fresh Ubuntu VPS (Hostinger).
# Usage: sudo bash setup-vps.sh
# ─────────────────────────────────────────────────────────────────────

echo "🔧 Fresh Greens — VPS Initial Setup"

# 1. System packages
apt update && apt upgrade -y
apt install -y curl git build-essential nginx certbot python3-certbot-nginx postgresql postgresql-contrib

# 2. Local PostgreSQL
systemctl enable --now postgresql

# 3. Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 4. PM2 globally
npm install -g pm2

# 5. Create app directory
APP_DIR="/var/www/fresh-greens"
mkdir -p "$APP_DIR"
chown $(whoami):$(whoami) "$APP_DIR"

# 5. Clone repo (user must set GIT_REPO first)
echo ""
echo "📋 Next steps:"
echo "  1. cd $APP_DIR && git clone <YOUR_REPO_URL> ."
echo "  2. Create the database: sudo -u postgres createuser --pwprompt fresh_greens"
echo "     sudo -u postgres createdb -O fresh_greens fresh_greens"
echo "  3. Create .env with DATABASE_URL=postgresql://fresh_greens:<password>@127.0.0.1:5432/fresh_greens"
echo "     Set DIRECT_DATABASE_URL to the same local connection string."
echo "  4. Run: npx prisma generate && npx prisma db push"
echo "     This initializes the local database from prisma/schema.prisma once."
echo "  5. Run: npm run build && pm2 start ecosystem.config.js --env production"
echo "  6. pm2 save && pm2 startup"
echo "  7. Copy deploy/nginx/fresh-greens.conf → /etc/nginx/sites-available/fresh-greens"
echo "     Then: ln -s /etc/nginx/sites-available/fresh-greens /etc/nginx/sites-enabled/"
echo "     Then: nginx -t && systemctl reload nginx"
echo "  6. certbot --nginx -d yourdomain.com -d www.yourdomain.com"
echo ""
echo "✅ Setup complete!"
