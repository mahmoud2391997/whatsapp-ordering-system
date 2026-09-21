export const ADMIN_COOKIE = 'fg_admin';
const SESSION_MS = 12 * 60 * 60 * 1000;

export function adminPasswordConfigured() {
  const value = process.env.ADMIN_PASSWORD?.trim() ?? '';
  return value.length >= 12 && !value.startsWith('placeholder-');
}

/** Production always requires a session. Local dev stays open until a password is set. */
export function adminGateActive() {
  if (process.env.NODE_ENV === 'production') return true;
  return adminPasswordConfigured();
}

function sessionSecret() {
  return process.env.ADMIN_PASSWORD?.trim() ?? '';
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function timingSafeEqualString(left: string, right: string) {
  const length = Math.max(left.length, right.length);
  let diff = left.length === right.length ? 0 : 1;
  for (let i = 0; i < length; i += 1) {
    diff |= (left.charCodeAt(i) || 0) ^ (right.charCodeAt(i) || 0);
  }
  return diff === 0;
}

async function signPayload(payload: string) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(sessionSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToBase64Url(new Uint8Array(mac));
}

export async function createAdminSession() {
  const payload = `v1.${Date.now() + SESSION_MS}`;
  return `${payload}.${await signPayload(payload)}`;
}

export async function verifyAdminSession(token: string | undefined | null) {
  if (!adminPasswordConfigured() || !token) return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return false;
  const expected = await signPayload(`v1.${parts[1]}`);
  return timingSafeEqualString(expected, parts[2]);
}

const ADMIN_API_PREFIXES = [
  '/api/data',
  '/api/products',
  '/api/orders',
  '/api/confirm-order',
  '/api/conversations',
  '/api/menu-pages',
  '/api/integrations',
  '/api/chat',
];

export function isAdminPath(pathname: string) {
  if (pathname === '/dashboard' || pathname.startsWith('/dashboard/')) return true;
  if (ADMIN_API_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return true;
  if (pathname.startsWith('/api/salla/') && !pathname.startsWith('/api/salla/callback')) return true;
  return false;
}

export function safeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/login')) return '/dashboard';
  return value;
}
