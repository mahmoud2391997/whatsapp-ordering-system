import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_COOKIE, adminGateActive, adminPasswordConfigured, isAdminPath, verifyAdminSession } from '@/lib/admin-session';

async function guardAdmin(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isAdminPath(pathname) || !adminGateActive()) return null;

  if (!adminPasswordConfigured()) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'ADMIN_PASSWORD is not configured' }, { status: 503 });
    }
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = 'error=config';
    return NextResponse.redirect(url);
  }

  const allowed = await verifyAdminSession(request.cookies.get(ADMIN_COOKIE)?.value);
  if (allowed) return null;

  if (pathname.startsWith('/api/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.search = `next=${encodeURIComponent(pathname)}`;
  return NextResponse.redirect(url);
}

export async function middleware(request: NextRequest) {
  const denied = await guardAdmin(request);
  if (denied) return denied;

  let response = NextResponse.next({ request });
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey || supabaseUrl.startsWith('https://placeholder-')) return response;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
