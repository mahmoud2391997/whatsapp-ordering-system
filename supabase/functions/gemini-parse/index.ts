import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

// Greeting / classification / flow keywords
const GREETING_PATTERNS = /^(مرحبا|السلام|اهلا|هلو|hello|hi|مرحب|مساء|صباح)/i;
const RETAIL_PATTERNS = /لنفسي|شخصي|فردي|retail|myself|personal/i;
const SHOP_PATTERNS = /محل|متجر|دكان|shop|store/i;
const RESTAURANT_PATTERNS = /مطعم|restaurant|كافيه|café|cafe/i;
const CONFIRM_PATTERNS = /نعم|اكد|تأكيد|confirm|yes|موافق|اوكي|ok/i;
const COD_PATTERNS = /استلام|cod|كاش|نقد|cash/i;
const ONLINE_PATTERNS = /إلكتروني|online|بطاقة|card|transfer/i;

interface ParsedOrder {
  items: Array<{ name: string; qty: number; unit: string; price: number }>;
  total: number;
  location?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message, customerType = "retail", conversationId, phone } = await req.json();

    if (!message) {
      return new Response(
        JSON.stringify({ error: "message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch conversation history for context
    const { data: recentMessages } = await supabase
      .from("messages")
      .select("sender, text")
      .eq("conversation_id", conversationId)
      .order("time", { ascending: false })
      .limit(6);

    const history = (recentMessages ?? []).reverse();
    const messageCount = history.length;

    // ── Flow-based rule engine (fast path before calling Gemini) ──
    if (messageCount <= 1 || GREETING_PATTERNS.test(message)) {
      return json({
        reply: "وعليكم السلام! اهلاً بك في متجر الخضروات والفواكه الطازجة 🌿\nهل تطلب لنفسك أم لمحل تجاري أم لمطعم؟",
        intent: "greeting",
        orderData: null,
      });
    }

    if (messageCount === 2) {
      let detectedType = customerType;
      let reply = "";
      if (RETAIL_PATTERNS.test(message)) {
        detectedType = "retail";
        reply = "ممتاز! سعيد بخدمتك. هل يمكنك مشاركتي موقعك للتوصيل؟";
      } else if (SHOP_PATTERNS.test(message)) {
        detectedType = "shop";
        reply = "رائع! ستحصل على أسعار الجملة الخاصة بالمحلات. أرسل لنا موقعك للتوصيل.";
      } else if (RESTAURANT_PATTERNS.test(message)) {
        detectedType = "restaurant";
        reply = "ممتاز! ستحصل على أفضل أسعار الجملة للمطاعم. أرسل لنا موقعك.";
      } else {
        reply = "عذراً، هل أنت عميل فردي أم تطلب لمحل أم لمطعم؟";
      }
      if (detectedType !== customerType) {
        await supabase.from("conversations").update({ customer_type: detectedType }).eq("id", conversationId);
      }
      return json({ reply, intent: "classification", orderData: null });
    }

    // ── Call Google Gemini for NLP order parsing ──
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) {
      return json({
        reply: "تم استلام طلبك. سنتواصل معك قريباً.",
        intent: "fallback",
        orderData: null,
      });
    }

    // Fetch products for context
    const { data: products } = await supabase
      .from("products")
      .select("name, name_ar, unit, retail_price, shop_price, wholesale_price")
      .order("category");

    const productContext = (products ?? [])
      .map(p => `${p.name} (${p.name_ar}): retail=${p.retail_price}, shop=${p.shop_price}, restaurant=${p.wholesale_price} per ${p.unit}`)
      .join("\n");

    const priceKey = customerType === "shop" ? "shop_price" : customerType === "restaurant" ? "wholesale_price" : "retail_price";

    const conversationContext = history
      .map(m => `${m.sender === "bot" ? "Bot" : "Customer"}: ${m.text}`)
      .join("\n");

    const prompt = `You are an AI assistant for a fresh vegetables & fruits WhatsApp ordering system.

Available products and prices:
${productContext}

Customer type: ${customerType} (use ${priceKey} pricing)

Conversation so far:
${conversationContext}

Customer latest message: "${message}"

Your tasks:
1. Determine the intent: greeting | classification | location | order | confirm | payment_choice | other
2. If the message contains a product order (in Arabic or English), extract:
   - items: array of {name, qty, unit, price} using the correct price tier
   - total: sum of all items
   - location: if mentioned
3. Generate a helpful Arabic reply that matches the conversation flow.
4. If it's a confirmation and there's an existing order being discussed, acknowledge.
5. If payment is being chosen: COD → acknowledge cash on delivery; online → send mock payment link.

Respond ONLY with valid JSON (no markdown):
{
  "intent": "order",
  "reply": "Arabic bot reply here",
  "orderData": {
    "items": [{"name": "Tomatoes", "qty": 5, "unit": "kg", "price": 8}],
    "total": 40,
    "location": "Riyadh"
  }
}
If no order, set "orderData": null.`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 1024,
            responseMimeType: "application/json",
          },
        }),
      },
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      await supabase.from("system_logs").insert({
        level: "error",
        service: "gemini-parse",
        message: `Gemini API error: ${geminiRes.status}`,
        metadata: { error: errText },
      });
      return json({
        reply: "شكراً لطلبك! سيتواصل معك فريقنا خلال دقائق.",
        intent: "fallback",
        orderData: null,
      });
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let parsed: { intent?: string; reply?: string; orderData?: ParsedOrder | null } = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { intent: "other", reply: rawText, orderData: null };
    }

    await supabase.from("system_logs").insert({
      level: "info",
      service: "gemini-parse",
      message: `Parsed intent: ${parsed.intent}`,
      metadata: { message, customerType, hasOrder: !!parsed.orderData },
    });

    return json({
      reply: parsed.reply ?? "شكراً! سنتواصل معك قريباً.",
      intent: parsed.intent ?? "other",
      orderData: parsed.orderData ?? null,
    });

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "gemini-parse",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
