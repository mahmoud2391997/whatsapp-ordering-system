import { getProducts } from '@/lib/data';
import MenuCart from '@/components/MenuCart';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const products = await getProducts();

  return (
    <div>
      <div className="bg-emerald-800 text-white text-center py-2 text-sm font-medium">
        Admin Preview — <a href="/dashboard" className="underline hover:text-emerald-200">Back to Dashboard</a>
      </div>
      <MenuCart
        products={products}
        customerName="Preview"
        customerType="retail"
        customerId=""
      />
    </div>
  );
}
