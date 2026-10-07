CREATE TABLE IF NOT EXISTS benefits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  description text NOT NULL CHECK (char_length(description) BETWEEN 1 AND 500),
  details text NOT NULL CHECK (char_length(details) BETWEEN 1 AND 5000)
);

CREATE INDEX IF NOT EXISTS benefits_title_idx ON benefits (title, id);
