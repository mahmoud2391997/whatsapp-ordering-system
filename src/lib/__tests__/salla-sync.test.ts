import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  product: { findUnique: vi.fn(), upsert: vi.fn(), create: vi.fn(), update: vi.fn(), findMany: vi.fn() },
  customer: { findUnique: vi.fn(), upsert: vi.fn() },
  order: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  sallaAuthorization: { findFirst: vi.fn(), update: vi.fn() },
  getSallaAuthorization: vi.fn(),
  sallaFetch: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/salla', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/salla')>();
  return { ...actual, getSallaAuthorization: mocks.getSallaAuthorization, sallaFetch: mocks.sallaFetch };
});

import { syncSallaProduct, syncSallaCustomer, syncSallaOrder, pushOrderToSalla, pushOrderStatusToSalla, sallaProductPayload, pushCatalogToSalla } from '@/lib/salla-sync';

const auth = { id: 'auth-1', merchantId: 'm1', accessToken: 'enc', refreshToken: null, status: 'active' } as any;

beforeEach(() => {
  vi.clearAllMocks();
  mocks.sallaAuthorization.findFirst.mockResolvedValue(auth);
  mocks.getSallaAuthorization.mockResolvedValue(auth);
});

describe('syncSallaProduct', () => {
  it('creates a product when no local match exists', async () => {
    mocks.product.findUnique.mockResolvedValue(null);
    mocks.product.create.mockResolvedValue({ id: 'p1' });
    const payload = { data: { id: 9001, name: 'Tomato', category: { name: 'vegetables' }, price: 5, image: 'https://x/i.png' } };
    await syncSallaProduct(payload, auth);
    expect(mocks.product.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ sallaProductId: '9001', name: 'Tomato', shopPrice: 0 }),
    }));
    expect(mocks.product.update).not.toHaveBeenCalled();
  });

  it('updates existing product by salla id', async () => {
    mocks.product.findUnique.mockResolvedValue({ id: 'local-1', sallaProductId: '9001' });
    mocks.product.update.mockResolvedValue({ id: 'local-1' });
    await syncSallaProduct({ data: { id: 9001, name: 'Lettuce', category: 'vegetables', price: 3 } }, auth);
    expect(mocks.product.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'local-1' },
      data: expect.objectContaining({ name: 'Lettuce' }),
    }));
    expect(mocks.product.create).not.toHaveBeenCalled();
  });

  it('skips non-food products (e.g. clothing) without a local name match', async () => {
    mocks.product.findMany.mockResolvedValue([{ name: 'Tomato' }, { name: 'Cucumber' }]);
    mocks.product.findUnique.mockResolvedValue(null);
    mocks.product.create.mockResolvedValue({ id: 'p2' });
    const result = await syncSallaProduct({ data: { id: 9002, name: 'فستان', price: 120 } }, auth);
    expect(result).toBeNull();
    expect(mocks.product.create).not.toHaveBeenCalled();
  });
});

describe('syncSallaCustomer', () => {
  it('upserts by phone with salla ids', async () => {
    mocks.customer.upsert.mockResolvedValue({ id: 'c1' });
    await syncSallaCustomer({ data: { id: 42, first_name: 'Ali', last_name: 'Omar', phone: '966500000000', email: 'a@b.com' } });
    expect(mocks.customer.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { phone: '966500000000' },
      create: expect.objectContaining({ sallaCustomerId: '42', sallaEmail: 'a@b.com' }),
    }));
  });
});

describe('syncSallaOrder', () => {
  it('creates order with SALLA-prefixed id on first sync', async () => {
    mocks.order.findUnique.mockResolvedValue(null);
    mocks.order.create.mockResolvedValue({ id: 'SALLA-555' });
    const payload = { data: { id: 555, customer: { name: 'Ali', phone: '9665' }, total: 100, status: { value: 'new' } } };
    await syncSallaOrder(payload);
    expect(mocks.order.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ id: 'SALLA-555', sallaOrderId: '555', sallaSyncStatus: 'synced' }),
    }));
  });
});

