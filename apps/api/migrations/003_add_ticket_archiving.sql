ALTER TABLE tickets
ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS tickets_active_column_position_idx
ON tickets (column_id, position)
WHERE archived_at IS NULL;