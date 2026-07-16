'use client';

import { Leaf } from 'lucide-react';
import type { Product } from '@/lib/types';

interface Props {
  products: Product[];
}

const categoryLabels: Record<string, { label: string; labelAr: string; color: string }> = {
  vegetables: { label: 'Vegetables', labelAr: 'الخضروات', color: 'bg-emerald-100 text-emerald-800' },
  fruits:     { label: 'Fruits',     labelAr: 'الفواكه',  color: 'bg-amber-100 text-amber-800' },
  herbs:      { label: 'Herbs',      labelAr: 'الأعشاب',  color: 'bg-teal-100 text-teal-800' },
};

export default function MenuCatalog({ products }: Props) {
  const grouped = ['vegetables', 'fruits', 'herbs'].map(cat => ({
    key: cat,
    items: products.filter(p => p.category === cat),
    ...categoryLabels[cat],
  }));

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <span className="text-white text-sm font-bold">FG</span>
          </div>
          <span className="font-bold text-gray-900 text-lg">Product Catalog</span>
          <span className="text-sm text-gray-400 ml-1">— Admin Preview</span>
          <a href="/dashboard" className="ml-auto text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Dashboard →
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Products</h1>
          <p className="text-sm text-gray-500 mt-1">{products.length} items across {grouped.filter(g => g.items.length > 0).length} categories</p>
        </div>

        {grouped.map(section => section.items.length > 0 && (
          <section key={section.key} className="mb-10">
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-xl font-bold text-gray-900">{section.label}</h2>
              <span className="text-gray-400">|</span>
              <span className="text-lg text-gray-600 font-medium">{section.labelAr}</span>
              <span className="text-xs text-gray-400 ml-1">({section.items.length})</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {section.items.map(product => (
                <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all overflow-hidden">
                  <div className="relative overflow-hidden h-40">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                    <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${section.color}`}>
                      {section.labelAr}
                    </span>
                    <div className={`absolute top-2 right-2 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${product.stock > 100 ? 'bg-emerald-100 text-emerald-700' : product.stock > 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {product.stock > 100 ? 'In stock' : product.stock > 30 ? 'Limited' : 'Low'}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-gray-500 text-xs mb-2">{product.name_ar} · per {product.unit}</p>
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-lg font-bold text-emerald-600">{product.retail_price} EGP</span>
                        <span className="text-xs text-gray-400 ml-1">/ {product.unit}</span>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2 text-[11px] text-gray-400">
                      <span>Shop: {product.shop_price}</span>
                      <span>·</span>
                      <span>Wholesale: {product.wholesale_price}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="text-center py-6 text-gray-400 text-sm border-t border-gray-100">
        © 2026 Fresh Greens — خضروات وفواكه طازجة
      </footer>
    </div>
  );
}
