import { describe, it, expect, beforeEach } from 'vitest';
import { sallaRequestedScopes, SALLA_PRODUCTION_SCOPES, getSallaSetup } from '@/lib/salla-config';

describe('sallaRequestedScopes', () => {
  beforeEach(() => {
    delete process.env.SALLA_SCOPES;
  });

  it('uses production scopes instead of *', () => {
    expect(sallaRequestedScopes()).toBe(SALLA_PRODUCTION_SCOPES);
    expect(sallaRequestedScopes()).toContain('offline_access');
    expect(sallaRequestedScopes()).toContain('products.read_write');
    expect(sallaRequestedScopes()).not.toContain('*');
  });

  it('ignores wildcard env and still uses production scopes', () => {
    process.env.SALLA_SCOPES = '*';
    expect(sallaRequestedScopes()).toBe(SALLA_PRODUCTION_SCOPES);
  });
});

describe('getSallaSetup', () => {
  it('exposes redirect and webhook URLs without secret values', () => {
    process.env.APP_URL = 'https://orders.example.com';
    const setup = getSallaSetup(null);
    expect(setup.pasteIntoSallaApp.redirectUri).toBe('https://orders.example.com/api/salla/callback');
    expect(setup.pasteIntoSallaApp.webhookUrl).toBe('https://orders.example.com/api/webhooks/salla');
    expect(JSON.stringify(setup)).not.toMatch(/ory_at_|sk_live|secret-value/);
  });
});
