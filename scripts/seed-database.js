#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...\n');

    // First check if tables exist by trying to select from customers
    console.log('🔍 Checking if tables exist...');
    const checkResult = await supabase.from('customers').select('count', { count: 'exact', head: true });
    if (checkResult.error) {
      console.error('⚠️  Tables do not exist yet. Migrations may need to be applied.');
      console.log('Please ensure the migrations have been applied to your Supabase instance.');
      console.log('You can do this by:');
      console.log('1. Going to your Supabase dashboard');
      console.log('2. Running: npx supabase db push');
      process.exit(0);
    }
    console.log('✓ Tables exist\n');

    // Seed Customers
    console.log('📝 Seeding customers...');
    const customers = await supabase.from('customers').insert([
      { name: 'Ahmed Hassan', phone: '+20 123 456 7890', type: 'retail', location: 'Cairo, Maadi', total_orders: 5, joined_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { name: 'Omar Electronics Shop', phone: '+20 987 654 3210', type: 'shop', location: 'Cairo, Heliopolis', total_orders: 12, joined_at: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
      { name: 'El Nile Restaurant', phone: '+20 555 111 2222', type: 'restaurant', location: 'Cairo, Downtown', total_orders: 25, joined_at: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] },
    ]).select();
    if (customers.error) throw customers.error;
    console.log(`✓ Seeded ${customers.data.length} customers\n`);

    // Seed Menu Pages
    console.log('📋 Seeding menu pages...');
    const menuPages = await supabase.from('menu_pages').insert([
      { slug: 'cust_a_menu_1', customer_name: 'Ahmed Hassan', phone: '+20 123 456 7890', customer_type: 'retail' },
      { slug: 'cust_a_menu_2', customer_name: 'Ahmed Hassan', phone: '+20 123 456 7890', customer_type: 'retail' },
      { slug: 'cust_a_menu_3', customer_name: 'Ahmed Hassan', phone: '+20 123 456 7890', customer_type: 'retail' },
      { slug: 'cust_b_menu_1', customer_name: 'Omar Electronics Shop', phone: '+20 987 654 3210', customer_type: 'shop' },
      { slug: 'cust_b_menu_2', customer_name: 'Omar Electronics Shop', phone: '+20 987 654 3210', customer_type: 'shop' },
      { slug: 'cust_b_menu_3', customer_name: 'Omar Electronics Shop', phone: '+20 987 654 3210', customer_type: 'shop' },
      { slug: 'cust_c_menu_1', customer_name: 'El Nile Restaurant', phone: '+20 555 111 2222', customer_type: 'restaurant' },
      { slug: 'cust_c_menu_2', customer_name: 'El Nile Restaurant', phone: '+20 555 111 2222', customer_type: 'restaurant' },
      { slug: 'cust_c_menu_3', customer_name: 'El Nile Restaurant', phone: '+20 555 111 2222', customer_type: 'restaurant' },
    ]).select();
    if (menuPages.error) throw menuPages.error;
    console.log(`✓ Seeded ${menuPages.data.length} menu pages\n`);

    // Seed Conversations
    console.log('💬 Seeding conversations...');
    const conversations = await supabase.from('conversations').insert([
      { customer_name: 'Ahmed Hassan', phone: '+20 123 456 7890', customer_type: 'retail', status: 'completed', last_activity: 'Order placed successfully' },
      { customer_name: 'Omar Electronics Shop', phone: '+20 987 654 3210', customer_type: 'shop', status: 'active', last_activity: 'Customer browsing menu' },
      { customer_name: 'El Nile Restaurant', phone: '+20 555 111 2222', customer_type: 'restaurant', status: 'waiting', last_activity: 'Awaiting customer confirmation' },
    ]).select();
    if (conversations.error) throw conversations.error;
    console.log(`✓ Seeded ${conversations.data.length} conversations\n`);

    // Seed Messages
    console.log('💬 Seeding messages...');
    const messages = [
      { conversation_id: conversations.data[0].id, sender: 'customer', text: 'مرحبا، أريد 2 كيلو طماطم و 3 كيلو خس', time: '09:30 AM', type: 'order_request' },
      { conversation_id: conversations.data[0].id, sender: 'bot', text: 'شكرا! لقد وجدت طلبك. يرجى اختيار المنتجات من القائمة', time: '09:31 AM', type: 'menu_link' },
      { conversation_id: conversations.data[0].id, sender: 'customer', text: 'تم الطلب!', time: '09:45 AM', type: 'order_confirmation' },
      { conversation_id: conversations.data[1].id, sender: 'customer', text: 'السلام عليكم، نحتاج كميات كبيرة من الخضراوات الطازة', time: '10:15 AM', type: 'inquiry' },
      { conversation_id: conversations.data[1].id, sender: 'bot', text: 'أهلا! نحن نوفر أسعار خاصة للمتاجر', time: '10:16 AM', type: 'greeting' },
      { conversation_id: conversations.data[2].id, sender: 'customer', text: 'نحتاج كميات يومية من الخضار والفواكه للمطعم', time: '11:00 AM', type: 'inquiry' },
      { conversation_id: conversations.data[2].id, sender: 'bot', text: 'مرحبا! نحن نوفر أسعار جملة للمطاعم', time: '11:01 AM', type: 'menu_link' },
    ];
    const messagesResult = await supabase.from('messages').insert(messages).select();
    if (messagesResult.error) throw messagesResult.error;
    console.log(`✓ Seeded ${messagesResult.data.length} messages\n`);

    // Seed Orders
    console.log('📦 Seeding orders...');
    const orders = await supabase.from('orders').insert([
      { id: 'ORD-001', customer_name: 'Ahmed Hassan', customer_type: 'retail', total: 35.50, status: 'completed', payment_status: 'paid', location: 'Cairo, Maadi' },
      { id: 'ORD-002', customer_name: 'Ahmed Hassan', customer_type: 'retail', total: 42.00, status: 'completed', payment_status: 'paid', location: 'Cairo, Maadi' },
      { id: 'ORD-003', customer_name: 'Omar Electronics Shop', customer_type: 'shop', total: 185.75, status: 'completed', payment_status: 'paid', location: 'Cairo, Heliopolis' },
      { id: 'ORD-004', customer_name: 'El Nile Restaurant', customer_type: 'restaurant', total: 425.30, status: 'pending', payment_status: 'unpaid', location: 'Cairo, Downtown' },
    ]).select();
    if (orders.error) throw orders.error;
    console.log(`✓ Seeded ${orders.data.length} orders\n`);

    // Seed Order Items
    console.log('🛒 Seeding order items...');
    const orderItems = await supabase.from('order_items').insert([
      // Order 1
      { order_id: 'ORD-001', product_name: 'Tomato', qty: 2, unit: 'kg', unit_price: 2.50 },
      { order_id: 'ORD-001', product_name: 'Lettuce', qty: 3, unit: 'piece', unit_price: 1.50 },
      { order_id: 'ORD-001', product_name: 'Cucumber', qty: 2, unit: 'kg', unit_price: 1.80 },
      // Order 2
      { order_id: 'ORD-002', product_name: 'Carrot', qty: 5, unit: 'kg', unit_price: 1.50 },
      { order_id: 'ORD-002', product_name: 'Spinach', qty: 2, unit: 'kg', unit_price: 2.00 },
      { order_id: 'ORD-002', product_name: 'Broccoli', qty: 3, unit: 'piece', unit_price: 2.75 },
      // Order 3
      { order_id: 'ORD-003', product_name: 'Tomato', qty: 20, unit: 'kg', unit_price: 2.00 },
      { order_id: 'ORD-003', product_name: 'Onion', qty: 15, unit: 'kg', unit_price: 0.90 },
      { order_id: 'ORD-003', product_name: 'Bell Pepper', qty: 10, unit: 'kg', unit_price: 2.80 },
      { order_id: 'ORD-003', product_name: 'Lettuce', qty: 50, unit: 'piece', unit_price: 1.20 },
      // Order 4
      { order_id: 'ORD-004', product_name: 'Tomato', qty: 50, unit: 'kg', unit_price: 1.50 },
      { order_id: 'ORD-004', product_name: 'Onion', qty: 30, unit: 'kg', unit_price: 0.70 },
      { order_id: 'ORD-004', product_name: 'Carrot', qty: 25, unit: 'kg', unit_price: 0.85 },
      { order_id: 'ORD-004', product_name: 'Apple', qty: 20, unit: 'kg', unit_price: 2.50 },
      { order_id: 'ORD-004', product_name: 'Orange', qty: 15, unit: 'kg', unit_price: 1.80 },
      { order_id: 'ORD-004', product_name: 'Mint', qty: 10, unit: 'bunch', unit_price: 0.60 },
      { order_id: 'ORD-004', product_name: 'Parsley', qty: 8, unit: 'bunch', unit_price: 0.70 },
    ]).select();
    if (orderItems.error) throw orderItems.error;
    console.log(`✓ Seeded ${orderItems.data.length} order items\n`);

    console.log('✅ Database seeding completed successfully!\n');
    console.log('📊 Summary:');
    console.log(`   • Customers: ${customers.data.length}`);
    console.log(`   • Menu Pages: ${menuPages.data.length}`);
    console.log(`   • Conversations: ${conversations.data.length}`);
    console.log(`   • Messages: ${messagesResult.data.length}`);
    console.log(`   • Orders: ${orders.data.length}`);
    console.log(`   • Order Items: ${orderItems.data.length}\n`);

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

seedDatabase();
