import { prisma } from '@/lib/db';
import { getSallaAuthorization, sallaFetch } from '@/lib/salla';

type SallaRecord = Record<string, any>;

function dataOf(payload: any): SallaRecord {
  return (payload?.data ?? payload) as SallaRecord;
}

export async function syncSallaProduct(payload: any, auth = undefined) {
  const item = dataOf(payload);
  const id = String(item.id ?? item.product_id ?? '');
  if (!id) throw new Error('Salla product id is missing');
  const price = Number(item.price?.amount ?? item.price ?? 0);
  const name = String(item.name ?? item.title ?? 'Salla product');
  const imageUrl = String(item.image?.url ?? item.thumbnail ?? '');
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
  const status = String(item.status?.slug ?? item.status ?? 'pending');
  const total = Number(item.amounts?.total?.amount ?? item.total ?? 0);
  const existing = await prisma.order.findUnique({ where: { sallaOrderId } });
  const data = { customerName: String(item.customer?.name ?? item.customer_name ?? 'Salla customer'), customerPhone: phone, total, status, paymentStatus: String(item.payment?.status ?? 'unpaid'), location: item.shipping?.address?.street ? String(item.shipping.address.street) : null, sallaSyncStatus: 'synced', sallaSyncError: null, sallaSyncedAt: new Date() };
  return existing ? prisma.order.update({ where: { id: existing.id }, data }) : prisma.order.create({ data: { id: orderId, sallaOrderId, ...data } });
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
