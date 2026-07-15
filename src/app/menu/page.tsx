import { createServerClient } from '@/lib/supabase/server';
import MenuCart from '@/components/MenuCart';
import type { Product } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const supabase = createServerClient();
  const { data: rawProducts } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true });

  const products: Product[] = rawProducts ?? [];

  return (
    <MenuCart
      products={products}
      customerName=""
      customerType="retail"
      slug="general"
    />
  );
}
