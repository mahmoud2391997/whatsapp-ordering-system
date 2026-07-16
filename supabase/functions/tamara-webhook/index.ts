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
      source: "tamara",
      event_type: body?.event_type ?? "order.notification",
      payload: body,
      processed: false,
    });

    const eventType = body?.event_type ?? "";
    const tamaraOrderId = body?.order_id ?? null;
    const orderId = body?.order_reference_id ?? null;
    const totalAmount = body?.total_amount?.amount ?? body?.amount ?? 0;
    const currency = body?.total_amount?.currency ?? body?.currency ?? "SAR";

    // Tamara event types:
    // order.authorized - payment authorized
    // order.captured - payment captured (funds received)
    // order.cancelled - payment cancelled
    // order.rejected - payment rejected
    const isSuccess = eventType === "order.captured" || eventType === "order.authorized";
    const isFailure = eventType === "order.cancelled" || eventType === "order.rejected";

    let status = "pending";
    if (isSuccess) status = "paid";
    else if (isFailure) status = "failed";

    // Upsert transaction record
    if (tamaraOrderId) {
      const { data: existingTxn } = await supabase
        .from("transactions")
        .select("id")
        .eq("provider_id", String(tamaraOrderId))
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
          amount: Number(totalAmount),
          currency,
          status,
          payment_method: "tamara",
          provider_id: String(tamaraOrderId),
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
        service: "tamara-webhook",
        message: `Tamara payment confirmed for order ${orderId}: ${totalAmount} ${currency} (${eventType})`,
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
            amount: totalAmount,
            currency,
            type: "payment_confirmed",
          }),
        });
      } catch { /* non-blocking */ }
    }

    // Mark webhook processed
    await supabase.from("webhook_events")
      .update({ processed: true })
      .eq("source", "tamara")
      .eq("processed", false);

    return new Response(
      JSON.stringify({ success: true, status }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "tamara-webhook",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
