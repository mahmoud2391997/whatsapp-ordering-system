import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();

  const { orderId, amount, currency = 'SAR', paymentMethod, customerEmail, customerName, customerPhone } = body;

  if (!orderId || !amount || !paymentMethod) {
    return NextResponse.json(
      { error: 'orderId, amount, and paymentMethod are required' },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  let endpoint = '';
  if (paymentMethod === 'geidea') {
    endpoint = `${supabaseUrl}/functions/v1/create-geidea-session`;
  } else if (paymentMethod === 'tamara') {
    endpoint = `${supabaseUrl}/functions/v1/create-tamara-order`;
  } else if (paymentMethod === 'hyperpay') {
    endpoint = `${supabaseUrl}/functions/v1/create-payment`;
  } else {
    return NextResponse.json(
      { error: 'Invalid payment method. Use: geidea, tamara, or hyperpay' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ orderId, amount, currency, customerEmail, customerName, customerPhone }),
    });

    const responseText = await response.text();

    let data;
    try { data = JSON.parse(responseText); } catch { data = { error: responseText }; }

    if (!response.ok) {
      if (data.error && (data.error.includes('Key length is zero') || data.error.includes('merchant') || data.error.includes('password') || data.details?.message === 'Invalid credentials')) {
        return NextResponse.json({ error: 'Payment gateway credentials not configured. Please configure real payment gateway credentials or use Cash on Delivery.' }, { status: 500 });
      }
      return NextResponse.json({ error: 'Payment session creation failed', details: data }, { status: response.status });
    }

    let redirectUrl = null;
    let checkoutId = null;
    if (paymentMethod === 'geidea' && data.paymentUrl) {
      redirectUrl = data.paymentUrl;
    } else if (paymentMethod === 'tamara' && data.checkoutUrl) {
      redirectUrl = data.checkoutUrl;
    } else if (paymentMethod === 'hyperpay') {
      checkoutId = data.checkoutId;
    }

    return NextResponse.json({
      success: true, redirectUrl, checkoutId, paymentMethod,
      sessionId: data.sessionId || data.tamaraOrderId || data.checkoutId,
    });
  } catch (error) {
    console.error('Payment redirect error:', error);
    return NextResponse.json({ error: 'Failed to create payment session' }, { status: 500 });
  }
}
