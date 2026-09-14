import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnv(path) {
  const env = {};
  for (const raw of readFileSync(path, 'utf8').split('\n')) {
    const line = raw.replace(/^\uFEFF/, '').trim().replace(/^export\s+/, '');
    if (!line || line.startsWith('#') || !line.includes('=')) continue;
    const eq = line.indexOf('=');
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const env = loadEnv(resolve(process.cwd(), '.env.local'));
const api = (env.SALLA_API_URL || 'https://api.salla.dev').replace(/\/$/, '');
const tokenUrl = env.SALLA_TOKEN_URL || 'https://accounts.salla.sa/oauth2/token';

async function tokenFromClientCredentials() {
  if (!env.SALLA_CLIENT_ID || !env.SALLA_CLIENT_SECRET) return '';
  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', accept: 'application/json' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: env.SALLA_CLIENT_ID,
      client_secret: env.SALLA_CLIENT_SECRET,
    }),
  });
  if (!response.ok) return '';
  const json = await response.json();
  return typeof json.access_token === 'string' ? json.access_token : '';
}

const token = env.SALLA_ACCESS_TOKEN || await tokenFromClientCredentials();
if (!token) {
  console.error(JSON.stringify({ ok: false, error: 'No Salla access token available (env empty and client credentials failed)' }));
  process.exit(1);
}

const payloads = [
  { method: 'PUT', path: '/admin/v2/settings/fields/store.maintenance', body: { value: false } },
  { method: 'PUT', path: '/admin/v2/settings/fields/store.maintenance', body: { value: 0 } },
  { method: 'POST', path: '/admin/v2/settings/fields/store.maintenance', body: { value: false } },
  { method: 'PUT', path: '/admin/v2/settings', body: { settings: [{ slug: 'store.maintenance', value: false }] } },
];

let lastError = '';
for (const payload of payloads) {
  const response = await fetch(`${api}${payload.path}`, {
    method: payload.method,
    headers: { accept: 'application/json', authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(payload.body),
  });
  const text = await response.text();
  const preview = text.slice(0, 300).replace(/\s+/g, ' ');
  if (response.ok) {
    console.log(JSON.stringify({ ok: true, status: response.status, path: payload.path }));
    process.exit(0);
  }
  lastError = `${response.status} ${payload.method} ${payload.path} ${preview}`;
}

console.error(JSON.stringify({ ok: false, error: lastError }));
process.exit(1);
