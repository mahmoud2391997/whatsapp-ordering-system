import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { CustomerType } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

  // ── Fast path: greeting (no AI needed) ──
  if (messageCount <= 1 && /^(مرحبا|السلام|اهلا|هلو|hello|hi|مرحب|مساء|صباح)/i.test(message)) {
    return NextResponse.json({
      reply: 'وعليكم السلام! اهلاً بك في متجر الخضروات والفواكه الطازجة 🌿\nهل تطلب لنفسك أم لمحل تجاري أم لمطعم؟',
      intent: 'greeting',
      orderData: null,
    });
  }

  // ── Fast path: classification (no AI needed) ──
  if (messageCount === 2) {
    let detectedType = customerType;
    let reply = '';

    if (/لنفسي|شخصي|فردي|retail|myself|personal/i.test(message)) {
      detectedType = 'retail';
      reply = 'ممتاز! سعيد بخدمتك. أرسل لنا موقعك للتوصيل أو تصفح المنتجات من القائمة:\n📱 /menu';
    } else if (/محل|متجر|دكان|shop|store/i.test(message)) {
      detectedType = 'shop';
      reply = 'رائع! ستحصل على أسعار الجملة الخاصة بالمحلات. أرسل لنا موقعك أو تصفح القائمة:\n📱 /menu';
    } else if (/مطعم|restaurant|كافيه|café|cafe/i.test(message)) {
      detectedType = 'restaurant';
      reply = 'ممتاز! ستحصل على أفضل أسعار الجملة للمطاعم. أرسل لنا موقعك أو تصفح القائمة:\n📱 /menu';
    } else {
      reply = 'عذراً، هل أنت عميل فردي أم تطلب لمحل أم لمطعم؟';
    }

    return NextResponse.json({ reply, intent: 'classification', orderData: null, customerType: detectedType });
  }

  // ── Call Mistral AI for everything else ──
  const mistralApiKey = process.env.MISTRAL_API_KEY;

  if (!mistralApiKey) {
    // Fallback to regex if no API key
    return fallbackReply(message, customerType, history);
  }

  // Fetch products for context
  const { data: products } = await supabase
    .from('products')
    .select('name, name_ar, unit, retail_price, shop_price, wholesale_price')
    .order('category');

  const productContext = (products ?? [])
    .map(p => `${p.name} (${p.name_ar}): retail=${p.retail_price}, shop=${p.shop_price}, restaurant=${p.wholesale_price} per ${p.unit}`)
    .join('\n');

  const priceKey = customerType === 'shop' ? 'shop_price' : customerType === 'restaurant' ? 'wholesale_price' : 'retail_price';

  const conversationContext = history
    .map(m => `${m.role === 'bot' ? 'Bot' : 'Customer'}: ${m.text}`)
    .join('\n');

  const prompt = `You are an AI assistant for a fresh vegetables & fruits WhatsApp ordering system.

Available products and prices:
${productContext}

Customer type: ${customerType} (use ${priceKey} pricing)

Conversation so far:
${conversationContext}

Customer latest message: "${message}"

Your tasks:
1. Determine the intent: greeting | classification | location | order | confirm | payment_choice | menu_link | browse | other
2. If the message contains a product order (in Arabic or English), extract:
   - items: array of {name, qty, unit, price} using the correct price tier
   - total: sum of all items
   - location: if mentioned
3. Generate a helpful Arabic reply that matches the conversation flow.
4. If it's a confirmation and there's an existing order being discussed, acknowledge.
5. If payment is being chosen: COD → acknowledge cash on delivery; online → send mock payment link.
6. If the customer wants to browse products or mentions the menu/list, respond with the menu link /menu.
7. If the customer sends what looks like an address (street, building, district, city), treat it as a location.

Respond ONLY with valid JSON (no markdown, no code blocks):
{
  "intent": "order",
  "reply": "Arabic bot reply here",
  "orderData": {
    "items": [{"name": "Tomato", "qty": 5, "unit": "kg", "price": 15}],
    "total": 75,
    "location": "Riyadh"
  }
}
If no order, set "orderData": null.
Always include a clickable menu link /menu in your reply when relevant.`;

  try {
    const mistralRes = await fetch('https://api.mistral.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${mistralApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          {
            role: 'system',
            content: 'You are an AI assistant for a fresh vegetables & fruits WhatsApp ordering system. Always respond with valid JSON only, no markdown formatting. Reply in Arabic.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
        response_format: { type: 'json_object' },
      }),
    });

    if (!mistralRes.ok) {
      console.error('Mistral API error:', mistralRes.status);
      return fallbackReply(message, customerType, history);
    }

    const mistralData = await mistralRes.json();
    const rawText = mistralData?.choices?.[0]?.message?.content ?? '{}';

    let parsed: { intent?: string; reply?: string; orderData?: ParsedOrder | null } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { intent: 'other', reply: rawText, orderData: null };
    }

    return NextResponse.json({
      reply: parsed.reply ?? 'شكراً! سنتواصل معك قريباً.',
      intent: parsed.intent ?? 'other',
      orderData: parsed.orderData ?? null,
    });
  } catch (err) {
    console.error('Mistral call failed:', err);
    return fallbackReply(message, customerType, history);
  }
}

// Regex fallback when Mistral is unavailable
function fallbackReply(message: string, customerType: CustomerType, history: ChatMessage[]) {
  if (/نعم|اكد|تأكيد|confirm|yes|موافق|اوكي|ok/i.test(message) && history.length > 2) {
    return NextResponse.json({
      reply: 'تم تأكيد طلبك! سنبدأ بتجهيزه فوراً. شكراً لك 🙏',
      intent: 'confirm',
      orderData: null,
    });
  }

  if (/استلام|cod|كاش|نقد|cash/i.test(message)) {
    return NextResponse.json({
      reply: 'ممتاز، الدفع عند الاستلام. تم تسجيل طلبك وسنتواصل معك لتأكيد التفاصيل ✅',
      intent: 'payment_choice',
      orderData: null,
    });
  }

  if (/استعراض|عرض|منيو|menu|products|المنتجات|القائمة|القايمة|قائمة|قايمة/i.test(message)) {
    return NextResponse.json({
      reply: '🛒 اختر المنتجات المطلوبة من القائمة:\n\n📱 افتح القائمة:\n/menu\n\nأو اكتب طلبك مباشرة مثل: "5 كيلو طماطم و 3 كيلو خيار"',
      intent: 'menu_link',
      orderData: null,
    });
  }

  // Try basic order parsing
  const orderData = parseOrderFromText(message, customerType);
  if (orderData) {
    const itemsList = orderData.items.map(i => `• ${i.name} × ${i.qty} ${i.unit} = ${(i.price * i.qty).toFixed(2)} EGP`).join('\n');
    return NextResponse.json({
      reply: `تم استلام طلبك! 🛒\n\n${itemsList}\n\nالمجموع: ${orderData.total.toFixed(2)} EGP\n\nهل تريد تأكيد الطلب؟ (نعم/لا)`,
      intent: 'order',
      orderData,
    });
  }

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
