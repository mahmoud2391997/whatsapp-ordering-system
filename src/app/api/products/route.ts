import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();
  const { data, error } = await supabase.from('products').select('*').order('category');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('products')
    .insert({
      name: body.name,
      name_ar: body.name_ar,
      category: body.category,
      unit: body.unit,
      retail_price: Number(body.retail_price),
      shop_price: Number(body.shop_price),
      wholesale_price: Number(body.wholesale_price),
      stock: Number(body.stock),
      image_url: body.image_url || 'https://images.unsplash.com/photo-1592924357228-3674a0f6468d?w=400',
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
