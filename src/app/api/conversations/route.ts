import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => null);

  if (!body || !body.customerName || !body.phone) {
    return NextResponse.json(
      { error: 'customerName and phone are required' },
      { status: 400 },
    );
  }

  const customerType = body.customerType ?? 'retail';
  const time = nowTime();

  // Reuse an existing conversation for this phone if there is one
  const { data: existing } = await supabase
    .from('conversations')
    .select('*')
    .eq('phone', body.phone)
    .maybeSingle();

  let conversation = existing;

  if (!conversation) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        customer_name: body.customerName,
        phone: body.phone,
        customer_type: customerType,
        status: 'active',
        last_activity: time,
      })
      .select('*')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    conversation = data;
  }

  let whatsappSent = false;
  if (body.message) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'bot',
      text: body.message,
      time,
      type: 'text',
    });
    await supabase.from('conversations')
      .update({ last_activity: time, status: 'active' })
      .eq('id', conversation.id);
    whatsappSent = await sendWhatsApp(body.phone, body.message);
  }

  return NextResponse.json({ conversation, whatsappSent, created: !existing });
}
