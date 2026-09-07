import { describe, it, expect, beforeEach } from 'vitest';
import { encryptToken, decryptToken, verifySallaWebhook, createOAuthState, sallaInstallUrl, sallaRedirectUri, sallaApiUrl, safeEqual } from '@/lib/salla';

const SECRET = 'test-encryption-key-0123456789abcdef';
const WEBHOOK_SECRET = 'test-webhook-secret';

beforeEach(() => {
  process.env.SALLA_TOKEN_ENCRYPTION_KEY = SECRET;
  process.env.SALLA_WEBHOOK_SECRET = WEBHOOK_SECRET;
  process.env.SALLA_CLIENT_ID = 'client-id';
  process.env.SALLA_CLIENT_SECRET = 'client-secret';
  process.env.SALLA_SCOPES = 'settings.read orders.read_write offline_access';
});

describe('encryptToken / decryptToken', () => {
  it('round-trips a token', () => {
    const token = 'ory_at_abc123';
    const encrypted = encryptToken(token);
    expect(encrypted).not.toContain(token);
    expect(decryptToken(encrypted)).toBe(token);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const token = 'ory_at_abc123';
    expect(encryptToken(token)).not.toBe(encryptToken(token));
  });

  it('rejects malformed ciphertext', () => {
    expect(() => decryptToken('not-a-valid-format')).toThrow('Invalid encrypted token');
  });
});

describe('safeEqual', () => {
  it('compares equal strings', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
  });
  it('rejects different length / content', () => {
    expect(safeEqual('abc', 'abcd')).toBe(false);
    expect(safeEqual('abc', 'abd')).toBe(false);
  });
});

describe('verifySallaWebhook', () => {
  const body = JSON.stringify({ event: 'product.created', merchant: 123 });
  const makeSig = () => {
    const crypto = require('node:crypto');
    return crypto.createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');
  };

  it('accepts a valid HMAC signature', () => {
    expect(verifySallaWebhook(body, makeSig())).toBe(true);
  });

  it('rejects a tampered body', () => {
    const sig = makeSig();
    expect(verifySallaWebhook(body.replace('product.created', 'order.created'), sig)).toBe(false);
  });

  it('rejects when signature or secret is missing', () => {
    expect(verifySallaWebhook(body, null)).toBe(false);
    process.env.SALLA_WEBHOOK_SECRET = '';
    expect(verifySallaWebhook(body, makeSig())).toBe(false);
  });
});

describe('createOAuthState', () => {
  it('generates unique 43-char base64url states', () => {
    const a = createOAuthState();
    const b = createOAuthState();
    expect(a).not.toBe(b);
    expect(a.length).toBe(43);
  });
});

describe('URL builders', () => {
  it('builds install URL with scopes and callback', () => {
    process.env.APP_URL = 'https://example.com';
    const url = sallaInstallUrl('state-123');
    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://accounts.salla.sa');
    expect(parsed.searchParams.get('client_id')).toBe('client-id');
    expect(parsed.searchParams.get('response_type')).toBe('code');
    expect(parsed.searchParams.get('state')).toBe('state-123');
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/api/salla/callback');
    expect(parsed.searchParams.get('scope')).toContain('orders.read_write');
    expect(parsed.searchParams.get('scope')).not.toContain('*');
  });

  it('redirect URI honors APP_URL and strips config overrides', () => {
    process.env.APP_URL = 'https://app.example.com';
    expect(sallaRedirectUri()).toBe('https://app.example.com/api/salla/callback');
  });

  it('api url joins paths onto SALLA_API_URL', () => {
    process.env.SALLA_API_URL = 'https://api.salla.dev';
    expect(sallaApiUrl('/admin/v2/store/info')).toBe('https://api.salla.dev/admin/v2/store/info');
  });
});