import type { PortalUser } from "@portal/shared";
import type { Pool } from "pg";

export type StoredUser = PortalUser & { passwordHash: string };

export type CreateUserInput = {
  email: string;
  name: string;
  role: "employee" | "admin";
  passwordHash: string;
};

export type UpdateUserInput = {
  email?: string;
  name?: string;
  role?: "employee" | "admin";
  passwordHash?: string;
};

export type UserRepository = {
  findByEmail(email: string): Promise<StoredUser | null>;
  findById(id: string): Promise<PortalUser | null>;
  findByIdWithPasswordHash(id: string): Promise<StoredUser | null>;
  updatePasswordHash(id: string, passwordHash: string): Promise<boolean>;
  listAll(): Promise<PortalUser[]>;
  create(input: CreateUserInput): Promise<PortalUser>;
  update(id: string, input: UpdateUserInput): Promise<PortalUser | null>;
  delete(id: string): Promise<boolean>;
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
    async findByIdWithPasswordHash(id) {
      const result = await database.query<StoredUser>(
        `SELECT id, email, name, role, password_hash AS "passwordHash"
         FROM users WHERE id = $1 LIMIT 1`,
        [id],
      );
      return result.rows[0] ?? null;
    },
    async updatePasswordHash(id, passwordHash) {
      const result = await database.query(
        "UPDATE users SET password_hash = $2 WHERE id = $1",
        [id, passwordHash],
      );
      return result.rowCount === 1;
    },
    async listAll() {
      const result = await database.query<PortalUser>(
        `SELECT id, email, name, role FROM users ORDER BY name ASC`,
      );
      return result.rows;
    },
    async create(input) {
      const result = await database.query<PortalUser>(
        `INSERT INTO users (email, name, role, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, name, role`,
        [input.email, input.name, input.role, input.passwordHash],
      );
      return result.rows[0];
    },
    async update(id, input) {
      const fields: string[] = [];
      const values: unknown[] = [];

      if (input.email !== undefined) {
        fields.push(`email = $${values.length + 1}`);
        values.push(input.email);
      }
      if (input.name !== undefined) {
        fields.push(`name = $${values.length + 1}`);
        values.push(input.name);
      }
      if (input.role !== undefined) {
        fields.push(`role = $${values.length + 1}`);
        values.push(input.role);
      }
      if (input.passwordHash !== undefined) {
        fields.push(`password_hash = $${values.length + 1}`);
        values.push(input.passwordHash);
      }

      if (fields.length === 0) {
        return this.findById(id);
      }

      values.push(id);
      const result = await database.query<PortalUser>(
        `UPDATE users
         SET ${fields.join(", ")}
         WHERE id = $${values.length}
         RETURNING id, email, name, role`,
        values,
      );
      return result.rows[0] ?? null;
    },
    async delete(id) {
      const result = await database.query("DELETE FROM users WHERE id = $1", [id]);
      return result.rowCount === 1;
    },
  };
}