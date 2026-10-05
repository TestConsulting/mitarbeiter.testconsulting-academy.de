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

-- Seed the three standard columns from the spec, but only on first run.
INSERT INTO board_columns (title, position)
SELECT defaults.title, defaults.position
FROM (VALUES ('Zu erledigen', 0), ('In Arbeit', 1), ('Erledigt', 2)) AS defaults (title, position)
WHERE NOT EXISTS (SELECT 1 FROM board_columns);
