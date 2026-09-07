import { describe, it, expect, beforeEach, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  order: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  orderStatusHistory: { create: vi.fn() },
  $transaction: vi.fn(),
  sendWhatsApp: vi.fn(),
  pushOrderStatusToSalla: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/whatsapp', () => ({ sendWhatsApp: mocks.sendWhatsApp }));
vi.mock('@/lib/salla-sync', () => ({ pushOrderStatusToSalla: mocks.pushOrderStatusToSalla }));

import { canTransition, normalizePhone, findCustomerOrder, transitionOrder, statusReply } from '@/lib/orders';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('normalizePhone', () => {
  it('strips non-digit characters', () => {
    expect(normalizePhone('+966 50 000 0000')).toBe('966500000000');
  });
});

describe('canTransition', () => {
  it('allows valid transitions', () => {
    expect(canTransition('pending', 'confirmed')).toBe(true);
    expect(canTransition('ready', 'out_for_delivery')).toBe(true);
    expect(canTransition('delivered', 'completed')).toBe(true);
  });
  it('rejects invalid transitions and unknown statuses', () => {
    expect(canTransition('pending', 'delivered')).toBe(false);
    expect(canTransition('completed', 'pending')).toBe(false);
    expect(canTransition('bogus', 'pending')).toBe(false);
  });
});

describe('findCustomerOrder', () => {
  it('looks up by reference when phone matches', async () => {
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-123', customerPhone: '966500000000' });
    const result = await findCustomerOrder('ord-123', '+966 50 000 0000');
    expect(mocks.order.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'ORD-123' } }));
    expect(result).toBeDefined();
  });
  it('falls back to latest by phone when reference phone mismatches', async () => {
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-123', customerPhone: '999999999' });
    mocks.order.findFirst.mockResolvedValue({ id: 'ORD-456', customerPhone: '966500000000' });
    const result = await findCustomerOrder('ORD-123', '966500000000');
    expect(mocks.order.findFirst).toHaveBeenCalled();
    expect(result?.id).toBe('ORD-456');
  });
});

describe('transitionOrder', () => {
  it('throws when order is missing', async () => {
    mocks.$transaction.mockImplementation((cb) => cb({ order: mocks.order, orderStatusHistory: mocks.orderStatusHistory }));
    mocks.order.findUnique.mockResolvedValue(null);
    await expect(transitionOrder('ORD-1', 'confirmed')).rejects.toThrow('ORDER_NOT_FOUND');
  });

  it('throws on invalid transition', async () => {
    mocks.$transaction.mockImplementation((cb) => cb({ order: mocks.order, orderStatusHistory: mocks.orderStatusHistory }));
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', status: 'pending', sallaOrderId: null });
    await expect(transitionOrder('ORD-1', 'delivered')).rejects.toThrow('INVALID_STATUS_TRANSITION');
  });

  it('transitions, logs history and sends WhatsApp', async () => {
    mocks.$transaction.mockImplementation((cb) => cb({ order: mocks.order, orderStatusHistory: mocks.orderStatusHistory }));
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', status: 'pending', customerPhone: '96650000000', sallaOrderId: null });
    mocks.order.update.mockResolvedValue({ id: 'ORD-1', status: 'confirmed', customerPhone: '96650000000', sallaOrderId: null });
    mocks.orderStatusHistory.create.mockResolvedValue({});
    await transitionOrder('ORD-1', 'confirmed');
    expect(mocks.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'confirmed' } }));
    expect(mocks.orderStatusHistory.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ oldStatus: 'pending', newStatus: 'confirmed' }) }));
    expect(mocks.sendWhatsApp).toHaveBeenCalledWith('96650000000', expect.stringContaining('ORD-1'));
    expect(mocks.pushOrderStatusToSalla).not.toHaveBeenCalled();
  });

  it('pushes status to Salla when order is linked', async () => {
    mocks.$transaction.mockImplementation((cb) => cb({ order: mocks.order, orderStatusHistory: mocks.orderStatusHistory }));
    const updated = { id: 'ORD-1', status: 'confirmed', customerPhone: '96650000000', sallaOrderId: '555' };
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', status: 'pending', customerPhone: '96650000000', sallaOrderId: '555' });
    mocks.order.update.mockResolvedValue(updated);
    mocks.orderStatusHistory.create.mockResolvedValue({});
    mocks.sendWhatsApp.mockResolvedValue(true);
    mocks.pushOrderStatusToSalla.mockResolvedValue({});
    mocks.order.update.mockResolvedValueOnce(updated).mockResolvedValueOnce({});
    await transitionOrder('ORD-1', 'confirmed');
    expect(mocks.pushOrderStatusToSalla).toHaveBeenCalledWith('ORD-1', 'confirmed');
    expect(mocks.order.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ sallaSyncStatus: 'synced' }) }));
  });

  it('marks sync failed when Salla push errors', async () => {
    mocks.$transaction.mockImplementation((cb) => cb({ order: mocks.order, orderStatusHistory: mocks.orderStatusHistory }));
    const updated = { id: 'ORD-1', status: 'confirmed', customerPhone: null, sallaOrderId: '555' };
    mocks.order.findUnique.mockResolvedValue({ id: 'ORD-1', status: 'pending', customerPhone: null, sallaOrderId: '555' });
    mocks.order.update.mockResolvedValueOnce(updated).mockResolvedValueOnce({});
    mocks.orderStatusHistory.create.mockResolvedValue({});
    mocks.pushOrderStatusToSalla.mockRejectedValue(new Error('SALLA_ORDER_NOT_LINKED'));
    await transitionOrder('ORD-1', 'confirmed');
    expect(mocks.order.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ sallaSyncStatus: 'failed', sallaSyncError: 'SALLA_ORDER_NOT_LINKED' }) }));
  });
});

describe('statusReply', () => {
  it('formats status text', () => {
    const reply = statusReply({ id: 'ORD-1', status: 'confirmed', paymentStatus: 'unpaid', total: 50, createdAt: new Date() });
    expect(reply).toContain('ORD-1');
    expect(reply).toContain('Confirmed');
    expect(reply).toContain('50.00');
  });
});