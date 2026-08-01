// ─── Prisma → Snake-case mapping ────────────────────────────────────
// Prisma returns camelCase, but the frontend types/components use snake_case.
// This file provides lightweight mappers to avoid changing every component.

import type { Product, Customer, Order, OrderItem, Conversation, Message, MenuPage } from './types';

export function mapProduct(p: {
  id: string; name: string; nameAr: string; category: string; unit: string;
  retailPrice: unknown; shopPrice: unknown; wholesalePrice: unknown;
  stock: number; imageUrl: string;
}): Product {
  return {
    id: p.id, name: p.name, name_ar: p.nameAr, category: p.category as Product['category'],
    unit: p.unit, retail_price: Number(p.retailPrice), shop_price: Number(p.shopPrice),
    wholesale_price: Number(p.wholesalePrice), stock: p.stock, image_url: p.imageUrl,
  };
}

export function mapCustomer(c: {
  id: string; name: string; phone: string; type: string;
  location: string | null; totalOrders: number; joinedAt: Date;
}): Customer {
  return {
    id: c.id, name: c.name, phone: c.phone, type: c.type as Customer['type'],
    location: c.location, total_orders: c.totalOrders, joined_at: c.joinedAt.toISOString(),
  };
}

export function mapOrderItem(i: {
  id: string; orderId: string; productId: string | null;
  productName: string; qty: unknown; unit: string; unitPrice: unknown;
}): OrderItem {
  return {
    id: i.id, order_id: i.orderId, product_id: i.productId,
    product_name: i.productName, qty: Number(i.qty), unit: i.unit,
    unit_price: Number(i.unitPrice),
  };
}

export function mapOrder(o: {
  id: string; customerId: string | null; customerName: string; customerType: string;
  total: unknown; status: string; paymentStatus: string; location: string | null;
  createdAt: Date;
}): Order {
  return {
    id: o.id, customer_id: o.customerId, customer_name: o.customerName,
    customer_type: o.customerType as Order['customer_type'],
    total: Number(o.total), status: o.status as Order['status'],
    payment_status: o.paymentStatus as Order['payment_status'],
    location: o.location, created_at: o.createdAt.toISOString(),
  };
}

export function mapConversation(c: {
  id: string; customerName: string; phone: string; customerType: string;
  status: string; orderId: string | null; lastActivity: string;
}): Conversation {
  return {
    id: c.id, customer_name: c.customerName, phone: c.phone,
    customer_type: c.customerType as Conversation['customer_type'],
    status: c.status as Conversation['status'],
    order_id: c.orderId, last_activity: c.lastActivity,
  };
}

export function mapMessage(m: {
  id: string; conversationId: string; sender: string;
  text: string; time: string; type: string | null;
}): Message {
  return {
    id: m.id, conversation_id: m.conversationId, sender: m.sender as Message['sender'],
    text: m.text, time: m.time, type: m.type,
  };
}

export function mapMenuPage(p: {
  id: string; slug: string; customerName: string; phone: string;
  customerType: string; createdAt: Date;
}): MenuPage {
  return {
    id: p.id, slug: p.slug, customer_name: p.customerName, phone: p.phone,
    customer_type: p.customerType as MenuPage['customer_type'],
    created_at: p.createdAt.toISOString(),
  };
}
