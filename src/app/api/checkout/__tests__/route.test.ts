import { describe, it, expect, beforeEach, beforeAll, afterAll, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  db: { isDbActive: vi.fn() },
  prisma: {
    menuPage: { findUnique: vi.fn() },
    order: { create: vi.fn(), update: vi.fn() },
    orderItem: { createMany: vi.fn() },
    customer: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
    message: { create: vi.fn() },
  },
  sendWhatsApp: vi.fn(),
  pushOrderToSalla: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks.prisma }));
vi.mock('@/lib/data', () => ({ isDbActive: mocks.db.isDbActive }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: mocks.sendWhatsApp }));
vi.mock('@/lib/salla-sync', () => ({ pushOrderToSalla: mocks.pushOrderToSalla }));

import { POST } from '@/app/api/checkout/route';

const validBody = {
  customerId: 'menu-1',
  customerName: 'Ali',
  phone: '+20 100 000 0000',
  items: [{ product_id: 'p1', product_name: 'Tomatoes', qty: 2, unit: 'kg', unit_price: 10 }],
  total: 20,
  customerType: 'retail',
  location: 'Cairo',
  paymentMethod: 'cod',
  customerConfirmed: true,
};

function req(body: unknown) {
  return new Request('https://example.com/api/checkout', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
}

beforeAll(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
  vi.useFakeTimers();
  vi.setSystemTime(new Date(1700000000000));
});

afterAll(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.pushOrderToSalla.mockResolvedValue(null);
  mocks.db.isDbActive.mockResolvedValue(true);
  mocks.prisma.menuPage.findUnique.mockResolvedValue({ id: 'menu-1' });
  mocks.prisma.order.create.mockResolvedValue({ id: 'ORD-000000' });
  mocks.prisma.customer.findUnique.mockResolvedValue(null);
  mocks.prisma.conversation.findFirst.mockResolvedValue(null);
  mocks.prisma.conversation.create.mockResolvedValue({ id: 'conv-1' });
  mocks.prisma.message.create.mockResolvedValue({});
});

describe('POST /api/checkout validation', () => {
  it('rejects missing items', async () => {
    const res = await POST(req({ ...validBody, items: [] }));
    expect(res.status).toBe(400);
  });

  it('rejects missing name/phone', async () => {
    const res = await POST(req({ ...validBody, customerName: ' ' }));
    expect(res.status).toBe(400);
  });

  it('rejects missing location', async () => {
    const res = await POST(req({ ...validBody, location: '' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Delivery address is required before placing the order' });
  });

  it('rejects unconfirmed orders', async () => {
    const res = await POST(req({ ...validBody, customerConfirmed: false }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/checkout happy path', () => {
  it('creates order, items, customer and conversation', async () => {
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.orderId).toBe('ORD-000000');
    expect(mocks.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'pending', paymentStatus: 'cod' }) }));
    expect(mocks.prisma.orderItem.createMany).toHaveBeenCalled();
    expect(mocks.prisma.customer.create).toHaveBeenCalled();
    expect(mocks.prisma.conversation.create).toHaveBeenCalled();
    expect(mocks.prisma.message.create).toHaveBeenCalled();
  });

  it('normalizes phone and increments existing customer orders', async () => {
    mocks.prisma.customer.findUnique.mockResolvedValue({ phone: '+20 100 000 0000' });
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    expect(mocks.prisma.order.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ customerPhone: '201000000000' }) }));
    expect(mocks.prisma.customer.create).not.toHaveBeenCalled();
    expect(mocks.prisma.customer.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ totalOrders: { increment: 1 } }) }));
  });

  it('returns 404 when menu page missing', async () => {
    mocks.prisma.menuPage.findUnique.mockResolvedValue(null);
    const res = await POST(req(validBody));
    expect(res.status).toBe(404);
  });

  it('pushes order to Salla', async () => {
    await POST(req(validBody));
    expect(mocks.pushOrderToSalla).toHaveBeenCalledWith('ORD-000000');
  });
});

describe('POST /api/checkout demo mode', () => {
  it('simulates checkout when DB is down', async () => {
    mocks.db.isDbActive.mockResolvedValue(false);
    const res = await POST(req(validBody));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.demo).toBe(true);
    expect(mocks.prisma.order.create).not.toHaveBeenCalled();
  });
});