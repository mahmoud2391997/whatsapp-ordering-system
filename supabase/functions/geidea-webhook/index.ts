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
      source: "geidea",
      event_type: body?.eventType ?? body?.resultCode ?? "payment.callback",
      payload: body,
      processed: false,
    });

    const resultCode = body?.resultCode ?? "";
    const orderId = body?.merchantReferenceId ?? body?.order?.merchantReferenceId ?? null;
    const amount = body?.amount ?? body?.order?.amount ?? 0;
    const currency = body?.currency ?? body?.order?.currency ?? "SAR";
    const paymentId = body?.orderId ?? body?.paymentId ?? null;

    // Geidea result codes: 000 = success
    const isSuccess = resultCode === "000";
    const isFailure = /^(001|002|003|004|005|006|007|008|009|010|080|081|082|083|084|085|086|087|088|089|090|091|092|093|094|095|096|097|098|099|100|101|102|103|104|105)$/.test(resultCode);

    let status = "pending";
    if (isSuccess) status = "paid";
    else if (isFailure || resultCode !== "000") status = "failed";

    // Upsert transaction record
    if (paymentId) {
      const { data: existingTxn } = await supabase
        .from("transactions")
        .select("id")
        .eq("provider_id", String(paymentId))
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
          payment_method: "geidea",
          provider_id: String(paymentId),
          provider_response: body,
        });
      }
    }

    // Update order payment_status
    if (orderId && isSuccess) {
      await supabase.from("orders")
        .update({ payment_status: "paid" })
        .eq("id", orderId);

      await supabase.from("system_logs").insert({
        level: "info",
        service: "geidea-webhook",
        message: `Geidea payment confirmed for order ${orderId}: ${amount} ${currency}`,
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
      .eq("source", "geidea")
      .eq("processed", false);

    return new Response(
      JSON.stringify({ success: true, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "geidea-webhook",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
