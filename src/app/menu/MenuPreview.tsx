'use client';

import { useState } from 'react';
import { ChevronDown, Eye, Users } from 'lucide-react';
import type { Product, MenuPage, CustomerType } from '@/lib/types';
import MenuCart from '@/components/MenuCart';

interface Props {
  menuPages: MenuPage[];
  products: Product[];
}

export default function MenuPreview({ menuPages, products }: Props) {
  const [selected, setSelected] = useState<MenuPage | null>(null);

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 to-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Eye className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Menu Preview</h1>
            <p className="text-sm text-gray-500">Select a customer to preview their menu</p>
          </div>
        </div>

        {!selected ? (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
            {menuPages.length === 0 ? (
              <div className="px-5 py-12 text-center text-gray-400">
                <Users className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">No menu pages yet.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {menuPages.map((page) => (
                  <button
                    key={page.id}
                    onClick={() => setSelected(page)}
                    className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50/50 transition-colors text-left"
                  >
                    <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                      <span className="text-sm font-bold text-emerald-600">
                        {page.customer_name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-medium text-gray-900 truncate">{page.customer_name}</h3>
                      <p className="text-xs text-gray-500">{page.phone} · {page.customer_type}</p>
                    </div>
                    <ChevronDown className="w-4 h-4 text-gray-400 -rotate-90 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div>
            <button
              onClick={() => setSelected(null)}
              className="mb-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-800 transition-colors"
            >
              <ChevronDown className="w-4 h-4 rotate-90" />
              Back to list
            </button>
            <MenuCart
              products={products}
              customerName={selected.customer_name}
              customerType={selected.customer_type}
              customerId={selected.id}
            />
          </div>
        )}
      </div>
    </div>
  );
}
