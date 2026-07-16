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

    const { orderId, amount, currency = "SAR", customerEmail, customerName, customerPhone } = await req.json();

    if (!orderId || !amount) {
      return new Response(
        JSON.stringify({ error: "orderId and amount are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const TAMARA_API_TOKEN = Deno.env.get("TAMARA_API_TOKEN")!;
    const TAMARA_API_URL = Deno.env.get("TAMARA_API_URL") ?? "https://api-sandbox.tamara.co";
    const TAMARA_WEBHOOK_URL = Deno.env.get("TAMARA_WEBHOOK_URL")!;
    const TAMARA_RETURN_URL = Deno.env.get("TAMARA_RETURN_URL") ?? "http://localhost:3000";
    const TAMARA_CANCEL_URL = Deno.env.get("TAMARA_CANCEL_URL") ?? "http://localhost:3000";

    // Create Tamara checkout order
    const checkoutPayload = {
      total_amount: {
        amount: Number(amount),
        currency,
      },
      shipping_address: {
        first_name: customerName ?? "",
        country_code: "SA",
      },
      billing_address: {
        first_name: customerName ?? "",
        country_code: "SA",
      },
      order_reference_id: orderId,
      customer: {
        email: customerEmail ?? "",
        first_name: customerName ?? "",
        phone_number: customerPhone ?? "",
      },
      payment_type: "PAY_BY_INSTALMENTS",
      instalments: 3,
      merchant_url: {
        success: TAMARA_RETURN_URL,
        cancel: TAMARA_CANCEL_URL,
        failure: TAMARA_CANCEL_URL,
      },
      callback_url: TAMARA_WEBHOOK_URL,
      countryCode: "SA",
      description: `Order ${orderId} - Fresh Greens`,
      tax_amount: {
        amount: 0,
        currency,
      },
      discount_amount: {
        amount: 0,
        currency,
      },
      shipping_amount: {
        amount: 0,
        currency,
      },
      items: [],
    };

    const res = await fetch(`${TAMARA_API_URL}/checkout`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${TAMARA_API_TOKEN}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(checkoutPayload),
    });

    const data = await res.json();

    if (!res.ok) {
      await supabase.from("system_logs").insert({
        level: "error",
        service: "create-tamara-order",
        message: `Tamara checkout failed: ${res.status}`,
        metadata: { orderId, error: data },
      });
      return new Response(
        JSON.stringify({ error: "Failed to create Tamara order", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tamaraOrderId = data?.order_id;
    const checkoutUrl = data?.checkout_url;

    // Store pending transaction
    await supabase.from("transactions").insert({
      order_id: orderId,
      amount: Number(amount),
      currency,
      status: "pending",
      payment_method: "tamara",
      provider_id: tamaraOrderId,
      provider_response: data,
    });

    await supabase.from("system_logs").insert({
      level: "info",
      service: "create-tamara-order",
      message: `Tamara checkout created for order ${orderId}`,
      metadata: { tamaraOrderId, checkoutUrl, amount, currency },
    });

    return new Response(
      JSON.stringify({
        success: true,
        tamaraOrderId,
        checkoutUrl,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "create-tamara-order",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
