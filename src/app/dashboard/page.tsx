'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  LayoutDashboard, ShoppingBag, Users, Package, MessageSquare,
  TrendingUp, Truck, Clock, CheckCircle2, XCircle, ChevronRight,
  Leaf, Bell, Search, Menu, X, AlertCircle, ExternalLink,
  Plug, Copy, Check, Activity, CreditCard, Wallet,
  UserPlus, Loader2, Link2, Plus,
} from 'lucide-react';
import Link from 'next/link';
import WhatsAppChat from '@/components/WhatsAppChat';
import MockChat from '@/components/MockChat';
import type { Product, Customer, Order, OrderItem, Conversation, OrderStatus, CustomerType, MenuPage } from '@/lib/types';

interface IntegrationInfo {
  name: string;
  service: string;
  configured: boolean;
  status: 'operational' | 'degraded' | 'down' | 'pending';
  description: string;
  webhookUrl?: string;
  lastEvent?: string | null;
  eventCount?: number;
}

interface IntegrationData {
  integrations: IntegrationInfo[];
  summary: {
    total: number;
    operational: number;
    pending: number;
    degraded: number;
    transactions: number;
    recentErrors: number;
  };
  edgeFunctions: Array<{ name: string; url: string }>;
  recentLogs: Array<{ level: string; service: string; created_at: string }>;
}

