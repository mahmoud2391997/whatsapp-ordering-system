import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getProducts } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const products = await getProducts();
  const raw = products.map(p => ({
    id: p.id,
    name: p.name,
    nameAr: p.name_ar,
    category: p.category,
    unit: p.unit,
    retailPrice: p.retail_price,
    shopPrice: p.shop_price,
    wholesalePrice: p.wholesale_price,
    stock: p.stock,
    imageUrl: p.image_url,
  }));
  return NextResponse.json(raw);
}

export async function POST(req: Request) {
  const body = await req.json();

  const product = await prisma.product.create({
    data: {
      name: body.name,
      nameAr: body.name_ar,
      category: body.category,
      unit: body.unit,
      retailPrice: Number(body.retail_price),
      shopPrice: Number(body.shop_price),
      wholesalePrice: Number(body.wholesale_price),
      stock: Number(body.stock),
      imageUrl: body.image_url || 'https://images.unsplash.com/photo-1592924357228-3674a0f6468d?w=400',
    },
  });

  return NextResponse.json(product, { status: 201 });
}
