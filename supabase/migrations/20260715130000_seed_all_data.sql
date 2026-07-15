/*
# Seed All Data for Fresh Greens WhatsApp Ordering System

Populates all tables with realistic test data:
- customers: 3 test customers (retail, shop, restaurant)
- menu_pages: 3 unique menu pages per customer
- conversations: 3 conversations with varying statuses
- messages: Sample conversations with customer/bot interactions
- orders: 4 completed orders with items from the menu
- order_items: Line items for each order
*/

-- ── Seed Customers ──
INSERT INTO customers (name, phone, type, location, total_orders, joined_at)
VALUES
  ('Ahmed Hassan', '+20 123 456 7890', 'retail', 'Cairo, Maadi', 5, CURRENT_DATE - 30),
  ('Omar Electronics Shop', '+20 987 654 3210', 'shop', 'Cairo, Heliopolis', 12, CURRENT_DATE - 60),
  ('El Nile Restaurant', '+20 555 111 2222', 'restaurant', 'Cairo, Downtown', 25, CURRENT_DATE - 90)
ON CONFLICT (phone) DO NOTHING;

-- ── Seed Menu Pages ──
INSERT INTO menu_pages (slug, customer_name, phone, customer_type)
VALUES
  ('cust_a_menu_1', 'Ahmed Hassan', '+20 123 456 7890', 'retail'),
  ('cust_a_menu_2', 'Ahmed Hassan', '+20 123 456 7890', 'retail'),
  ('cust_a_menu_3', 'Ahmed Hassan', '+20 123 456 7890', 'retail'),
  ('cust_b_menu_1', 'Omar Electronics Shop', '+20 987 654 3210', 'shop'),
  ('cust_b_menu_2', 'Omar Electronics Shop', '+20 987 654 3210', 'shop'),
  ('cust_b_menu_3', 'Omar Electronics Shop', '+20 987 654 3210', 'shop'),
  ('cust_c_menu_1', 'El Nile Restaurant', '+20 555 111 2222', 'restaurant'),
  ('cust_c_menu_2', 'El Nile Restaurant', '+20 555 111 2222', 'restaurant'),
  ('cust_c_menu_3', 'El Nile Restaurant', '+20 555 111 2222', 'restaurant')
ON CONFLICT (slug) DO NOTHING;

-- ── Seed Conversations ──
INSERT INTO conversations (customer_name, phone, customer_type, status, last_activity)
VALUES
  ('Ahmed Hassan', '+20 123 456 7890', 'retail', 'completed', 'Order placed successfully'),
  ('Omar Electronics Shop', '+20 987 654 3210', 'shop', 'active', 'Customer browsing menu'),
  ('El Nile Restaurant', '+20 555 111 2222', 'restaurant', 'waiting', 'Awaiting customer confirmation')
ON CONFLICT DO NOTHING;

-- Get IDs for conversations we just inserted (for use in messages)
WITH conv_ids AS (
  SELECT id, phone, customer_name FROM conversations 
  WHERE phone IN ('+20 123 456 7890', '+20 987 654 3210', '+20 555 111 2222')
)

-- ── Seed Messages ──
INSERT INTO messages (conversation_id, sender, text, time, type)
SELECT
  (SELECT id FROM conversations WHERE phone = '+20 123 456 7890' LIMIT 1),
  'customer',
  'مرحبا، أريد 2 كيلو طماطم و 3 كيلو خس',
  '09:30 AM',
  'order_request'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 123 456 7890')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 123 456 7890' LIMIT 1),
  'bot',
  'شكرا! لقد وجدت طلبك. يرجى اختيار المنتجات من القائمة هنا: https://app.example.com/menu/cust_a_menu_1',
  '09:31 AM',
  'menu_link'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 123 456 7890')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 123 456 7890' LIMIT 1),
  'customer',
  'تم الطلب!',
  '09:45 AM',
  'order_confirmation'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 123 456 7890')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 987 654 3210' LIMIT 1),
  'customer',
  'السلام عليكم، نحتاج كميات كبيرة من الخضراوات الطازة',
  '10:15 AM',
  'inquiry'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 987 654 3210')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 987 654 3210' LIMIT 1),
  'bot',
  'أهلا! نحن نوفر أسعار خاصة للمتاجر. يرجى زيارة قائمتك الخاصة',
  '10:16 AM',
  'greeting'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 987 654 3210')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 555 111 2222' LIMIT 1),
  'customer',
  'نحتاج كميات يومية من الخضار والفواكه للمطعم',
  '11:00 AM',
  'inquiry'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 555 111 2222')

