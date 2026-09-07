import crypto from 'node:crypto';
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

export function safeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function sallaRedirectUri() {
  return `${process.env.APP_URL ?? process.env.VERCEL_URL ?? 'http://localhost:3000'}/api/salla/callback`;
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
  const response = await fetch(TOKEN_URL, {
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
  if (!response.ok) throw new Error(`Salla token exchange failed (${response.status})`);
  return response.json() as Promise<{ access_token: string; refresh_token?: string; expires_in?: number; scope?: string }>;
}

export async function getSallaAuthorization(merchantId?: string) {
  return prisma.sallaAuthorization.findFirst({ where: merchantId ? { merchantId, status: 'active' } : { status: 'active' } });
}

export async function getSallaAccessToken(auth: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  if (auth.expiresAt && auth.expiresAt.getTime() > Date.now() + 120_000) return decryptToken(auth.accessToken);
  if (!auth.refreshToken) throw new Error('SALLA_REAUTH_REQUIRED');
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: decryptToken(auth.refreshToken), client_id: process.env.SALLA_CLIENT_ID ?? '', client_secret: process.env.SALLA_CLIENT_SECRET ?? '' }),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Salla token refresh failed (${response.status})`);
  const token = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  await prisma.sallaAuthorization.update({ where: { id: auth.id }, data: { accessToken: encryptToken(token.access_token), refreshToken: token.refresh_token ? encryptToken(token.refresh_token) : auth.refreshToken, expiresAt: token.expires_in ? new Date(Date.now() + token.expires_in * 1000) : null } });
  return token.access_token;
}

export async function sallaFetch<T>(path: string, init: RequestInit = {}, auth?: NonNullable<Awaited<ReturnType<typeof getSallaAuthorization>>>) {
  const authorization = auth ?? await getSallaAuthorization();
  if (!authorization) throw new Error('SALLA_NOT_CONNECTED');
  const token = await getSallaAccessToken(authorization);
  const response = await fetch(`${API_URL}${path}`, { ...init, headers: { accept: 'application/json', ...(init.body ? { 'content-type': 'application/json' } : {}), ...init.headers, authorization: `Bearer ${token}` }, cache: 'no-store' });
  if (!response.ok) throw new Error(`Salla API ${response.status}: ${await response.text()}`);
  return response.json() as Promise<T>;
}

export function verifySallaWebhook(rawBody: string, signature: string | null) {
  const secret = process.env.SALLA_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  return safeEqual(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), signature);
}
