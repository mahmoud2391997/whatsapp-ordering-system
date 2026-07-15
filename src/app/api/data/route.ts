import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import type { Order, OrderItem, Conversation, Message } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createServerClient();

  const [productsRes, customersRes, ordersRes, conversationsRes, orderItemsRes, messagesRes] = await Promise.all([
    supabase.from('products').select('*').order('category'),
    supabase.from('customers').select('*').order('name'),
    supabase.from('orders').select('*').order('created_at', { ascending: false }),
    supabase.from('conversations').select('*').order('last_activity', { ascending: false }),
    supabase.from('order_items').select('*'),
    supabase.from('messages').select('*').order('time', { ascending: true }),
  ]);

  const orderItems = (orderItemsRes.data ?? []) as OrderItem[];
  const messages = (messagesRes.data ?? []) as Message[];

  const orders: Order[] = (ordersRes.data ?? []).map((o: any) => ({
    ...o,
    order_items: orderItems.filter(oi => oi.order_id === o.id),
  }));

  const conversations: Conversation[] = (conversationsRes.data ?? []).map((c: any) => ({
    ...c,
    messages: messages.filter(m => m.conversation_id === c.id),
  }));

  return NextResponse.json({
    products: productsRes.data ?? [],
    customers: customersRes.data ?? [],
    orders,
    conversations,
  });
}
