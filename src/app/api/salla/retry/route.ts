import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { pushOrderStatusToSalla, pushOrderToSalla } from '@/lib/salla-sync';

export const dynamic = 'force-dynamic';

export async function POST() {
  const orders = await prisma.order.findMany({ where: { sallaSyncStatus: 'failed' }, select: { id: true, status: true, sallaOrderId: true } });
  let succeeded = 0;
  let stillFailing = 0;
  for (const order of orders) {
    try {
      if (order.sallaOrderId) await pushOrderStatusToSalla(order.id, order.status);
      else await pushOrderToSalla(order.id);
      await prisma.order.update({ where: { id: order.id }, data: { sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() } });
      succeeded += 1;
    } catch (error) {
      stillFailing += 1;
      await prisma.order.update({ where: { id: order.id }, data: { sallaSyncError: error instanceof Error ? error.message : 'Retry failed' } }).catch(() => undefined);
    }
  }
  return NextResponse.json({ retriedOrders: orders.length, succeeded, stillFailing });
}
