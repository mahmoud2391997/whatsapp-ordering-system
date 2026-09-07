import { NextResponse } from 'next/server';
import { getSallaAuthorization } from '@/lib/salla';

export async function POST() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const origin = process.env.APP_URL ? process.env.APP_URL : 'http://localhost:3000';
  const results: Record<string, unknown> = {};
  for (const resource of ['products', 'customers', 'orders']) {
    const response = await fetch(`${origin}/api/salla/sync/${resource}`, { method: 'POST', headers: { 'x-salla-internal-sync': '1' } });
    results[resource] = await response.json().catch(() => ({ error: response.statusText }));
  }
  return NextResponse.json({ ok: true, results });
}
