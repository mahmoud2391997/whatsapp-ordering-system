import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const body = await request.json().catch(() => ({}));
  const status = typeof body.status === 'string' ? body.status : '';
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });
  const order = await prisma.order.findUnique({ where: { id: params.id } });
  if (!order?.sallaOrderId) return NextResponse.json({ error: 'Order is not linked to Salla' }, { status: 409 });
  try {
    await sallaFetch(`/admin/v2/orders/${order.sallaOrderId}/status`, { method: 'POST', body: JSON.stringify({ status }) }, auth);
    await prisma.order.update({ where: { id: order.id }, data: { status, sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() } });
    return NextResponse.json({ ok: true, status });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla status sync failed';
    await prisma.order.update({ where: { id: order.id }, data: { sallaSyncStatus: 'failed', sallaSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
