import { NextResponse } from 'next/server';
import * as XLSX from 'xlsx';

export const dynamic = 'force-dynamic';

export async function GET() {
  const headers = [
    'name',
    'name_ar',
    'category',
    'unit',
    'retail_price',
    'shop_price',
    'wholesale_price',
    'stock',
    'image_url',
  ];

  const exampleRow = [
    'Tomato',
    'طماطم',
    'vegetables',
    'kg',
    2.5,
    2.0,
    1.5,
    100,
    'https://example.com/tomato.jpg',
  ];

  const sheetData = [headers, exampleRow];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  ws['!cols'] = headers.map(() => ({ wch: 20 }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Products');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="products_template.xlsx"',
    },
  });
}
