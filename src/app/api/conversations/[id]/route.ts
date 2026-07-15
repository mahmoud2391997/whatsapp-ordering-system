import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => null);

  if (!body || !body.text?.trim()) {
    return NextResponse.json({ error: 'text is required' }, { status: 400 });
  }

  const { data: conversation, error: convError } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', params.id)
    .maybeSingle();

  if (convError || !conversation) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
  }

  const time = nowTime();

  const { data: message, error: msgError } = await supabase
    .from('messages')
    .insert({
      conversation_id: conversation.id,
      sender: 'bot',
      text: body.text.trim(),
      time,
      type: 'text',
    })
    .select('*')
    .single();

  if (msgError) {
    return NextResponse.json({ error: msgError.message }, { status: 500 });
  }

  await supabase.from('conversations')
    .update({ last_activity: time, status: 'active' })
    .eq('id', conversation.id);

  const whatsappSent = await sendWhatsApp(conversation.phone, body.text.trim());

  return NextResponse.json({ message, whatsappSent });
}
