// ─── Dummy / Demo Data ──────────────────────────────────────────────
// Used whenever the database is unreachable so the UI still renders
// realistic sample data across every entity (products, customers,
// orders, conversations, menu pages, transactions, logs, etc.).

import type { Product, Customer, Order, Conversation, MenuPage } from './types';

const img = (id: string) => `https://images.unsplash.com/${id}?w=400&auto=format`;

export const DUMMY_PRODUCTS: Product[] = [
  { id: 'demo-tomato',    name: 'Tomato',       name_ar: 'طماطم',      category: 'vegetables', unit: 'kg',    retail_price: 15,   shop_price: 12,   wholesale_price: 10,    stock: 420, image_url: img('photo-1546094096-0df4bcaaa337') },
  { id: 'demo-cucumber',  name: 'Cucumber',     name_ar: 'خيار',       category: 'vegetables', unit: 'kg',    retail_price: 12,   shop_price: 10,   wholesale_price: 8,     stock: 310, image_url: img('photo-1604977042946-1eecc30f269e') },
  { id: 'demo-potato',    name: 'Potato',       name_ar: 'بطاطس',      category: 'vegetables', unit: 'kg',    retail_price: 10,   shop_price: 8,    wholesale_price: 6,     stock: 560, image_url: img('photo-1518977676601-b53f82aba655') },
  { id: 'demo-onion',     name: 'Onion',        name_ar: 'بصل',         category: 'vegetables', unit: 'kg',    retail_price: 8,    shop_price: 6.5,  wholesale_price: 5,     stock: 380, image_url: img('photo-1508747703725-719777637510') },
  { id: 'demo-carrot',    name: 'Carrot',       name_ar: 'جزر',         category: 'vegetables', unit: 'kg',    retail_price: 9,    shop_price: 7,    wholesale_price: 5.5,   stock: 240, image_url: img('photo-1447175008436-054170c2e979') },
  { id: 'demo-lettuce',   name: 'Lettuce',      name_ar: 'خس',          category: 'vegetables', unit: 'piece', retail_price: 8,    shop_price: 6,    wholesale_price: 4.5,   stock: 150, image_url: img('photo-1622206151226-18ca2c9ab4a1') },
  { id: 'demo-spinach',   name: 'Spinach',      name_ar: 'سبانخ',       category: 'vegetables', unit: 'kg',    retail_price: 20,   shop_price: 16,   wholesale_price: 12,    stock: 90,  image_url: img('photo-1576045057995-568f588f82fb') },
  { id: 'demo-pepper',    name: 'Bell Pepper',  name_ar: 'فلفل رومي',   category: 'vegetables', unit: 'kg',    retail_price: 25,   shop_price: 20,   wholesale_price: 16,    stock: 180, image_url: img('photo-1563565375-f3fdfdbefa83') },
  { id: 'demo-broccoli',  name: 'Broccoli',     name_ar: 'بروكلي',      category: 'vegetables', unit: 'piece', retail_price: 18,   shop_price: 14,   wholesale_price: 11,    stock: 70,  image_url: img('photo-1459411621453-7b03977f4bfc') },
  { id: 'demo-apple',     name: 'Apple',        name_ar: 'تفاح',        category: 'fruits',     unit: 'kg',    retail_price: 35,   shop_price: 30,   wholesale_price: 26,    stock: 260, image_url: img('photo-1560806887-1e4cd0b6cbd6') },
  { id: 'demo-orange',    name: 'Orange',       name_ar: 'برتقال',      category: 'fruits',     unit: 'kg',    retail_price: 20,   shop_price: 17,   wholesale_price: 14,    stock: 300, image_url: img('photo-1547514701-42782101795e') },
  { id: 'demo-banana',    name: 'Banana',       name_ar: 'موز',         category: 'fruits',     unit: 'kg',    retail_price: 25,   shop_price: 22,   wholesale_price: 18,    stock: 340, image_url: img('photo-1571771894821-ce9b6c11b08e') },
  { id: 'demo-lemon',     name: 'Lemon',        name_ar: 'ليمون',       category: 'fruits',     unit: 'kg',    retail_price: 22,   shop_price: 18,   wholesale_price: 15,    stock: 140, image_url: img('photo-1590502593747-42a996133562') },
  { id: 'demo-mint',      name: 'Mint',         name_ar: 'نعناع',       category: 'herbs',      unit: 'bunch', retail_price: 5,    shop_price: 4,    wholesale_price: 3,     stock: 120, image_url: img('photo-1628556270448-e4d2c1c6f4b4') },
  { id: 'demo-parsley',   name: 'Parsley',      name_ar: 'بقدونس',      category: 'herbs',      unit: 'bunch', retail_price: 5,    shop_price: 4,    wholesale_price: 3,     stock: 135, image_url: img('photo-1606041008023-472dfb5e530f') },
  { id: 'demo-basil',     name: 'Basil',        name_ar: 'ريحان',       category: 'herbs',      unit: 'bunch', retail_price: 6,    shop_price: 4.5,  wholesale_price: 3.5,   stock: 85,  image_url: img('photo-1596040033229-a9821ebd058d') },
];

