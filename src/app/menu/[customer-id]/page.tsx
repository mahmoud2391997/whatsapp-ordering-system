import { createServerClient } from '@/lib/supabase/server';
import type { Product, MenuPage } from '@/lib/types';
import MenuCart from '@/components/MenuCart';

interface PageProps {
  params: Promise<{ 'customer-id': string }>;
}

export const dynamic = 'force-dynamic';

export default async function CustomerMenuPage({ params }: PageProps) {
  const { 'customer-id': customerId } = await params;
  const supabase = createServerClient();

  // Fetch menu page data
  const { data: menuPage, error: pageError } = await supabase
    .from('menu_pages')
    .select('*')
    .eq('id', customerId)
    .maybeSingle();

  if (pageError || !menuPage) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Menu Link</h1>
          <p className="text-gray-600">This menu is no longer available or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  // Fetch all products grouped by category
  const { data: products, error: productsError } = await supabase
    .from('products')
    .select('*')
    .order('category')
    .order('name');

  if (productsError || !products) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error Loading Menu</h1>
          <p className="text-gray-600">We encountered an error while loading the menu. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <MenuCart
        products={products as Product[]}
        customerName={menuPage.customer_name}
        customerType={menuPage.customer_type}
        customerId={customerId}
      />
    </div>
  );
}
