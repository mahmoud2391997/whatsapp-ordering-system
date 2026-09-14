export const SALLA_PARTNER_PORTAL = 'https://salla.partners/';
export const SALLA_MERCHANT_DASHBOARD = 'https://s.salla.sa/';
export const SALLA_MAINTENANCE_SETTINGS_URL = 'https://s.salla.sa/channel/settings?legacy=0#maintenance-mode';
export const SALLA_CREATE_APP_DOCS = 'https://docs.salla.dev/create-app';
export const SALLA_OAUTH_DOCS = 'https://docs.salla.dev/authorization';

export const SALLA_PRODUCTION_SCOPES = [
  'offline_access',
  'settings.read',
  'products.read_write',
  'orders.read_write',
  'customers.read_write',
  'categories.read_write',
  'webhooks.read_write',
].join(' ');

export const SALLA_WEBHOOK_EVENTS = [
  'app.store.authorize',
  'app.uninstalled',
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.created',
  'customer.updated',
  'order.created',
  'order.status.update',
] as const;

export const SALLA_SUBSCRIBE_EVENTS = [
  'product.created',
  'product.updated',
  'product.deleted',
  'customer.created',
  'customer.updated',
  'order.status.update',
  'app.uninstalled',
] as const;

const SECRET_ENV = [
  'SALLA_CLIENT_ID',
  'SALLA_CLIENT_SECRET',
  'SALLA_WEBHOOK_SECRET',
  'SALLA_TOKEN_ENCRYPTION_KEY',
] as const;

const PUBLIC_ENV = [
  'APP_URL',
  'SALLA_WEBHOOK_URL',
  'NEXT_PUBLIC_SALLA_STOREFRONT_URL',
] as const;

function present(key: string) {
  const value = process.env[key]?.trim() ?? '';
  return value.length > 0 && !value.startsWith('placeholder-');
}

export function sallaRequestedScopes() {
  const configured = process.env.SALLA_SCOPES?.trim();
  if (configured && configured !== '*') return configured;
  return SALLA_PRODUCTION_SCOPES;
}

export function appBaseUrl() {
  return process.env.APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
}

export function sallaCallbackUrl() {
  return new URL('/api/salla/callback', appBaseUrl()).toString();
}

export function getSallaSetup(connected: { merchantId: string; storeName: string | null; status: string } | null = null) {
  const appUrl = appBaseUrl().replace(/\/$/, '');
  const redirectUri = sallaCallbackUrl();
  const webhookUrl = process.env.SALLA_WEBHOOK_URL?.trim() || `${appUrl}/api/webhooks/salla`;
  const env = Object.fromEntries([...SECRET_ENV, ...PUBLIC_ENV].map((key) => [key, present(key)]));
  const secretsReady = SECRET_ENV.every((key) => env[key]);
  const missingSecrets = SECRET_ENV.filter((key) => !env[key]);
  const nextSteps: string[] = [];
  if (!env.APP_URL) nextSteps.push('Set APP_URL to the public HTTPS origin of this Next.js app (no trailing slash).');
  if (missingSecrets.length) nextSteps.push(`Copy ${missingSecrets.join(', ')} from the Salla Partners app into the server environment.`);
  if (!env.NEXT_PUBLIC_SALLA_STOREFRONT_URL) nextSteps.push('Set NEXT_PUBLIC_SALLA_STOREFRONT_URL to the live store URL (https://STORE.salla.sa or https://salla.sa/STORE), not demostore.salla.sa.');
  if (secretsReady && !connected) nextSteps.push('Install the app on the live merchant store via Connect to Salla (/api/salla/install).');
  if (connected) nextSteps.push('Disable maintenance mode on the live store, then sync products from Integrations.');

  return {
    links: {
      partnerPortal: SALLA_PARTNER_PORTAL,
      merchantDashboard: SALLA_MERCHANT_DASHBOARD,
      maintenanceSettings: SALLA_MAINTENANCE_SETTINGS_URL,
      createAppDocs: SALLA_CREATE_APP_DOCS,
      oauthDocs: SALLA_OAUTH_DOCS,
    },
    pasteIntoSallaApp: {
      oauthMode: 'Custom Mode',
      redirectUri,
      webhookUrl,
      scopes: sallaRequestedScopes(),
      storeEvents: [...SALLA_WEBHOOK_EVENTS],
    },
    copyFromSallaApp: [
      { env: 'SALLA_CLIENT_ID', from: 'Partners Portal → App Keys → Client ID' },
      { env: 'SALLA_CLIENT_SECRET', from: 'Partners Portal → App Keys → Client Secret' },
      { env: 'SALLA_WEBHOOK_SECRET', from: 'Partners Portal → Webhooks/Notifications → Webhook Secret' },
    ],
    generateLocally: [
      { env: 'SALLA_TOKEN_ENCRYPTION_KEY', from: 'Random 32+ character secret you create. Used only to encrypt tokens in Postgres. Not from Salla.' },
      { env: 'APP_URL', from: 'Your production site origin, e.g. https://orders.example.com' },
    ],
    env,
    secretsReady,
    connected,
    nextSteps,
  };
}
