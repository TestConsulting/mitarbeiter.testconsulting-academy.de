import type { Pool } from "pg";

export async function provisionSingleAccount(
  database: Pick<Pool, "connect">,
  account: { email: string; name: string; passwordHash: string },
) {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE users, tickets IN SHARE ROW EXCLUSIVE MODE");
    await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_single_account_admin");
    await client.query("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check");
    await client.query("ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user'");
    const existing = await client.query<{ id: string }>(
      "SELECT id FROM users ORDER BY (lower(email) = lower($1)) DESC, created_at ASC, id ASC LIMIT 1",
      [account.email],
    );
    let id = existing.rows[0]?.id;
    if (!id) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, password_hash, role)
         VALUES ($1, $2, $3, 'user') RETURNING id`,
        [account.email, account.name, account.passwordHash],
      );
      id = created.rows[0].id;
    }
    await client.query("UPDATE tickets SET created_by = $1 WHERE created_by <> $1", [id]);
    await client.query("UPDATE tickets SET assignee_id = $1 WHERE assignee_id IS NOT NULL AND assignee_id <> $1", [id]);
    await client.query("DELETE FROM users WHERE id <> $1", [id]);
    await client.query(
      "UPDATE users SET email = $2, name = $3, password_hash = $4, role = 'user' WHERE id = $1",
      [id, account.email, account.name, account.passwordHash],
    );
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS users_single_account ON users ((true))");
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conrelid = 'users'::regclass AND conname = 'users_single_account_user'
        ) THEN
          ALTER TABLE users ADD CONSTRAINT users_single_account_user CHECK (role = 'user');
        END IF;
        IF to_regclass('portal_sessions') IS NOT NULL THEN
          DELETE FROM portal_sessions;
        END IF;
      END $$;
    `);
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