describe('pushOrderToSalla', () => {
  it('throws when not connected', async () => {
    mocks.getSallaAuthorization.mockResolvedValue(null);
    await expect(pushOrderToSalla('ORD-123')).rejects.toThrow('SALLA_NOT_CONNECTED');
  });

  it('throws when order not found', async () => {
    mocks.getSallaAuthorization.mockResolvedValue(auth);
    mocks.order.findUnique.mockResolvedValue(null);
    await expect(pushOrderToSalla('ORD-123')).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('pushes order via API and marks synced', async () => {
    mocks.getSallaAuthorization.mockResolvedValue(auth);
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-123', customerName: 'Ali', customerPhone: '9665', customerType: 'retail', total: 50, location: 'Riyadh', orderItems: [{ productName: 'Tomato', qty: 2, unit: 'kg', unitPrice: 25 }] });
    mocks.sallaFetch.mockResolvedValue({ data: { id: 3000 } });
    mocks.order.update.mockResolvedValue({});
    const result = await pushOrderToSalla('ORD-123');
    const [path, init] = mocks.sallaFetch.mock.calls[0];
    expect(path).toBe('/admin/v2/orders');
    expect(JSON.parse(init.body)).toEqual(expect.objectContaining({ reference_id: 'ORD-123', total: 50 }));
    expect(mocks.order.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { sallaOrderId: '3000', sallaSyncStatus: 'synced', sallaSyncedAt: expect.any(Date), sallaSyncError: null },
    }));
    expect(result).toEqual({ data: { id: 3000 } });
  });
});

describe('pushOrderStatusToSalla', () => {
  it('throws when order has no salla link', async () => {
    mocks.getSallaAuthorization.mockResolvedValue(auth);
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', sallaOrderId: null });
    await expect(pushOrderStatusToSalla('ORD-1', 'confirmed')).rejects.toThrow('SALLA_ORDER_NOT_LINKED');
  });

  it('posts status update for linked order', async () => {
    mocks.getSallaAuthorization.mockResolvedValue(auth);
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', sallaOrderId: '555' });
    mocks.sallaFetch.mockResolvedValue({ data: { id: '555' } });
    await pushOrderStatusToSalla('ORD-1', 'confirmed');
    expect(mocks.sallaFetch).toHaveBeenCalledWith('/admin/v2/orders/555/status', expect.objectContaining({ method: 'POST' }), auth);
  });
});

describe('sallaProductPayload', () => {
  it('builds a sale product with arabic name, quantity and image', () => {
    const payload = sallaProductPayload({ name: 'Tomato', nameAr: 'طماطم', retailPrice: 5, stock: 20, imageUrl: 'https://x/t.png' });
    expect(payload).toEqual({
      name: 'طماطم',
      price: 5,
      product_type: 'product',
      quantity: 20,
      status: 'sale',
      require_shipping: true,
      images: [{ original: 'https://x/t.png', default: true }],
    });
  });

  it('marks out-of-stock products as out and omits missing images', () => {
    const payload = sallaProductPayload({ name: 'Basil', retailPrice: 1.5, stock: 0, imageUrl: null });
    expect(payload.status).toBe('out');
    expect(payload.images).toBeUndefined();
  });
});

describe('pushCatalogToSalla', () => {
  it('creates remote products and links ids back', async () => {
    mocks.product.findMany.mockResolvedValue([{ id: 'p1', name: 'Tomato', nameAr: 'طماطم', retailPrice: 5, stock: 10, imageUrl: 'https://x/t.png', sallaProductId: null }]);
    mocks.sallaFetch.mockResolvedValue({ data: { id: 70001 } });
    mocks.product.update.mockResolvedValue({});
    const result = await pushCatalogToSalla();
    expect(mocks.sallaFetch).toHaveBeenCalledWith('/admin/v2/products', expect.objectContaining({ method: 'POST' }), auth);
    expect(mocks.product.update).toHaveBeenCalledWith(expect.objectContaining({ data: { sallaProductId: '70001', syncedAt: expect.any(Date) } }));
    expect(result).toEqual({ ok: true, pushed: 1, created: 1, updated: 0, errors: [] });
  });

  it('updates already-linked products via PUT', async () => {
    mocks.product.findMany.mockResolvedValue([{ id: 'p2', name: 'Apple', nameAr: 'تفاح', retailPrice: 4, stock: 50, imageUrl: null, sallaProductId: '900' }]);
    mocks.sallaFetch.mockResolvedValue({ data: { id: 900 } });
    const result = await pushCatalogToSalla();
    expect(mocks.sallaFetch).toHaveBeenCalledWith('/admin/v2/products/900', expect.objectContaining({ method: 'PUT' }), auth);
    expect(result).toEqual({ ok: true, pushed: 1, created: 0, updated: 1, errors: [] });
  });
});