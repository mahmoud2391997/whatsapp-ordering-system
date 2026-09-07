import { NextRequest, NextResponse } from 'next/server';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

const CLOTHING_CATEGORY_NAMES = ['الفساتين', 'البلايز', 'التنانير', 'الجاكيتات'];

export async function POST(req: NextRequest) {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const explicit = req.nextUrl.searchParams.get('names')?.split(',').map((n) => n.trim()).filter(Boolean);
  const targets = (explicit?.length ? explicit : CLOTHING_CATEGORY_NAMES).map((n) => n.toLowerCase());
  const report: Array<{ id: string; name: string; products: number; action: string }> = [];
  try {
    const result = await sallaFetch<{ data?: Array<Record<string, unknown>> }>(`/admin/v2/categories?page=1&per_page=100&with=items`, {}, auth);
    const categories = result.data ?? [];
    for (const category of categories) {
      const id = String(category.id ?? '');
      const name = String(category.name ?? category.name_ar ?? '');
      if (!id || !targets.includes(name.toLowerCase())) continue;
      const items = Array.isArray(category.items) ? category.items : [];
      const productCount = items.length;
      if (productCount > 0) {
        report.push({ id, name, products: productCount, action: 'skipped-not-empty' });
        continue;
      }
      try {
        await sallaFetch(`/admin/v2/categories/${id}`, { method: 'DELETE' }, auth);
        report.push({ id, name, products: 0, action: 'deleted' });
      } catch (error) {
        report.push({ id, name, products: 0, action: `delete-failed: ${error instanceof Error ? error.message : String(error)}` });
      }
    }
    return NextResponse.json({ ok: true, total: categories.length, report });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla cleanup failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}