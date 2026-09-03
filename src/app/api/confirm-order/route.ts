import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

interface ConfirmOrderBody {
  orderId: string;
  message?: string;
}

export async function POST(req: Request) {
  const body: ConfirmOrderBody = await req.json().catch(() => null);
  if (!body || !body.orderId) {
    return NextResponse.json({ error: 'orderId is required' }, { status: 400 });
  }

  const order = await prisma.order.findUnique({ where: { id: body.orderId }, include: { orderItems: true } });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  if (order.status !== 'pending') {
    return NextResponse.json({ error: `Only pending orders can be confirmed (current status: ${order.status})` }, { status: 409 });
  }

  await prisma.order.update({ where: { id: body.orderId }, data: { status: 'confirmed' } });

  const conversation = await prisma.conversation.findFirst({ where: { orderId: body.orderId } });

  let whatsappSent = false;
  if (conversation?.phone) {
    const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
    const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? '';

    if (PHONE_NUMBER_ID && WHATSAPP_TOKEN) {
      const formattedPhone = conversation.phone.replace(/[^0-9]/g, '');
      const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

      try {
        await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: formattedPhone,
          type: 'template',
          template: {
            name: 'jaspers_market_order_confirmation_v1',
            language: { code: 'en_US' },
            components: [{ type: 'body', parameters: [
              { type: 'text', text: order.customerName },
              { type: 'text', text: body.orderId },
              { type: 'text', text: orderDate },
            ] }],
          },
        }),
        });
      } catch { /* delivery failure must not undo the database status change */ }
    }

    const conv = await prisma.conversation.findFirst({ where: { phone: conversation.phone } });
    if (conv) {
      const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
      await prisma.message.create({
        data: { conversationId: conv.id, sender: 'bot', text: body.message?.trim() || `Order confirmed! Order ID: ${body.orderId}`, time, type: 'confirmation' },
      });
    }
  }

  return NextResponse.json({ success: true, orderId: body.orderId, status: 'confirmed' });
}
