import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { crypto } from "npm:crypto";

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

    const webhookSecret = Deno.env.get("SALLA_WEBHOOK_SECRET")!;
    const signature = req.headers.get("X-Salla-Signature");
    
    if (!signature) {
      return new Response("Missing signature", { status: 401, headers: corsHeaders });
    }

    const body = await req.text();
    
    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(body)
      .digest("hex");

    if (signature !== expectedSignature) {
      await supabase.from("system_logs").insert({
        level: "error",
        service: "salla-webhook",
        message: "Invalid webhook signature",
        metadata: { received: signature, expected: expectedSignature },
      });
      return new Response("Invalid signature", { status: 401, headers: corsHeaders });
    }

    const event = JSON.parse(body);
    const eventType = event.event;
    const eventData = event.data;

    await supabase.from("webhook_events").insert({
      source: "salla",
      event_type: eventType,
      payload: event,
      processed: false,
    });

    // Handle different event types
    switch (eventType) {
      case "order.created":
      case "order.updated":
        await handleOrderEvent(eventType, eventData);
        break;
      case "product.created":
      case "product.updated":
      case "product.deleted":
        await handleProductEvent(eventType, eventData);
        break;
      case "inventory.updated":
        await handleInventoryEvent(eventData);
        break;
      case "payment.captured":
      case "payment.paid":
        await handlePaymentEvent(eventType, eventData);
        break;
      default:
        await supabase.from("system_logs").insert({
          level: "info",
          service: "salla-webhook",
          message: `Unhandled event type: ${eventType}`,
          metadata: { event },
        });
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "salla-webhook",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

async function handleOrderEvent(eventType: string, eventData: any) {
  const sallaOrderId = eventData.id;
  const orderData = {
    salla_order_id: sallaOrderId,
    status: eventData.status,
    total: eventData.total?.amount || 0,
    customer_name: eventData.customer?.name || "",
    customer_phone: eventData.customer?.phone || "",
    customer_email: eventData.customer?.email || "",
    payment_method: eventData.payment_method || "",
    created_at: eventData.created_at,
    updated_at: eventData.updated_at,
  };

  // Check if order already exists
  const { data: existingOrder } = await supabase
    .from("orders")
    .select("*")
    .eq("salla_order_id", sallaOrderId)
    .single();

  if (existingOrder) {
    // Update existing order
    await supabase
      .from("orders")
      .update(orderData)
      .eq("salla_order_id", sallaOrderId);
  } else {
    // Create new order
    await supabase.from("orders").insert({
      ...orderData,
      customer_type: "retail",
      payment_method: eventData.payment_method || "cod",
    });
  }

  // Send WhatsApp notification for order status changes
  if (eventType === "order.updated" && eventData.status) {
    await sendWhatsAppOrderUpdate(eventData);
  }
}

async function handleProductEvent(eventType: string, eventData: any) {
  const sallaProductId = eventData.id;
  const productData = {
    salla_product_id: sallaProductId,
    name: eventData.name || "",
    name_ar: eventData.name_ar || eventData.name || "",
    description: eventData.description || "",
    price: eventData.price?.amount || 0,
    compare_price: eventData.compare_price?.amount || 0,
    cost_price: eventData.cost_price?.amount || 0,
    stock: eventData.quantity || 0,
    sku: eventData.sku || "",
    barcode: eventData.barcode || "",
    image_url: eventData.main_image || "",
    category: eventData.category?.name || "uncategorized",
    status: eventData.status || "active",
    updated_at: eventData.updated_at,
  };

  const { data: existingProduct } = await supabase
    .from("products")
    .select("*")
    .eq("salla_product_id", sallaProductId)
    .single();

  if (eventType === "product.deleted") {
    if (existingProduct) {
      await supabase.from("products").delete().eq("salla_product_id", sallaProductId);
    }
  } else if (existingProduct) {
    await supabase.from("products").update(productData).eq("salla_product_id", sallaProductId);
  } else {
    await supabase.from("products").insert({
      ...productData,
      unit: "piece",
      retail_price: productData.price,
      wholesale_price: productData.price,
      restaurant_price: productData.price,
    });
  }
}

async function handleInventoryEvent(eventData: any) {
  const sallaProductId = eventData.product_id;
  const newQuantity = eventData.quantity;

  await supabase
    .from("products")
    .update({ stock: newQuantity })
    .eq("salla_product_id", sallaProductId);

  // Check for low stock and send alert
  if (newQuantity < 10) {
    await sendLowStockAlert(sallaProductId, newQuantity);
  }
}

async function handlePaymentEvent(eventType: string, eventData: any) {
  const sallaOrderId = eventData.order_id;
  
  await supabase
    .from("transactions")
    .update({
      status: "completed",
      provider_response: eventData,
    })
    .eq("order_id", sallaOrderId);

  // Update order status
  await supabase
    .from("orders")
    .update({ status: "paid" })
    .eq("salla_order_id", sallaOrderId);
}

async function sendWhatsAppOrderUpdate(orderData: any) {
  const customerPhone = orderData.customer?.phone;
  if (!customerPhone) return;

  const message = `Order Update: Your order #${orderData.id} status is now: ${orderData.status}`;
  
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/whatsapp-send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      to: customerPhone,
      message,
    }),
  });
}

async function sendLowStockAlert(productId: string, quantity: number) {
  const { data: product } = await supabase
    .from("products")
    .select("name")
    .eq("salla_product_id", productId)
    .single();

  await supabase.from("system_logs").insert({
    level: "warning",
    service: "salla-webhook",
    message: `Low stock alert: ${product?.name || productId} - ${quantity} units remaining`,
    metadata: { product_id: productId, quantity },
  });
}
