import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { ADMIN_COOKIE, adminPasswordConfigured, createAdminSession, safeNextPath } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

function passwordMatches(supplied: string) {
  const expected = process.env.ADMIN_PASSWORD ?? '';
  const left = createHash('sha256').update(supplied).digest();
  const right = createHash('sha256').update(expected).digest();
  return timingSafeEqual(left, right);
}

export async function POST(req: Request) {
  if (!adminPasswordConfigured()) {
    return NextResponse.json({ error: 'Set ADMIN_PASSWORD to at least 12 characters before signing in.' }, { status: 503 });
  }

  const body = await req.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!passwordMatches(password)) {
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, next: safeNextPath(typeof body?.next === 'string' ? body.next : null) });
  response.cookies.set(ADMIN_COOKIE, await createAdminSession(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  return response;
}
