import { NextRequest, NextResponse } from 'next/server';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';
import { ensureSallaCategory, fetchSallaCategories } from '@/lib/salla-sync';

const VEGETABLE_KEYWORDS = ['طماطم', 'خيار', 'باذنجان', 'بطاطس', 'بصل', 'ثوم', 'جزر', 'فلفل', 'كوسة', 'قرع', 'سبانخ', 'ملفوف', 'كرنب', 'خس', 'بروكلي', 'قرنبيط', 'زهرة', 'فجل', 'شمندر', 'ذرة', 'بازلاء', 'فاصوليا', 'لوبيا', 'خضار', 'خضروات', 'خضراوات', 'vegetable', 'tomato', 'cucumber', 'eggplant', 'potato', 'onion', 'garlic', 'carrot', 'pepper', 'zucchini', 'squash', 'spinach', 'cabbage', 'lettuce', 'broccoli', 'cauliflower', 'radish', 'beet', 'corn', 'peas', 'beans'];
const FRUIT_KEYWORDS = ['تفاح', 'برتقال', 'موز', 'عنب', 'فراولة', 'مانجو', 'بطيخ', 'شمام', 'كيوي', 'أناناس', 'ليمون', 'رمان', 'خوخ', 'مشمش', 'كمثرى', 'تين', 'تمر', 'فواكه', 'فاكهة', 'fruit', 'apple', 'orange', 'banana', 'grape', 'strawberry', 'mango', 'watermelon', 'melon', 'kiwi', 'pineapple', 'lemon', 'pomegranate', 'peach', 'apricot', 'pear', 'fig', 'dates'];
const HERB_KEYWORDS = ['نعناع', 'ريحان', 'حبق', 'كزبرة', 'بقدونس', 'شبت', 'زعتر', 'إكليل', 'روزماري', 'مردقوش', 'ميرمية', 'أعشاب', 'اعشاب', 'herb', 'mint', 'basil', 'coriander', 'parsley', 'dill', 'thyme', 'rosemary', 'oregano', 'sage'];

function classifyProduct(name: string): 'vegetables' | 'fruits' | 'herbs' | 'unknown' {
  const n = String(name ?? '').toLowerCase();
  const hits = (list: string[]) => list.filter((k) => n.includes(k));
  const herbHit = hits(HERB_KEYWORDS);
  if (herbHit.length) return 'herbs';
  const fruitHit = hits(FRUIT_KEYWORDS);
  if (fruitHit.length) return 'fruits';
  const vegHit = hits(VEGETABLE_KEYWORDS);
  if (vegHit.length) return 'vegetables';
  return 'unknown';
}

export async function POST(req: NextRequest) {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  const apply = req.nextUrl.searchParams.get('apply') === '1';
  const diagnostics = { merchantId: auth.merchantId, scopes: auth.scopes, updatedAt: auth.updatedAt, status: auth.status };
  try {
    let page = 1;
    const sallaCategories = await fetchSallaCategories(auth);
    const categoryCache: Record<string, string> = {};
    const report: Array<{ id: string; name: string; currentCategory: string; classified: string; action: string }> = [];
    const unknown: string[] = [];
    let total = 0;
    while (page <= 100) {
      const result = await sallaFetch<{ data?: Array<Record<string, unknown>>; pagination?: { currentPage?: number; totalPages?: number }; total?: number }>(`/admin/v2/products?page=${page}&per_page=100`, {}, auth);
      const items = result.data ?? [];
      if (!items.length) break;
      total += items.length;
      for (const item of items) {
        const id = String(item.id ?? '');
        if (!id) continue;
        const name = String(item.name ?? item.name_en ?? item.name_ar ?? 'Salla product');
        const current = String((item.category as Record<string, unknown>)?.name ?? (Array.isArray(item.categories) ? (item.categories as Array<Record<string, unknown>>).map((c) => c.name ?? c.name_ar ?? '').join(', ') : ''));
        const classified = classifyProduct(name);
        if (classified === 'unknown') {
          unknown.push(name);
          report.push({ id, name, currentCategory: current, classified, action: 'skip' });
          continue;
        }
        if (apply) {
          if (!categoryCache[classified]) {
            categoryCache[classified] = await ensureSallaCategory(classified, sallaCategories, auth);
          }
          const categories = [Number(categoryCache[classified])];
          await sallaFetch(`/admin/v2/products/${id}`, { method: 'PUT', body: JSON.stringify({ categories }) }, auth);
          report.push({ id, name, currentCategory: current, classified, action: 'updated' });
        } else {
          report.push({ id, name, currentCategory: current, classified, action: 'would-update' });
        }
      }
      const totalPages = result.pagination?.totalPages ?? page;
      if (page >= totalPages) break;
      page++;
    }
    return NextResponse.json({ ok: true, dryRun: !apply, total, classified: report.length - unknown.length, unknown, report, diagnostics });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla categorize failed';
    return NextResponse.json({ error: message, diagnostics }, { status: 502 });
  }
}