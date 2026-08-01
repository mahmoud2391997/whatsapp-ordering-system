-- Enable pg_trgm for fuzzy matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN trigram index on product name for fast fuzzy search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm
  ON products USING gin (name gin_trgm_ops);

-- GIN trigram index on product name_ar for Arabic fuzzy search
CREATE INDEX IF NOT EXISTS idx_products_name_ar_trgm
  ON products USING gin (name_ar gin_trgm_ops);
