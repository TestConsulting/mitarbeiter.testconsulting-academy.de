ALTER TABLE benefits ADD COLUMN IF NOT EXISTS sort_order integer;

WITH ordered AS (
  SELECT id, (row_number() OVER (ORDER BY title, id) - 1)::integer AS position
  FROM benefits
)
UPDATE benefits SET sort_order = ordered.position
FROM ordered WHERE benefits.id = ordered.id AND benefits.sort_order IS NULL;

ALTER TABLE benefits ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE benefits ALTER COLUMN sort_order SET NOT NULL;
CREATE INDEX IF NOT EXISTS benefits_sort_order_idx ON benefits (sort_order, title, id);
