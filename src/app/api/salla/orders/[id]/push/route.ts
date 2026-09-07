import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization } from '@/lib/salla';
import { pushOrderToSalla } from '@/lib/salla-sync';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const order = await prisma.order.findUnique({ where: { id: params.id }, include: { orderItems: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  try {
    const response = await pushOrderToSalla(order.id) as { data?: { id?: string }; id?: string };
    return NextResponse.json({ ok: true, sallaOrderId: response.data?.id ?? response.id ?? null });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla order push failed';
    await prisma.order.update({ where: { id: order.id }, data: { sallaSyncStatus: 'failed', sallaSyncError: message } });
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
