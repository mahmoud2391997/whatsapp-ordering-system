import { NextResponse } from 'next/server';
import { getIntegrationsData, isDbActive } from '@/lib/data';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

interface IntegrationStatus {
  name: string;
  service: string;
  configured: boolean;
  status: 'operational' | 'degraded' | 'down' | 'pending';
  description: string;
  webhookUrl?: string;
  lastEvent?: string | null;
  eventCount?: number;
}

export async function GET() {
  const envKeys = [
    'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_VERIFY_TOKEN',
    'MISTRAL_API_KEY',
    'HYPERPAY_URL', 'HYPERPAY_ACCESS_TOKEN', 'HYPERPAY_ENTITY_ID',
    'GEIDEA_MERCHANT_PUBLIC_KEY', 'GEIDEA_API_PASSWORD', 'GEIDEA_API_URL',
    'TAMARA_API_TOKEN', 'TAMARA_API_URL',
    'SALLA_CLIENT_ID', 'SALLA_CLIENT_SECRET', 'SALLA_TOKEN_ENCRYPTION_KEY', 'SALLA_WEBHOOK_SECRET',
  ];

  const env: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    env[key] = process.env[key] ?? process.env[`NEXT_PUBLIC_${key}`];
  }

  const appUrl = process.env.APP_URL ?? 'https://yourdomain.com';

  const dbActive = await isDbActive();
  const { whatsappEvents, hyperpayEvents, geideaEvents, tamaraEvents, recentLogs, txnCount } = await getIntegrationsData();

  const whatsappConfigured = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_VERIFY_TOKEN);
  const mistralConfigured = !!env.MISTRAL_API_KEY;
  const hyperpayConfigured = !!(env.HYPERPAY_URL && env.HYPERPAY_ACCESS_TOKEN && env.HYPERPAY_ENTITY_ID);
  const geideaConfigured = !!(env.GEIDEA_MERCHANT_PUBLIC_KEY && env.GEIDEA_API_PASSWORD);
  const tamaraConfigured = !!env.TAMARA_API_TOKEN;
  const sallaConfigured = !!(env.SALLA_CLIENT_ID && env.SALLA_CLIENT_SECRET && (env.SALLA_TOKEN_ENCRYPTION_KEY || process.env.TOKEN_ENCRYPTION_KEY));
  const sallaAuth = dbActive
    ? await prisma.sallaAuthorization.findFirst({ where: { status: 'active' }, orderBy: { updatedAt: 'desc' } }).catch(() => null)
    : null;

  const integrations: IntegrationStatus[] = [
    {
      name: 'WhatsApp Business API', service: 'whatsapp',
      configured: whatsappConfigured, status: whatsappConfigured ? 'operational' : 'pending',
      description: 'Receive and send WhatsApp messages via Meta Cloud API',
      webhookUrl: whatsappConfigured ? `${appUrl}/api/webhooks/whatsapp` : undefined,
      lastEvent: whatsappEvents[0]?.createdAt?.toISOString() ?? null, eventCount: whatsappEvents.length,
    },
    {
      name: 'Mistral AI', service: 'mistral',
      configured: mistralConfigured, status: mistralConfigured ? 'operational' : 'pending',
      description: 'AI-powered order parsing from Arabic & English WhatsApp messages',
    },
    {
      name: 'HyperPay Payments', service: 'hyperpay',
      configured: hyperpayConfigured, status: hyperpayConfigured ? 'operational' : 'pending',
      description: 'Online payment processing with webhook status updates',
      webhookUrl: hyperpayConfigured ? `${appUrl}/api/webhooks/hyperpay` : undefined,
      lastEvent: hyperpayEvents[0]?.createdAt?.toISOString() ?? null, eventCount: hyperpayEvents.length,
    },
    {
      name: 'Geidea Payments', service: 'geidea',
      configured: geideaConfigured, status: geideaConfigured ? 'operational' : 'pending',
      description: 'Geidea checkout — card payments for Saudi, Egypt & UAE',
      webhookUrl: geideaConfigured ? `${appUrl}/api/webhooks/geidea` : undefined,
      lastEvent: geideaEvents[0]?.createdAt?.toISOString() ?? null, eventCount: geideaEvents.length,
    },
    {
      name: 'Tamara BNPL', service: 'tamara',
      configured: tamaraConfigured, status: tamaraConfigured ? 'operational' : 'pending',
      description: 'Buy Now Pay Later — 3 instalments for your customers',
      webhookUrl: tamaraConfigured ? `${appUrl}/api/webhooks/tamara` : undefined,
      lastEvent: tamaraEvents[0]?.createdAt?.toISOString() ?? null, eventCount: tamaraEvents.length,
    },
    {
      name: 'Salla Partner App', service: 'salla',
      configured: sallaConfigured, status: sallaAuth ? (sallaAuth.lastSyncError ? 'degraded' : 'operational') : 'pending',
      description: 'Multi-store catalog, customer, order, and webhook synchronization',
      webhookUrl: `${appUrl}/api/webhooks/salla`,
      lastEvent: sallaAuth?.lastWebhookAt?.toISOString() ?? null,
    },
    {
      name: 'PostgreSQL (Supabase-hosted)', service: 'postgresql',
      configured: true, status: dbActive ? 'operational' : 'degraded',
      description: dbActive
        ? 'PostgreSQL database hosted on Supabase — direct connection via Prisma'
        : 'Database unreachable — showing demo data',
    },
  ];

  const errorCount = recentLogs.filter(l => l.level === 'error').length;
  if (errorCount > 0) {
    const whatsappIdx = integrations.findIndex(i => i.service === 'whatsapp');
    if (whatsappIdx >= 0 && errorCount > 2) integrations[whatsappIdx].status = 'degraded';
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';

  const edgeFunctions = [
    { name: 'create-payment', url: `${supabaseUrl}/functions/v1/create-payment` },
    { name: 'create-geidea-session', url: `${supabaseUrl}/functions/v1/create-geidea-session` },
    { name: 'create-tamara-order', url: `${supabaseUrl}/functions/v1/create-tamara-order` },
    { name: 'handle-webhooks', url: `${supabaseUrl}/functions/v1/handle-webhooks` },
  ];

  return NextResponse.json({
    integrations,
    summary: {
      total: integrations.length,
      operational: integrations.filter(i => i.status === 'operational').length,
      pending: integrations.filter(i => i.status === 'pending').length,
      degraded: integrations.filter(i => i.status === 'degraded').length,
      transactions: txnCount,
      recentErrors: errorCount,
    },
    edgeFunctions,
    db: { active: dbActive, mode: dbActive ? 'database' : 'demo' },
    recentLogs: recentLogs.map(l => ({ ...l, createdAt: l.createdAt.toISOString() })),
  });
}
