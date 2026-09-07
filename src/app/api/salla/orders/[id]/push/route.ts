import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { orderItems: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  try {
    const response = await sallaFetch<{ id?: string }>('/admin/v2/orders', { method: 'POST', body: JSON.stringify({ reference_id: order.id, customer: { name: order.customerName, mobile: order.customerPhone }, total: { amount: Number(order.total), currency: 'SAR' }, items: order.orderItems.map((item) => ({ name: item.productName, quantity: Number(item.qty), price: { amount: Number(item.unitPrice), currency: 'SAR' } })) }) }, auth);
    await prisma.order.update({ where: { id: order.id }, data: { sallaOrderId: response.id ?? order.sallaOrderId, sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() } });
    return NextResponse.json({ ok: true, sallaOrderId: response.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla order push failed';
    await prisma.order.update({ where: { id: order.id }, data: { sallaSyncStatus: 'failed', sallaSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
