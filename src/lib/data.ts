// ─── DB-aware Data Access Layer ────────────────────────────────────
// Every read here first checks whether the database is reachable.
// If it isn't, we return realistic dummy data so the UI still renders.

import { prisma } from './db';
import {
  mapProduct, mapCustomer, mapOrder, mapOrderItem,
  mapConversation, mapMessage, mapMenuPage,
} from './mappers';
import {
  DUMMY_PRODUCTS, DUMMY_CUSTOMERS, DUMMY_ORDERS,
  DUMMY_CONVERSATIONS, DUMMY_MENU_PAGES,
  DUMMY_TRANSACTIONS, DUMMY_WEBHOOK_EVENTS, DUMMY_SYSTEM_LOGS,
} from './dummy';
import type { Product, Customer, Order, Conversation, MenuPage } from './types';

let cachedActive: boolean | null = null;
let lastCheck = 0;
const CHECK_INTERVAL_MS = 10_000;
const QUERY_TIMEOUT_MS = 2_000;

export async function isDbActive(): Promise<boolean> {
  if (cachedActive !== null && Date.now() - lastCheck < CHECK_INTERVAL_MS) {
    return cachedActive;
  }

  let active = false;
  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1 AS ok`,
      new Promise((_, reject) => setTimeout(() => reject(new Error('db check timeout')), QUERY_TIMEOUT_MS)),
    ]);
    active = true;
  } catch {
    active = false;
  }

  cachedActive = active;
  lastCheck = Date.now();
  return active;
}

export async function getProducts(): Promise<Product[]> {
  if (!(await isDbActive())) return DUMMY_PRODUCTS;
  try {
    const products = await prisma.product.findMany({ orderBy: { category: 'asc' } });
    return products.map(mapProduct);
  } catch {
    return DUMMY_PRODUCTS;
  }
}

export async function getCustomers(): Promise<Customer[]> {
  if (!(await isDbActive())) return DUMMY_CUSTOMERS;
  try {
    const customers = await prisma.customer.findMany({ orderBy: { name: 'asc' } });
    return customers.map(mapCustomer);
  } catch {
    return DUMMY_CUSTOMERS;
  }
}

export async function getOrders(): Promise<Order[]> {
  if (!(await isDbActive())) return DUMMY_ORDERS;
  try {
    const [orders, orderItems] = await Promise.all([
      prisma.order.findMany({ orderBy: { createdAt: 'desc' } }),
      prisma.orderItem.findMany(),
    ]);

    const itemsByOrder = new Map<string, typeof orderItems>();
    for (const oi of orderItems) {
      const arr = itemsByOrder.get(oi.orderId) ?? [];
      arr.push(oi);
      itemsByOrder.set(oi.orderId, arr);
    }

    return orders.map(o => {
      const mapped = mapOrder(o);
      mapped.order_items = (itemsByOrder.get(o.id) ?? []).map(mapOrderItem);
      return mapped;
    });
  } catch {
    return DUMMY_ORDERS;
  }
}

export async function getConversations(): Promise<Conversation[]> {
  if (!(await isDbActive())) return DUMMY_CONVERSATIONS;
  try {
    const [conversations, messages] = await Promise.all([
      prisma.conversation.findMany({ orderBy: { lastActivity: 'desc' } }),
      prisma.message.findMany({ orderBy: { time: 'asc' } }),
    ]);

    const messagesByConv = new Map<string, typeof messages>();
    for (const m of messages) {
      const arr = messagesByConv.get(m.conversationId) ?? [];
      arr.push(m);
      messagesByConv.set(m.conversationId, arr);
    }

    return conversations.map(c => {
      const mapped = mapConversation(c);
      mapped.messages = (messagesByConv.get(c.id) ?? []).map(mapMessage);
      return mapped;
    });
  } catch {
    return DUMMY_CONVERSATIONS;
  }
}

export async function getMenuPages(): Promise<MenuPage[]> {
  if (!(await isDbActive())) return DUMMY_MENU_PAGES;
  try {
    const pages = await prisma.menuPage.findMany({ orderBy: { createdAt: 'desc' } });
    return pages.map(mapMenuPage);
  } catch {
    return DUMMY_MENU_PAGES;
  }
}

export async function getMenuPageBySlug(slug: string): Promise<MenuPage | null> {
  if (!(await isDbActive())) {
    return DUMMY_MENU_PAGES.find(p => p.slug === slug) ?? null;
  }
  try {
    const page = await prisma.menuPage.findUnique({ where: { slug } });
    return page ? mapMenuPage(page) : null;
  } catch {
    return DUMMY_MENU_PAGES.find(p => p.slug === slug) ?? null;
  }
}

export interface DashboardData {
  products: Product[];
  customers: Customer[];
  orders: Order[];
  conversations: Conversation[];
}

export async function getDashboardData(): Promise<DashboardData> {
  const [products, customers, orders, conversations] = await Promise.all([
    getProducts(), getCustomers(), getOrders(), getConversations(),
  ]);
  return { products, customers, orders, conversations };
}

export interface IntegrationsData {
  whatsappEvents: Array<{ createdAt: Date; processed: boolean }>;
  hyperpayEvents: Array<{ createdAt: Date; processed: boolean }>;
  geideaEvents: Array<{ createdAt: Date; processed: boolean }>;
  tamaraEvents: Array<{ createdAt: Date; processed: boolean }>;
  recentLogs: Array<{ level: string; service: string; createdAt: Date }>;
  txnCount: number;
}

const DUMMY_WEBHOOKS: IntegrationsData['whatsappEvents'] = DUMMY_WEBHOOK_EVENTS.map(e => ({ createdAt: e.createdAt, processed: e.processed }));
const DUMMY_LOGS: IntegrationsData['recentLogs'] = DUMMY_SYSTEM_LOGS.map(l => ({ level: l.level, service: l.service, createdAt: l.createdAt }));

export async function getIntegrationsData(): Promise<IntegrationsData> {
  if (!(await isDbActive())) {
    return {
      whatsappEvents: DUMMY_WEBHOOKS,
      hyperpayEvents: [],
      geideaEvents: [],
      tamaraEvents: [],
      recentLogs: DUMMY_LOGS,
      txnCount: DUMMY_TRANSACTIONS.length,
    };
  }
  try {
    const [txnCount, whatsappEvents, hyperpayEvents, geideaEvents, tamaraEvents, recentLogs] = await Promise.all([
      prisma.transaction.count(),
      prisma.webhookEvent.findMany({ where: { source: 'whatsapp' }, orderBy: { createdAt: 'desc' }, take: 50, select: { createdAt: true, processed: true } }),
      prisma.webhookEvent.findMany({ where: { source: 'hyperpay' }, orderBy: { createdAt: 'desc' }, take: 50, select: { createdAt: true, processed: true } }),
      prisma.webhookEvent.findMany({ where: { source: 'geidea' }, orderBy: { createdAt: 'desc' }, take: 50, select: { createdAt: true, processed: true } }),
      prisma.webhookEvent.findMany({ where: { source: 'tamara' }, orderBy: { createdAt: 'desc' }, take: 50, select: { createdAt: true, processed: true } }),
      prisma.systemLog.findMany({ orderBy: { createdAt: 'desc' }, take: 20, select: { level: true, service: true, createdAt: true } }),
    ]);

    return { whatsappEvents, hyperpayEvents, geideaEvents, tamaraEvents, recentLogs, txnCount };
  } catch {
    return {
      whatsappEvents: DUMMY_WEBHOOKS,
      hyperpayEvents: [],
      geideaEvents: [],
      tamaraEvents: [],
      recentLogs: DUMMY_LOGS,
      txnCount: DUMMY_TRANSACTIONS.length,
    };
  }
}
