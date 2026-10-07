CREATE TABLE IF NOT EXISTS app_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  url text NOT NULL CHECK (char_length(url) BETWEEN 1 AND 2048),
  icon text NOT NULL CHECK (char_length(icon) BETWEEN 1 AND 12),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0)
);

CREATE INDEX IF NOT EXISTS app_links_sort_order_idx ON app_links (sort_order, name, id);
