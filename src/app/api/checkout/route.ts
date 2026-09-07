import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isDbActive } from '@/lib/data';
import { sendWhatsApp } from '@/lib/whatsapp';
import { pushOrderToSalla } from '@/lib/salla-sync';

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
  paymentMethod?: string;
  customerConfirmed?: boolean;
}

export async function POST(req: Request) {
  const body: CheckoutBody = await req.json().catch(() => null);

  if (!body || !body.items?.length) {
    return NextResponse.json({ error: 'items are required' }, { status: 400 });
  }
  if (!body.customerName?.trim() || !body.phone?.trim()) {
    return NextResponse.json({ error: 'customerName and phone are required' }, { status: 400 });
  }
  if (!body.location?.trim()) {
    return NextResponse.json({ error: 'Delivery address is required before placing the order' }, { status: 400 });
  }
  if (!body.customerConfirmed) {
    return NextResponse.json({ error: 'Please confirm that all order details are correct' }, { status: 400 });
  }

  const dbActive = await isDbActive();

  // In demo mode (DB down) we cannot validate menu pages or persist the order,
  // so we simulate a successful checkout instead.
  if (!dbActive) {
    return simulateCheckout(body);
  }

  let menuPageId: string | null = null;
  if (body.customerId) {
    const menuPage = await prisma.menuPage.findUnique({ where: { id: body.customerId } });
    if (!menuPage) {
      return NextResponse.json({ error: 'Menu page not found for this customer ID' }, { status: 404 });
    }
    menuPageId = menuPage.id;
  }

  const orderId = `ORD-${Date.now().toString().slice(-6)}`;
  let paymentStatus: string;
  switch (body.paymentMethod) {
    case 'geidea': paymentStatus = 'pending'; break;
    case 'tamara': paymentStatus = 'pending'; break;
    case 'online': paymentStatus = 'unpaid'; break;
    default: paymentStatus = 'cod';
  }

  await prisma.order.create({
    data: {
      id: orderId,
      customerName: body.customerName,
      customerPhone: body.phone.replace(/[^0-9]/g, ''),
      customerType: body.customerType ?? 'retail',
      paymentMethod: body.paymentMethod ?? 'cod',
      total: body.total,
      status: 'pending',
      paymentStatus,
      location: body.location ?? null,
      menuPageId,
    },
  });

  await prisma.orderItem.createMany({
    data: body.items.map(item => ({
      orderId,
      productId: item.product_id,
      productName: item.product_name,
      qty: item.qty,
      unit: item.unit,
      unitPrice: item.unit_price,
    })),
  });

  const existingCustomer = await prisma.customer.findUnique({ where: { phone: body.phone } });
  if (!existingCustomer) {
    await prisma.customer.create({
      data: { name: body.customerName, phone: body.phone, type: body.customerType ?? 'retail', location: body.location ?? null },
    });
  } else {
    await prisma.customer.update({ where: { phone: body.phone }, data: { totalOrders: { increment: 1 } } });
  }

  const now = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const existingConv = await prisma.conversation.findFirst({ where: { phone: body.phone } });

  let conversationId: string;
  if (existingConv) {
    conversationId = existingConv.id;
    await prisma.conversation.update({
      where: { id: conversationId },
      data: { orderId, status: 'active', lastActivity: now },
    });
  } else {
    const conv = await prisma.conversation.create({
      data: { customerName: body.customerName, phone: body.phone, customerType: body.customerType ?? 'retail', status: 'active', orderId, lastActivity: now },
    });
    conversationId = conv.id;
  }

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
    `*Total: ${body.total.toFixed(2)} EGP*\n\n` +
    `Customer confirmed all order details ✅`;

  await prisma.message.create({
    data: { conversationId, sender: 'bot', text: orderMessage, time: now, type: 'order' },
  });

  void pushOrderToSalla(orderId).catch(async (error) => {
    await prisma.order.update({ where: { id: orderId }, data: { sallaSyncStatus: 'failed', sallaSyncError: error instanceof Error ? error.message : 'Salla push failed' } }).catch(() => undefined);
  });

  let whatsappSent = false;
  try {
    whatsappSent = await sendWhatsApp(body.phone, `شكراً لطلبك! 🌿\nرقم الطلب: ${orderId}\nالمجموع: ${body.total.toFixed(2)} EGP\n\nسنتواصل معك قريباً لتأكيد الطلب والتوصيل.`);
  } catch { /* non-blocking */ }

  // Payment sessions for Geidea/Tamara (HyperPay handled by separate flow)
  let paymentSession: { sessionId?: string; checkoutUrl?: string; provider?: string } | null = null;

  if (body.paymentMethod === 'geidea') {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const res = await fetch(`${supabaseUrl}/functions/v1/create-geidea-session`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: body.total, currency: 'SAR', customerEmail: '', customerName: body.customerName }),
      });
      if (res.ok) {
        const data = await res.json();
        paymentSession = { sessionId: data.sessionId, checkoutUrl: data.paymentUrl, provider: 'geidea' };
      }
    } catch { /* non-blocking */ }
  } else if (body.paymentMethod === 'tamara') {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
      const res = await fetch(`${supabaseUrl}/functions/v1/create-tamara-order`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, amount: body.total, currency: 'SAR', customerEmail: '', customerName: body.customerName, customerPhone: body.phone }),
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

function simulateCheckout(body: CheckoutBody) {
  const orderId = `ORD-${Date.now().toString().slice(-6)}`;

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
    `*Total: ${body.total.toFixed(2)} EGP*\n\n` +
    `Customer confirmed all order details ✅`;

  return NextResponse.json({
    success: true,
    orderId,
    conversationId: null,
    whatsappSent: false,
    whatsappLink: `https://wa.me/${body.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(orderMessage)}`,
    paymentSession: null,
    demo: true,
  });
}
