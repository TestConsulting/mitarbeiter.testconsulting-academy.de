import type { Benefit, BenefitInput } from "@portal/shared";
import type { Pool } from "pg";

export type BenefitRepository = {
  list(): Promise<Benefit[]>;
  findById(id: string): Promise<Benefit | null>;
  create(input: BenefitInput): Promise<Benefit>;
  update(id: string, input: BenefitInput): Promise<Benefit | null>;
  delete(id: string): Promise<boolean>;
};

const fields = "id, title, description, details";

export function createBenefitRepository(database: Pick<Pool, "query">): BenefitRepository {
  return {
    async list() {
      const result = await database.query<Benefit>(`SELECT ${fields} FROM benefits ORDER BY title ASC, id ASC`);
      return result.rows;
    },
    async findById(id) {
      const result = await database.query<Benefit>(`SELECT ${fields} FROM benefits WHERE id = $1`, [id]);
      return result.rows[0] ?? null;
    },
    async create(input) {
      const result = await database.query<Benefit>(
        `INSERT INTO benefits (title, description, details) VALUES ($1, $2, $3) RETURNING ${fields}`,
        [input.title, input.description, input.details],
      );
      return result.rows[0];
    },
    async update(id, input) {
      const result = await database.query<Benefit>(
        `UPDATE benefits SET title = $2, description = $3, details = $4 WHERE id = $1 RETURNING ${fields}`,
        [id, input.title, input.description, input.details],
      );
      return result.rows[0] ?? null;
    },
    async delete(id) {
      const result = await database.query("DELETE FROM benefits WHERE id = $1", [id]);
      return result.rowCount === 1;
    },
  };
}
