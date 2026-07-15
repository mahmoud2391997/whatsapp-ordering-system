import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { PaymentMethod } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface CartItem {
  product_id: string;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
}

interface CheckoutBody {
  customerId: string;
  customerName: string;
  phone: string;
  items: CartItem[];
  total: number;
  customerType?: string;
  location?: string;
  paymentMethod?: PaymentMethod;
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body: CheckoutBody = await req.json().catch(() => null);

  if (!body || !body.customerId || !body.items?.length) {
    return NextResponse.json(
      { error: 'customerId and items are required' },
      { status: 400 },
    );
  }

  // Fetch the menu page to get customer info
  const { data: menuPage, error: pageError } = await supabase
    .from('menu_pages')
    .select('*')
    .eq('id', body.customerId)
    .maybeSingle();

  if (pageError || !menuPage) {
    return NextResponse.json(
      { error: 'Menu page not found for this customer ID' },
      { status: 404 },
    );
  }

  // Create the order
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  let paymentStatus: string;
  switch (body.paymentMethod) {
    case 'geidea':
      paymentStatus = 'geidea_pending';
      break;
    case 'tamara':
      paymentStatus = 'tamara_pending';
      break;
    case 'online':
      paymentStatus = 'unpaid';
      break;
    default:
      paymentStatus = 'cod';
  }

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    customer_name: body.customerName,
    customer_type: body.customerType,
    total: body.total,
    status: 'pending',
    payment_status: paymentStatus,
    location: body.location ?? null,
  });

  if (orderError) {
    return NextResponse.json({ error: orderError.message }, { status: 500 });
  }

  // Create order items
  const orderItems = body.items.map(item => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    qty: item.qty,
    unit: item.unit,
    unit_price: item.unit_price,
  }));

  const { error: itemsError } = await supabase.from('order_items').insert(orderItems);

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Upsert customer
  const { data: existingCustomer } = await supabase
    .from('customers')
    .select('id')
    .eq('phone', body.phone)
    .maybeSingle();

  if (!existingCustomer) {
    await supabase.from('customers').insert({
      name: body.customerName,
      phone: body.phone,
      type: body.customerType,
      location: body.location ?? null,
    });
  } else {
    await supabase.rpc('increment_customer_orders', { customer_phone: body.phone });
  }

  // Upsert conversation and link the order
  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone', body.phone)
    .maybeSingle();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
    await supabase.from('conversations')
      .update({ order_id: orderId, status: 'active', last_activity: now })
      .eq('id', conversationId);
  } else {
    const { data: newConv } = await supabase.from('conversations').insert({
      customer_name: body.customerName,
      phone: body.phone,
    customer_type: body.customerType,
      status: 'active',
      order_id: orderId,
      last_activity: now,
    }).select('id').single();
    conversationId = newConv!.id;
  }

  // Build the WhatsApp order message
  const itemsText = body.items.map((item, i) =>
    `${i + 1}. ${item.product_name} — ${item.qty} ${item.unit} × ${item.unit_price} = ${(item.qty * item.unit_price).toFixed(2)} EGP`
  ).join('\n');

  const paymentLabel = body.paymentMethod === 'geidea' ? 'Geidea Online Payment'
    : body.paymentMethod === 'tamara' ? 'Tamara (Pay in Instalments)'
    : body.paymentMethod === 'online' ? 'Online (HyperPay)'
    : 'Cash on Delivery';

  const orderMessage = `🧾 *New Order from Menu*\n\n` +
    `Order ID: ${orderId}\n` +
    `Customer: ${body.customerName}\n` +
    `Type: ${body.customerType}\n` +
    `Phone: ${body.phone}\n` +
    (body.location ? `Location: ${body.location}\n` : '') +
    `Payment: ${paymentLabel}\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `*Total: ${body.total.toFixed(2)} EGP*`;

  // Store the order message in the conversation
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender: 'bot',
    text: orderMessage,
    time: now,
    type: 'order',
  });

  // Send the order confirmation to the customer's WhatsApp via edge function
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  let whatsappSent = false;
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: body.phone,
        text: `شكراً لطلبك! 🌿\nرقم الطلب: ${orderId}\nالمجموع: ${body.total.toFixed(2)} EGP\n\nسنتواصل معك قريباً لتأكيد الطلب والتوصيل.`,
      }),
    });
    whatsappSent = res.ok;
  } catch { /* non-blocking */ }

  // Create payment session for Geidea or Tamara
  let paymentSession: { sessionId?: string; checkoutUrl?: string; provider?: string } | null = null;

  if (body.paymentMethod === 'geidea') {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/create-geidea-session`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount: body.total,
          currency: 'SAR',
          customerEmail: '',
          customerName: body.customerName,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        paymentSession = { sessionId: data.sessionId, checkoutUrl: data.paymentUrl, provider: 'geidea' };
      }
    } catch { /* non-blocking */ }
  } else if (body.paymentMethod === 'tamara') {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/create-tamara-order`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          amount: body.total,
          currency: 'SAR',
          customerEmail: '',
          customerName: body.customerName,
          customerPhone: body.phone,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        paymentSession = { sessionId: data.tamaraOrderId, checkoutUrl: data.checkoutUrl, provider: 'tamara' };
      }
    } catch { /* non-blocking */ }
  }

  return NextResponse.json({
    success: true,
    orderId,
    conversationId,
    whatsappSent,
    whatsappLink: `https://wa.me/${body.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(orderMessage)}`,
    paymentSession,
  });
}
