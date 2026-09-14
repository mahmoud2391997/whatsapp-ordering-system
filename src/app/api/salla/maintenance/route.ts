import { NextResponse } from 'next/server';
import { setSallaMaintenanceMode, SALLA_MAINTENANCE_SETTINGS_URL } from '@/lib/salla';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const enabled = body.enabled === true;
  try {
    const result = await setSallaMaintenanceMode(enabled);
    return NextResponse.json({ ok: true, enabled, settingsUrl: SALLA_MAINTENANCE_SETTINGS_URL, result });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Failed to update Salla maintenance mode',
      settingsUrl: SALLA_MAINTENANCE_SETTINGS_URL,
    }, { status: 502 });
  }
}
