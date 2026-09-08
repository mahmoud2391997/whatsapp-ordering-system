import { fetchSallaCatalog } from '@/lib/salla';
import MenuCart from '@/components/MenuCart';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  let products: Awaited<ReturnType<typeof fetchSallaCatalog>> = [];
  let catalogError: string | null = null;

  try {
    products = await fetchSallaCatalog();
  } catch (error) {
    catalogError = error instanceof Error && error.message === 'SALLA_NOT_CONNECTED'
      ? 'The Salla store is not connected yet.'
      : 'The Salla catalog is temporarily unavailable. Please try again shortly.';
  }

  return (
    <div>
      <div className="bg-emerald-800 text-white text-center py-2 text-sm font-medium">
        Admin Preview — <a href="/dashboard" className="underline hover:text-emerald-200">Back to Dashboard</a>
      </div>
      <MenuCart
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          name_ar: product.nameAr,
          category: product.category,
          unit: product.unit,
          retail_price: product.price,
          shop_price: product.price,
          wholesale_price: product.price,
          stock: product.stock,
          image_url: product.imageUrl,
        }))}
        catalogError={catalogError}
        customerName="Preview"
        customerType="retail"
        customerId=""
      />
    </div>
  );
}
