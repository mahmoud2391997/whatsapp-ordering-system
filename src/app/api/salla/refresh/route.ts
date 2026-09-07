import { NextResponse } from 'next/server';
import { getSallaAuthorization, getSallaAccessToken } from '@/lib/salla';

export async function POST() {
  try {
    const authorization = await getSallaAuthorization();
    if (!authorization) return NextResponse.json({ error: 'Salla is not connected' }, { status: 404 });
    await getSallaAccessToken(authorization);
    return NextResponse.json({ ok: true, status: 'active' });
  } catch (error) {
    console.error('[v0] Salla token refresh failed', error);
    return NextResponse.json({ error: 'Salla authorization needs attention' }, { status: 502 });
  }
}
