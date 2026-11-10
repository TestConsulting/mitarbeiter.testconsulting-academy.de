ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS type text NOT NULL DEFAULT 'task';

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_type_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_type_check
  CHECK (type IN ('task', 'bug', 'feature', 'spike', 'todo'));
