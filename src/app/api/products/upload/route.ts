import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const bytes = await file.arrayBuffer();
  const wb = XLSX.read(bytes, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, unknown>[] = XLSX.utils.sheet_to_json(ws);

  if (!rows.length) return NextResponse.json({ error: 'Spreadsheet is empty' }, { status: 400 });

  const requiredCols = ['name', 'name_ar', 'category', 'unit', 'retail_price', 'shop_price', 'wholesale_price', 'stock'];
  const missing = requiredCols.filter(col => !(col in rows[0]));
  if (missing.length) {
    return NextResponse.json({ error: `Missing columns: ${missing.join(', ')}` }, { status: 400 });
  }

  const validCategories = ['vegetables', 'fruits', 'herbs'];
  const products = rows
    .map(r => ({
      name: String(r.name || '').trim(),
      nameAr: String(r.name_ar || '').trim(),
      category: validCategories.includes(String(r.category)) ? String(r.category) : 'vegetables',
      unit: String(r.unit || 'kg').trim(),
      retailPrice: Number(r.retail_price) || 0,
      shopPrice: Number(r.shop_price) || 0,
      wholesalePrice: Number(r.wholesale_price) || 0,
      stock: Number(r.stock) || 0,
      imageUrl: String(r.image_url || 'https://images.unsplash.com/photo-1592924357228-3674a0f6468d?w=400').trim(),
    }))
    .filter(p => p.name && p.nameAr);

  if (!products.length) {
    return NextResponse.json({ error: 'No valid products found' }, { status: 400 });
  }

  const created = await prisma.product.createMany({ data: products });
  return NextResponse.json({ imported: created.count, products }, { status: 201 });
}