type DashSection = 'overview' | 'orders' | 'conversations' | 'customers' | 'inventory' | 'integrations' | 'chatbot';

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: typeof Clock }> = {
  pending:    { label: 'Pending',    color: 'bg-amber-100 text-amber-700',   icon: Clock },
  confirmed:  { label: 'Confirmed',  color: 'bg-blue-100 text-blue-700',     icon: CheckCircle2 },
  preparing:  { label: 'Preparing',  color: 'bg-indigo-100 text-indigo-700', icon: Package },
  ready:      { label: 'Ready',      color: 'bg-cyan-100 text-cyan-700',     icon: CheckCircle2 },
  out_for_delivery: { label: 'Out for delivery', color: 'bg-purple-100 text-purple-700', icon: Truck },
  delivered:  { label: 'Delivered',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  completed:  { label: 'Completed',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  cancelled:  { label: 'Cancelled',  color: 'bg-red-100 text-red-700',       icon: XCircle },
};

const customerTypeBadge: Record<CustomerType, string> = {
  retail:     'bg-emerald-100 text-emerald-700',
  shop:       'bg-blue-100 text-blue-700',
  restaurant: 'bg-amber-100 text-amber-700',
};

export default function DashboardPage() {
  const [section, setSection] = useState<DashSection>('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [dbActive, setDbActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch('/api/data');
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setProducts(data.products ?? []);
      setCustomers(data.customers ?? []);
      setOrders(data.orders ?? []);
      setConversations(data.conversations ?? []);
      setDbActive(data.db?.active ?? true);
    } catch {
      setDbActive(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending').length;
  const activeCustomers = customers.length;

  const navItems: { id: DashSection; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview',       label: 'Overview',       icon: LayoutDashboard },
    { id: 'orders',         label: 'Orders',         icon: ShoppingBag },
    { id: 'conversations',  label: 'WhatsApp Chats', icon: MessageSquare },
    { id: 'customers',      label: 'Customers',      icon: Users },
    { id: 'inventory',      label: 'Inventory',      icon: Package },
    { id: 'integrations',   label: 'Integrations',   icon: Plug },
    { id: 'chatbot',        label: 'AI Bot Test',     icon: MessageSquare },
  ];

  const goMenu = useCallback(() => { window.location.href = '/menu'; }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400 flex items-center gap-2">
          <Leaf className="w-5 h-5 animate-pulse" />
          Loading Fresh Greens dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-30 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-40 w-60 bg-[#064e3b] flex flex-col transform transition-transform duration-200 lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="px-5 py-5 flex items-center gap-2 border-b border-emerald-800">
          <div className="w-8 h-8 bg-[#25D366] rounded-lg flex items-center justify-center shrink-0">
            <Leaf className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-sm leading-tight">Fresh Greens</p>
            <p className="text-emerald-400 text-xs">Admin Dashboard</p>
          </div>
          <button className="ml-auto lg:hidden text-emerald-400 hover:text-white" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => { setSection(item.id); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === item.id
                  ? 'bg-emerald-600 text-white'
                  : 'text-emerald-200 hover:bg-emerald-800 hover:text-white'
              }`}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="px-3 pb-4">
          <Link
            href="/menu"
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium text-emerald-300 hover:bg-emerald-800 hover:text-white transition-colors"
          >
            <ExternalLink className="w-4 h-4 shrink-0" />
            View Menu Page
          </Link>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        {!dbActive && (
          <div className="bg-amber-500 text-white text-xs font-medium px-4 py-1.5 flex items-center gap-2 justify-center">
            <AlertCircle className="w-3.5 h-3.5 shrink-0" />
            Database unavailable — showing demo data.
          </div>
        )}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 h-14 flex items-center gap-3 sticky top-0 z-20">
          <button className="lg:hidden text-gray-500" onClick={() => setSidebarOpen(true)}>
            <Menu className="w-5 h-5" />
          </button>
          <div className="relative hidden sm:block flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="w-full bg-gray-100 rounded-lg pl-9 pr-3 py-1.5 text-sm text-gray-600 placeholder-gray-400 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-300 transition" placeholder="Search orders, customers..." />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <button className="relative text-gray-500 hover:text-gray-700">
              <Bell className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">2</span>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-emerald-600 flex items-center justify-center text-white text-sm font-bold">A</div>
              <span className="text-sm font-medium text-gray-700 hidden sm:block">Admin</span>
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          {section === 'overview'      && <OverviewSection goMenu={goMenu} setSection={setSection} totalRevenue={totalRevenue} pendingOrders={pendingOrders} activeCustomers={activeCustomers} orders={orders} products={products} />}
          {section === 'orders'        && <OrdersSection orders={orders} />}
          {section === 'conversations' && <ConversationsSection conversations={conversations} goMenu={goMenu} onRefresh={loadData} />}
          {section === 'customers'     && <CustomersSection customers={customers} />}
          {section === 'inventory'     && <InventorySection products={products} onRefresh={loadData} />}
          {section === 'integrations'  && <IntegrationsSection />}
          {section === 'chatbot'       && <ChatbotSection />}
        </main>
      </div>
    </div>
  );
}

/* ── Overview ── */
function OverviewSection({
  goMenu, setSection, totalRevenue, pendingOrders, activeCustomers, orders, products,
}: {
  goMenu: () => void;
  setSection: (s: DashSection) => void;
  totalRevenue: number;
  pendingOrders: number;
  activeCustomers: number;
  orders: Order[];
  products: Product[];
}) {
  const stats = [
    { label: "Today's Revenue", value: `${totalRevenue.toLocaleString()} EGP`, change: '+12%', icon: TrendingUp, color: 'bg-emerald-500' },
    { label: 'Total Orders', value: orders.length.toString(), change: '+3 today', icon: ShoppingBag, color: 'bg-blue-500' },
    { label: 'Pending Orders', value: pendingOrders.toString(), change: 'Need action', icon: Clock, color: 'bg-amber-500' },
    { label: 'Active Customers', value: activeCustomers.toString(), change: '+2 new', icon: Users, color: 'bg-purple-500' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard Overview</h1>
        <p className="text-gray-500 text-sm mt-0.5">Sunday, 13 July 2026</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center`}>
                <s.icon className="w-4 h-4 text-white" />
              </div>
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">{s.change}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['retail', 'shop', 'restaurant'] as CustomerType[]).map(type => {
          const count = orders.filter(o => o.customer_type === type).length;
          const rev = orders.filter(o => o.customer_type === type).reduce((s, o) => s + o.total, 0);
          return (
            <div key={type} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
              <div className="flex items-center justify-between mb-3">
                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${customerTypeBadge[type]}`}>{type}</span>
                <span className="text-sm font-bold text-gray-900">{count} orders</span>
              </div>
              <p className="text-xl font-bold text-gray-900">{rev.toLocaleString()} EGP</p>
              <div className="mt-2 bg-gray-100 rounded-full h-1.5">
                <div className="bg-emerald-500 rounded-full h-1.5" style={{ width: `${totalRevenue ? (rev / totalRevenue) * 100 : 0}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Recent Orders</h2>
            <button onClick={() => setSection('orders')} className="text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1">
              View all <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {orders.slice(0, 4).map(order => {
              const sc = statusConfig[order.status];
              return (
                <div key={order.id} className="flex items-center gap-3 px-5 py-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{order.id}</p>
                    <p className="text-xs text-gray-500">{order.customer_name}</p>
                  </div>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${customerTypeBadge[order.customer_type]}`}>{order.customer_type}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
                  <span className="text-sm font-bold text-gray-900 w-24 text-right">{order.total.toLocaleString()} EGP</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-gradient-to-br from-emerald-600 to-emerald-500 rounded-xl p-5 text-white">
            <h3 className="font-semibold text-sm mb-1">Public Menu Page</h3>
            <p className="text-emerald-100 text-xs mb-4">Share with customers to browse products & place orders via WhatsApp.</p>
            <button
              onClick={goMenu}
              className="flex items-center gap-2 bg-white text-emerald-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-emerald-50 transition-colors w-full justify-center"
            >
              <ExternalLink className="w-4 h-4" />
              View Menu
            </button>
          </div>
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-sm text-gray-800 mb-3">Low Stock Alert</h3>
            {products.filter(p => p.stock < 100).map(p => (
              <div key={p.id} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <span className="text-xs text-gray-700">{p.name}</span>
                </div>
                <span className="text-xs font-semibold text-amber-600">{p.stock} {p.unit}s</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Orders ── */
function OrdersSection({ orders }: { orders: Order[] }) {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState('');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [orderError, setOrderError] = useState<string | null>(null);
  const filtered = filter === 'all' ? orders : orders.filter(o => o.status === filter);

  const handleConfirmOrder = async (orderId: string) => {
    try {
      const res = await fetch('/api/confirm-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, message: '' }),
      });
      if (res.ok) {
        setConfirmingId(null);
        setConfirmMsg('');
        window.location.reload();
      } else {
        const data = await res.json().catch(() => null);
        setOrderError(data?.error ?? 'Failed to confirm order');
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to confirm order');
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingId || !cancelReason.trim()) return;
    try {
      const res = await fetch(`/api/orders/${cancellingId}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'cancelled', reason: cancelReason.trim() }),
      });
      if (res.ok) window.location.reload();
      else {
        const data = await res.json().catch(() => null);
        setOrderError(data?.error ?? 'Failed to cancel order');
      }
    } catch (err) {
      setOrderError(err instanceof Error ? err.message : 'Failed to cancel order');
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      <div className="flex flex-wrap gap-2">
        {(['all', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed', 'cancelled'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
              filter === f ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400'
            }`}
          >
            {f === 'all' ? 'All Orders' : statusConfig[f].label}
            <span className="ml-1.5 opacity-70">
              {f === 'all' ? orders.length : orders.filter(o => o.status === f).length}
            </span>
          </button>
        ))}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Order</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Items</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Salla</th>
  <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Payment</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Total</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(order => {
                const sc = statusConfig[order.status];
                return (
                  <tr key={order.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-gray-900">{order.id}</p>
                      <p className="text-xs text-gray-400">{new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-medium text-gray-800 text-sm">{order.customer_name}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${customerTypeBadge[order.customer_type]}`}>{order.customer_type}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="space-y-0.5">
                        {(order.order_items ?? []).map((item: OrderItem, i: number) => (
                          <p key={i} className="text-xs text-gray-600">{item.product_name} × {item.qty} {item.unit}</p>
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-gray-500 max-w-28">{order.location}</td>
  <td className="px-4 py-3.5">
  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.color}`}>{sc.label}</span>
  </td>
  <td className="px-4 py-3.5">
  <div className="flex flex-col gap-1">
  <span className={`text-xs px-2 py-0.5 rounded-full font-medium w-fit ${order.salla_sync_status === 'synced' ? 'bg-emerald-100 text-emerald-700' : order.salla_sync_status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>{order.salla_sync_status ?? 'not synced'}</span>
  <span className="text-[10px] text-gray-400 max-w-28 truncate">{order.salla_order_id ?? 'Not linked'}</span>
  {order.salla_sync_status === 'failed' && <button onClick={() => fetch('/api/salla/retry', { method: 'POST' }).then(() => window.location.reload())} className="text-[10px] text-emerald-600 hover:underline text-left">Retry</button>}
  </div>
  </td>
  <td className="px-4 py-3.5">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        order.payment_status === 'paid' ? 'bg-emerald-100 text-emerald-700' :
                        order.payment_status === 'cod' ? 'bg-blue-100 text-blue-700' :
                        order.payment_status === 'pending' ? 'bg-violet-100 text-violet-700' :
                        'bg-red-100 text-red-700'
                      }`}>{order.payment_status.replace('_', ' ').toUpperCase()}</span>
                    </td>
                    <td className="px-4 py-3.5 text-right font-bold text-gray-900">{order.total.toLocaleString()} EGP</td>
                    <td className="px-4 py-3.5 text-right">
                      {order.status === 'pending' && (
                        <button
                          onClick={() => setConfirmingId(order.id)}
                          className="text-xs px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 transition-colors font-medium"
                        >
                          Confirm
                        </button>
                      )}
                      {['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status) && (
                        <button
                          onClick={() => { setCancellingId(order.id); setCancelReason(''); setOrderError(null); }}
                          className="ml-2 text-xs px-3 py-1.5 rounded-lg bg-red-100 text-red-700 hover:bg-red-200 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {orderError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{orderError}</p>}

      {/* Confirmation modal */}
      {confirmingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Confirm Order</h3>
            <p className="text-gray-500 text-sm mb-6">
              A professional confirmation message will be sent to the customer via WhatsApp using our order confirmation template.
            </p>
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
              <p className="text-sm text-emerald-800">
                <span className="font-semibold">Order ID:</span> {confirmingId}
              </p>
              <p className="text-xs text-emerald-700 mt-2">
                Template: jaspers_market_order_confirmation_v1
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingId(null)}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleConfirmOrder(confirmingId)}
                className="flex-1 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="w-4 h-4" />
                Confirm & Notify
              </button>
            </div>
          </div>
        </div>
      )}

      {cancellingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h3 className="font-bold text-gray-900 text-lg mb-2">Cancel Order</h3>
            <p className="text-gray-500 text-sm mb-4">Cancellation cannot be undone. The customer will be notified with the reason.</p>
            <textarea
              value={cancelReason}
              onChange={e => setCancelReason(e.target.value)}
              placeholder="Cancellation reason"
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
            />
            <div className="flex gap-3 mt-4">
              <button onClick={() => setCancellingId(null)} className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg">Keep Order</button>
              <button onClick={handleCancelOrder} disabled={!cancelReason.trim()} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg disabled:opacity-50">Cancel Order</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Conversations ── */
function ConversationsSection({ conversations, goMenu, onRefresh }: { conversations: Conversation[]; goMenu: () => void; onRefresh: () => void | Promise<void> }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp Conversations</h1>
        <p className="text-gray-500 text-sm mt-0.5">Start conversations, confirm orders, and reply to customers</p>
      </div>
      <WhatsAppChat conversations={conversations} onViewMenu={goMenu} onRefresh={onRefresh} />
    </div>
  );
}

/* ── Customers ── */
function CustomersSection({ customers }: { customers: Customer[] }) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-2">
        {(['retail', 'shop', 'restaurant'] as CustomerType[]).map(type => {
          const count = customers.filter(c => c.type === type).length;
          const totalOrders = customers.filter(c => c.type === type).reduce((s, c) => s + c.total_orders, 0);
          return (
            <div key={type} className={`rounded-xl p-4 border-2 ${customerTypeBadge[type].replace('text-', 'border-').replace('-700', '-300')} bg-white shadow-sm`}>
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize ${customerTypeBadge[type]}`}>{type}</span>
              <p className="text-3xl font-bold text-gray-900 mt-2">{count}</p>
              <p className="text-xs text-gray-500">{totalOrders} total orders</p>
            </div>
          );
        })}
      </div>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Phone</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Type</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Location</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Orders</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {customers.map(c => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center text-white text-sm font-bold shrink-0">
                        {c.name[0]}
                      </div>
                      <p className="font-semibold text-gray-900">{c.name}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-gray-600">{c.phone}</td>
                  <td className="px-4 py-3.5">
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${customerTypeBadge[c.type]}`}>{c.type}</span>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-500">{c.location}</td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-gray-900">{c.total_orders}</span>
                      <div className="bg-gray-100 rounded-full h-1.5 w-16">
                        <div className="bg-emerald-500 rounded-full h-1.5" style={{ width: `${Math.min((c.total_orders / 80) * 100, 100)}%` }} />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-xs text-gray-400">{c.joined_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ── Inventory ── */
function InventorySection({ products, onRefresh }: { products: Product[]; onRefresh: () => void }) {
  const [category, setCategory] = useState<'all' | 'vegetables' | 'fruits' | 'herbs'>('all');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const emptyForm = { name: '', name_ar: '', category: 'vegetables' as 'vegetables' | 'fruits' | 'herbs', unit: 'kg', retail_price: '', shop_price: '', wholesale_price: '', stock: '', image_url: '' };
  const [form, setForm] = useState(emptyForm);

  const filtered = category === 'all' ? products : products.filter(p => p.category === category);

  function openAdd() { setEditing(null); setForm(emptyForm); setShowForm(true); }
  function openEdit(p: Product) {
    setEditing(p);
    setForm({ name: p.name, name_ar: p.name_ar, category: p.category, unit: p.unit, retail_price: String(p.retail_price), shop_price: String(p.shop_price), wholesale_price: String(p.wholesale_price), stock: String(p.stock), image_url: p.image_url });
    setShowForm(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const url = editing ? `/api/products/${editing.id}` : '/api/products';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error('Failed');
      setShowForm(false);
      onRefresh();
    } catch { alert('Failed to save product'); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this product?')) return;
    const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
    if (res.ok) onRefresh(); else alert('Failed to delete');
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/products/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      alert(`Imported ${json.imported} products`);
      onRefresh();
    } catch (err: unknown) { alert(err instanceof Error ? err.message : 'Upload failed'); } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function downloadTemplate() { window.open('/api/products/template', '_blank'); }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Inventory & Products</h1>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 transition-colors">
            Download Template
          </button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleUpload} />
          <button onClick={() => fileRef.current?.click()} disabled={uploading} className="text-xs px-3 py-1.5 rounded-lg font-medium bg-white border border-gray-200 text-gray-600 hover:border-emerald-400 transition-colors disabled:opacity-50">
            {uploading ? 'Uploading...' : 'Upload Excel'}
          </button>
          <button onClick={openAdd} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Add Product
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(['all', 'vegetables', 'fruits', 'herbs'] as const).map(c => (
          <button
            key={c}
            onClick={() => setCategory(c)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium capitalize transition-colors ${
              category === c ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-emerald-400'
            }`}
          >{c === 'all' ? 'All Products' : c}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Product</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Category</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Retail</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Shop</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Restaurant</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stock</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => {
                const stockStatus = p.stock > 200 ? { label: 'Good', color: 'bg-emerald-100 text-emerald-700' }
                  : p.stock > 80 ? { label: 'OK', color: 'bg-amber-100 text-amber-700' }
                  : { label: 'Low', color: 'bg-red-100 text-red-700' };
                return (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="font-semibold text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-500">{p.name_ar} · per {p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium capitalize ${
                        p.category === 'vegetables' ? 'bg-emerald-100 text-emerald-700' :
                        p.category === 'fruits' ? 'bg-amber-100 text-amber-700' :
                        'bg-teal-100 text-teal-700'
                      }`}>{p.category}</span>
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-gray-800">{p.retail_price} EGP</td>
                    <td className="px-4 py-3.5 font-semibold text-blue-700">{p.shop_price} EGP</td>
                    <td className="px-4 py-3.5 font-semibold text-amber-700">{p.wholesale_price} EGP</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 w-10">{p.stock}</span>
                        <div className="bg-gray-100 rounded-full h-1.5 w-20">
                          <div className={`rounded-full h-1.5 ${
                            p.stock > 200 ? 'bg-emerald-500' : p.stock > 80 ? 'bg-amber-500' : 'bg-red-500'
                          }`} style={{ width: `${Math.min((p.stock / 600) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stockStatus.color}`}>{stockStatus.label}</span>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(p)} className="text-xs text-emerald-600 hover:underline font-medium">Edit</button>
                        <button onClick={() => handleDelete(p.id)} className="text-xs text-red-600 hover:underline font-medium">Delete</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold text-gray-900">{editing ? 'Edit Product' : 'Add Product'}</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name (English)</label>
                  <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Name (Arabic)</label>
                  <input value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" dir="rtl" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Category</label>
                  <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value as 'vegetables' | 'fruits' | 'herbs' })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none capitalize">
                    <option value="vegetables">Vegetables</option>
                    <option value="fruits">Fruits</option>
                    <option value="herbs">Herbs</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Unit</label>
                  <select value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none">
                    <option value="kg">kg</option>
                    <option value="piece">piece</option>
                    <option value="bunch">bunch</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Retail Price (EGP)</label>
                  <input type="number" step="0.01" value={form.retail_price} onChange={e => setForm({ ...form, retail_price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Shop Price (EGP)</label>
                  <input type="number" step="0.01" value={form.shop_price} onChange={e => setForm({ ...form, shop_price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Wholesale (EGP)</label>
                  <input type="number" step="0.01" value={form.wholesale_price} onChange={e => setForm({ ...form, wholesale_price: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Stock</label>
                  <input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Image URL</label>
                  <input value={form.image_url} onChange={e => setForm({ ...form, image_url: e.target.value })} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-300 outline-none" placeholder="https://..." />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
              <button onClick={handleSave} disabled={saving || !form.name || !form.name_ar} className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center gap-1.5">
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editing ? 'Save Changes' : 'Add Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Integrations ── */
function IntegrationsSection() {
  const [data, setData] = useState<IntegrationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const runSallaAction = async (action: string) => {
    setSyncing(action);
    setSyncResult(null);
    try {
      const endpoint = action === 'retry' ? '/api/salla/retry' : `/api/salla/sync/${action}`;
      const response = await fetch(endpoint, { method: 'POST' });
      const result = await response.json();
      setSyncResult(response.ok ? `${action} complete${result.succeeded !== undefined ? `: ${result.succeeded} succeeded, ${result.stillFailing} still failing` : ''}` : result.error ?? 'Sync failed');
    } catch { setSyncResult('Sync failed'); } finally { setSyncing(null); }
  };

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/integrations');
        if (!res.ok) throw new Error('Failed to fetch');
        const json = await res.json();
        setData(json);
      } catch { /* empty state */ } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Activity className="w-5 h-5 animate-pulse mr-2" />
        Loading integrations status...
      </div>
    );
  }

  if (!data) {
    return <div className="text-gray-400 text-center py-20">Failed to load integration status.</div>;
  }

  const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
    operational: { label: 'Operational', color: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
    degraded:    { label: 'Degraded',    color: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500' },
    down:        { label: 'Down',        color: 'bg-red-100 text-red-700',       dot: 'bg-red-500' },
    pending:     { label: 'Pending Setup', color: 'bg-gray-100 text-gray-600',   dot: 'bg-gray-400' },
  };

  const serviceIcons: Record<string, typeof Plug> = {
    whatsapp: MessageSquare,
    mistral: Activity,
    hyperpay: ShoppingBag,
    geidea: CreditCard,
    tamara: Wallet,
    supabase: Plug,
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
        <p className="text-gray-500 text-sm mt-0.5">External service connections and webhook endpoints</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.summary.operational}</span>
          </div>
          <p className="text-xs text-gray-500">Operational</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-gray-500" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.summary.pending}</span>
          </div>
          <p className="text-xs text-gray-500">Pending Setup</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-blue-600" />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.summary.transactions}</span>
          </div>
          <p className="text-xs text-gray-500">Transactions</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${data.summary.recentErrors > 0 ? 'bg-red-100' : 'bg-emerald-100'}`}>
              <AlertCircle className={`w-4 h-4 ${data.summary.recentErrors > 0 ? 'text-red-600' : 'text-emerald-600'}`} />
            </div>
            <span className="text-2xl font-bold text-gray-900">{data.summary.recentErrors}</span>
          </div>
          <p className="text-xs text-gray-500">Recent Errors</p>
        </div>
      </div>

      {/* Salla controls */}
      {(() => {
        const salla = data.integrations.find((item) => item.service === 'salla');
        return <div className="bg-white rounded-xl border border-emerald-100 shadow-sm p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-gray-900">Salla Partner App</h2>
              <p className="text-xs text-gray-500 mt-1">{salla?.configured ? 'Connected store synchronization' : 'Connect a Salla store to sync catalog and orders'}</p>
              {salla?.lastEvent && <p className="text-xs text-gray-400 mt-2">Last webhook: {new Date(salla.lastEvent).toLocaleString()}</p>}
            </div>
            <a href="/api/salla/install" className="text-sm font-medium text-emerald-700 hover:underline">{salla?.configured ? 'Reconnect' : 'Connect to Salla'}</a>
          </div>
          <div className="flex flex-wrap gap-2 mt-4">
            {['products', 'customers', 'orders', 'retry'].map((action) => <button key={action} onClick={() => runSallaAction(action)} disabled={syncing !== null} className="px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 disabled:opacity-50">{syncing === action ? 'Working...' : action === 'retry' ? 'Retry failed syncs' : `Sync ${action}`}</button>)}
          </div>
          {syncResult && <p className="text-xs text-gray-600 mt-3" role="status">{syncResult}</p>}
        </div>;
      })()}

      {/* Integration cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {data.integrations.map(integration => {
          const sc = statusConfig[integration.status];
          const Icon = serviceIcons[integration.service] ?? Plug;
          return (
            <div key={integration.service} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${integration.configured ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                    <Icon className={`w-5 h-5 ${integration.configured ? 'text-emerald-600' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{integration.name}</h3>
                    <p className="text-xs text-gray-500">{integration.description}</p>
                  </div>
                </div>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${sc.color} flex items-center gap-1.5`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot} ${integration.status === 'operational' ? 'animate-pulse' : ''}`} />
                  {sc.label}
                </span>
              </div>

              {integration.webhookUrl && (
                <div className="mt-3 bg-gray-50 rounded-lg p-2.5 flex items-center gap-2">
                  <code className="text-xs text-gray-600 flex-1 truncate">{integration.webhookUrl}</code>
                  <button
                    onClick={() => copyToClipboard(integration.webhookUrl!)}
                    className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
                  >
                    {copied === integration.webhookUrl ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {integration.eventCount !== undefined && integration.eventCount > 0 && (
                <div className="mt-2 flex items-center gap-4 text-xs text-gray-400">
                  <span>{integration.eventCount} events received</span>
                  {integration.lastEvent && (
                    <span>Last: {new Date(integration.lastEvent).toLocaleString()}</span>
                  )}
                </div>
              )}

              {!integration.configured && (
                <div className="mt-3 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                  Configure the required environment variables to activate this integration.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edge Functions list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">Edge Functions</h2>
          <p className="text-xs text-gray-500 mt-0.5">Serverless functions deployed on Supabase</p>
        </div>
        <div className="divide-y divide-gray-50">
          {data.edgeFunctions.map(fn => (
            <div key={fn.name} className="flex items-center gap-3 px-5 py-3">
              <div className="w-7 h-7 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <span className="text-sm font-medium text-gray-800">{fn.name}</span>
              <code className="text-xs text-gray-400 flex-1 truncate ml-2">{fn.url}</code>
              <button
                onClick={() => copyToClipboard(fn.url)}
                className="text-gray-400 hover:text-gray-700 transition-colors shrink-0"
              >
                {copied === fn.url ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Recent logs */}
      {data.recentLogs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-50">
            <h2 className="font-semibold text-gray-900">Recent System Logs</h2>
          </div>
          <div className="divide-y divide-gray-50 max-h-64 overflow-y-auto">
            {data.recentLogs.map((log, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-2.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  log.level === 'error' ? 'bg-red-100 text-red-700' :
                  log.level === 'warn' ? 'bg-amber-100 text-amber-700' :
                  'bg-blue-100 text-blue-700'
                }`}>{log.level}</span>
                <span className="text-xs text-gray-500">{log.service}</span>
                <span className="text-xs text-gray-400 ml-auto">{new Date(log.created_at).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Menu Pages ── */
function MenuPagesSection({ menuPages }: { menuPages: MenuPage[] }) {
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [customerType, setCustomerType] = useState<CustomerType>('retail');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSlug, setCreatedSlug] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pages, setPages] = useState<MenuPage[]>(menuPages);

  useEffect(() => { setPages(menuPages); }, [menuPages]);

  const handleCreate = async () => {
    if (!name || !phone) { setError('Name and phone are required'); return; }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/menu-pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customerName: name, phone, customerType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create');
      setCreatedSlug(data.menuPage.slug);
      setPages(prev => [data.menuPage, ...prev.filter(p => p.id !== data.menuPage.id)]);
      setName(''); setPhone(''); setCustomerType('retail');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setCreating(false);
    }
  };

  const copyUrl = (slug: string) => {
    const url = `${window.location.origin}/menu/${slug}`;
    navigator.clipboard.writeText(url);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Menu Pages</h1>
          <p className="text-gray-500 text-sm mt-0.5">Unique menu page for each customer — orders go straight to WhatsApp</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
        >
          {showCreate ? <X className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
          {showCreate ? 'Cancel' : 'New Menu Page'}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Create Customer Menu Page</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Customer Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ahmed Hassan"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Phone (WhatsApp)</label>
              <input
                type="text"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+20 100 123 4567"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Customer Type</label>
              <select
                value={customerType}
                onChange={e => setCustomerType(e.target.value as CustomerType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="retail">Retail</option>
                <option value="shop">Shop</option>
                <option value="restaurant">Restaurant</option>
              </select>
            </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-3">{error}</p>}
          {createdSlug && (
            <div className="mt-3 bg-emerald-50 rounded-lg p-3 flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              <code className="text-sm text-emerald-700 flex-1 truncate">/menu/{createdSlug}</code>
              <button onClick={() => copyUrl(createdSlug)} className="text-emerald-600 hover:text-emerald-800 transition-colors shrink-0">
                {copied === createdSlug ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          )}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="mt-4 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Create Page
          </button>
        </div>
      )}

      {/* Menu pages list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="px-5 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-gray-900">All Menu Pages ({pages.length})</h2>
        </div>
        {pages.length === 0 ? (
          <div className="px-5 py-12 text-center text-gray-400">
            <Link2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">No menu pages yet. Create one to give a customer their own ordering page.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pages.map(page => (
              <div key={page.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center shrink-0">
                  <Link2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-medium text-gray-900 truncate">{page.customer_name}</h3>
                  <p className="text-xs text-gray-500">{page.phone} · {page.customer_type}</p>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <code className="text-xs text-gray-400 bg-gray-50 px-2 py-1 rounded">/menu/{page.slug}</code>
                  <button onClick={() => copyUrl(page.slug)} className="text-gray-400 hover:text-gray-700 transition-colors">
                    {copied === page.slug ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <a
                  href="/menu"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:text-emerald-800 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors shrink-0"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Review
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── AI Bot Test ── */
function ChatbotSection() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">AI Bot Test</h1>
        <p className="text-gray-500 text-sm mt-0.5">Mock WhatsApp conversation to test the AI bot flow</p>
      </div>
      <div className="max-w-lg">
        <MockChat />
      </div>
    </div>
  );
}
