import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { verifySallaWebhook, encryptToken } from '@/lib/salla';
import { applySallaWebhook } from '@/lib/salla-sync';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  if (!verifySallaWebhook(rawBody, request.headers.get('x-salla-signature') ?? request.headers.get('x-signature'))) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(rawBody); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const eventType = String(payload.event ?? payload.event_type ?? 'unknown');
  const eventId = String(payload.id ?? request.headers.get('x-salla-event-id') ?? `${eventType}:${crypto.randomUUID()}`);
  let event;
  try {
    event = await prisma.webhookEvent.create({ data: { source: 'salla', eventType, eventKey: eventId, payload: payload as Prisma.InputJsonValue } });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return NextResponse.json({ ok: true, duplicate: true });
    throw error;
  }
  try {
    const merchant = payload.merchant as { id?: string | number } | undefined;
    const merchantId = String(payload.merchant_id ?? merchant?.id ?? '');
    if (merchantId) {
      await prisma.sallaAuthorization.updateMany({ where: { merchantId }, data: { lastWebhookAt: new Date(), status: eventType.includes('uninstall') ? 'revoked' : 'active' } });
    }
    if (eventType.includes('authorize')) {
      const data = payload.data as { access_token?: string; expires?: number; refresh_token?: string; scope?: string } | undefined;
      const accessToken = data?.access_token;
      if (merchantId && accessToken) {
        const expires = Number(data.expires ?? 0);
        const expiresAt = expires > 1_000_000_000 ? new Date(expires * 1000) : expires > 0 ? new Date(Date.now() + expires * 1000) : null;
        await prisma.sallaAuthorization.upsert({
          where: { merchantId },
          update: {
            accessToken: encryptToken(accessToken),
            refreshToken: data.refresh_token ? encryptToken(data.refresh_token) : undefined,
            expiresAt,
            scopes: data.scope ?? null,
            status: 'active',
            lastSyncError: null,
          },
          create: {
            merchantId,
            accessToken: encryptToken(accessToken),
            refreshToken: data.refresh_token ? encryptToken(data.refresh_token) : null,
            expiresAt,
            scopes: data.scope ?? null,
            status: 'active',
          },
        });
      }
    } else if (!eventType.includes('uninstall')) {
      await applySallaWebhook(eventType, payload);
    }
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { processed: true, error: null } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await prisma.webhookEvent.update({ where: { id: event.id }, data: { error: error instanceof Error ? error.message : 'Webhook processing failed' } });
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
