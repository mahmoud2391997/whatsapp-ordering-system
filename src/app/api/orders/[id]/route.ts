import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';
import { isOrderStatus, ORDER_STATUS_LABELS } from '@/lib/types';
import { transitionOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

async function loadOrder(id: string) {
  return prisma.order.findUnique({
    where: { id },
    include: { orderItems: true, statusHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
  });
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const order = await loadOrder(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const status = body?.status;
  if (!isOrderStatus(status)) return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
  if (status === 'cancelled' && !body?.reason?.trim()) return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });

  try {
    const updated = await transitionOrder(params.id, status, body.reason?.trim());
    const conversation = await prisma.conversation.findFirst({ where: { orderId: params.id } });
    const label = ORDER_STATUS_LABELS[status];
    const message = status === 'cancelled'
      ? `Order ${params.id} was cancelled. Reason: ${body.reason.trim()}\nتم إلغاء الطلب.`
      : `Order ${params.id} update: ${label.en}\n${label.ar}`;
    let whatsappSent = false;
    if (conversation) {
      await prisma.message.create({ data: { conversationId: conversation.id, sender: 'bot', text: message, time: nowTime(), type: 'status_update' } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastActivity: nowTime(), status: 'active' } });
      whatsappSent = await sendWhatsApp(conversation.phone, message);
    }
    return NextResponse.json({ order: updated, whatsappSent });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN';
    if (code === 'ORDER_NOT_FOUND') return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    if (code === 'INVALID_STATUS_TRANSITION') return NextResponse.json({ error: 'Invalid status transition' }, { status: 409 });
    return NextResponse.json({ error: 'Unable to update order' }, { status: 500 });
  }
}
