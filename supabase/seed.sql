-- Sample products for local development / demo.
INSERT INTO products (name, name_ar, category, unit, retail_price, shop_price, wholesale_price, stock, image_url) VALUES
  ('Tomato',    'طماطم',  'vegetables', 'kg', 15, 12, 10, 300, 'https://images.pexels.com/photos/533280/pexels-photo-533280.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Cucumber',  'خيار',   'vegetables', 'kg', 12, 10,  8, 250, 'https://images.pexels.com/photos/2329440/pexels-photo-2329440.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Potato',    'بطاطس',  'vegetables', 'kg', 10,  8,  6, 500, 'https://images.pexels.com/photos/144248/potatoes-vegetables-erdfrucht-bio-144248.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Banana',    'موز',    'fruits',     'kg', 25, 22, 18,  90, 'https://images.pexels.com/photos/2872767/pexels-photo-2872767.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Orange',    'برتقال', 'fruits',     'kg', 20, 17, 14, 180, 'https://images.pexels.com/photos/207085/pexels-photo-207085.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Apple',     'تفاح',   'fruits',     'kg', 35, 30, 26,  60, 'https://images.pexels.com/photos/102104/pexels-photo-102104.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Mint',      'نعناع',  'herbs',      'bunch', 5, 4, 3, 120, 'https://images.pexels.com/photos/2318959/pexels-photo-2318959.jpeg?auto=compress&cs=tinysrgb&w=600'),
  ('Parsley',   'بقدونس', 'herbs',      'bunch', 5, 4, 3,  25, 'https://images.pexels.com/photos/606540/pexels-photo-606540.jpeg?auto=compress&cs=tinysrgb&w=600')
ON CONFLICT DO NOTHING;
