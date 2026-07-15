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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const VERIFY_TOKEN = Deno.env.get("WHATSAPP_VERIFY_TOKEN")!;
    const WHATSAPP_TOKEN = Deno.env.get("WHATSAPP_ACCESS_TOKEN")!;
    const PHONE_NUMBER_ID = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID")!;

    // ── GET: Meta webhook verification ──
    if (req.method === "GET") {
      const url = new URL(req.url);
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      if (mode === "subscribe" && token === VERIFY_TOKEN) {
        await log("info", "whatsapp-webhook", "Webhook verified by Meta");
        return new Response(challenge, { status: 200, headers: corsHeaders });
      }
      return new Response("Forbidden", { status: 403, headers: corsHeaders });
    }

    // ── POST: Receive incoming message ──
    if (req.method === "POST") {
      const body = await req.json();

      // Log raw webhook event for audit
      await supabase.from("webhook_events").insert({
        source: "whatsapp",
        event_type: body?.entry?.[0]?.changes?.[0]?.value?.messages ? "message" : "status_update",
        payload: body,
        processed: false,
      });

      const entry = body?.entry?.[0];
      const change = entry?.changes?.[0];
      const value = change?.value;

      // Handle status updates (delivered, read) - just mark processed
      if (value?.statuses) {
        await supabase.from("webhook_events")
          .update({ processed: true })
          .eq("source", "whatsapp")
          .eq("processed", false);
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const messages = value?.messages;
      if (!messages?.length) {
        return new Response("OK", { status: 200, headers: corsHeaders });
      }

      const msg = messages[0];
      const from = msg.from; // customer phone number
      const messageText = msg.text?.body ?? "";
      const messageType = msg.type ?? "text";
      const contact = value?.contacts?.[0];
      const customerName = contact?.profile?.name ?? from;

      await log("info", "whatsapp-webhook", `Message from ${from}: ${messageText}`);

      // Upsert conversation
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id, status, customer_type")
        .eq("phone", from)
        .maybeSingle();

      let conversationId: string;
      let customerType = existingConv?.customer_type ?? "retail";

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv } = await supabase
          .from("conversations")
          .insert({
            customer_name: customerName,
            phone: from,
            customer_type: "retail",
            status: "active",
            last_activity: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          })
          .select("id")
          .single();
        conversationId = newConv!.id;
      }

      // Store incoming message
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender: "customer",
        text: messageText,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        type: messageType === "location" ? "location" : "text",
      });

      // Update last_activity
      await supabase.from("conversations")
        .update({
          last_activity: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          status: "active",
        })
        .eq("id", conversationId);

      // Determine bot response using Mistral AI
      const mistralUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/mistral-parse`;
      const mistralRes = await fetch(mistralUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: messageText,
          customerType,
          conversationId,
          phone: from,
        }),
      });

      const { reply, orderData } = await mistralRes.json();

      // If Mistral extracted an order, create it
      if (orderData?.items?.length) {
        const orderId = `ORD-${Date.now().toString().slice(-6)}`;
        await supabase.from("orders").insert({
          id: orderId,
          customer_name: customerName,
          customer_type: customerType,
          total: orderData.total,
          status: "pending",
          payment_status: "unpaid",
          location: orderData.location ?? null,
        });

        for (const item of orderData.items) {
          await supabase.from("order_items").insert({
            order_id: orderId,
            product_name: item.name,
            qty: item.qty,
            unit: item.unit ?? "kg",
            unit_price: item.price ?? 0,
          });
        }

        await supabase.from("conversations").update({ order_id: orderId }).eq("id", conversationId);

        // Increment customer total_orders
        await supabase.rpc("increment_customer_orders", { customer_phone: from }).maybeSingle();
      }

      // Store bot reply
      const replyText = reply ?? "شكراً لتواصلك معنا! سنرد عليك قريباً.";
      await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
        type: "text",
      });

      // Send reply via WhatsApp API
      await fetch(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: { body: replyText },
        }),
      });

      // Mark webhook processed
      await supabase.from("webhook_events")
        .update({ processed: true })
        .eq("source", "whatsapp")
        .eq("processed", false)
        .order("created_at", { ascending: false });

      return new Response("OK", { status: 200, headers: corsHeaders });
    }

    return new Response("Method not allowed", { status: 405, headers: corsHeaders });

  } catch (err) {
    await log("error", "whatsapp-webhook", String(err));
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function log(level: string, service: string, message: string, metadata?: Record<string, unknown>) {
  try {
    await supabase.from("system_logs").insert({ level, service, message, metadata });
  } catch { /* non-blocking */ }
}
