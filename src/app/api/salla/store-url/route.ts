import { NextResponse } from 'next/server';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const result: Record<string, unknown> = { merchantId: auth.merchantId, storeName: auth.storeName };
  const candidates: string[] = [];
  const fetchInfo = async (path: string): Promise<void> => {
    const body = await sallaFetch<{ data?: Record<string, any> }>(`/admin/v2${path}`, {}, auth);
    const data = body.data;
    if (data?.url) candidates.push(String(data.url));
    if (data?.links?.customer) candidates.push(String(data.links.customer));
  };
  try {
    await fetchInfo('/store/info');
  } catch (error) {
    result.errorStoreInfo = error instanceof Error ? error.message : String(error);
  }
  try {
    const products = await sallaFetch<{ data?: Array<Record<string, any>> }>('/admin/v2/products?page=1&per_page=1', {}, auth);
    const first = products.data?.[0];
    if (first) {
      if (first.urls?.customer) candidates.push(String(first.urls.customer));
      if (first.url) candidates.push(String(first.url));
    }
  } catch (error) {
    result.errorProducts = error instanceof Error ? error.message : String(error);
  }
  const normalized = [...new Set(candidates)]
    .map((url) => url.replace(/\/(?:p|c)\d+(\/)?$/, '').replace(/\/(p|c)\d+$/, '').replace(/\/[^/]+$/, '').replace(/\/[a-z]{2}(\/)?$/, ''))
    .filter(Boolean);
  result.url = normalized[0] ?? null;
  result.candidates = candidates;
  return NextResponse.json(result);
}