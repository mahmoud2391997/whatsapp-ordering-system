'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingCart, Plus, Minus, Trash2, X, MessageCircle,
  ChevronRight, Check, Loader2, MapPin, CreditCard, Banknote,
} from 'lucide-react';
import type { Product } from '@/lib/types';

interface CartItem {
  product: Product;
  qty: number;
}

interface MenuCartProps {
  products: Product[];
}

const categoryLabels: Record<string, { label: string; labelAr: string; color: string }> = {
  vegetables: { label: 'Vegetables', labelAr: 'الخضروات', color: 'bg-emerald-100 text-emerald-800' },
  fruits:     { label: 'Fruits',     labelAr: 'الفواكه',  color: 'bg-amber-100 text-amber-800' },
  herbs:      { label: 'Herbs',      labelAr: 'الأعشاب',  color: 'bg-teal-100 text-teal-800' },
};

export default function MenuCart({ products }: MenuCartProps) {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [location, setLocation] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'online'>('cod');
  const [submitting, setSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState<{ orderId: string; whatsappLink: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceKey = 'retail_price';

  const addToCart = useCallback((product: Product) => {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === product.id);
      if (existing) {
        return prev.map(i => i.product.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { product, qty: 1 }];
    });
    setCartOpen(true);
    setTimeout(() => setCartOpen(false), 1500);
  }, []);

  const updateQty = (productId: string, delta: number) => {
    setCart(prev => prev
      .map(i => i.product.id === productId ? { ...i, qty: i.qty + delta } : i)
      .filter(i => i.qty > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(i => i.product.id !== productId));
  };

  const cartCount = cart.reduce((sum, i) => sum + i.qty, 0);
  const cartTotal = cart.reduce((sum, i) => sum + i.qty * Number(i.product[priceKey]), 0);

  const handleCheckout = async () => {
    if (!cart.length) return;
    if (!name.trim() || !phone.trim()) {
      setError('Please enter your name and WhatsApp number');
      return;
    }
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: name.trim(),
          phone: phone.trim(),
          items: cart.map(i => ({
            product_id: i.product.id,
            product_name: i.product.name,
            qty: i.qty,
            unit: i.product.unit,
            unit_price: Number(i.product[priceKey]),
          })),
          total: cartTotal,
          customerType: 'retail',
          location: location || undefined,
          paymentMethod,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? 'Checkout failed');
      }

      setOrderResult({ orderId: data.orderId, whatsappLink: data.whatsappLink });
      setCart([]);
      setCheckoutOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const vegetables = products.filter(p => p.category === 'vegetables');
  const fruits = products.filter(p => p.category === 'fruits');
  const herbs = products.filter(p => p.category === 'herbs');

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
              <span className="text-white text-sm font-bold">FG</span>
            </div>
            <div>
              <span className="font-bold text-gray-900 text-lg">Fresh Greens</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setCartOpen(!cartOpen)}
              className="relative flex items-center gap-2 bg-emerald-50 text-emerald-700 px-4 py-2 rounded-full text-sm font-medium hover:bg-emerald-100 transition-colors"
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:inline">Cart</span>
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-emerald-600 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {cartCount}
                </span>
              )}
            </button>
            <a href="/dashboard" className="flex items-center gap-1 text-gray-500 text-sm hover:text-gray-800 transition-colors">
              Dashboard <ChevronRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-emerald-700 to-emerald-500">
        <div className="absolute inset-0 opacity-10">
          <img
            src="https://images.pexels.com/photos/1640777/pexels-photo-1640777.jpeg?auto=compress&cs=tinysrgb&w=1200"
            alt=""
            className="w-full h-full object-cover"
          />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <span className="inline-flex items-center gap-1.5 bg-white/20 text-white text-sm px-3 py-1 rounded-full mb-4 backdrop-blur-sm">
            <span className="w-2 h-2 bg-emerald-300 rounded-full animate-pulse"></span>
            Fresh Retail Pricing
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 leading-tight">
            Farm-Fresh Vegetables<br />& Fruits
          </h1>
          <p className="text-emerald-100 text-lg mb-2 max-w-xl mx-auto">
            Add items to your cart and checkout — your order goes straight to WhatsApp.
          </p>
          <p className="text-white/70 text-base">خضروات وفواكه طازجة من المزرعة مباشرة</p>
        </div>
      </section>

      {/* Products */}
      {[
        { key: 'vegetables', items: vegetables, title: 'Vegetables', titleAr: 'الخضروات' },
        { key: 'fruits',     items: fruits,     title: 'Fruits',     titleAr: 'الفواكه' },
        { key: 'herbs',      items: herbs,      title: 'Herbs & Greens', titleAr: 'الأعشاب' },
      ].map(section => (
        <section key={section.key} className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex items-center gap-3 mb-6">
            <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
            <span className="text-gray-400">|</span>
            <span className="text-xl text-gray-600 font-medium">{section.titleAr}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {section.items.map(product => {
              const price = Number(product[priceKey]);
              const inCart = cart.find(i => i.product.id === product.id);
              return (
                <div key={product.id} className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-all group overflow-hidden">
                  <div className="relative overflow-hidden h-40">
                    <img
                      src={product.image_url}
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <span className={`absolute top-2 left-2 text-xs font-medium px-2 py-0.5 rounded-full ${categoryLabels[product.category]?.color ?? ''}`}>
                      {categoryLabels[product.category]?.labelAr ?? product.category}
                    </span>
                    <div className={`absolute top-2 right-2 flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full ${product.stock > 100 ? 'bg-emerald-100 text-emerald-700' : product.stock > 30 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                      {product.stock > 100 ? 'In stock' : product.stock > 30 ? 'Limited' : 'Low'}
                    </div>
                  </div>
                  <div className="p-3">
                    <h3 className="font-semibold text-gray-900 text-sm">{product.name}</h3>
                    <p className="text-gray-500 text-xs mb-2">{product.name_ar} · per {product.unit}</p>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-lg font-bold text-emerald-600">{price} EGP</span>
                      <span className="text-xs text-gray-400">/{product.unit}</span>
                    </div>
                    {inCart ? (
                      <div className="flex items-center justify-between bg-emerald-50 rounded-lg p-1.5">
                        <button
                          onClick={() => updateQty(product.id, -1)}
                          className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="font-semibold text-emerald-700 text-sm">{inCart.qty}</span>
                        <button
                          onClick={() => updateQty(product.id, 1)}
                          className="w-7 h-7 flex items-center justify-center text-emerald-700 hover:bg-emerald-100 rounded-md transition-colors"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-xs font-medium py-2 rounded-lg hover:bg-emerald-700 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Add to Cart
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Floating cart button (mobile) */}
      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-4 right-4 sm:hidden z-30 bg-emerald-600 text-white px-5 py-3 rounded-full shadow-lg flex items-center gap-2 font-medium"
        >
          <ShoppingCart className="w-5 h-5" />
          {cartCount} · {cartTotal.toFixed(2)} EGP
        </button>
      )}

      {/* Cart drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setCartOpen(false)} />
          <div className="relative w-full max-w-md bg-white shadow-2xl flex flex-col h-full">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-emerald-600" />
                Your Cart
              </h2>
              <button onClick={() => setCartOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {cart.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <ShoppingCart className="w-12 h-12 mb-3 opacity-50" />
                  <p className="text-sm">Your cart is empty</p>
                  <p className="text-xs mt-1">Add some fresh products to get started</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map(item => {
                    const price = Number(item.product[priceKey]);
                    return (
                      <div key={item.product.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                        <img src={item.product.image_url} alt={item.product.name} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-gray-900 text-sm truncate">{item.product.name}</h4>
                          <p className="text-xs text-gray-500">{price} EGP / {item.product.unit}</p>
                          <p className="text-sm font-semibold text-emerald-600 mt-0.5">{(price * item.qty).toFixed(2)} EGP</p>
                        </div>
                        <div className="flex items-center gap-1.5 bg-white rounded-lg p-1 shadow-sm">
                          <button onClick={() => updateQty(item.product.id, -1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-semibold text-gray-800 text-sm w-6 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.product.id, 1)} className="w-6 h-6 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded-md transition-colors">
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <button onClick={() => removeFromCart(item.product.id)} className="text-gray-300 hover:text-red-500 transition-colors shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="border-t border-gray-100 px-5 py-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Total</span>
                  <span className="text-2xl font-bold text-gray-900">{cartTotal.toFixed(2)} <span className="text-sm font-normal text-gray-500">EGP</span></span>
                </div>
                <button
                  onClick={() => { setCartOpen(false); setCheckoutOpen(true); }}
                  className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Check className="w-5 h-5" />
                  Checkout
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checkout modal */}
      {checkoutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => !submitting && setCheckoutOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900 text-lg">Checkout</h2>
              <button onClick={() => !submitting && setCheckoutOpen(false)} className="text-gray-400 hover:text-gray-700 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4">
              {/* Order summary */}
              <div className="bg-gray-50 rounded-xl p-3 space-y-2">
                {cart.map(item => {
                  const price = Number(item.product[priceKey]);
                  return (
                    <div key={item.product.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{item.product.name} × {item.qty}</span>
                      <span className="font-medium text-gray-900">{(price * item.qty).toFixed(2)} EGP</span>
                    </div>
                  );
                })}
                <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                  <span className="font-semibold text-gray-900">Total</span>
                  <span className="font-bold text-emerald-600 text-lg">{cartTotal.toFixed(2)} EGP</span>
                </div>
              </div>

              {/* Customer details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">Your Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Ahmed Hassan"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1.5 block">WhatsApp Number</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+20 100 123 4567"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1.5 block flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-gray-400" />
                  Delivery Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={e => setLocation(e.target.value)}
                  placeholder="e.g. Nasr City, Cairo — Street name, building"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all"
                />
              </div>

              {/* Payment method */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">Payment Method</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod('cod')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${paymentMethod === 'cod' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <Banknote className={`w-5 h-5 ${paymentMethod === 'cod' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-medium ${paymentMethod === 'cod' ? 'text-emerald-700' : 'text-gray-500'}`}>Cash on Delivery</span>
                  </button>
                  <button
                    onClick={() => setPaymentMethod('online')}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-all ${paymentMethod === 'online' ? 'border-emerald-500 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <CreditCard className={`w-5 h-5 ${paymentMethod === 'online' ? 'text-emerald-600' : 'text-gray-400'}`} />
                    <span className={`text-xs font-medium ${paymentMethod === 'online' ? 'text-emerald-700' : 'text-gray-500'}`}>Online Payment</span>
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                onClick={handleCheckout}
                disabled={submitting || !cart.length}
                className="w-full bg-emerald-600 text-white font-semibold py-3 rounded-xl hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Placing Order...
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-5 h-5" />
                    Place Order via WhatsApp
                  </>
                )}
              </button>

              <p className="text-xs text-gray-400 text-center">
                Your order will be sent to our WhatsApp and we'll confirm shortly.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Order success modal */}
      {orderResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center p-8">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Order Placed!</h2>
            <p className="text-gray-500 text-sm mb-1">Your order ID is</p>
            <p className="text-emerald-600 font-bold text-lg mb-4">{orderResult.orderId}</p>
            <p className="text-gray-500 text-sm mb-6">
              We've received your order and sent a confirmation to your WhatsApp. Click below to continue the conversation.
            </p>
            <a
              href={orderResult.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full bg-[#25D366] text-white font-semibold py-3 rounded-xl hover:bg-[#1ebe5c] transition-colors flex items-center justify-center gap-2 mb-2"
            >
              <MessageCircle className="w-5 h-5" />
              Continue on WhatsApp
            </a>
            <button
              onClick={() => setOrderResult(null)}
              className="text-gray-400 text-sm hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      <footer className="text-center py-6 text-gray-400 text-sm border-t border-gray-100">
        © 2026 Fresh Greens — خضروات وفواكه طازجة
      </footer>
    </div>
  );
}
