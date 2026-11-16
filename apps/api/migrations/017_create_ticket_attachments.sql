CREATE TABLE IF NOT EXISTS ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES tickets (id) ON DELETE CASCADE,
  file_name text NOT NULL CHECK (char_length(file_name) BETWEEN 1 AND 255),
  file_size bigint NOT NULL CHECK (file_size BETWEEN 1 AND 20971520),
  content_type text NOT NULL CHECK (content_type IN (
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
    'application/pdf',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  )),
  content bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (octet_length(content) = file_size)
);

CREATE INDEX IF NOT EXISTS ticket_attachments_ticket_id_created_at_idx
  ON ticket_attachments (ticket_id, created_at, id);
