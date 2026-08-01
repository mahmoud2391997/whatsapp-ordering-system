import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  if (!body || !body.text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
  if (!conversation) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });

  const time = nowTime();

  const message = await prisma.message.create({
    data: { conversationId: conversation.id, sender: 'bot', text: body.text.trim(), time, type: 'text' },
  });

  await prisma.conversation.update({ where: { id: conversation.id }, data: { lastActivity: time, status: 'active' } });

  const whatsappSent = await sendWhatsApp(conversation.phone, body.text.trim());

  return NextResponse.json({ message, whatsappSent });
}
