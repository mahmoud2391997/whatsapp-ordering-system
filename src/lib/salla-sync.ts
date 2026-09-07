import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

type SallaRecord = Record<string, any>;

function dataOf(payload: any): SallaRecord {
  return (payload?.data ?? payload) as SallaRecord;
}

export function sallaAmount(value: unknown): number {
  if (value == null) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value.replace(/[,\s]/g, ''));
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof value === 'object') return sallaAmount((value as Record<string, unknown>)?.amount);
  return 0;
}

export function sallaStatusSlug(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>;
    return String(o.slug ?? o.name ?? o.value ?? 'pending').toLowerCase();
  }
  return 'pending';
}

const STATUS_ALIAS: Record<string, string> = {
  new: 'pending',
  created: 'pending',
  payment_pending: 'pending',
  payment_failed: 'pending',
  under_review: 'confirmed',
  in_progress: 'preparing',
  working: 'preparing',
  ready: 'ready',
  delivering: 'out_for_delivery',
  shipped: 'out_for_delivery',
  delivered: 'delivered',
  completed: 'completed',
  canceled: 'cancelled',
  cancelled: 'cancelled',
  other: 'pending',
};

export function toLocalStatus(slug: string): string {
  return STATUS_ALIAS[slug] ?? slug;
}

const FOOD_KEYWORDS = [
  'vegetable', 'vegetables', 'veg', 'fruit', 'fruits', 'herb', 'herbs', 'salad', 'sallad',
  'produce', 'grocery', 'groceries', 'food', 'greens', 'fresh', 'organic', 'legume', 'legumes',
  'خضار', 'خضروات', 'خضراوات', 'خضاره', 'فواكه', 'فاكهة', 'أعشاب', 'اعشاب', 'خضار وفواكه',
  'خضروات وفواكه', 'بقوليات', 'حبوب', 'طعام', 'منتجات طازجة', 'منتجات غذائية',
];

export function categoryLabel(item: SallaRecord): string {
  const raw = (item as Record<string, unknown>).category ?? (item as Record<string, unknown>).categories;
  if (Array.isArray(raw)) {
    return raw
      .map((c) => (typeof c === 'string' ? c : String((c as Record<string, unknown>)?.name ?? (c as Record<string, unknown>)?.name_ar ?? '')))
      .join(' ');
  }
  if (raw && typeof raw === 'object') return String((raw as Record<string, unknown>)?.name ?? (raw as Record<string, unknown>)?.name_ar ?? '');
  return String(raw ?? '');
}

export function isFoodCatalogItem(item: SallaRecord): boolean {
  const haystack = `${categoryLabel(item)} ${String(item.name ?? item.title ?? '')}`.toLowerCase();
  return FOOD_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

export function normalizeCatalogName(name: string): string {
  return String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]+/g, ' ');
}

export function matchesLocalCatalogName(remoteName: string, localNames: string[]): boolean {
  const r = normalizeCatalogName(remoteName);
  if (!r) return false;
  return localNames.some((n) => {
    const ln = normalizeCatalogName(n);
    return ln && (ln.includes(r) || r.includes(ln));
  });
}

export function inferCategories(categoryLabelText: string): [string, string] {
  const label = categoryLabelText.toLowerCase();
  if (label.includes('fruit') || label.includes('فاكهة') || label.includes('فواكه')) return ['fruits', 'kg'];
  if (label.includes('herb') || label.includes('أعشاب') || label.includes('اعشاب')) return ['herbs', 'bunch'];
  return ['vegetables', 'kg'];
}

export async function syncSallaProduct(payload: any, auth = undefined) {
  const item = dataOf(payload);
  if (!isFoodCatalogItem(item)) {
    const localNames = (await prisma.product.findMany({ select: { name: true } })).map((p) => p.name);
    if (!matchesLocalCatalogName(String(item.name ?? item.title ?? ''), localNames)) return null;
  }
  const id = String(item.id ?? item.product_id ?? '');
  if (!id) throw new Error('Salla product id is missing');
  const price = Number(item.price?.amount ?? item.price ?? 0);
  const name = String(item.name ?? item.title ?? 'Salla product');
  const imageUrl = String(item.image?.url ?? item.main_image ?? item.thumbnail ?? '');
  const existing = await prisma.product.findUnique({ where: { sallaProductId: id } });
  const data = { name, nameAr: String(item.name_ar ?? name), retailPrice: price, syncedAt: new Date() };
  if (existing) return prisma.product.update({ where: { id: existing.id }, data });
  return prisma.product.create({ data: { ...data, sallaProductId: id, shopPrice: 0, wholesalePrice: 0, category: 'vegetables', unit: 'kg', stock: Number(item.quantity ?? 0), imageUrl } });
}

export async function syncSallaCustomer(payload: any) {
  const item = dataOf(payload);
  const id = String(item.id ?? item.customer_id ?? '');
  const rawPhone = item.mobile ?? item.phone ?? '';
  const phone = String(rawPhone ? `${item.mobile_code ?? ''}${rawPhone}` : '');
  if (!id || !phone) throw new Error('Salla customer id or phone is missing');
  const fallbackName = `${item.first_name ?? ''} ${item.last_name ?? ''}`.trim() || 'Salla customer';
  const name = String(item.name ?? fallbackName);
  return prisma.customer.upsert({ where: { phone }, update: { name, sallaCustomerId: id, sallaEmail: item.email ? String(item.email) : undefined }, create: { name, phone, sallaCustomerId: id, sallaEmail: item.email ? String(item.email) : null } });
}

