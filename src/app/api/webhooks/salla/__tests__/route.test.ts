import { describe, it, expect, beforeEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import crypto from 'node:crypto';

const mocks = vi.hoisted(() => ({
  webhookEvent: { create: vi.fn(), update: vi.fn() },
  sallaAuthorization: { updateMany: vi.fn(), upsert: vi.fn() },
  verifySallaWebhook: vi.fn(),
  encryptToken: vi.fn(),
  applySallaWebhook: vi.fn(),
  Prisma: { PrismaClientKnownRequestError: class extends Error { code: string; constructor(message: string, code: string) { super(message); this.code = code; } } },
}));

vi.mock('@/lib/db', () => ({ prisma: mocks }));
vi.mock('@/lib/salla', () => ({ verifySallaWebhook: mocks.verifySallaWebhook, encryptToken: mocks.encryptToken }));
vi.mock('@/lib/salla-sync', () => ({ applySallaWebhook: mocks.applySallaWebhook }));
vi.mock('@prisma/client', () => ({ Prisma: mocks.Prisma }));

import { POST } from '@/app/api/webhooks/salla/route';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.encryptToken.mockImplementation((v: string) => `enc:${v}`);
  mocks.webhookEvent.create.mockResolvedValue({ id: 'evt-1' });
  mocks.webhookEvent.update.mockResolvedValue({});
  mocks.sallaAuthorization.updateMany.mockResolvedValue({ count: 1 });
});

function signedRequest(body: Record<string, unknown>, sig?: string) {
  const rawBody = JSON.stringify(body);
  const signature = sig ?? 'valid-sig';
  return new NextRequest('https://example.com/api/webhooks/salla', { method: 'POST', body: rawBody, headers: { 'x-salla-signature': signature, 'content-type': 'application/json' } });
}

describe('POST /api/webhooks/salla', () => {
  it('rejects missing/invalid signature with 401', async () => {
    mocks.verifySallaWebhook.mockReturnValue(false);
    const res = await POST(signedRequest({ event: 'order.created' } as any));
    expect(res.status).toBe(401);
  });

  it('rejects malformed JSON with 400', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    const req = new NextRequest('https://x/api/webhooks/salla', { method: 'POST', body: 'not json', headers: { 'x-salla-signature': 's' } });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('stores the token on app.store.authorize (easy mode)', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    mocks.sallaAuthorization.upsert.mockResolvedValue({ id: 'auth-1', merchantId: '123' });
    const body = { event: 'app.store.authorize', merchant_id: 123, data: { access_token: 'ory_at_abc', refresh_token: 'ory_rt_def', expires: 1_700_000_000, scope: 'orders.read_write offline_access' } };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(mocks.sallaAuthorization.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { merchantId: '123' },
      create: expect.objectContaining({ merchantId: '123', accessToken: 'enc:ory_at_abc', refreshToken: 'enc:ory_rt_def', status: 'active' }),
    }));
    expect(mocks.sallaAuthorization.upsert.mock.calls[0][0].create.expiresAt).toBeInstanceOf(Date);
  });

  it('computes expiresAt as relative when expires is not epoch', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    mocks.sallaAuthorization.upsert.mockResolvedValue({ id: 'auth-1' });
    const body = { event: 'app.store.authorize', merchant_id: 123, data: { access_token: 'ory_at_abc', expires: 1209599 } };
    await POST(signedRequest(body));
    const expiresAt = mocks.sallaAuthorization.upsert.mock.calls[0][0].create.expiresAt;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + 1209600 * 1000);
  });

  it('dedupes duplicate events via P2002', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    mocks.webhookEvent.create.mockRejectedValue(new mocks.Prisma.PrismaClientKnownRequestError('dup', 'P2002'));
    const body = { event: 'order.created', id: 'dup-id-1' };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.duplicate).toBe(true);
  });

  it('marks status revoked on uninstall and skips sync', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    const body = { event: 'app.uninstalled', merchant_id: 123, id: 'u1' };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(mocks.sallaAuthorization.updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'revoked' }) }));
    expect(mocks.applySallaWebhook).not.toHaveBeenCalled();
  });

  it('routes store events through applySallaWebhook', async () => {
    mocks.verifySallaWebhook.mockReturnValue(true);
    mocks.applySallaWebhook.mockResolvedValue(null);
    const body = { event: 'product.created', id: 'p1', data: { id: 1, name: 'X' } };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    expect(mocks.applySallaWebhook).toHaveBeenCalledWith('product.created', body);
  });
});