import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function generateSlug(): string {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let slug = '';
  for (let i = 0; i < 8; i++) slug += chars[Math.floor(Math.random() * chars.length)];
  return slug;
}

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('menu_pages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ menuPages: data });
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body = await req.json().catch(() => null);

  if (!body || !body.customerName || !body.phone) {
    return NextResponse.json(
      { error: 'customerName and phone are required' },
      { status: 400 },
    );
  }

  const customerType = body.customerType ?? 'retail';

  // Check if a page already exists for this phone
  const { data: existing } = await supabase
    .from('menu_pages')
    .select('*')
    .eq('phone', body.phone)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ menuPage: existing, created: false });
  }

  // Generate unique slug
  let slug = generateSlug();
  let attempts = 0;
  while (attempts < 5) {
    const { data: conflict } = await supabase
      .from('menu_pages')
      .select('id')
      .eq('slug', slug)
      .maybeSingle();
    if (!conflict) break;
    slug = generateSlug();
    attempts++;
  }

  const { data, error } = await supabase
    .from('menu_pages')
    .insert({
      slug,
      customer_name: body.customerName,
      phone: body.phone,
      customer_type: customerType,
    })
    .select('*')
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ menuPage: data, created: true });
}
