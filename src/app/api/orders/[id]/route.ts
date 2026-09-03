import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

async function loadOrder(id: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return null;
  const items = await prisma.orderItem.findMany({ where: { orderId: id } });
  return { ...order, order_items: items };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const order = await loadOrder(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  return NextResponse.json({ order });
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => ({}));
  const status = body?.status ?? 'confirmed';
  const allowedStatuses = ['pending', 'confirmed', 'delivering', 'delivered', 'completed', 'cancelled'];
  if (!allowedStatuses.includes(status)) {
    return NextResponse.json({ error: 'Invalid order status' }, { status: 400 });
  }

  const order = await loadOrder(params.id);
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status === 'cancelled' || order.status === 'completed') {
    return NextResponse.json({ error: `Cannot change a ${order.status} order` }, { status: 409 });
  }
  if (status === 'cancelled' && !body?.reason?.trim()) {
    return NextResponse.json({ error: 'Cancellation reason is required' }, { status: 400 });
  }
  if (status === 'confirmed' && order.status !== 'pending') {
    return NextResponse.json({ error: 'Only pending orders can be confirmed' }, { status: 409 });
  }

  await prisma.order.update({ where: { id: order.id }, data: { status } });

  let conversation = null;
  if (body?.conversationId) {
    conversation = await prisma.conversation.findUnique({ where: { id: body.conversationId } });
  } else {
    conversation = await prisma.conversation.findFirst({ where: { orderId: order.id } });
  }

  const time = nowTime();
  const itemsText = (order.order_items ?? [])
    .map((it: { productName: string; qty: unknown; unit: string; unitPrice: unknown }, i: number) =>
      `${i + 1}. ${it.productName} — ${it.qty} ${it.unit} × ${it.unitPrice} EGP`)
    .join('\n');

  const isCancellation = status === 'cancelled';
  const confirmMessage = isCancellation
    ? `❌ *Order Cancelled*\n\nOrder ID: ${order.id}\nReason: ${body.reason.trim()}\n\nPlease contact us if you need help.`
    : `✅ *Order Confirmed*\n\n` +
      `Order ID: ${order.id}\n` +
      (itemsText ? `\n*Items:*\n${itemsText}\n` : '') +
      `\n*Total: ${Number(order.total).toFixed(2)} EGP*\n\n` +
      `شكراً لك! تم تأكيد طلبك وسنبدأ في تجهيزه. 🌿`;

  let whatsappSent = false;
  if (conversation) {
    await prisma.message.create({ data: { conversationId: conversation.id, sender: 'bot', text: confirmMessage, time, type: isCancellation ? 'cancellation' : 'order' } });
    await prisma.conversation.update({ where: { id: conversation.id }, data: { orderId: order.id, lastActivity: time, status: 'active' } });
    whatsappSent = await sendWhatsApp(conversation.phone, confirmMessage);
  }

  return NextResponse.json({ order: { ...order, status }, conversationId: conversation?.id ?? null, confirmMessage, whatsappSent });
}
