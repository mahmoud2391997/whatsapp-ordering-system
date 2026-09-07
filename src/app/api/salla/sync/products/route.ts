import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';
import { isFoodCatalogItem, matchesLocalCatalogName, categoryLabel, inferCategories } from '@/lib/salla-sync';

export async function POST() {
  const auth = await getSallaAuthorization();
  if (!auth) return NextResponse.json({ error: 'Salla is not connected' }, { status: 503 });
  try {
    const catalogNames = (await prisma.product.findMany({ select: { name: true } })).map((p) => p.name);
    let page = 1;
    let synced = 0;
    let skipped = 0;
    const accepted: string[] = [];
    let hasMore = true;
    while (hasMore && page <= 100) {
      const result = await sallaFetch<{ data?: Array<Record<string, unknown>>; pagination?: { currentPage?: number; totalPages?: number } }>(`/admin/v2/products?page=${page}&per_page=100`, {}, auth);
      for (const item of result.data ?? []) {
        const id = String(item.id ?? '');
        if (!id) continue;
        const name = String(item.name ?? item.name_en ?? 'Salla product');
        if (!isFoodCatalogItem(item as Record<string, unknown>) && !matchesLocalCatalogName(name, catalogNames)) {
          skipped++;
          continue;
        }
        accepted.push(id);
        const priceOf = (v: unknown) => (v as { amount?: number })?.amount ?? v;
        const price = Number(priceOf(item.price) ?? priceOf(item.regular_price) ?? 0) || 0;
        const image = String((item.image as Record<string, unknown> | undefined)?.url ?? item.main_image ?? item.thumbnail ?? item.image_url ?? '');
        const [category, unit] = inferCategories(categoryLabel(item as Record<string, unknown>));
        const existing = await prisma.product.findUnique({ where: { sallaProductId: id } });
        await prisma.product.upsert({ where: { sallaProductId: id }, update: { name, nameAr: existing?.nameAr ?? name, retailPrice: price, category, unit, stock: Number(item.quantity ?? item.stock ?? existing?.stock ?? 0), imageUrl: image || existing?.imageUrl || '', syncedAt: new Date() }, create: { name, nameAr: name, retailPrice: price, shopPrice: 0, wholesalePrice: 0, category, unit, stock: Number(item.quantity ?? item.stock ?? 0), imageUrl: image, sallaProductId: id, syncedAt: new Date() } });
        synced++;
      }
      const totalPages = result.pagination?.totalPages ?? page;
      hasMore = page < totalPages;
      page++;
    }
    const locallyLinked = await prisma.product.findMany({ where: { sallaProductId: { not: null } }, select: { id: true, sallaProductId: true } });
    const stale = locallyLinked.filter((p) => p.sallaProductId && !accepted.includes(p.sallaProductId));
    if (stale.length) {
      await prisma.product.deleteMany({ where: { id: { in: stale.map((p) => p.id) } } });
    }
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncAt: new Date(), lastSyncError: null } });
    return NextResponse.json({ ok: true, synced, skipped, pruned: stale.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Salla product sync failed';
    await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncError: message } });
    const status = message === 'SALLA_REAUTH_REQUIRED' || message === 'SALLA_NOT_CONNECTED' ? 401 : 502;
    return NextResponse.json({ error: message, retryable: status >= 500 }, { status });
  }
}
