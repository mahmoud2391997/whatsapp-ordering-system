import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';

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
  const supabase = createServerClient();

  // Check which secrets are configured
  const envKeys = [
    'WHATSAPP_ACCESS_TOKEN',
    'WHATSAPP_PHONE_NUMBER_ID',
    'WHATSAPP_VERIFY_TOKEN',
    'GEMINI_API_KEY',
    'HYPERPAY_URL',
    'HYPERPAY_ACCESS_TOKEN',
    'HYPERPAY_ENTITY_ID',
    'SENDGRID_API_KEY',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
  ];

  const env: Record<string, string | undefined> = {};
  for (const key of envKeys) {
    env[key] = process.env[key] ?? process.env[`NEXT_PUBLIC_${key}`];
  }

  // Fetch webhook events and system logs for health metrics
  const [whatsappEvents, hyperpayEvents, recentLogs, txnCount] = await Promise.all([
    supabase.from('webhook_events').select('created_at, processed').eq('source', 'whatsapp').order('created_at', { ascending: false }).limit(50),
    supabase.from('webhook_events').select('created_at, processed').eq('source', 'hyperpay').order('created_at', { ascending: false }).limit(50),
    supabase.from('system_logs').select('level, service, created_at').order('created_at', { ascending: false }).limit(20),
    supabase.from('transactions').select('id', { count: 'exact', head: true }),
  ]);

  const whatsappConfigured = !!(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_VERIFY_TOKEN);
  const geminiConfigured = !!env.GEMINI_API_KEY;
  const hyperpayConfigured = !!(env.HYPERPAY_URL && env.HYPERPAY_ACCESS_TOKEN && env.HYPERPAY_ENTITY_ID);
  const sendgridConfigured = !!env.SENDGRID_API_KEY;
  const cloudinaryConfigured = !!(env.CLOUDINARY_CLOUD_NAME && env.CLOUDINARY_API_KEY);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? '';

  const integrations: IntegrationStatus[] = [
    {
      name: 'WhatsApp Business API',
      service: 'whatsapp',
      configured: whatsappConfigured,
      status: whatsappConfigured ? 'operational' : 'pending',
      description: 'Receive and send WhatsApp messages via Meta Cloud API',
      webhookUrl: whatsappConfigured ? `${supabaseUrl}/functions/v1/whatsapp-webhook` : undefined,
      lastEvent: whatsappEvents.data?.[0]?.created_at ?? null,
      eventCount: whatsappEvents.data?.length ?? 0,
    },
    {
      name: 'Google Gemini AI',
      service: 'gemini',
      configured: geminiConfigured,
      status: geminiConfigured ? 'operational' : 'pending',
      description: 'AI-powered order parsing from Arabic & English WhatsApp messages',
    },
    {
      name: 'HyperPay Payments',
      service: 'hyperpay',
      configured: hyperpayConfigured,
      status: hyperpayConfigured ? 'operational' : 'pending',
      description: 'Online payment processing with webhook status updates',
      webhookUrl: hyperpayConfigured ? `${supabaseUrl}/functions/v1/hyperpay-webhook` : undefined,
      lastEvent: hyperpayEvents.data?.[0]?.created_at ?? null,
      eventCount: hyperpayEvents.data?.length ?? 0,
    },
    {
      name: 'SendGrid Email',
      service: 'sendgrid',
      configured: sendgridConfigured,
      status: sendgridConfigured ? 'operational' : 'pending',
      description: 'Order confirmations, payment receipts & shipping notifications',
    },
    {
      name: 'Cloudinary',
      service: 'cloudinary',
      configured: cloudinaryConfigured,
      status: cloudinaryConfigured ? 'operational' : 'pending',
      description: 'Product image storage and CDN delivery',
    },
    {
      name: 'Supabase Database',
      service: 'supabase',
      configured: true,
      status: 'operational',
      description: 'Postgres database, auth, and edge function hosting',
    },
  ];

  // Count errors in recent logs
  const errorCount = recentLogs.data?.filter(l => l.level === 'error').length ?? 0;
  if (errorCount > 0) {
    const whatsappIdx = integrations.findIndex(i => i.service === 'whatsapp');
    if (whatsappIdx >= 0 && errorCount > 2) {
      integrations[whatsappIdx].status = 'degraded';
    }
  }

  return NextResponse.json({
    integrations,
    summary: {
      total: integrations.length,
      operational: integrations.filter(i => i.status === 'operational').length,
      pending: integrations.filter(i => i.status === 'pending').length,
      degraded: integrations.filter(i => i.status === 'degraded').length,
      transactions: txnCount.count ?? 0,
      recentErrors: errorCount,
    },
    edgeFunctions: [
      { name: 'whatsapp-webhook', url: `${supabaseUrl}/functions/v1/whatsapp-webhook` },
      { name: 'whatsapp-send', url: `${supabaseUrl}/functions/v1/whatsapp-send` },
      { name: 'gemini-parse', url: `${supabaseUrl}/functions/v1/gemini-parse` },
      { name: 'hyperpay-webhook', url: `${supabaseUrl}/functions/v1/hyperpay-webhook` },
      { name: 'create-payment', url: `${supabaseUrl}/functions/v1/create-payment` },
      { name: 'send-email', url: `${supabaseUrl}/functions/v1/send-email` },
    ],
    recentLogs: recentLogs.data ?? [],
  });
}
