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

    const SALLA_API_URL = Deno.env.get("SALLA_API_URL")!;
    const SALLA_ACCESS_TOKEN = Deno.env.get("SALLA_ACCESS_TOKEN")!;

    // Use direct access token instead of OAuth flow
    const accessToken = SALLA_ACCESS_TOKEN;

    if (!accessToken) {
      throw new Error("SALLA_ACCESS_TOKEN not configured");
    }

    // Fetch products from Salla
    let allProducts: any[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const productsResponse = await fetch(`${SALLA_API_URL}/products?page=${page}&per_page=100`, {
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Accept": "application/json",
        },
      });

      const productsData = await productsResponse.json();
      const products = productsData.data || [];

      allProducts = [...allProducts, ...products];
      hasMore = products.length === 100;
      page++;
    }

    // Sync products to Supabase
    let synced = 0;
    let updated = 0;
    let errors = 0;

    for (const product of allProducts) {
      try {
        const productData = {
          salla_product_id: product.id,
          name: product.name || "",
          name_ar: product.name_ar || product.name || "",
          description: product.description || "",
          price: product.price?.amount || 0,
          compare_price: product.compare_price?.amount || 0,
          cost_price: product.cost_price?.amount || 0,
          stock: product.quantity || 0,
          sku: product.sku || "",
          barcode: product.barcode || "",
          image_url: product.main_image || "",
          category: product.category?.name || "uncategorized",
          status: product.status || "active",
          unit: "piece",
          retail_price: product.price?.amount || 0,
          wholesale_price: product.price?.amount || 0,
          restaurant_price: product.price?.amount || 0,
          updated_at: new Date().toISOString(),
        };

        const { data: existingProduct } = await supabase
          .from("products")
          .select("*")
          .eq("salla_product_id", product.id)
          .single();

        if (existingProduct) {
          await supabase.from("products").update(productData).eq("salla_product_id", product.id);
          updated++;
        } else {
          await supabase.from("products").insert(productData);
          synced++;
        }
      } catch (err) {
        errors++;
        console.error(`Error syncing product ${product.id}:`, err);
      }
    }

    await supabase.from("system_logs").insert({
      level: "info",
      service: "sync-salla-products",
      message: `Product sync completed: ${synced} new, ${updated} updated, ${errors} errors`,
      metadata: { total: allProducts.length, synced, updated, errors },
    });

    return new Response(
      JSON.stringify({
        success: true,
        total: allProducts.length,
        synced,
        updated,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (err) {
    await supabase.from("system_logs").insert({
      level: "error",
      service: "sync-salla-products",
      message: String(err),
    });
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
