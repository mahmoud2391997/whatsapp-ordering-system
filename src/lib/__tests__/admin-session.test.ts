import { afterEach, describe, expect, it } from 'vitest';
import { createAdminSession, isAdminPath, safeNextPath, verifyAdminSession } from '@/lib/admin-session';

const ORIGINAL = process.env.ADMIN_PASSWORD;

afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_PASSWORD;
  else process.env.ADMIN_PASSWORD = ORIGINAL;
});

describe('admin session', () => {
  it('accepts a session signed with the configured password', async () => {
    process.env.ADMIN_PASSWORD = 'deployment-secret-value';
    const token = await createAdminSession();
    expect(await verifyAdminSession(token)).toBe(true);
  });

  it('rejects a tampered session', async () => {
    process.env.ADMIN_PASSWORD = 'deployment-secret-value';
    const token = await createAdminSession();
    expect(await verifyAdminSession(`${token}x`)).toBe(false);
  });

  it('rejects sessions when the password is a placeholder', async () => {
    process.env.ADMIN_PASSWORD = 'placeholder-admin-password';
    expect(await verifyAdminSession('v1.1.sig')).toBe(false);
  });
});

describe('admin paths', () => {
  it('protects the dashboard and store mutations', () => {
    expect(isAdminPath('/dashboard')).toBe(true);
    expect(isAdminPath('/api/products/upload')).toBe(true);
    expect(isAdminPath('/api/salla/sync')).toBe(true);
    expect(isAdminPath('/api/confirm-order')).toBe(true);
  });

  it('leaves customer and webhook routes public', () => {
    expect(isAdminPath('/api/checkout')).toBe(false);
    expect(isAdminPath('/api/webhooks/whatsapp')).toBe(false);
    expect(isAdminPath('/api/salla/callback')).toBe(false);
    expect(isAdminPath('/api/health')).toBe(false);
    expect(isAdminPath('/menu/customer-1')).toBe(false);
  });

  it('only allows same-site return paths', () => {
    expect(safeNextPath('/dashboard')).toBe('/dashboard');
    expect(safeNextPath('https://evil.example')).toBe('/dashboard');
    expect(safeNextPath('//evil.example')).toBe('/dashboard');
  });
});
