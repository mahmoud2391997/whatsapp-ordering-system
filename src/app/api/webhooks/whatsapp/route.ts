import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { sendWhatsApp } from '@/lib/whatsapp';
import { handleWhatsAppText } from '@/lib/whatsapp-order';
import { normalizePhone } from '@/lib/orders';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN && challenge) return new Response(challenge);
  return new Response('Forbidden', { status: 403 });
}

function validSignature(raw: string, signature: string | null) {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret) return process.env.NODE_ENV !== 'production';
  if (!signature?.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', secret).update(raw).digest('hex');
  const a = Buffer.from(signature.slice(7));
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

function extractText(message: any) {
  return message?.text?.body ?? message?.button?.text ?? message?.interactive?.button_reply?.title ?? message?.interactive?.list_reply?.title ?? '';
}

export async function POST(req: Request) {
  const raw = await req.text();
  if (!validSignature(raw, req.headers.get('x-hub-signature-256'))) return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const messages = payload?.entry?.flatMap((entry: any) => entry.changes?.flatMap((change: any) => change.value?.messages ?? []) ?? []) ?? [];
  const contacts = payload?.entry?.flatMap((entry: any) => entry.changes?.flatMap((change: any) => change.value?.contacts ?? []) ?? []) ?? [];
  for (const message of messages) {
    const phone = normalizePhone(message.from ?? '');
    const text = extractText(message).trim();
    if (!phone || !text) continue;
    const eventId = message.id ?? `${phone}:${message.timestamp}:${text}`;
    try {
      await prisma.webhookEvent.create({ data: { source: 'whatsapp', eventType: 'message', eventKey: String(eventId), payload: message, processed: false } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue;
      throw error;
    }
    const profileName = contacts.find((contact: any) => normalizePhone(contact.wa_id ?? '') === phone)?.profile?.name;
    try {
      const { reply } = await handleWhatsAppText({ phone, text, name: profileName });
      await sendWhatsApp(phone, reply);
      await prisma.webhookEvent.updateMany({ where: { source: 'whatsapp', eventType: 'message', eventKey: String(eventId) }, data: { processed: true } });
    } catch (error) {
      await prisma.webhookEvent.updateMany({
        where: { source: 'whatsapp', eventType: 'message', eventKey: String(eventId) },
        data: { processed: false, error: error instanceof Error ? error.message : 'WhatsApp handler failed' },
      });
      throw error;
    }
  }
  return NextResponse.json({ received: true });
}
