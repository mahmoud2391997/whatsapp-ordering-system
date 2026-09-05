import { NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { findCustomerOrder, statusReply, normalizePhone } from '@/lib/orders';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

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
  const payload = JSON.parse(raw);
  const messages = payload?.entry?.flatMap((entry: any) => entry.changes?.flatMap((change: any) => change.value?.messages ?? []) ?? []) ?? [];
  for (const message of messages) {
    const phone = normalizePhone(message.from ?? '');
    const text = extractText(message).trim();
    if (!phone || !text) continue;
    const eventId = message.id ?? `${phone}:${message.timestamp}:${text}`;
    const existing = await prisma.webhookEvent.findFirst({ where: { source: 'whatsapp', eventType: eventId } });
    if (existing) continue;
    await prisma.webhookEvent.create({ data: { source: 'whatsapp', eventType: eventId, payload: message, processed: false } });
    const conversation = await prisma.conversation.findFirst({ where: { phone: { contains: phone } } });
    const reply = /status|where|order|tracking|حالة|طلب|فين|أين/i.test(text)
      ? await findCustomerOrder(text.match(/ORD[- ]?\d+/i)?.[0]?.replace(' ', '-'), phone).then(order => order ? statusReply(order) : 'We could not find an active order for this WhatsApp number. Please send your order reference, for example ORD-123456.')
      : 'To check your order status, send “status” or your order reference (for example ORD-123456).';
    if (conversation) await prisma.message.create({ data: { conversationId: conversation.id, sender: 'customer', text, time: nowTime(), type: 'whatsapp' } });
    await sendWhatsApp(phone, reply);
    if (conversation) await prisma.message.create({ data: { conversationId: conversation.id, sender: 'bot', text: reply, time: nowTime(), type: 'status_reply' } });
    await prisma.webhookEvent.updateMany({ where: { source: 'whatsapp', eventType: eventId }, data: { processed: true } });
  }
  return NextResponse.json({ received: true });
}
