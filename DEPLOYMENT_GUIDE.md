# Deployment

Production runs as a Next.js app on the VPS, with PostgreSQL on the same machine and PM2 keeping the process up. Copy `.env.example` to `/var/www/fresh-greens/.env` and replace every placeholder. Do not commit that file.

## Required environment

- `APP_URL` — public HTTPS origin, no trailing slash
- `ADMIN_PASSWORD` — at least 12 characters; this signs the dashboard session
- `DATABASE_URL` and `DIRECT_DATABASE_URL` — PostgreSQL URL for a role that **owns** the tables
- `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `SALLA_CLIENT_ID`, `SALLA_CLIENT_SECRET`, `SALLA_WEBHOOK_SECRET`, `SALLA_TOKEN_ENCRYPTION_KEY`
- `PAYMENT_WEBHOOK_SECRET` when card or BNPL webhooks are enabled

WhatsApp webhook: `{APP_URL}/api/webhooks/whatsapp`  
Salla redirect: `{APP_URL}/api/salla/callback`  
Salla webhook: `{APP_URL}/api/webhooks/salla`

## First-time database

```bash
sudo -u postgres createuser --pwprompt fresh_greens
sudo -u postgres createdb -O fresh_greens fresh_greens
```

The app user must own the tables. Row-level security is enabled and the old public anon policies are removed, so a non-owner role cannot read orders.

## Release

On the server, from `/var/www/fresh-greens`:

```bash
bash deploy.sh
```

That pulls `main`, installs dependencies, runs `npx prisma migrate deploy`, builds Next.js, and reloads PM2 from `ecosystem.config.cjs`.

Check `https://your-domain.example/api/health`. `status` is `healthy` only when Postgres, `pg_trgm`, and `ADMIN_PASSWORD` are ready. Salla can stay disconnected without failing the check. The response does not include database errors.

## Dashboard

`/dashboard` and the admin APIs require the password. Customer checkout (`/api/checkout`), the menu, and the signed webhooks stay public. In production a database outage shows an empty dashboard instead of demo orders.

## Local development

Leave `ADMIN_PASSWORD` unset to open the dashboard without a login. Set it when you want to exercise the production gate. `npm test` runs the unit tests. `npm run build` is the same build the server runs.
