import type { PortalUser } from "@portal/shared";
import type { Pool } from "pg";

export type StoredUser = PortalUser & { passwordHash: string };

export type UserRepository = {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<PortalUser | null>;
  listAll(): Promise<PortalUser[]>;
};

export function createUserRepository(database: Pick<Pool, "query">): UserRepository {
  return {
    async findByEmail(email) {
      const result = await database.query<StoredUser>(
        `SELECT id, email, name, role, password_hash AS "passwordHash"
         FROM users WHERE lower(email) = lower($1) LIMIT 1`,
        [email],
      );
      return result.rows[0] ?? null;
    },
    async findById(id) {
      const result = await database.query<PortalUser>(
        `SELECT id, email, name, role FROM users WHERE id = $1 LIMIT 1`,
        [id],
      );
      return result.rows[0] ?? null;
    },
    async listAll() {
      const result = await database.query<PortalUser>(
        `SELECT id, email, name, role FROM users ORDER BY name ASC`,
      );
      return result.rows;
    },
  };
}