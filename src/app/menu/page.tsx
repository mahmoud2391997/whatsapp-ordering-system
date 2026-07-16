import { createServerClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import MenuCart from '@/components/MenuCart';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const supabase = createServerClient();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name');

  return (
    <div>
      <div className="bg-emerald-800 text-white text-center py-2 text-sm font-medium">
        Admin Preview — <a href="/dashboard" className="underline hover:text-emerald-200">Back to Dashboard</a>
      </div>
      <MenuCart
        products={(products ?? []) as Product[]}
        customerName="Preview"
        customerType="retail"
        customerId=""
      />
    </div>
  );
}
