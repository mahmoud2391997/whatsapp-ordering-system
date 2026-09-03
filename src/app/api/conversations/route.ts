import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body || !body.customerName || !body.phone) {
    return NextResponse.json({ error: 'customerName and phone are required' }, { status: 400 });
  }

  const customerType = body.customerType ?? 'retail';
  const time = nowTime();

  try {
    let conversation = await prisma.conversation.findFirst({ where: { phone: body.phone } });
    let created = false;

    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: { customerName: body.customerName, phone: body.phone, customerType, status: 'active', lastActivity: time },
      });
      created = true;
    }

    let whatsappSent = false;
    if (body.message) {
      await prisma.message.create({ data: { conversationId: conversation.id, sender: 'bot', text: body.message, time, type: 'text' } });
      await prisma.conversation.update({ where: { id: conversation.id }, data: { lastActivity: time, status: 'active' } });
      whatsappSent = await sendWhatsApp(body.phone, body.message);
    }

    return NextResponse.json({ conversation, whatsappSent, created });
  } catch (error) {
    console.error('Failed to create conversation:', error);
    return NextResponse.json(
      { error: 'Database unavailable. Connect Supabase before creating conversations.' },
      { status: 503 },
    );
  }
}
