import { NextResponse } from 'next/server';
import { getDashboardData, isDbActive } from '@/lib/data';

export const dynamic = 'force-dynamic';

export async function GET() {
  const dbActive = await isDbActive();

  const data = await getDashboardData();

  return NextResponse.json({
    ...data,
    db: { active: dbActive, mode: dbActive ? 'database' : 'demo' },
  });
}
