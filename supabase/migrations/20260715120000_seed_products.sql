/*
# Seed Fresh Greens Product Catalog

Populates the products table with a complete catalog of vegetables, fruits, and herbs
with Arabic names, tiered pricing (retail, shop, wholesale), and stock levels.
*/

-- Clear existing products (if any)
DELETE FROM products;

-- Vegetables (8 items)
INSERT INTO products (name, name_ar, category, unit, retail_price, shop_price, wholesale_price, stock, image_url)
VALUES
  ('Tomato', 'طماطم', 'vegetables', 'kg', 2.50, 2.00, 1.50, 50, 'https://images.unsplash.com/photo-1592924357228-3674a0f6468d?w=400'),
  ('Lettuce', 'خس', 'vegetables', 'piece', 1.50, 1.20, 0.90, 40, 'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400'),
  ('Cucumber', 'خيار', 'vegetables', 'kg', 1.80, 1.40, 1.00, 35, 'https://images.unsplash.com/photo-1589927723078-b763f4f9b1e6?w=400'),
  ('Onion', 'بصل', 'vegetables', 'kg', 1.20, 0.90, 0.70, 60, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Bell Pepper', 'فلفل رومي', 'vegetables', 'kg', 3.50, 2.80, 2.20, 30, 'https://images.unsplash.com/photo-1599599810247-30a352c2d7e1?w=400'),
  ('Carrot', 'جزر', 'vegetables', 'kg', 1.50, 1.20, 0.85, 45, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Broccoli', 'بروكلي', 'vegetables', 'piece', 2.75, 2.20, 1.70, 25, 'https://images.unsplash.com/photo-1553530666-ba6a7a76e979?w=400'),
  ('Spinach', 'سبانخ', 'vegetables', 'kg', 2.00, 1.60, 1.25, 20, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),

-- Fruits (4 items)
  ('Apple', 'تفاح', 'fruits', 'kg', 4.00, 3.20, 2.50, 50, 'https://images.unsplash.com/photo-1560806674-e8a5fe5c6e28?w=400'),
  ('Banana', 'موز', 'fruits', 'kg', 2.50, 2.00, 1.50, 55, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Orange', 'برتقال', 'fruits', 'kg', 3.00, 2.40, 1.80, 45, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Lemon', 'ليمون', 'fruits', 'kg', 2.80, 2.20, 1.70, 35, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),

-- Herbs (3 items)
  ('Mint', 'نعناع', 'herbs', 'bunch', 1.00, 0.80, 0.60, 25, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Parsley', 'بقدونس', 'herbs', 'bunch', 1.20, 0.95, 0.70, 20, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400'),
  ('Basil', 'ريحان', 'herbs', 'bunch', 1.50, 1.20, 0.90, 15, 'https://images.unsplash.com/photo-1599599810694-b5ac4dd0b7ae?w=400');
