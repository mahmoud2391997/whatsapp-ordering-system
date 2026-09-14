import { NextResponse } from 'next/server';
import { getSallaAuthorization, resolveSallaStorefrontUrl } from '@/lib/salla';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  try {
    const url = await resolveSallaStorefrontUrl();
    if (!url) {
      return NextResponse.json({
        error: 'Live Salla storefront URL not found. Demo stores are ignored. Set NEXT_PUBLIC_SALLA_STOREFRONT_URL to the live store domain.',
        merchantId: auth.merchantId,
        storeName: auth.storeName,
        url: null,
      }, { status: 404 });
    }
    return NextResponse.json({ merchantId: auth.merchantId, storeName: auth.storeName, url });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed to resolve Salla storefront' }, { status: 502 });
  }
}
