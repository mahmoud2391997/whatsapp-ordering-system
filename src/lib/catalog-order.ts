import type { SallaCatalogProduct } from '@/lib/salla';

export interface ParsedCatalogItem {
  id: string;
  name: string;
  nameAr: string;
  qty: number;
  unit: string;
  price: number;
  stock: number;
  purchasable: boolean;
}

export interface ParsedCatalogOrder {
  items: ParsedCatalogItem[];
  unmatched: string[];
  total: number;
}

export function normalizeCatalogText(value: string) {
  return value.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]+/gu, ' ').replace(/\s+/g, ' ');
}

export function matchCatalogProduct(segment: string, products: SallaCatalogProduct[]): SallaCatalogProduct | null {
  const haystack = normalizeCatalogText(segment);
  if (!haystack) return null;
  let best: { product: SallaCatalogProduct; score: number } | null = null;
  for (const product of products) {
    const names = [product.name, product.nameAr].map(normalizeCatalogText).filter(Boolean);
    for (const name of names) {
      if (!name) continue;
      if (haystack === name || haystack.includes(name) || name.includes(haystack)) {
        const score = name.length;
        if (!best || score > best.score) best = { product, score };
      }
    }
  }
  return best?.product ?? null;
}

export function parseCatalogOrder(text: string, products: SallaCatalogProduct[]): ParsedCatalogOrder | null {
  const segments = text.split(/\s+(?:و|and)\s+|[,،]/i).map((segment) => segment.trim()).filter(Boolean);
  const items: ParsedCatalogItem[] = [];
  const unmatched: string[] = [];

  for (const segment of segments) {
    const qtyMatch = segment.match(/(\d+(?:\.\d+)?)/);
    const qty = qtyMatch ? Number(qtyMatch[1]) : 1;
    const product = matchCatalogProduct(segment.replace(qtyMatch?.[0] ?? '', ' '), products) ?? matchCatalogProduct(segment, products);
    if (!product || !Number.isFinite(qty) || qty <= 0) {
      unmatched.push(segment);
      continue;
    }
    items.push({
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      qty,
      unit: product.unit,
      price: product.price,
      stock: product.stock,
      purchasable: product.purchasable,
    });
  }

  if (items.length === 0) return null;
  return { items, unmatched, total: items.reduce((sum, item) => sum + item.qty * item.price, 0) };
}

export function formatOrderSummary(order: ParsedCatalogOrder) {
  const lines = order.items.map((item) => `• ${item.nameAr || item.name} × ${item.qty} ${item.unit} = ${(item.qty * item.price).toFixed(2)}`);
  return `${lines.join('\n')}\nالمجموع: ${order.total.toFixed(2)}`;
}

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: string) {
  return UUID_RE.test(value);
}
