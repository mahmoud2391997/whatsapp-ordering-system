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
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const { orderId, amount, currency = "SAR", customerEmail, customerName } = await req.json();

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: "orderId and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const HYPERPAY_URL = Deno.env.get("HYPERPAY_URL")!;
    const HYPERPAY_ACCESS_TOKEN = Deno.env.get("HYPERPAY_ACCESS_TOKEN")!;
    const HYPERPAY_ENTITY_ID = Deno.env.get("HYPERPAY_ENTITY_ID")!;
    const HYPERPAY_WEBHOOK_URL = Deno.env.get("HYPERPAY_WEBHOOK_URL")!;

    // Create HyperPay checkout session
    const formData = new URLSearchParams();
    formData.append("entityId", HYPERPAY_ENTITY_ID);
    formData.append("amount", String(amount));
    formData.append("currency", currency);
    formData.append("paymentType", "DB");
    formData.append("merchantTransactionId", orderId);
    formData.append("merchantInvoiceId", orderId);
    formData.append("customer.email", customerEmail ?? "");
    formData.append("customer.givenName", customerName ?? "");
    formData.append("shopperResultUrl", `${Deno.env.get("SUPABASE_URL")}/functions/v1/hyperpay-webhook`);
    formData.append("asyncNotificationUrl", HYPERPAY_WEBHOOK_URL);

    const res = await fetch(`${HYPERPAY_URL}/v1/checkouts`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${HYPERPAY_ACCESS_TOKEN}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: formData.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      await supabase.from("system_logs").insert({
        level: "error",
        service: "create-payment",
        message: `HyperPay checkout failed: ${res.status}`,
        metadata: { orderId, error: data },
      });
      return new Response(
        JSON.stringify({ error: "Failed to create payment session", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const checkoutId = data.id;

    // Store pending transaction
    await supabase.from("transactions").insert({
      order_id: orderId,
      amount: Number(amount),
      currency,
      status: "pending",
      provider_response: data,
    });

    await supabase.from("system_logs").insert({
      level: "info",
      service: "create-payment",
      message: `Payment session created for order ${orderId}`,
      metadata: { checkoutId, amount, currency },
    });

    return new Response(
      JSON.stringify({
        success: true,
        checkoutId,
        checkoutUrl: `${HYPERPAY_URL}/v1/paymentWidgets.js?checkoutId=${checkoutId}`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "create-payment",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
