export type CustomerType = 'retail' | 'shop' | 'restaurant';
export type OrderStatus = 'pending' | 'confirmed' | 'delivering' | 'delivered' | 'completed' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'paid' | 'cod' | 'geidea_pending' | 'tamara_pending';
export type PaymentMethod = 'cod' | 'online' | 'geidea' | 'tamara';

export interface Product {
  id: string;
  name: string;
  name_ar: string;
  category: 'vegetables' | 'fruits' | 'herbs';
  unit: string;
  retail_price: number;
  shop_price: number;
  wholesale_price: number;
  stock: number;
  image_url: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  location: string | null;
  total_orders: number;
  joined_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  qty: number;
  unit: string;
  unit_price: number;
}

export interface Order {
  id: string;
  customer_id: string | null;
  customer_name: string;
  customer_type: CustomerType;
  total: number;
  status: OrderStatus;
  payment_status: PaymentStatus;
  location: string | null;
  menu_page_id?: string | null;
  created_at: string;
  order_items?: OrderItem[];
}

export interface Conversation {
  id: string;
  customer_name: string;
  phone: string;
  customer_type: CustomerType;
  status: 'active' | 'completed' | 'waiting';
  order_id: string | null;
  last_activity: string;
  messages?: Message[];
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'customer' | 'bot';
  text: string;
  time: string;
  type: string | null;
}

export interface MenuPage {
  id: string;
  slug: string;
  customer_name: string;
  phone: string;
  customer_type: CustomerType;
  created_at: string;
}
