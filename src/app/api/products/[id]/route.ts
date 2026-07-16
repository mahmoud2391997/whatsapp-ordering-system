import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const body = await req.json();

  const { data, error } = await supabase
    .from('products')
    .update({
      name: body.name,
      name_ar: body.name_ar,
      category: body.category,
      unit: body.unit,
      retail_price: Number(body.retail_price),
      shop_price: Number(body.shop_price),
      wholesale_price: Number(body.wholesale_price),
      stock: Number(body.stock),
      image_url: body.image_url,
    })
    .eq('id', params.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const supabase = createServerClient();
  const { error } = await supabase.from('products').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
