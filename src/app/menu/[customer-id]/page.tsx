import { getProducts, getMenuPageBySlug } from '@/lib/data';
import { CustomerType } from '@/lib/types';
import MenuCart from '@/components/MenuCart';

interface PageProps {
  params: Promise<{ 'customer-id': string }>;
}

export const dynamic = 'force-dynamic';

export default async function CustomerMenuPage({ params }: PageProps) {
  const { 'customer-id': customerId } = await params;

  const menuPage = await getMenuPageBySlug(customerId);

  if (!menuPage) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Invalid Menu Link</h1>
          <p className="text-gray-600">This menu is no longer available or the link is incorrect.</p>
        </div>
      </div>
    );
  }

  const products = await getProducts();

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <MenuCart
        products={products}
        customerName={menuPage.customer_name}
        customerType={menuPage.customer_type as CustomerType}
        customerId={menuPage.id}
      />
    </div>
  );
}
