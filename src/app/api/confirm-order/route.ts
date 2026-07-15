import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

interface ConfirmOrderBody {
  orderId: string;
  message: string;
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body: ConfirmOrderBody = await req.json().catch(() => null);

  if (!body || !body.orderId || !body.message) {
    return NextResponse.json(
      { error: 'orderId and message are required' },
      { status: 400 },
    );
  }

  try {
    // Fetch the order
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', body.orderId)
      .maybeSingle();

    if (orderError || !order) {
      return NextResponse.json(
        { error: 'Order not found' },
        { status: 404 },
      );
    }

    // Update order status to confirmed
    const { error: updateError } = await supabase
      .from('orders')
      .update({ status: 'confirmed' })
      .eq('id', body.orderId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Get customer phone from conversation
    const { data: conversation } = await supabase
      .from('conversations')
      .select('phone')
      .eq('order_id', body.orderId)
      .maybeSingle();

    if (conversation?.phone) {
      // Send WhatsApp template message for confirmation
      const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID ?? '';
      const WHATSAPP_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN ?? '';

      if (PHONE_NUMBER_ID && WHATSAPP_TOKEN) {
        const formattedPhone = conversation.phone.replace(/[^0-9]/g, '');
        const orderDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });

        // Send template message
        await fetch(`https://graph.facebook.com/v25.0/${PHONE_NUMBER_ID}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'template',
            template: {
              name: 'jaspers_market_order_confirmation_v1',
              language: { code: 'en_US' },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: order.customer_name },
                    { type: 'text', text: body.orderId },
                    { type: 'text', text: orderDate },
                  ],
                },
              ],
            },
          }),
        });
      }

      // Fetch conversation ID to store the message
      const { data: conv } = await supabase
        .from('conversations')
        .select('id')
        .eq('phone', conversation.phone)
        .maybeSingle();

      if (conv?.id) {
        await supabase.from('messages').insert({
          conversation_id: conv.id,
          sender: 'bot',
          text: `Order confirmed! Order ID: ${body.orderId}`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
          type: 'confirmation',
        });
      }
    }

    return NextResponse.json({
      success: true,
      orderId: body.orderId,
      status: 'confirmed',
    });
  } catch (err) {
    console.error('Error confirming order:', err);
    return NextResponse.json(
      { error: 'Failed to confirm order' },
      { status: 500 },
    );
  }
}
