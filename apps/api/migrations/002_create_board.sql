CREATE TABLE IF NOT EXISTS board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  column_id uuid NOT NULL REFERENCES board_columns (id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  assignee_id uuid REFERENCES users (id) ON DELETE SET NULL,
  position integer NOT NULL,
  created_by uuid NOT NULL REFERENCES users (id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tickets_column_id_idx ON tickets (column_id);

-- Seed the default board columns from the spec, but only create missing ones.
INSERT INTO board_columns (title, position)
SELECT defaults.title, defaults.position
FROM (VALUES ('Backlog', 0), ('Zu erledigen', 1), ('In Arbeit', 2), ('In Review', 3), ('Erledigt', 4)) AS defaults (title, position)
WHERE NOT EXISTS (SELECT 1 FROM board_columns WHERE title = defaults.title);

WITH ordered AS (
  SELECT id,
         ROW_NUMBER() OVER (
           ORDER BY
             CASE title
               WHEN 'Backlog' THEN 0
               WHEN 'Zu erledigen' THEN 1
               WHEN 'In Arbeit' THEN 2
               WHEN 'In Review' THEN 3
               WHEN 'Erledigt' THEN 4
               ELSE 99
             END,
             position
         ) AS new_position
  FROM board_columns
)
UPDATE board_columns
SET position = ordered.new_position
FROM ordered
WHERE board_columns.id = ordered.id;
