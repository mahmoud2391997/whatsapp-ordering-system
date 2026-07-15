import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { sendWhatsApp, nowTime } from '@/lib/whatsapp';
import type { OrderItem } from '@/lib/types';

export const dynamic = 'force-dynamic';

async function loadOrder(supabase: ReturnType<typeof createServerClient>, id: string) {
  const { data: order } = await supabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (!order) return null;

  const { data: items } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', id);

  return { ...order, order_items: (items ?? []) as OrderItem[] };
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const order = await loadOrder(supabase, params.id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }
  return NextResponse.json({ order });
}

// Confirm (or otherwise update) an order and notify the customer in their conversation.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => ({}));
  const status = body?.status ?? 'confirmed';

  const order = await loadOrder(supabase, params.id);
  if (!order) {
    return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', order.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  // Find the conversation to notify: explicit id, else the one linked to this order.
  let conversation = null;
  if (body?.conversationId) {
    const { data } = await supabase.from('conversations').select('*').eq('id', body.conversationId).maybeSingle();
    conversation = data;
  } else {
    const { data } = await supabase.from('conversations').select('*').eq('order_id', order.id).maybeSingle();
    conversation = data;
  }

  const time = nowTime();
  const itemsText = (order.order_items ?? [])
    .map((it: OrderItem, i: number) => `${i + 1}. ${it.product_name} — ${it.qty} ${it.unit} × ${it.unit_price} EGP`)
    .join('\n');

  const confirmMessage = `✅ *Order Confirmed*\n\n` +
    `Order ID: ${order.id}\n` +
    (itemsText ? `\n*Items:*\n${itemsText}\n` : '') +
    `\n*Total: ${Number(order.total).toFixed(2)} EGP*\n\n` +
    `شكراً لك! تم تأكيد طلبك وسنبدأ في تجهيزه. 🌿`;

  let whatsappSent = false;
  if (conversation) {
    await supabase.from('messages').insert({
      conversation_id: conversation.id,
      sender: 'bot',
      text: confirmMessage,
      time,
      type: 'order',
    });
    await supabase.from('conversations')
      .update({ order_id: order.id, last_activity: time, status: 'active' })
      .eq('id', conversation.id);
    whatsappSent = await sendWhatsApp(conversation.phone, confirmMessage);
  }

  return NextResponse.json({
    order: { ...order, status },
    conversationId: conversation?.id ?? null,
    confirmMessage,
    whatsappSent,
  });
}
