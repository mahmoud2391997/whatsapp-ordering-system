/*
# Grant table privileges to Supabase roles

RLS policies alone are not enough — PostgREST connects as the `anon`,
`authenticated`, and `service_role` roles, which also need table-level
GRANTs. Without these, every query fails with "permission denied for table".

## Changes
- Grant privileges on all existing tables, sequences, and functions in
  `public` to `anon`, `authenticated`, and `service_role`.
- Set default privileges so future objects created by `postgres` are
  granted automatically.
*/

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public
  TO anon, authenticated, service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public
  TO anon, authenticated, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public
  TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
