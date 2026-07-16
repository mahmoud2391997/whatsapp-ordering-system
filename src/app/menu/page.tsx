import { createServerClient } from '@/lib/supabase/server';
import type { Product } from '@/lib/types';
import MenuCatalog from '@/components/MenuCatalog';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const supabase = createServerClient();

  const { data: products } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name');

  return <MenuCatalog products={(products ?? []) as Product[]} />;
}
