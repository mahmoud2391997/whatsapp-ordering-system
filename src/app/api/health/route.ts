import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization } from '@/lib/salla';
import { adminPasswordConfigured } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch {
    checks.database = { ok: false, error: 'unavailable', latencyMs: Date.now() - dbStart };
  }

  // 2. pg_trgm extension
  try {
    const ext = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS exists
    `;
    checks.pg_trgm = { ok: !!ext[0]?.exists };
  } catch {
    checks.pg_trgm = { ok: false, error: 'unavailable' };
  }

  // 3. Fuzzy match query
  try {
    const sim = await prisma.$queryRaw<{ sim: number }[]>`
      SELECT similarity('طماطم', 'طماطم') AS sim
    `;
    checks.fuzzy_match = { ok: (sim[0]?.sim ?? 0) > 0 };
  } catch {
    checks.fuzzy_match = { ok: false, error: 'unavailable' };
  }

  // 4. Product count
  const productStart = Date.now();
  try {
    await prisma.product.count();
    checks.product_count = { ok: true, latencyMs: Date.now() - productStart };
  } catch {
    checks.product_count = { ok: false, error: 'unavailable', latencyMs: Date.now() - productStart };
  }

  try {
    const auth = await getSallaAuthorization();
    checks.salla = { ok: Boolean(auth), error: auth ? undefined : 'Salla store is not connected' };
  } catch {
    checks.salla = { ok: false, error: 'unavailable' };
  }

  const adminRequired = process.env.NODE_ENV === 'production';
  checks.admin = {
    ok: !adminRequired || adminPasswordConfigured(),
    error: adminRequired && !adminPasswordConfigured() ? 'ADMIN_PASSWORD is missing' : undefined,
  };

  const required = Object.entries(checks).filter(([key]) => key !== 'salla');
  const allOk = required.every(([, c]) => c.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
