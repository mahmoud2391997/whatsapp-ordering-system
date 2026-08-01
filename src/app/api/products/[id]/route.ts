import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();

  const product = await prisma.product.update({
    where: { id: params.id },
    data: {
      name: body.name,
      nameAr: body.name_ar,
      category: body.category,
      unit: body.unit,
      retailPrice: Number(body.retail_price),
      shopPrice: Number(body.shop_price),
      wholesalePrice: Number(body.wholesale_price),
      stock: Number(body.stock),
      imageUrl: body.image_url,
    },
  });

  return NextResponse.json(product);
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  await prisma.product.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
