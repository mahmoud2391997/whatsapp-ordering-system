import crypto from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';

const API_URL = process.env.SALLA_API_URL ?? 'https://api.salla.dev';
const TOKEN_URL = process.env.SALLA_TOKEN_URL ?? 'https://accounts.salla.sa/oauth2/token';
const encryptionKey = () => {
  const value = process.env.SALLA_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('SALLA_TOKEN_ENCRYPTION_KEY is not configured');
  return crypto.createHash('sha256').update(value).digest();
};

export function encryptToken(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
}

export function decryptToken(value: string) {
  const [iv, tag, payload] = value.split('.');
  if (!iv || !tag || !payload) throw new Error('Invalid encrypted token');
  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(payload, 'base64url')), decipher.final()]).toString('utf8');
}

export function createOAuthState() {
  return crypto.randomBytes(32).toString('base64url');
}

function requireConfig(...keys: string[]) {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length > 0) throw new Error(`Salla configuration missing: ${missing.join(', ')}`);
}

async function responseError(response: Response) {
  const body = await response.text().catch(() => '');
  return body.slice(0, 500).replace(/\s+/g, ' ');
}

function retryDelay(attempt: number, response?: Response) {
  const retryAfter = response?.headers.get('retry-after');
  const seconds = retryAfter ? Number(retryAfter) : Number.NaN;
  return Number.isFinite(seconds) ? Math.min(seconds * 1000, 5000) : Math.min(250 * 2 ** attempt, 2500);
}

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function sallaRedirectUri() {
  const configuredUrl = process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return new URL('/api/salla/callback', configuredUrl).toString();
}

export function sallaApiUrl(path: string) {
  return new URL(path, API_URL).toString();
}

export async function fetchSallaStoreInfo(accessToken: string) {
  const response = await fetchWithRetry(sallaApiUrl('/admin/v2/store/info'), {
    headers: { accept: 'application/json', authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salla store lookup failed (${response.status}): ${await responseError(response)}`);
  return response.json() as Promise<{ data?: { id?: string | number; name?: string } }>;
}

async function fetchWithRetry(input: RequestInfo | URL, init: RequestInit, attempts = 3) {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetch(input, init);
    if (response.ok || ![429, 500, 502, 503, 504].includes(response.status) || attempt === attempts - 1) return response;
    await new Promise((resolve) => setTimeout(resolve, retryDelay(attempt, response)));
  }
  throw new Error('Salla request failed');
}

export function sallaInstallUrl(state: string) {
  const params = new URLSearchParams({
    client_id: process.env.SALLA_CLIENT_ID ?? '',
    redirect_uri: sallaRedirectUri(),
    response_type: 'code',
    scope: process.env.SALLA_SCOPES ?? '*',
    state,
  });
  return `https://accounts.salla.sa/oauth2/auth?${params}`;
}

export async function exchangeSallaCode(code: string) {
  requireConfig('SALLA_CLIENT_ID', 'SALLA_CLIENT_SECRET');
  const response = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: process.env.SALLA_CLIENT_ID ?? '',
      client_secret: process.env.SALLA_CLIENT_SECRET ?? '',
      redirect_uri: sallaRedirectUri(),
      code,
    }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salla token exchange failed (${response.status}): ${await responseError(response)}`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
}

export async function getSallaAuthorization(merchantId?: string) {
  return prisma.sallaAuthorization.findFirst({ where: merchantId ? { merchantId, status: 'active' } : { status: 'active' } });
}

export async function getSallaAccessToken(auth: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  if (auth.expiresAt && auth.expiresAt.getTime() > Date.now() + 120_000) return decryptToken(auth.accessToken);
  if (!auth.refreshToken) throw new Error('SALLA_REAUTH_REQUIRED');
  requireConfig('SALLA_CLIENT_ID', 'SALLA_CLIENT_SECRET');
  const latest = await prisma.sallaAuthorization.findUnique({ where: { id: auth.id } });
  if (latest?.expiresAt && latest.expiresAt.getTime() > Date.now() + 120_000) return decryptToken(latest.accessToken);
  const response = await fetchWithRetry(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptToken(auth.refreshToken), client_id: process.env.SALLA_CLIENT_ID ?? '', client_secret: process.env.SALLA_CLIENT_SECRET ?? '' }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salla token refresh failed (${response.status}): ${await responseError(response)}`);
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { accessToken: encryptToken(token.access_token), refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : auth.refreshToken, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null } });
  return token.access_token;
}

export async function sallaFetch<T>(path: string, init: RequestInit = {}, auth?: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  const authorization = auth ?? await getSallaAuthorization();
  if (!authorization) throw new Error('SALLA_NOT_CONNECTED');
  const token = await getSallaAccessToken(authorization);
  const response = await fetchWithRetry(sallaApiUrl(path), { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers, authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Salla API ${response.status}: ${await responseError(response)}`);
  return response.json() as Promise<T>;
}

const SALLA_WEBHOOK_EVENTS = ['product.created', 'product.updated', 'product.deleted', 'customer.created', 'customer.updated', 'order.status.update', 'app.uninstalled'];

export async function registerSallaWebhooks(auth: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  const webhookUrl = process.env.SALLA_WEBHOOK_URL;
  if (!webhookUrl) throw new Error('SALLA_WEBHOOK_URL is not configured');
  const existing = Array.isArray(auth.webhookIds) ? auth.webhookIds as Array<{ event?: string; id?: string | number }> : [];
  const subscriptions: Array<{ event: string; id: string | number | null }> = SALLA_WEBHOOK_EVENTS.map(event => {
    const match = existing.find(item => item.event === event && item.id != null);
    return { event, id: match?.id ?? null };
  });
  for (const subscription of subscriptions.filter(item => item.id == null)) {
    const response = await sallaFetch<{ data?: { id?: string | number } }>('/admin/v2/webhooks/subscribe', { method: 'POST', body: JSON.stringify({ name: subscription.event, event: subscription.event, url: webhookUrl }) }, auth);
    subscription.id = response.data?.id ?? null;
  }
  await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { webhookIds: subscriptions as Prisma.InputJsonValue, lastSyncError: null } });
  return subscriptions;
}

export function verifySallaWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const normalized = signature.trim().replace(/^sha256=/i, '').replace(/^sha256:/i, '');
  const expectedHex = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const expectedBase64 = crypto.createHmac('sha256', secret).update(rawBody).digest('base64url');
  return safeEqual(expectedHex, normalized) || safeEqual(expectedBase64, normalized);
}
