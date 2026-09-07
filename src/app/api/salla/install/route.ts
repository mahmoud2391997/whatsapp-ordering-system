import { NextResponse } from 'next/server';
import { createOAuthState, sallaInstallUrl } from '@/lib/salla';

export async function GET() {
  if (!process.env.SALLA_CLIENT_ID || !process.env.SALLA_CLIENT_SECRET || !process.env.SALLA_TOKEN_ENCRYPTION_KEY) return NextResponse.json({ error: 'Salla OAuth is not configured' }, { status: 503 });
  const state = createOAuthState();
  const response = NextResponse.redirect(sallaInstallUrl(state));
  response.cookies.set('salla_oauth_state', state, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 600, path: '/' });
  return response;
}
