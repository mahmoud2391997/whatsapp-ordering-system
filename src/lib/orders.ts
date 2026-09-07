import { prisma } from '@/lib/db';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS, OrderStatus, isOrderStatus } from '@/lib/types';
import { sendWhatsApp } from '@/lib/whatsapp';
import { pushOrderStatusToSalla } from '@/lib/salla-sync';

export const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABELS) as OrderStatus[];

export function normalizePhone(phone: string) {
  return phone.replace(/[^0-9]/g, '');
}

export function canTransition(from: string, to: string) {
  return isOrderStatus(from) && isOrderStatus(to) && ORDER_STATUS_TRANSITIONS[from].includes(to);
}

export async function findCustomerOrder(reference: string | undefined, phone: string) {
  const normalizedPhone = normalizePhone(phone);
  if (reference) {
    const order = await prisma.order.findUnique({ where: { id: reference.toUpperCase() }, include: { statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 } } });
    if (order && normalizePhone(order.customerPhone) === normalizedPhone) return order;
  }
  return prisma.order.findFirst({
    where: { customerPhone: { contains: normalizedPhone } },
    orderBy: { createdAt: 'desc' },
    include: { statusHistory: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
}

export async function transitionOrder(orderId: string, nextStatus: OrderStatus, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.order.findUnique({ where: { id: orderId } });
    if (!current) throw new Error('ORDER_NOT_FOUND');
    if (current.status === nextStatus) return current;
    if (!canTransition(current.status, nextStatus)) throw new Error('INVALID_STATUS_TRANSITION');
    const updated = await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    await tx.orderStatusHistory.create({ data: { orderId, oldStatus: current.status, newStatus: nextStatus, reason } });
    return updated;
  }).then(async (updated) => {
    if (updated.customerPhone) {
      const label = ORDER_STATUS_LABELS[nextStatus];
      await sendWhatsApp(updated.customerPhone, `Order ${updated.id} update:\n${label.en}\n${label.ar}`);
    }
    if (updated.sallaOrderId) {
      try {
        await pushOrderStatusToSalla(updated.id, nextStatus);
        await prisma.order.update({ where: { id: updated.id }, data: { sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() } });
      } catch (error) {
        await prisma.order.update({ where: { id: updated.id }, data: { sallaSyncStatus: 'failed', sallaSyncError: error instanceof Error ? error.message : 'Salla status sync failed' } }).catch(() => undefined);
      }
    }
    return updated;
  });
}

export function statusReply(order: { id: string; status: string; paymentStatus: string; total: unknown; createdAt: Date }) {
  const label = isOrderStatus(order.status) ? ORDER_STATUS_LABELS[order.status] : { en: order.status, ar: order.status };
  return `Order ${order.id}\nStatus: ${label.en}\nالحالة: ${label.ar}\nPayment: ${order.paymentStatus}\nTotal: ${Number(order.total).toFixed(2)}\n\nWe will send you another update when the status changes.`;
}
