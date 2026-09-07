import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization } from '@/lib/salla';
import { pushCatalogToSalla } from '@/lib/salla-sync';

export async function POST() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  try {
    const result = await pushCatalogToSalla();
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla catalog push failed';
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncError: message } });
    const status = message === 'SALLA_REAUTH_REQUIRED' || message === 'SALLA_NOT_CONNECTED' ? 401 : 502;
    return NextResponse.json({ error: message, retryable: status >= 500 }, { status });
  }
}