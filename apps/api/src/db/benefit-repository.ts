import type { Benefit, BenefitInput } from "@portal/shared";
import type { Pool } from "pg";

export type BenefitRepository = {
  list(): Promise<Benefit[]>;
  findById(id: string): Promise<Benefit | null>;
  create(input: BenefitInput): Promise<Benefit>;
  update(id: string, input: BenefitInput): Promise<Benefit | null>;
  delete(id: string): Promise<boolean>;
  reorder(ids: string[]): Promise<Benefit[] | null>;
};

const fields = 'id, title, description, details, url, sort_order AS "sortOrder"';

export function createBenefitRepository(database: Pick<Pool, "query" | "connect">): BenefitRepository {
  return {
    async list() {
      const result = await database.query<Benefit>(`SELECT ${fields} FROM benefits ORDER BY sort_order ASC, title ASC, id ASC`);
      return result.rows;
    },
    async findById(id) {
      const result = await database.query<Benefit>(`SELECT ${fields} FROM benefits WHERE id = $1`, [id]);
      return result.rows[0] ?? null;
    },
    async create(input) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE benefits IN SHARE ROW EXCLUSIVE MODE");
        const result = await client.query<Benefit>(
          `INSERT INTO benefits (title, description, details, url, sort_order)
           SELECT $1, $2, $3, $4, COALESCE(MAX(sort_order) + 1, 0) FROM benefits RETURNING ${fields}`,
          [input.title, input.description, input.details, input.url ?? null],
        );
        await client.query("COMMIT");
        return result.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async update(id, input) {
      const result = await database.query<Benefit>(
        `UPDATE benefits SET title = $2, description = $3, details = $4, url = $5 WHERE id = $1 RETURNING ${fields}`,
        [id, input.title, input.description, input.details, input.url ?? null],
      );
      return result.rows[0] ?? null;
    },
    async delete(id) {
      const result = await database.query("DELETE FROM benefits WHERE id = $1", [id]);
      return result.rowCount === 1;
    },
    async reorder(ids) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE benefits IN SHARE ROW EXCLUSIVE MODE");
        const current = await client.query<{ id: string }>("SELECT id FROM benefits");
        const requested = new Set(ids);
        if (!ids.length || requested.size !== ids.length || current.rows.length !== ids.length ||
            current.rows.some((benefit) => !requested.has(benefit.id))) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `UPDATE benefits AS benefit SET sort_order = (ordered.position - 1)::integer
           FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id, position)
           WHERE benefit.id = ordered.id`,
          [ids],
        );
        const result = await client.query<Benefit>(`SELECT ${fields} FROM benefits ORDER BY sort_order ASC`);
        await client.query("COMMIT");
        return result.rows;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
  };
}
