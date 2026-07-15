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
    const body = await req.json();

    // Log raw webhook
    await supabase.from("webhook_events").insert({
      source: "hyperpay",
      event_type: body?.eventType ?? "payment.webhook",
      payload: body,
      processed: false,
    });

    // Extract payment details from HyperPay webhook payload
    const resourcePath = body?.resourcePath ?? "";
    const paymentId = body?.payload?.id ?? body?.id ?? resourcePath.split("/").pop();
    const paymentStatus = body?.payload?.result?.code ? String(body.payload.result.code) : "";
    const amount = body?.payload?.amount ?? body?.amount ?? 0;
    const currency = body?.payload?.currency ?? body?.currency ?? "SAR";
    const orderId = body?.merchantTransactionId ?? body?.payload?.merchantTransactionId ?? body?.customParameters?.order_id;

    // Determine transaction status from HyperPay result code
    // Success codes: 000.000.000, 000.100.110, 000.100.111, 000.100.112
    const isSuccess = /^(000\.000\.|000\.100\.1)/.test(paymentStatus);
    const isFailure = /^(000\.400\.|000\.500\.|800\.|900\.)/.test(paymentStatus);

    let status = "pending";
    if (isSuccess) status = "paid";
    else if (isFailure) status = "failed";

    // Upsert transaction record
    const { data: existingTxn } = await supabase
      .from("transactions")
      .select("id")
      .eq("provider_id", paymentId)
      .maybeSingle();

    if (existingTxn) {
      await supabase.from("transactions")
        .update({
          status,
          provider_response: body,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingTxn.id);
    } else {
      await supabase.from("transactions").insert({
        order_id: orderId ?? null,
        amount: Number(amount),
        currency,
        status,
        provider_id: paymentId,
        provider_response: body,
      });
    }

    // Update order payment_status if we have an order_id
    if (orderId && isSuccess) {
      await supabase.from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      await supabase.from("system_logs").insert({
        level: "info",
        service: "hyperpay-webhook",
        message: `Payment confirmed for order ${orderId}: ${amount} ${currency}`,
      });

      // Trigger email notification
      try {
        const emailUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`;
        await fetch(emailUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            orderId,
            amount,
            currency,
            type: "payment_confirmed",
          }),
        });
      } catch { /* non-blocking */ }
    }

    // Mark webhook processed
    await supabase.from("webhook_events")
      .update({ processed: true })
      .eq("source", "hyperpay")
      .eq("processed", false);

    return new Response(
      JSON.stringify({ success: true, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "hyperpay-webhook",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
