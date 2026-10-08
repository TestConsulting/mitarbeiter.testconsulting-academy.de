ALTER TABLE benefits ADD COLUMN IF NOT EXISTS url text
  CHECK (url IS NULL OR char_length(url) BETWEEN 1 AND 2048);
