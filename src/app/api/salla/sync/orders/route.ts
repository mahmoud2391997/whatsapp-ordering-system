import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

export async function POST() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  try {
    const result = await sallaFetch<{ data?: Array<Record<string, unknown>> }>(`/admin/v2/orders?per_page=100`, {}, auth);
    let synced = 0;
    for (const item of result.data ?? []) {
      const sallaOrderId = String(item.id ?? '');
      if (!sallaOrderId) continue;
      const customer = item.customer as Record<string, unknown> | undefined;
      const customerName = String(customer?.name ?? item.customer_name ?? 'Salla customer');
      const customerPhone = String(customer?.mobile ?? customer?.phone ?? item.customer_phone ?? `salla-${sallaOrderId}`);
      const total = Number((item.total as Record<string, unknown> | undefined)?.amount ?? item.total ?? 0);
      const existing = await prisma.order.findUnique({ where: { sallaOrderId } });
      await prisma.order.upsert({ where: { sallaOrderId }, update: { customerName, customerPhone, total, status: String(item.status?.toString().toLowerCase() ?? 'pending'), sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() }, create: { id: `SALLA-${sallaOrderId}`, sallaOrderId, customerName, customerPhone, total, status: 'pending', paymentStatus: 'unpaid', sallaSyncStatus: 'synced', sallaSyncedAt: new Date() } });
      if (!existing) await prisma.orderStatusHistory.create({ data: { orderId: `SALLA-${sallaOrderId}`, oldStatus: 'new', newStatus: 'pending', reason: 'Imported from Salla' } });
      synced++;
    }
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
    return NextResponse.json({ ok: true, synced });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla order sync failed';
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
