import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifySallaWebhook } from '@/lib/salla';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySallaWebhook(rawBody, request.headers.get('x-salla-signature') ?? request.headers.get('x-signature'))) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const eventType = String(payload.event ?? payload.event_type ?? 'unknown');
  const eventId = String(payload.id ?? request.headers.get('x-salla-event-id') ?? `${eventType}:${crypto.randomUUID()}`);
  const existing = await prisma.webhookEvent.findFirst({ where: { source: 'salla', eventType, payload: { path: ['id'], equals: eventId } } });
  if (existing?.processed) return NextResponse.json({ ok: true, duplicate: true });
  const event = existing ?? await prisma.webhookEvent.create({ data: { source: 'salla', eventType, payload: payload as Prisma.InputJsonValue } });
  try {
    const merchant = payload.merchant as { id?: string | number } | undefined;
    const merchantId = String(payload.merchant_id ?? merchant?.id ?? '');
    if (merchantId) await prisma.sallaAuthorization.updateMany({ where: { merchantId }, data: { lastWebhookAt: new Date() } });
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message : 'Webhook processing failed' } });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
