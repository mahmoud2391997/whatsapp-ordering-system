import { createHmac, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { transitionOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

function validSecret(raw: string, request: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  const supplied = request.headers.get('x-payment-webhook-signature') ?? request.headers.get('x-payment-webhook-secret');
  if (!supplied) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(supplied.replace(/^sha256=/, ''), 'utf8');
  const b = Buffer.from(expected, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const raw = await request.text();
  if (!validSecret(raw, request)) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const orderId = String(body.orderId ?? body.order_id ?? '');
  const status = String(body.status ?? '').toLowerCase();
  const provider = String(body.provider ?? body.paymentMethod ?? '').toLowerCase();
  const providerId = String(body.providerId ?? body.transactionId ?? body.id ?? '');
  const normalized = status === 'success' ? 'paid' : status;
  if (!orderId || !provider || !providerId || !['paid', 'success', 'failed', 'refunded', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'orderId, provider, provider id, and valid status are required' }, { status: 400 });
  }

  try {
    const event = await prisma.webhookEvent.create({
      data: { source: provider, eventType: 'payment', eventKey: providerId, payload: body as Prisma.InputJsonValue },
    });
    const transaction = await prisma.transaction.upsert({
      where: { providerId },
      create: { orderId, amount: Number(body.amount ?? 0), currency: String(body.currency ?? 'SAR'), status: normalized, paymentMethod: provider, providerId, providerResponse: body as Prisma.InputJsonValue },
      update: { status: normalized, providerResponse: body as Prisma.InputJsonValue, orderId },
    });
    await prisma.order.update({ where: { id: orderId }, data: { paymentStatus: normalized === 'paid' ? 'paid' : normalized } });
    if (normalized === 'paid') {
      const order = await prisma.order.findUnique({ where: { id: orderId } });
      if (order?.status === 'pending') await transitionOrder(orderId, 'confirmed', 'Payment confirmed');
    }
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true } });
    return NextResponse.json({ success: true, transactionId: transaction.id });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ success: true, duplicate: true });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
