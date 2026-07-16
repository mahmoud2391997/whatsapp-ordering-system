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
const ADDRESS_PATTERNS = /شارع|طريق|شارع|حى|حي|منطقة|بلك|بلوك|عمار|مبنى|دور|شقة|فيلا|مدينة|القاهرة|الرياض|جدة|الدمام|محافظة|جمهورية|مصر|الكويت|الإمارات|دبي|ابو ظبي|شارع|تقاطع|قطع/i;

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
      reply = 'ممتاز! سعيد بخدمتك. أرسل لنا موقعك للتوصيل أو تصفح المنتجات من القائمة:\n📱 /menu';
    } else if (SHOP_PATTERNS.test(message)) {
      detectedType = 'shop';
      reply = 'رائع! ستحصل على أسعار الجملة الخاصة بالمحلات. أرسل لنا موقعك أو تصفح القائمة:\n📱 /menu';
    } else if (RESTAURANT_PATTERNS.test(message)) {
      detectedType = 'restaurant';
      reply = 'ممتاز! ستحصل على أفضل أسعار الجملة للمطاعم. أرسل لنا موقعك أو تصفح القائمة:\n📱 /menu';
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
      reply: ' الدفع الإلكتروني:\nhttps://pay.example.com/order/12345\n\nيرجى إتمام الدفع وسنؤكد طلبك فوراً ✅',
      intent: 'payment_choice',
      orderData: null,
    });
  }

  // ── Location detection (keyword prefix OR looks like an address) ──
  if (/^(موقع|location|address|عنوان|العنوان|city|مدينة)\s*[:：]?\s*/i.test(message)) {
    const location = message.replace(/^(موقع|location|address|عنوان|العنوان|city|مدينة)\s*[:：]?\s*/i, '').trim();
    return NextResponse.json({
      reply: `تم استلام موقعك: ${location}\n\nيمكنك تصفح المنتجات من القائمة:\n📱 /menu\n\nأو أرسل لنا طلبك مباشرة مثل: "5 كيلو طماطم"`,
      intent: 'location',
      orderData: { items: [], total: 0, location },
    });
  }

  // Plain address without keyword (after being asked for location)
  const lastBotMsg = [...history].reverse().find(m => m.role === 'bot')?.text ?? '';
  const askedForLocation = /موقعك|التوصيل|location/i.test(lastBotMsg);
  if (askedForLocation && ADDRESS_PATTERNS.test(message)) {
    return NextResponse.json({
      reply: `تم استلام موقعك: ${message.trim()}\n\nيمكنك تصفح المنتجات من القائمة:\n📱 /menu\n\nأو أرسل لنا طلبك مباشرة مثل: "5 كيلو طماطم"`,
      intent: 'location',
      orderData: { items: [], total: 0, location: message.trim() },
    });
  }

  // ── Browse products ──
  if (/استعراض|عرض|منيو|menu|products|المنتجات|القائمة|القايمة|بدي اشوف|ابي اشوف|اريد استعراض|browse|قائمة|قايمة/i.test(message)) {
    return NextResponse.json({
      reply: '🛒 اختر المنتجات المطلوبة من القائمة:\n\n📱 افتح القائمة:\n/menu\n\nأو اكتب طلبك مباشرة مثل: "5 كيلو طماطم و 3 كيلو خيار"',
      intent: 'menu_link',
      orderData: null,
    });
  }

  // ── Try to parse an order from the message ──
  const orderData = parseOrderFromText(message, customerType);

  if (orderData) {
    const itemsList = orderData.items.map(i => `• ${i.name} × ${i.qty} ${i.unit} = ${(i.price * i.qty).toFixed(2)} EGP`).join('\n');
    return NextResponse.json({
      reply: `تم استلام طلبك! 🛒\n\n${itemsList}\n\nالمجموع: ${orderData.total.toFixed(2)} EGP\n\nهل تريد تأكيد الطلب؟ (نعم/لا)`,
      intent: 'order',
      orderData,
    });
  }

  // ── Default fallback ──
  return NextResponse.json({
    reply: 'يمكنك تصفح جميع المنتجات والأسعار من القائمة:\n📱 /menu\n\nأو اكتب طلبك مباشرة مثل: "5 كيلو طماطم و 3 كيلو خيار"',
    intent: 'other',
    orderData: null,
  });
}

