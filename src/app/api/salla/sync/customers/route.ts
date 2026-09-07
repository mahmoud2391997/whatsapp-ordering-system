import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

export async function POST() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  try {
    const result = await sallaFetch<{ data?: Array<Record<string, unknown>> }>(`/admin/v2/customers?per_page=100`, {}, auth);
    let synced = 0;
    for (const item of result.data ?? []) {
      const id = String(item.id ?? '');
      const phone = String(item.mobile ?? item.phone ?? `salla-${id}`);
      if (!id) continue;
      const fallbackName = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || 'Salla customer';
      const name = String(item.name ?? fallbackName);
      const existing = await prisma.customer.findFirst({ where: { sallaCustomerId: id } });
      if (existing) await prisma.customer.update({ where: { id: existing.id }, data: { name, phone, sallaEmail: typeof item.email === 'string' ? item.email : existing.sallaEmail } });
      else await prisma.customer.create({ data: { name, phone, sallaCustomerId: id, sallaEmail: typeof item.email === 'string' ? item.email : null } });
      synced++;
    }
    return NextResponse.json({ ok: true, synced });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla customer sync failed';
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
