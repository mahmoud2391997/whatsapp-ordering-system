import { describe, it, expect } from 'vitest';
import { parseCatalogOrder, matchCatalogProduct, formatOrderSummary } from '@/lib/catalog-order';
import type { SallaCatalogProduct } from '@/lib/salla';

const catalog: SallaCatalogProduct[] = [
  { id: '1', name: 'Tomato', nameAr: 'طماطم', category: 'vegetables', unit: 'kg', price: 15, stock: 40, imageUrl: '', purchasable: true },
  { id: '2', name: 'Cucumber', nameAr: 'خيار', category: 'vegetables', unit: 'kg', price: 12, stock: 20, imageUrl: '', purchasable: true },
  { id: '3', name: 'Apple', nameAr: 'تفاح', category: 'fruits', unit: 'kg', price: 35, stock: 0, imageUrl: '', purchasable: false },
];

describe('matchCatalogProduct', () => {
  it('matches Arabic and English names from the Salla catalog', () => {
    expect(matchCatalogProduct('طماطم', catalog)?.id).toBe('1');
    expect(matchCatalogProduct('cucumber', catalog)?.id).toBe('2');
  });
});

describe('parseCatalogOrder', () => {
  it('parses a typed WhatsApp order against Salla products', () => {
    const parsed = parseCatalogOrder('5 كيلو طماطم و 3 خيار', catalog);
    expect(parsed?.items).toEqual([
      expect.objectContaining({ id: '1', qty: 5, price: 15 }),
      expect.objectContaining({ id: '2', qty: 3, price: 12 }),
    ]);
    expect(parsed?.total).toBe(5 * 15 + 3 * 12);
  });

  it('returns unmatched fragments and null when nothing matches', () => {
    expect(parseCatalogOrder('فستان أحمر', catalog)).toBeNull();
    expect(parseCatalogOrder('2 طماطم و فستان', catalog)?.unmatched).toContain('فستان');
  });
});

describe('formatOrderSummary', () => {
  it('includes Arabic names and a total', () => {
    const parsed = parseCatalogOrder('2 طماطم', catalog)!;
    const text = formatOrderSummary(parsed);
    expect(text).toContain('طماطم');
    expect(text).toContain('30.00');
  });
});
