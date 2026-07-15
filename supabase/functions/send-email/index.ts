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

    const { orderId, type, to, subject, amount, currency, customerName, customerEmail } = await req.json();

    const SENDGRID_API_KEY = Deno.env.get("SENDGRID_API_KEY")!;
    const FROM_EMAIL = Deno.env.get("SENDGRID_FROM_EMAIL") ?? "orders@freshgreens.co";
    const FRONTEND_URL = Deno.env.get("FRONTEND_URL") ?? "https://freshgreens.co";

    if (!SENDGRID_API_KEY) {
      return new Response(
        JSON.stringify({ error: "SendGrid API key not configured" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch order details if orderId provided
    let orderData: Record<string, unknown> | null = null;
    if (orderId) {
      const { data } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("id", orderId)
        .maybeSingle();
      orderData = data;
    }

    // Build email templates based on type
    const templates: Record<string, { subject: string; html: string }> = {
      order_confirmed: {
        subject: `تأكيد الطلب ${orderId ?? ""} - Fresh Greens`,
        html: buildOrderEmail(orderData, FRONTEND_URL),
      },
      payment_confirmed: {
        subject: `تم تأكيد الدفع - ${orderId ?? ""}`,
        html: buildPaymentEmail(orderData, amount, currency),
      },
      shipping_update: {
        subject: `طلبك في الطريق! - ${orderId ?? ""}`,
        html: buildShippingEmail(orderData, FRONTEND_URL),
      },
      custom: {
        subject: subject ?? "Fresh Greens Notification",
        html: `<div style="font-family: sans-serif; padding: 20px;">${subject ?? ""}</div>`,
      },
    };

    const template = templates[type] ?? templates.custom;
    const recipient = to ?? customerEmail ?? orderData?.customer_email;

    if (!recipient) {
      return new Response(
        JSON.stringify({ error: "No recipient email address provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const emailPayload = {
      personalizations: [
        {
          to: [{ email: recipient, name: customerName ?? "Customer" }],
          subject: template.subject,
        },
      ],
      from: { email: FROM_EMAIL, name: "Fresh Greens" },
      content: [{ type: "text/html", value: template.html }],
    };

    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${SENDGRID_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const errText = await res.text();
      await supabase.from("system_logs").insert({
        level: "error",
        service: "send-email",
        message: `SendGrid API error: ${res.status}`,
        metadata: { error: errText, recipient, type },
      });
      return new Response(
        JSON.stringify({ error: "Failed to send email", details: errText }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    await supabase.from("system_logs").insert({
      level: "info",
      service: "send-email",
      message: `Email sent to ${recipient} (type: ${type})`,
      metadata: { orderId, type, recipient },
    });

    return new Response(
      JSON.stringify({ success: true, recipient, type }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "send-email",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function buildOrderEmail(order: Record<string, unknown> | null, frontendUrl: string): string {
  const items = (order?.order_items as Array<Record<string, unknown>>) ?? [];
  const itemsHtml = items.map(i =>
    `<tr><td style="padding: 8px; border-bottom: 1px solid #eee;">${i.product_name}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${i.qty} ${i.unit}</td><td style="padding: 8px; border-bottom: 1px solid #eee;">${i.unit_price} EGP</td></tr>`
  ).join("");

  return `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Fresh Greens 🌿</h1>
      <p style="color: #d1fae5; margin: 5px 0 0;">تم تأكيد طلبك بنجاح</p>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937; margin-bottom: 20px;">Order Confirmation</h2>
      <p style="color: #6b7280;">Order ID: <strong>${order?.id ?? ""}</strong></p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <thead>
          <tr style="background: #f9fafb;">
            <th style="padding: 10px; text-align: left;">Product</th>
            <th style="padding: 10px; text-align: left;">Qty</th>
            <th style="padding: 10px; text-align: left;">Price</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="font-size: 18px; color: #059669; font-weight: bold;">Total: ${order?.total ?? 0} EGP</p>
      <p style="color: #6b7280; margin-top: 20px;">سيتم توصيل طلبك خلال 45-60 دقيقة.</p>
      <a href="${frontendUrl}/menu" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">View Menu</a>
    </div>
  </div>`;
}

function buildPaymentEmail(order: Record<string, unknown> | null, amount?: number, currency?: string): string {
  return `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">Payment Confirmed ✅</h1>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937;">تم استلام الدفع بنجاح</h2>
      <p style="color: #6b7280;">Order: <strong>${order?.id ?? ""}</strong></p>
      <p style="font-size: 20px; color: #059669; font-weight: bold;">Amount: ${amount ?? order?.total ?? 0} ${currency ?? "EGP"}</p>
      <p style="color: #6b7280; margin-top: 20px;">جاري تجهيز طلبك للتوصيل.</p>
    </div>
  </div>`;
}

function buildShippingEmail(order: Record<string, unknown> | null, frontendUrl: string): string {
  return `
  <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">طلبك في الطريق! 🚚</h1>
    </div>
    <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-radius: 0 0 12px 12px;">
      <h2 style="color: #1f2937;">Your order is on the way!</h2>
      <p style="color: #6b7280;">Order: <strong>${order?.id ?? ""}</strong></p>
      <p style="color: #6b7280;">Location: ${order?.location ?? ""}</p>
      <p style="color: #6b7280; margin-top: 20px;">سيصلك طلبك خلال 30-45 دقيقة.</p>
      <a href="${frontendUrl}/menu" style="display: inline-block; background: #059669; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; margin-top: 20px;">Track Order</a>
    </div>
  </div>`;
}
