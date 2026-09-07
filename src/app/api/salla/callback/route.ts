import crypto from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { exchangeSallaCode, encryptToken, safeEqual, fetchSallaStoreInfo, registerSallaWebhooks } from '@/lib/salla';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const state = params.get('state');
  const code = params.get('code');
  const storedState = request.cookies.get('salla_oauth_state')?.value;
  if (!state || !storedState || !safeEqual(state, storedState) || !code) return NextResponse.json({ error: 'Invalid OAuth callback' }, { status: 400 });
  try {
    const token = await exchangeSallaCode(code);
    const store = await fetchSallaStoreInfo(token.access_token).catch(() => null);
    const merchantId = params.get('merchant') ?? params.get('merchant_id') ?? String(store?.data?.id ?? `pending-${crypto.randomUUID()}`);
    const storeName = store?.data?.name ?? null;
    const auth = await prisma.sallaAuthorization.upsert({ where: { merchantId }, update: { storeName, accessToken: encryptToken(token.access_token), refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : undefined, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: token.scope, status: 'active', lastSyncError: null }, create: { merchantId, accessToken: encryptToken(token.access_token), refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : null, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null, scopes: token.scope, storeName, status: 'active' } });
    try {
      await registerSallaWebhooks(auth);
    } catch (webhookError) {
      await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncError: webhookError instanceof Error ? webhookError.message : 'Webhook registration failed' } });
    }
    const response = NextResponse.redirect(new URL('/dashboard?integration=salla&connected=1', request.url));
    response.cookies.delete('salla_oauth_state');
    return response;
  } catch (error) {
    console.error('[v0] Salla callback failed', error);
    return NextResponse.redirect(new URL('/dashboard?integration=salla&error=callback', request.url));
  }
}
