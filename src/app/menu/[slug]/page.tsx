import { createServerClient } from '@/lib/supabase/server';
import MenuCart from '@/components/MenuCart';
import type { Product, CustomerType } from '@/lib/types';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function CustomerMenuPage({ params }: { params: { slug: string } }) {
  const supabase = createServerClient();

  const { data: menuPage } = await supabase
    .from('menu_pages')
    .select('*')
    .eq('slug', params.slug)
    .maybeSingle();

  if (!menuPage) {
    notFound();
  }

  const { data: rawProducts } = await supabase
    .from('products')
    .select('*')
    .order('category', { ascending: true });

  const products: Product[] = rawProducts ?? [];

  return (
    <MenuCart
      products={products}
      customerName={menuPage.customer_name}
      customerType={menuPage.customer_type as CustomerType}
      slug={params.slug}
    />
  );
}
