import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { transitionOrder } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (secret && req.headers.get('x-payment-webhook-secret') !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const orderId = String(body.orderId ?? body.order_id ?? '');
  const status = String(body.status ?? '').toLowerCase();
  const provider = String(body.provider ?? body.paymentMethod ?? 'unknown');
  const providerId = body.providerId ?? body.transactionId ?? body.id ?? null;
  if (!orderId || !['paid', 'success', 'failed', 'refunded', 'cancelled'].includes(status)) {
    return NextResponse.json({ error: 'orderId and a valid payment status are required' }, { status: 400 });
  }

  const normalized = status === 'success' ? 'paid' : status;
  const transaction = await prisma.transaction.create({
    data: {
      orderId,
      amount: Number(body.amount ?? 0),
      currency: String(body.currency ?? 'SAR'),
      status: normalized,
      paymentMethod: provider,
      providerId: providerId ? String(providerId) : undefined,
      providerResponse: body,
    },
  });

  await prisma.order.update({
    where: { id: orderId },
    data: { paymentStatus: normalized === 'paid' ? 'paid' : normalized },
  });

  if (normalized === 'paid') {
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (order?.status === 'pending') await transitionOrder(orderId, 'confirmed', 'Payment confirmed');
  }

  return NextResponse.json({ success: true, transactionId: transaction.id });
}
