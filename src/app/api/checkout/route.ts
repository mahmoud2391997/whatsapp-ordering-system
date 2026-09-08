import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { isDbActive } from '@/lib/data';
import { sendWhatsApp } from '@/lib/whatsapp';
import { pushOrderToSalla } from '@/lib/salla-sync';
import { createSallaOrder, fetchSallaCatalog } from '@/lib/salla';

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
  checkoutMode?: 'salla' | 'in_app';
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

  if (body.checkoutMode === 'salla') {
    try {
      const catalog = await fetchSallaCatalog();
      const catalogById = new Map(catalog.map((product) => [product.id, product]));
      const verifiedItems = body.items.map((item) => {
        const product = catalogById.get(String(item.product_id));
        const quantity = Number(item.qty);
        if (!product || !product.purchasable || !Number.isFinite(quantity) || quantity <= 0 || quantity > product.stock) {
          throw new Error(`Product unavailable or quantity exceeds stock: ${item.product_name}`);
        }
        return { id: product.id, quantity, price: product.price, name: product.name };
      });
      const verifiedTotal = verifiedItems.reduce((sum, item) => sum + item.quantity * item.price, 0);
      const referenceId = `WEB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
      const result = await createSallaOrder({ referenceId, customerName: body.customerName.trim(), phone: body.phone.trim(), address: body.location.trim(), items: verifiedItems });
      const data = (result.data ?? result) as { id?: string | number; checkout_url?: string; url?: string };
      const checkoutUrl = data.checkout_url ?? data.url;
      return NextResponse.json({ success: true, orderId: String(data.id ?? referenceId), sallaOrderId: String(data.id ?? ''), checkoutUrl, total: verifiedTotal, hostedCheckout: Boolean(checkoutUrl) });
    } catch (error) {
      return NextResponse.json({ error: error instanceof Error ? error.message : 'Salla checkout failed' }, { status: 502 });
    }
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
