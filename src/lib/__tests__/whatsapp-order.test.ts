import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  menuPage: { findFirst: vi.fn(), create: vi.fn() },
  message: { create: vi.fn(), findFirst: vi.fn() },
  order: { create: vi.fn(), update: vi.fn() },
  orderItem: { createMany: vi.fn() },
  product: { findUnique: vi.fn() },
  fetchSallaCatalog: vi.fn(),
  resolveSallaStorefrontUrl: vi.fn(),
  pushOrderToSalla: vi.fn(),
  findCustomerOrder: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/salla', () => ({ fetchSallaCatalog: mocks.fetchSallaCatalog, resolveSallaStorefrontUrl: mocks.resolveSallaStorefrontUrl }));
vi.mock('@/lib/salla-sync', () => ({ pushOrderToSalla: mocks.pushOrderToSalla }));
vi.mock('@/lib/orders', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/orders')>();
  return { ...actual, findCustomerOrder: mocks.findCustomerOrder };
});

import { handleWhatsAppText, isMenuQuery, isStatusQuery } from '@/lib/whatsapp-order';

const catalog = [
  { id: '11', name: 'Tomato', nameAr: 'طماطم', category: 'vegetables', unit: 'kg', price: 15, stock: 40, imageUrl: '', purchasable: true },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APP_URL = 'https://shop.example.com';
  mocks.conversation.findFirst.mockResolvedValue(null);
  mocks.conversation.create.mockResolvedValue({ id: 'conv-1', phone: '966500000000' });
  mocks.conversation.update.mockResolvedValue({});
  mocks.menuPage.findFirst.mockResolvedValue(null);
  mocks.menuPage.create.mockResolvedValue({ id: 'menu-uuid', slug: 'wa-5000000000-abc' });
  mocks.message.create.mockResolvedValue({});
  mocks.message.findFirst.mockResolvedValue(null);
  mocks.product.findUnique.mockResolvedValue(null);
  mocks.fetchSallaCatalog.mockResolvedValue(catalog);
  mocks.resolveSallaStorefrontUrl.mockResolvedValue('https://salla.sa/live-store');
  mocks.pushOrderToSalla.mockResolvedValue({});
});

describe('intent helpers', () => {
  it('detects greetings as menu requests and status questions separately', () => {
    expect(isMenuQuery('مرحبا')).toBe(true);
    expect(isMenuQuery('عرض المنتجات')).toBe(true);
    expect(isStatusQuery('فين الطلب')).toBe(true);
    expect(isStatusQuery('5 كيلو طماطم')).toBe(false);
  });
});

describe('handleWhatsAppText', () => {
  it('sends a personalized Salla menu link on greeting', async () => {
    const result = await handleWhatsAppText({ phone: '+966 50 000 0000', text: 'مرحبا', name: 'Ali' });
    expect(result.menuUrl).toBe('https://salla.sa/live-store');
    expect(result.reply).toContain(result.menuUrl);
    expect(mocks.menuPage.create).toHaveBeenCalled();
  });

  it('parses a typed order against the Salla catalog', async () => {
    const result = await handleWhatsAppText({ phone: '966500000000', text: '5 كيلو طماطم' });
    expect(result.reply).toContain('طماطم');
    expect(result.reply).toContain('75.00');
    expect(mocks.message.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ type: 'order_draft' }),
    }));
  });

  it('places the draft on Salla after address + confirmation', async () => {
    mocks.conversation.findFirst.mockResolvedValue({ id: 'conv-1', phone: '966500000000' });
    mocks.menuPage.findFirst.mockResolvedValue({ id: 'menu-uuid', slug: 'wa-5000000000-abc' });
    mocks.message.findFirst.mockResolvedValue({
      text: JSON.stringify({ items: [{ id: '11', name: 'Tomato', nameAr: 'طماطم', qty: 2, unit: 'kg', price: 15, stock: 40, purchasable: true }], unmatched: [], total: 30, location: 'الرياض حي النخيل' }),
    });
    mocks.order.create.mockResolvedValue({ id: 'ORD-123456' });
    const result = await handleWhatsAppText({ phone: '966500000000', text: 'نعم' });
    expect(mocks.order.create).toHaveBeenCalled();
    expect(mocks.pushOrderToSalla).toHaveBeenCalled();
    expect(result.reply).toContain('تم تسجيل طلبك');
  });
});
