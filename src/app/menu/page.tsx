import { redirect } from 'next/navigation';
import { resolveSallaStorefrontUrl } from '@/lib/salla';

export const dynamic = 'force-dynamic';

export default async function MenuPage() {
  const storefrontUrl = await resolveSallaStorefrontUrl();
  if (storefrontUrl) redirect(storefrontUrl);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-md p-8 max-w-md w-full text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Service catalog unavailable</h1>
        <p className="text-gray-600">
          Service listings are managed in your connected Salla storefront. Connect Salla in the dashboard, or set
          {' '}
          <code className="text-sm bg-gray-100 px-1 rounded">NEXT_PUBLIC_SALLA_STOREFRONT_URL</code>
          {' '}
          to the live store link (https://salla.sa/your-store), not demostore.salla.sa.
        </p>
      </div>
    </div>
  );
}
