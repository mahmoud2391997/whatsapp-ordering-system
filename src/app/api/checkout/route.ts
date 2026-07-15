import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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
  items: CartItem[];
  total: number;
  customerType: string;
  location?: string;
  paymentMethod?: 'cod' | 'online';
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
  const paymentStatus = body.paymentMethod === 'online' ? 'unpaid' : 'cod';

  const { error: orderError } = await supabase.from('orders').insert({
    id: orderId,
    customer_name: menuPage.customer_name,
    customer_type: body.customerType ?? menuPage.customer_type,
    total: body.total,
    status: 'pending',
    payment_status: paymentStatus,
    location: body.location ?? null,
    menu_page_id: menuPage.id,
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
    .eq('phone', menuPage.phone)
    .maybeSingle();

  if (!existingCustomer) {
    await supabase.from('customers').insert({
      name: menuPage.customer_name,
      phone: menuPage.phone,
      type: body.customerType ?? menuPage.customer_type,
      location: body.location ?? null,
    });
  } else {
    await supabase.rpc('increment_customer_orders', { customer_phone: menuPage.phone });
  }

  // Upsert conversation and link the order
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('phone', menuPage.phone)
    .maybeSingle();

  let conversationId: string;

  if (existingConv) {
    conversationId = existingConv.id;
    await supabase.from('conversations')
      .update({
        order_id: orderId,
        status: 'active',
        last_activity: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
      })
      .eq('id', conversationId);
  } else {
    const { data: newConv } = await supabase.from('conversations').insert({
      customer_name: menuPage.customer_name,
      phone: menuPage.phone,
      customer_type: body.customerType ?? menuPage.customer_type,
      status: 'active',
      order_id: orderId,
      last_activity: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    }).select('id').single();
    conversationId = newConv!.id;
  }

  // Build the WhatsApp order message
  const itemsText = body.items.map((item, i) =>
    `${i + 1}. ${item.product_name} — ${item.qty} ${item.unit} × ${item.unit_price} = ${(item.qty * item.unit_price).toFixed(2)} EGP`
  ).join('\n');

  const orderMessage = `🧾 *New Order from Menu Page*\n\n` +
    `Order ID: ${orderId}\n` +
    `Customer: ${menuPage.customer_name}\n` +
    `Type: ${body.customerType ?? menuPage.customer_type}\n` +
    `Phone: ${menuPage.phone}\n` +
    (body.location ? `Location: ${body.location}\n` : '') +
    `Payment: ${paymentStatus === 'cod' ? 'Cash on Delivery' : 'Online'}\n\n` +
    `*Items:*\n${itemsText}\n\n` +
    `*Total: ${body.total.toFixed(2)} EGP*`;

  // Store the order message in the conversation
  await supabase.from('messages').insert({
    conversation_id: conversationId,
    sender: 'bot',
    text: orderMessage,
    time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }),
    type: 'order',
  });

  // Send the order to the store's WhatsApp via edge function
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
        to: menuPage.phone,
        text: `شكراً لطلبك! 🌿\nرقم الطلب: ${orderId}\nالمجموع: ${body.total.toFixed(2)} EGP\n\nسنتواصل معك قريباً لتأكيد الطلب والتوصيل.`,
      }),
    });
    whatsappSent = res.ok;
  } catch { /* non-blocking */ }

  return NextResponse.json({
    success: true,
    orderId,
    conversationId,
    whatsappSent,
    whatsappLink: `https://wa.me/${menuPage.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(orderMessage)}`,
  });
}
