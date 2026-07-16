import { createServerClient } from '@/lib/supabase/server';
import type { Product, MenuPage, CustomerType } from '@/lib/types';
import MenuPreview from './MenuPreview';

export const dynamic = 'force-dynamic';

export default async function MenuPreviewPage() {
  const supabase = createServerClient();

  const { data: menuPages } = await supabase
    .from('menu_pages')
    .select('*')
    .order('created_at', { ascending: false });

  const { data: rawProducts } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name');

  return (
    <MenuPreview
      menuPages={(menuPages ?? []) as MenuPage[]}
      products={(rawProducts ?? []) as Product[]}
    />
  );
}
