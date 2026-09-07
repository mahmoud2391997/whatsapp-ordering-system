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

    const { orderId, customerName, customerPhone, customerEmail, items, total, customerType, location } = await req.json();

    if (!orderId || !items || !items.length) {
      return new Response(
        JSON.stringify({ error: "orderId and items are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const SALLA_API_URL = Deno.env.get("SALLA_API_URL")!;
    const SALLA_ACCESS_TOKEN = Deno.env.get("SALLA_ACCESS_TOKEN")!;

    // Use direct access token instead of OAuth flow
    const accessToken = SALLA_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("SALLA_ACCESS_TOKEN not configured");
    }

    // Get or create customer in Salla
    let sallaCustomerId;
    try {
      const customerResponse = await fetch(`${SALLA_API_URL}/customers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: customerName,
          phone: customerPhone,
          email: customerEmail,
        }),
      });

      const customerData = await customerResponse.json();
      sallaCustomerId = customerData.data?.id;

      if (!sallaCustomerId) {
        throw new Error("Failed to create customer in Salla");
      }
    } catch (err) {
      console.error("Error creating Salla customer:", err);
      sallaCustomerId = null;
    }

    // Create order in Salla
    const orderItems = items.map((item: any) => ({
      product_id: item.salla_product_id || item.product_id,
      quantity: item.qty,
      price: item.unit_price,
    }));

    const orderPayload = {
      customer_id: sallaCustomerId,
      items: orderItems,
      status: "pending",
      payment_method: "cod",
      total: {
        amount: total,
        currency: "SAR",
      },
      notes: location ? `Delivery location: ${location}` : "Order from WhatsApp",
      metadata: {
        source: "whatsapp",
        order_id: orderId,
        customer_type: customerType,
      },
    };

    const orderResponse = await fetch(`${SALLA_API_URL}/orders`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    const orderData = await orderResponse.json();

    if (!orderResponse.ok) {
      throw new Error(`Failed to create Salla order: ${JSON.stringify(orderData)}`);
    }

    const sallaOrderId = orderData.data?.id;

    // Update order in Supabase with Salla order ID
    await supabase
      .from("orders")
      .update({ salla_order_id: sallaOrderId })
      .eq("id", orderId);

    await supabase.from("system_logs").insert({
      level: "info",
      service: "create-salla-order",
      message: `Salla order created for order ${orderId}`,
      metadata: { orderId, sallaOrderId, total },
    });

    return new Response(
      JSON.stringify({
        success: true,
        sallaOrderId,
        orderId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "create-salla-order",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
