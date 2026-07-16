import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { CustomerType } from '@/lib/types';

export const dynamic = 'force-dynamic';

const GREETING_PATTERNS = /^(مرحبا|السلام|اهلا|هلو|hello|hi|مرحب|مساء|صباح)/i;
const RETAIL_PATTERNS = /لنفسي|شخصي|فردي|retail|myself|personal/i;
const SHOP_PATTERNS = /محل|متجر|دكان|shop|store/i;
const RESTAURANT_PATTERNS = /مطعم|restaurant|كافيه|café|cafe/i;
const CONFIRM_PATTERNS = /نعم|اكد|تأكيد|confirm|yes|موافق|اوكي|ok/i;
const COD_PATTERNS = /استلام|cod|كاش|نقد|cash/i;
const ONLINE_PATTERNS = /إلكتروني|online|بطاقة|card|transfer/i;

interface ChatMessage {
  role: 'customer' | 'bot';
  text: string;
}

interface ParsedOrder {
  items: Array<{ name: string; qty: number; unit: string; price: number }>;
  total: number;
  location?: string;
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => null);

  if (!body?.message) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const message: string = body.message;
  const history: ChatMessage[] = body.history ?? [];
  const customerType: CustomerType = body.customerType ?? 'retail';

  const messageCount = history.length;

  // ── Greeting ──
  if (messageCount <= 1 && GREETING_PATTERNS.test(message)) {
    return NextResponse.json({
      reply: 'وعليكم السلام! اهلاً بك في متجر الخضروات والفواكه الطازجة 🌿\nهل تطلب لنفسك أم لمحل تجاري أم لمطعم؟',
      intent: 'greeting',
      orderData: null,
    });
  }

  // ── Classification ──
  if (messageCount === 2) {
    let detectedType = customerType;
    let reply = '';

    if (RETAIL_PATTERNS.test(message)) {
      detectedType = 'retail';
      reply = 'ممتاز! سعيد بخدمتك. هل يمكنك مشاركتي موقعك للتوصيل؟';
    } else if (SHOP_PATTERNS.test(message)) {
      detectedType = 'shop';
      reply = 'رائع! ستحصل على أسعار الجملة الخاصة بالمحلات. أرسل لنا موقعك للتوصيل.';
    } else if (RESTAURANT_PATTERNS.test(message)) {
      detectedType = 'restaurant';
      reply = 'ممتاز! ستحصل على أفضل أسعار الجملة للمطاعم. أرسل لنا موقعك.';
    } else {
      reply = 'عذراً، هل أنت عميل فردي أم تطلب لمحل أم لمطعم؟';
    }

    return NextResponse.json({ reply, intent: 'classification', orderData: null, customerType: detectedType });
  }

  // ── Confirm ──
  if (CONFIRM_PATTERNS.test(message) && messageCount > 2) {
    return NextResponse.json({
      reply: 'تم تأكيد طلبك! سنبدأ بتجهيزه فوراً. شكراً لك 🙏',
      intent: 'confirm',
      orderData: null,
    });
  }

  // ── Payment choice ──
  if (COD_PATTERNS.test(message)) {
    return NextResponse.json({
      reply: 'ممتاز، الدفع عند الاستلام. تم تسجيل طلبك وسنتواصل معك لتأكيد التفاصيل ✅',
      intent: 'payment_choice',
      orderData: null,
    });
  }

  if (ONLINE_PATTERNS.test(message)) {
    return NextResponse.json({
      reply: '链接 الدفع الإلكتروني:\nhttps://pay.example.com/order/12345\n\nيرجى إتمام الدفع وسنؤكد طلبك فوراً ✅',
      intent: 'payment_choice',
      orderData: null,
    });
  }

  // ── Try to parse an order from the message ──
  const { data: products } = await supabase
    .from('products')
    .select('name, name_ar, unit, retail_price, shop_price, wholesale_price')
    .order('category');

  const priceKey = customerType === 'shop' ? 'shop_price' : customerType === 'restaurant' ? 'wholesale_price' : 'retail_price';

  const orderData = parseOrderFromText(message, products ?? [], priceKey);

  if (orderData) {
    const itemsList = orderData.items.map(i => `• ${i.name} × ${i.qty} ${i.unit} = ${i.price * i.qty} EGP`).join('\n');
    return NextResponse.json({
      reply: `تم استلام طلبك! 🛒\n\n${itemsList}\n\nالمجموع: ${orderData.total} EGP${orderData.location ? `\nالموقع: ${orderData.location}` : ''}\n\nهل تريد تأكيد الطلب؟ (نعم/لا)`,
      intent: 'order',
      orderData,
    });
  }

  // ── Location detection ──
  if (/موقع|location|address|عنوان|العنوان|city|مدينة/i.test(message)) {
    const location = message.replace(/.*(موقع|location|address|عنوان|العنوان|city|مدينة)\s*[:：]?\s*/i, '').trim() || message.trim();
    return NextResponse.json({
      reply: `تم استلام موقعك: ${location}\n\nيمكنك تصفح المنتجات من القائمة:\n📱 /menu\n\nأو أرسل لنا طلبك مباشرة مثل: "5 كيلو طماطم"`,
      intent: 'location',
      orderData: { items: [], total: 0, location },
    });
  }

  // ── Browse products ──
  if (/استعراض|عرض|منيو|menu|products|المنتجات|القائمة|القايمة|بدي اشوف|ابي اشوف|اريد استعراض|browse|قائمة|قايمة/i.test(message)) {
    const menuUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL ? '' : ''}/menu`;
    return NextResponse.json({
      reply: `🛒 اختر المنتجات المطلوبة من القائمة:\n\nيمكنك تصفح جميع المنتجات و الأسعار من خلال الرابط التالي:\n\n📱 افتح القائمة:\n/menu\n\nأو اكتب طلبك مباشرة مثل: "5 كيلو طماطم"`,
      intent: 'menu_link',
      orderData: null,
    });
  }

  // ── Default fallback ──
  return NextResponse.json({
    reply: 'يمكنك تصفح جميع المنتجات والأسعار من القائمة:\n📱 /menu\n\nأو اكتب طلبك مباشرة مثل: "5 كيلو طماطم و 3 كيلو خيار"',
    intent: 'other',
    orderData: null,
  });
}

function parseOrderFromText(text: string, products: Array<{ name: string; name_ar: string; unit: string; retail_price: number; shop_price: number; wholesale_price: number }>, priceKey: string): ParsedOrder | null {
  const items: ParsedOrder['items'] = [];

  const qtyPatterns = [
    /(\d+)\s*(كيلو|كجم|kg|kilo)/i,
    /(\d+)\s*(قطعة|حبة|piece|pcs)/i,
    /(\d+)\s*(حزمة|باقات|bunch)/i,
  ];

  for (const product of products) {
    const nameRegex = new RegExp(`(${product.name}|${product.name_ar})`, 'i');
    if (!nameRegex.test(text)) continue;

    let qty = 1;
    let unit = product.unit;

    for (const pattern of qtyPatterns) {
      const match = text.match(new RegExp(`(\\d+)\\s*.*(${product.name}|${product.name_ar}).*`, 'i')) ??
                    text.match(new RegExp(`(${product.name}|${product.name_ar}).*?(\\d+)`, 'i'));
      if (match) {
        const numMatch = text.match(/(\d+)/);
        if (numMatch) {
          qty = parseInt(numMatch[1]);
          break;
        }
      }
    }

    // Try to extract qty near the product name
    const nearMatch = text.match(new RegExp(`(\\d+)\\s*(?:كيلو|كجم|kg)?\\s*(?:${product.name}|${product.name_ar})|(?:${product.name}|${product.name_ar})\\s*(\\d+)`, 'i'));
    if (nearMatch) {
      qty = parseInt(nearMatch[1] || nearMatch[2]);
    }

    const price = Number(product[priceKey as keyof typeof product]);
    items.push({ name: product.name, qty, unit: product.unit, price });
  }

  if (items.length === 0) return null;

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  return { items, total };
}