// Hardcoded products with correct prices per customer type
const PRODUCTS: Record<string, { name: string; nameAr: string; unit: string; prices: { retail: number; shop: number; restaurant: number } }> = {
  tomato:    { name: 'Tomato',    nameAr: 'طماطم',      unit: 'kg',     prices: { retail: 15, shop: 12, restaurant: 10 } },
  cucumber:  { name: 'Cucumber',  nameAr: 'خيار',       unit: 'kg',     prices: { retail: 12, shop: 10, restaurant: 8 } },
  potato:    { name: 'Potato',    nameAr: 'بطاطس',      unit: 'kg',     prices: { retail: 10, shop: 8, restaurant: 6 } },
  onion:     { name: 'Onion',     nameAr: 'بصل',        unit: 'kg',     prices: { retail: 1.2, shop: 0.9, restaurant: 0.7 } },
  carrot:    { name: 'Carrot',    nameAr: 'جزر',        unit: 'kg',     prices: { retail: 1.5, shop: 1.2, restaurant: 0.85 } },
  spinach:   { name: 'Spinach',   nameAr: 'سبانخ',      unit: 'kg',     prices: { retail: 2, shop: 1.6, restaurant: 1.25 } },
  broccoli:  { name: 'Broccoli',  nameAr: 'بروكلي',     unit: 'piece',  prices: { retail: 2.75, shop: 2.2, restaurant: 1.7 } },
  lettuce:   { name: 'Lettuce',   nameAr: 'خس',         unit: 'piece',  prices: { retail: 1.5, shop: 1.2, restaurant: 0.9 } },
  pepper:    { name: 'Bell Pepper', nameAr: 'فلفل رومي', unit: 'kg',    prices: { retail: 3.5, shop: 2.8, restaurant: 2.2 } },
  apple:     { name: 'Apple',     nameAr: 'تفاح',       unit: 'kg',     prices: { retail: 35, shop: 30, restaurant: 26 } },
  orange:    { name: 'Orange',    nameAr: 'برتقال',      unit: 'kg',     prices: { retail: 20, shop: 17, restaurant: 14 } },
  banana:    { name: 'Banana',    nameAr: 'موز',         unit: 'kg',     prices: { retail: 25, shop: 22, restaurant: 18 } },
  lemon:     { name: 'Lemon',     nameAr: 'ليمون',       unit: 'kg',     prices: { retail: 2.8, shop: 2.2, restaurant: 1.7 } },
  mint:      { name: 'Mint',      nameAr: 'نعناع',       unit: 'bunch',  prices: { retail: 5, shop: 4, restaurant: 3 } },
  parsley:   { name: 'Parsley',   nameAr: 'بقدونس',      unit: 'bunch',  prices: { retail: 5, shop: 4, restaurant: 3 } },
  basil:     { name: 'Basil',     nameAr: 'ريحان',       unit: 'bunch',  prices: { retail: 1.5, shop: 1.2, restaurant: 0.9 } },
};

function parseOrderFromText(text: string, customerType: CustomerType): ParsedOrder | null {
  const items: ParsedOrder['items'] = [];
  const priceKey = customerType as 'retail' | 'shop' | 'restaurant';

  // Split by و / , / and
  const segments = text.split(/\s*(?:و|,|and|،)\s*/i);

  for (const segment of segments) {
    const numMatch = segment.match(/(\d+)/);
    const qty = numMatch ? parseInt(numMatch[1]) : 1;

    for (const [, product] of Object.entries(PRODUCTS)) {
      const nameRegex = new RegExp(`(${product.name}|${product.nameAr})`, 'i');
      if (!nameRegex.test(segment)) continue;

      const price = product.prices[priceKey];
      items.push({ name: product.name, qty, unit: product.unit, price });
      break;
    }
  }

  if (items.length === 0) return null;

  const total = items.reduce((sum, i) => sum + i.qty * i.price, 0);
  return { items, total };
}
