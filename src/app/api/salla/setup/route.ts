import { NextResponse } from 'next/server';
import { getSallaAuthorization } from '@/lib/salla';
import { getSallaSetup } from '@/lib/salla-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  let connected: { merchantId: string; storeName: string | null; status: string } | null = null;
  try {
    const auth = await getSallaAuthorization();
    if (auth) connected = { merchantId: auth.merchantId, storeName: auth.storeName, status: auth.status };
  } catch {
    connected = null;
  }
  return NextResponse.json(getSallaSetup(connected));
}
