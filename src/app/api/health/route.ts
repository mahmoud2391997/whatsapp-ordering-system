import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};

  // 1. Database connectivity
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { ok: false, error: String(err), latencyMs: Date.now() - dbStart };
  }

  // 2. pg_trgm extension
  try {
    const ext = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm') AS exists
    `;
    checks.pg_trgm = { ok: !!ext[0]?.exists };
  } catch (err) {
    checks.pg_trgm = { ok: false, error: String(err) };
  }

  // 3. Fuzzy match query
  try {
    const sim = await prisma.$queryRaw<{ sim: number }[]>`
      SELECT similarity('طماطم', 'طماطم') AS sim
    `;
    checks.fuzzy_match = { ok: (sim[0]?.sim ?? 0) > 0 };
  } catch (err) {
    checks.fuzzy_match = { ok: false, error: String(err) };
  }

  // 4. Product count
  const productStart = Date.now();
  try {
    const count = await prisma.product.count();
    checks.product_count = { ok: true, latencyMs: Date.now() - productStart };
  } catch (err) {
    checks.product_count = { ok: false, error: String(err), latencyMs: Date.now() - productStart };
  }

  const allOk = Object.values(checks).every(c => c.ok);

  return NextResponse.json(
    { status: allOk ? 'healthy' : 'degraded', checks, timestamp: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
