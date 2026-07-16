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

    const GEIDEA_MERCHANT_PUBLIC_KEY = Deno.env.get("GEIDEA_MERCHANT_PUBLIC_KEY")!;
    const GEIDEA_API_PASSWORD = Deno.env.get("GEIDEA_API_PASSWORD")!;
    const GEIDEA_API_URL = Deno.env.get("GEIDEA_API_URL") ?? "https://api.merchant.geidea.net";
    const GEIDEA_WEBHOOK_URL = Deno.env.get("GEIDEA_WEBHOOK_URL")!;
    const GEIDEA_RETURN_URL = Deno.env.get("GEIDEA_RETURN_URL") ?? "http://localhost:3000";

    const timestamp = new Date().toISOString();
    const merchantReferenceId = orderId;

    // Generate signature: HMAC-SHA256(merchantPublicKey + amount + currency + merchantReferenceId + timestamp, apiPassword)
    const encoder = new TextEncoder();
    const keyData = encoder.encode(GEIDEA_API_PASSWORD);
    const messageData = encoder.encode(`${GEIDEA_MERCHANT_PUBLIC_KEY}${amount}${currency}${merchantReferenceId}${timestamp}`);

    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, messageData);
    const signatureArray = new Uint8Array(signatureBuffer);
    const signature = btoa(String.fromCharCode(...signatureArray));

    // Create Geidea session
    const sessionPayload = {
      amount: Number(amount),
      currency,
      timestamp,
      merchantReferenceId,
      signature,
      callbackUrl: GEIDEA_WEBHOOK_URL,
      returnUrl: GEIDEA_RETURN_URL,
      paymentOperation: "Pay",
      language: "en",
      customer: {
        email: customerEmail ?? "",
        name: customerName ?? "",
      },
    };

    const authHeader = "Basic " + btoa(`${GEIDEA_MERCHANT_PUBLIC_KEY}:${GEIDEA_API_PASSWORD}`);

    const res = await fetch(`${GEIDEA_API_URL}/payment-intent/api/v2/direct/session`, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify(sessionPayload),
    });

    const data = await res.json();

    if (!res.ok || data?.resultCode !== "000") {
      await supabase.from("system_logs").insert({
        level: "error",
        service: "create-geidea-session",
        message: `Geidea session creation failed: ${res.status}`,
        metadata: { orderId, error: data },
      });
      return new Response(
        JSON.stringify({ error: "Failed to create Geidea session", details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sessionId = data?.session?.id;

    // Store pending transaction
    await supabase.from("transactions").insert({
      order_id: orderId,
      amount: Number(amount),
      currency,
      status: "pending",
      payment_method: "geidea",
      provider_id: sessionId,
      provider_response: data,
    });

    await supabase.from("system_logs").insert({
      level: "info",
      service: "create-geidea-session",
      message: `Geidea session created for order ${orderId}`,
      metadata: { sessionId, amount, currency },
    });

    return new Response(
      JSON.stringify({
        success: true,
        sessionId,
        paymentUrl: data?.session?.paymentUrl ?? null,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "create-geidea-session",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