export const DUMMY_CUSTOMERS: Customer[] = [
  { id: 'demo-cust-1', name: 'Ahmed Hassan',      phone: '+20 100 123 4567', type: 'retail',     location: 'Nasr City, Cairo',        total_orders: 24, joined_at: '2026-01-12T00:00:00.000Z' },
  { id: 'demo-cust-2', name: 'Sara Mostafa',      phone: '+20 111 234 5678', type: 'retail',     location: 'Maadi, Cairo',            total_orders: 12, joined_at: '2026-02-03T00:00:00.000Z' },
  { id: 'demo-cust-3', name: 'Green Mart',        phone: '+20 122 345 6789', type: 'shop',       location: 'Dokki, Giza',             total_orders: 8,  joined_at: '2026-02-21T00:00:00.000Z' },
  { id: 'demo-cust-4', name: 'Nile Restaurant',   phone: '+20 100 987 6543', type: 'restaurant', location: 'Zamalek, Cairo',           total_orders: 15, joined_at: '2025-11-18T00:00:00.000Z' },
  { id: 'demo-cust-5', name: 'Fresh Market Co.',  phone: '+20 115 556 6778', type: 'shop',       location: 'New Cairo',               total_orders: 5,  joined_at: '2026-04-09T00:00:00.000Z' },
  { id: 'demo-cust-6', name: 'Omar Farouk',       phone: '+20 106 789 0123', type: 'retail',     location: 'Heliopolis, Cairo',       total_orders: 3,  joined_at: '2026-05-30T00:00:00.000Z' },
];

const d = (daysAgo: number, hour = 10, min = 0) => {
  const t = new Date();
  t.setDate(t.getDate() - daysAgo);
  t.setHours(hour, min, 0, 0);
  return t.toISOString();
};