UNION ALL

SELECT
  (SELECT id FROM conversations WHERE phone = '+20 555 111 2222' LIMIT 1),
  'bot',
  'مرحبا! نحن نوفر أسعار جملة للمطاعم. إليك قائمة الأسعار الخاصة بك',
  '11:01 AM',
  'menu_link'
WHERE EXISTS (SELECT 1 FROM conversations WHERE phone = '+20 555 111 2222');

-- ── Seed Orders ──
INSERT INTO orders (id, customer_name, customer_type, total, status, payment_status, location)
VALUES
  ('ORD-001', 'Ahmed Hassan', 'retail', 35.50, 'completed', 'paid', 'Cairo, Maadi'),
  ('ORD-002', 'Ahmed Hassan', 'retail', 42.00, 'completed', 'paid', 'Cairo, Maadi'),
  ('ORD-003', 'Omar Electronics Shop', 'shop', 185.75, 'completed', 'paid', 'Cairo, Heliopolis'),
  ('ORD-004', 'El Nile Restaurant', 'restaurant', 425.30, 'pending', 'unpaid', 'Cairo, Downtown')
ON CONFLICT (id) DO NOTHING;

-- ── Seed Order Items ──
INSERT INTO order_items (order_id, product_name, qty, unit, unit_price)
VALUES
  -- Order 1: 2kg Tomato (retail), 3 Lettuce (retail)
  ('ORD-001', 'Tomato', 2, 'kg', 2.50),
  ('ORD-001', 'Lettuce', 3, 'piece', 1.50),
  ('ORD-001', 'Cucumber', 2, 'kg', 1.80),

  -- Order 2: 5kg Carrot, 2kg Spinach, 3 Broccoli
  ('ORD-002', 'Carrot', 5, 'kg', 1.50),
  ('ORD-002', 'Spinach', 2, 'kg', 2.00),
  ('ORD-002', 'Broccoli', 3, 'piece', 2.75),

  -- Order 3: Shop order (bulk) - tomato, onion, peppers
  ('ORD-003', 'Tomato', 20, 'kg', 2.00),
  ('ORD-003', 'Onion', 15, 'kg', 0.90),
  ('ORD-003', 'Bell Pepper', 10, 'kg', 2.80),
  ('ORD-003', 'Lettuce', 50, 'piece', 1.20),

  -- Order 4: Restaurant order (wholesale) - mixed vegetables & fruits
  ('ORD-004', 'Tomato', 50, 'kg', 1.50),
  ('ORD-004', 'Onion', 30, 'kg', 0.70),
  ('ORD-004', 'Carrot', 25, 'kg', 0.85),
  ('ORD-004', 'Apple', 20, 'kg', 2.50),
  ('ORD-004', 'Orange', 15, 'kg', 1.80),
  ('ORD-004', 'Mint', 10, 'bunch', 0.60),
  ('ORD-004', 'Parsley', 8, 'bunch', 0.70)
ON CONFLICT DO NOTHING;

-- ── Summary Comment ──
-- Successfully seeded:
-- - 3 customers (retail, shop, restaurant)
-- - 9 menu pages (3 per customer)
-- - 3 conversations (completed, active, waiting statuses)
-- - 7 messages (order requests, bot replies, inquiries)
-- - 4 orders (2 completed retail, 1 completed shop, 1 pending restaurant)
-- - 16 order items (with realistic quantities and tiered pricing)
