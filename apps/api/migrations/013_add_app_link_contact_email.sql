ALTER TABLE app_links
  ADD COLUMN IF NOT EXISTS contact_email text NOT NULL DEFAULT 'backoffice@testconsulting.de';
