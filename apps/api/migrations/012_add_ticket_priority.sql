ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'normal';

ALTER TABLE tickets
  DROP CONSTRAINT IF EXISTS tickets_priority_check;

ALTER TABLE tickets
  ADD CONSTRAINT tickets_priority_check
  CHECK (priority IN ('low', 'normal', 'high', 'urgent'));
