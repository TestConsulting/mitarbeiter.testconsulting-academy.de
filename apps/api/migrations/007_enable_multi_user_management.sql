-- Removes legacy single-account constraints so admin user management can create multiple users.
DROP INDEX IF EXISTS users_single_account;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_single_account_admin;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_single_account_user;

-- Ensure the role check allows both supported roles.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('employee', 'admin'));
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'employee';
