/*
# Add increment_customer_orders RPC

Adds a stored procedure that increments the total_orders counter
for a customer identified by phone number. Called by the whatsapp-webhook
edge function after a new order is created.

## Functions
- increment_customer_orders(customer_phone text) — increments total_orders
  by 1 for the matching customer row. Returns void.
*/

CREATE OR REPLACE FUNCTION increment_customer_orders(customer_phone text)
RETURNS void AS $$
BEGIN
  UPDATE customers
  SET total_orders = total_orders + 1
  WHERE phone = customer_phone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
