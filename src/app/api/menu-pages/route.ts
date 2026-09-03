import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getMenuPages } from '@/lib/data';
import { mapMenuPage } from '@/lib/mappers';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(await getMenuPages());
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  if (!body?.customerName?.trim() || !body?.phone?.trim()) {
    return NextResponse.json({ error: 'customerName and phone are required' }, { status: 400 });
  }

  const customerType = body.customerType ?? 'retail';
  const slug = `menu-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    const menuPage = await prisma.menuPage.create({
      data: {
        slug,
        customerName: body.customerName.trim(),
        phone: body.phone.trim(),
        customerType,
      },
    });

    return NextResponse.json({ menuPage: mapMenuPage(menuPage) }, { status: 201 });
  } catch (error) {
    console.error('Failed to create menu page:', error);
    return NextResponse.json(
      { error: 'Database unavailable. Connect PostgreSQL before creating menu pages.' },
      { status: 503 },
    );
  }
}