const time = (h: number, m: number) =>
  `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

export const DUMMY_ORDERS: Order[] = [
  {
    id: 'ORD-852114', customer_id: 'demo-cust-1', customer_name: 'Ahmed Hassan', customer_type: 'retail',
    total: 187.5, status: 'pending', payment_status: 'cod', location: 'Nasr City, Cairo',
    created_at: d(0, 10, 24),
    order_items: [
      { id: 'demo-oi-1', order_id: 'ORD-852114', product_id: 'demo-tomato',  product_name: 'Tomato',   qty: 5, unit: 'kg',    unit_price: 15 },
      { id: 'demo-oi-2', order_id: 'ORD-852114', product_id: 'demo-cucumber', product_name: 'Cucumber', qty: 3, unit: 'kg',    unit_price: 12 },
      { id: 'demo-oi-3', order_id: 'ORD-852114', product_id: 'demo-mint',     product_name: 'Mint',     qty: 4, unit: 'bunch', unit_price: 5 },
    ],
  },
  {
    id: 'ORD-852099', customer_id: 'demo-cust-4', customer_name: 'Nile Restaurant', customer_type: 'restaurant',
    total: 2640, status: 'confirmed', payment_status: 'unpaid', location: 'Zamalek, Cairo',
    created_at: d(0, 9, 5),
    order_items: [
      { id: 'demo-oi-4', order_id: 'ORD-852099', product_id: 'demo-potato',   product_name: 'Potato',   qty: 40, unit: 'kg',    unit_price: 6 },
      { id: 'demo-oi-5', order_id: 'ORD-852099', product_id: 'demo-onion',    product_name: 'Onion',    qty: 30, unit: 'kg',    unit_price: 5 },
      { id: 'demo-oi-6', order_id: 'ORD-852099', product_id: 'demo-tomato',   product_name: 'Tomato',   qty: 50, unit: 'kg',    unit_price: 10 },
      { id: 'demo-oi-7', order_id: 'ORD-852099', product_id: 'demo-lettuce',  product_name: 'Lettuce',  qty: 60, unit: 'piece', unit_price: 4.5 },
    ],
  },
  {
    id: 'ORD-852031', customer_id: 'demo-cust-3', customer_name: 'Green Mart', customer_type: 'shop',
    total: 940, status: 'out_for_delivery', payment_status: 'paid', location: 'Dokki, Giza',
    created_at: d(1, 16, 42),
    order_items: [
      { id: 'demo-oi-8', order_id: 'ORD-852031', product_id: 'demo-apple',   product_name: 'Apple',  qty: 20, unit: 'kg', unit_price: 30 },
      { id: 'demo-oi-9', order_id: 'ORD-852031', product_id: 'demo-orange',  product_name: 'Orange', qty: 20, unit: 'kg', unit_price: 17 },
    ],
  },
  {
    id: 'ORD-851998', customer_id: 'demo-cust-2', customer_name: 'Sara Mostafa', customer_type: 'retail',
    total: 126, status: 'delivered', payment_status: 'cod', location: 'Maadi, Cairo',
    created_at: d(2, 13, 18),
    order_items: [
      { id: 'demo-oi-10', order_id: 'ORD-851998', product_id: 'demo-carrot',   product_name: 'Carrot',  qty: 4, unit: 'kg',    unit_price: 9 },
      { id: 'demo-oi-11', order_id: 'ORD-851998', product_id: 'demo-spinach',  product_name: 'Spinach', qty: 2, unit: 'kg',    unit_price: 20 },
      { id: 'demo-oi-12', order_id: 'ORD-851998', product_id: 'demo-lemon',    product_name: 'Lemon',   qty: 3, unit: 'kg',    unit_price: 22 },
    ],
  },
  {
    id: 'ORD-851870', customer_id: 'demo-cust-5', customer_name: 'Fresh Market Co.', customer_type: 'shop',
    total: 720, status: 'completed', payment_status: 'paid', location: 'New Cairo',
    created_at: d(4, 11, 2),
    order_items: [
      { id: 'demo-oi-13', order_id: 'ORD-851870', product_id: 'demo-pepper',   product_name: 'Bell Pepper', qty: 15, unit: 'kg', unit_price: 20 },
      { id: 'demo-oi-14', order_id: 'ORD-851870', product_id: 'demo-broccoli', product_name: 'Broccoli',    qty: 20, unit: 'piece', unit_price: 14 },
    ],
  },
  {
    id: 'ORD-851644', customer_id: 'demo-cust-6', customer_name: 'Omar Farouk', customer_type: 'retail',
    total: 85, status: 'cancelled', payment_status: 'unpaid', location: 'Heliopolis, Cairo',
    created_at: d(6, 18, 33),
    order_items: [
      { id: 'demo-oi-15', order_id: 'ORD-851644', product_id: 'demo-banana', product_name: 'Banana', qty: 3, unit: 'kg', unit_price: 25 },
      { id: 'demo-oi-16', order_id: 'ORD-851644', product_id: 'demo-basil',  product_name: 'Basil',  qty: 2, unit: 'bunch', unit_price: 6 },
    ],
  },
];

export const DUMMY_CONVERSATIONS: Conversation[] = [
  {
    id: 'demo-conv-1', customer_name: 'Ahmed Hassan', phone: '+20 100 123 4567', customer_type: 'retail',
    status: 'active', order_id: 'ORD-852114', last_activity: time(10, 30),
    messages: [
      { id: 'demo-msg-1', conversation_id: 'demo-conv-1', sender: 'customer', text: 'مرحباً، هل عندكم طماطم طازجة اليوم؟', time: time(10, 12), type: 'text' },
      { id: 'demo-msg-2', conversation_id: 'demo-conv-1', sender: 'bot', text: 'وعليكم السلام! نعم، لدينا طماطم طازجة بسعر 15 جنيه للكيلو. 🌿', time: time(10, 13), type: 'text' },
      { id: 'demo-msg-3', conversation_id: 'demo-conv-1', sender: 'customer', text: 'تمام، أريد 5 كيلو طماطم و 3 كيلو خيار.', time: time(10, 20), type: 'text' },
      { id: 'demo-msg-4', conversation_id: 'demo-conv-1', sender: 'bot', text: 'تم استلام طلبك! 🛒\n\n• Tomato × 5 kg = 75.00 EGP\n• Cucumber × 3 kg = 36.00 EGP\n\nالمجموع: 187.50 EGP\n\nهل تريد تأكيد الطلب؟ (نعم/لا)', time: time(10, 24), type: 'order' },
    ],
  },
  {
    id: 'demo-conv-2', customer_name: 'Nile Restaurant', phone: '+20 100 987 6543', customer_type: 'restaurant',
    status: 'active', order_id: 'ORD-852099', last_activity: time(9, 12),
    messages: [
      { id: 'demo-msg-5', conversation_id: 'demo-conv-2', sender: 'customer', text: 'صباح الخير، محتاج كمية جملة للمطعم اليوم.', time: time(9, 2), type: 'text' },
      { id: 'demo-msg-6', conversation_id: 'demo-conv-2', sender: 'bot', text: 'صباح الخير! بالتأكيد، ستحصل على أفضل أسعار الجملة. أرسل تفاصيل طلبك.', time: time(9, 3), type: 'text' },
      { id: 'demo-msg-7', conversation_id: 'demo-conv-2', sender: 'customer', text: '40 كيلو بطاطس، 30 كيلو بصل، 50 كيلو طماطم و 60 خسة.', time: time(9, 6), type: 'text' },
      { id: 'demo-msg-8', conversation_id: 'demo-conv-2', sender: 'bot', text: 'تم استلام طلبك! المجموع: 2640.00 EGP. سنقوم بتأكيد الطلب والتوصيل.', time: time(9, 8), type: 'order' },
    ],
  },
  {
    id: 'demo-conv-3', customer_name: 'Green Mart', phone: '+20 122 345 6789', customer_type: 'shop',
    status: 'waiting', order_id: null, last_activity: time(17, 45),
    messages: [
      { id: 'demo-msg-9', conversation_id: 'demo-conv-3', sender: 'customer', text: 'بعتلي الأسعار بتاعت الفواكه للجملة؟', time: time(17, 40), type: 'text' },
      { id: 'demo-msg-10', conversation_id: 'demo-conv-3', sender: 'bot', text: 'أكيد! اسعار الجملة: تفاح 26، برتقال 14، موز 18 للكيلو. تصفح القائمة:\n/menu', time: time(17, 41), type: 'link' },
    ],
  },
  {
    id: 'demo-conv-4', customer_name: 'Sara Mostafa', phone: '+20 111 234 5678', customer_type: 'retail',
    status: 'completed', order_id: 'ORD-851998', last_activity: time(13, 30),
    messages: [
      { id: 'demo-msg-11', conversation_id: 'demo-conv-4', sender: 'customer', text: 'شكراً على التوصيل! التوصيل كان سريع.', time: time(13, 25), type: 'text' },
      { id: 'demo-msg-12', conversation_id: 'demo-conv-4', sender: 'bot', text: 'نشكرك جزيلاً! يسعدنا خدمتك دائماً 🌿', time: time(13, 26), type: 'text' },
    ],
  },
  {
    id: 'demo-conv-5', customer_name: 'Omar Farouk', phone: '+20 106 789 0123', customer_type: 'retail',
    status: 'completed', order_id: 'ORD-851644', last_activity: time(18, 45),
    messages: [
      { id: 'demo-msg-13', conversation_id: 'demo-conv-5', sender: 'customer', text: 'هو الطلب اتأكد؟', time: time(18, 30), type: 'text' },
      { id: 'demo-msg-14', conversation_id: 'demo-conv-5', sender: 'bot', text: 'عذراً للتأخير، تم إلغاء الطلب لعدم توفر بعض الأصناف.', time: time(18, 33), type: 'text' },
    ],
  },
];

export const DUMMY_MENU_PAGES: MenuPage[] = [
  { id: 'demo-menu-1', slug: 'ahmed-hassan', customer_name: 'Ahmed Hassan', phone: '+20 100 123 4567', customer_type: 'retail', created_at: d(30, 9, 0) },
  { id: 'demo-menu-2', slug: 'nile-restaurant', customer_name: 'Nile Restaurant', phone: '+20 100 987 6543', customer_type: 'restaurant', created_at: d(20, 10, 0) },
];

export const DUMMY_TRANSACTIONS = [
  { id: 'demo-txn-1', orderId: 'ORD-852031', amount: 940, currency: 'EGP', status: 'success', paymentMethod: 'online', providerId: 'hy-7839201', createdAt: new Date(d(1, 17, 0)), updatedAt: new Date(d(1, 17, 5)) },
  { id: 'demo-txn-2', orderId: 'ORD-851870', amount: 720, currency: 'EGP', status: 'success', paymentMethod: 'online', providerId: 'hy-7738100', createdAt: new Date(d(4, 11, 30)), updatedAt: new Date(d(4, 11, 35)) },
];

export const DUMMY_WEBHOOK_EVENTS = [
  { id: 'demo-wbh-1', source: 'whatsapp', eventType: 'message_received', payload: {}, processed: true, createdAt: new Date(d(0, 10, 30)) },
  { id: 'demo-wbh-2', source: 'hyperpay', eventType: 'payment_succeeded', payload: {}, processed: true, createdAt: new Date(d(1, 17, 5)) },
  { id: 'demo-wbh-3', source: 'whatsapp', eventType: 'message_received', payload: {}, processed: true, createdAt: new Date(d(2, 9, 15)) },
];

export const DUMMY_SYSTEM_LOGS = [
  { id: 'demo-log-1', level: 'info', service: 'whatsapp', message: 'Webhook message received', createdAt: new Date(d(0, 10, 30)) },
  { id: 'demo-log-2', level: 'info', service: 'checkout', message: 'Order ORD-852114 created', createdAt: new Date(d(0, 10, 24)) },
  { id: 'demo-log-3', level: 'warn', service: 'mistral', message: 'Low confidence order parse, used fallback', createdAt: new Date(d(0, 9, 40)) },
  { id: 'demo-log-4', level: 'info', service: 'hyperpay', message: 'Payment succeeded for ORD-852031', createdAt: new Date(d(1, 17, 5)) },
];