export async function syncSallaOrder(payload: any) {
  const item = dataOf(payload);
  const sallaOrderId = String(item.id ?? item.order_id ?? '');
  if (!sallaOrderId) throw new Error('Salla order id is missing');
  const phone = String(item.customer?.mobile ?? item.customer?.phone ?? item.phone ?? 'unknown');
  const orderId = `SALLA-${sallaOrderId}`;
  const status = toLocalStatus(sallaStatusSlug(item.status));
  const total = sallaAmount(item.amounts?.total ?? item.total ?? 0);
  const existing = await prisma.order.findUnique({ where: { sallaOrderId } });
  const data = { customerName: String(item.customer?.name ?? item.customer_name ?? 'Salla customer'), customerPhone: phone, total, status, paymentStatus: String(item.payment?.status ?? 'unpaid'), location: item.shipping?.address?.street ? String(item.shipping.address.street) : null, sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() };
  return existing ? prisma.order.update({ where: { id: existing.id }, data }) : prisma.order.create({ data: { id: orderId, sallaOrderId, ...data } });
}

export function sallaProductPayload(product: { name: string; nameAr?: string | null; retailPrice?: number | { toString(): string } | null; stock?: number }) {
  return {
    name: product.nameAr || product.name,
    price: Number(product.retailPrice) || 0,
    product_type: 'product',
    quantity: Number(product.stock) || 0,
    status: Number(product.stock) > 0 ? 'sale' : 'out',
    require_shipping: true,
    weight: 1,
    weight_type: 'kg',
  } as const;
}

async function attachProductImage(remoteId: string, imageUrl: string, auth?: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  const response = await fetch(imageUrl, { cache: 'no-store' });
  if (!response.ok || !response.body) throw new Error(`image download failed (${response.status})`);
  const bytes = await response.arrayBuffer();
  const extension = response.headers.get('content-type')?.includes('png') ? 'png' : 'jpg';
  const form = new FormData();
  form.append('photo', new Blob([bytes]), `image.${extension}`);
  form.append('main', 'true');
  await sallaFetch(`/admin/v2/products/${remoteId}/images`, { method: 'POST', body: form }, auth);
}

export async function pushCatalogToSalla() {
  const auth = await getSallaAuthorization();
  if (!auth) throw new Error('SALLA_NOT_CONNECTED');
  const products = await prisma.product.findMany({ orderBy: { name: 'asc' } });
  let created = 0;
  let updated = 0;
  const errors: Array<{ name: string; error: string }> = [];
  for (const product of products) {
    const payload = sallaProductPayload(product);
    try {
      let remoteId = product.sallaProductId;
      if (remoteId) {
        await sallaFetch(`/admin/v2/products/${remoteId}`, { method: 'PUT', body: JSON.stringify(payload) }, auth);
        updated++;
      } else {
        const result = await sallaFetch<{ data?: { id?: string | number } }>('/admin/v2/products', { method: 'POST', body: JSON.stringify(payload) }, auth);
        remoteId = String(result?.data?.id ?? '');
        if (remoteId) await prisma.product.update({ where: { id: product.id }, data: { sallaProductId: remoteId, syncedAt: new Date() } });
        created++;
      }
      if (remoteId && product.imageUrl) {
        try {
          await attachProductImage(remoteId, product.imageUrl, auth);
        } catch (error) {
          errors.push({ name: product.name, error: `image: ${error instanceof Error ? error.message : String(error)}` });
        }
      }
    } catch (error) {
      errors.push({ name: product.name, error: error instanceof Error ? error.message : String(error) });
    }
  }
  await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { lastSyncAt: new Date(), lastSyncError: errors.length ? errors[0].error : null } });
  return { ok: true, pushed: created + updated, created, updated, errors };
}

export async function pushOrderToSalla(orderId: string) {
  const auth = await getSallaAuthorization();
  if (!auth) throw new Error('SALLA_NOT_CONNECTED');
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { orderItems: true } });
  if (!order) throw new Error('ORDER_NOT_FOUND');
  const result = await sallaFetch('/admin/v2/orders', { method: 'POST', body: JSON.stringify({ reference_id: order.id, total: Number(order.total), customer: { name: order.customerName, mobile: order.customerPhone }, items: order.orderItems.map((item) => ({ name: item.productName, quantity: Number(item.qty), price: Number(item.unitPrice) })) }) }, auth);
  const remoteId = String((result as any)?.data?.id ?? (result as any)?.id ?? '');
  await prisma.order.update({ where: { id: order.id }, data: { sallaOrderId: remoteId || undefined, sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() } });
  return result;
}

export async function pushOrderStatusToSalla(orderId: string, status: string) {
  const auth = await getSallaAuthorization();
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!auth || !order?.sallaOrderId) throw new Error('SALLA_ORDER_NOT_LINKED');
  return sallaFetch(`/admin/v2/orders/${order.sallaOrderId}/status`, { method: 'POST', body: JSON.stringify({ status }) }, auth);
}

export async function applySallaWebhook(eventType: string, payload: any) {
  if (eventType.includes('product')) return syncSallaProduct(payload);
  if (eventType.includes('customer')) return syncSallaCustomer(payload);
  if (eventType.includes('order')) return syncSallaOrder(payload);
  return null;
}
