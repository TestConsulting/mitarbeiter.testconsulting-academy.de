import type { AppLink, AppLinkInput } from "@portal/shared";
import type { Pool, PoolClient } from "pg";

export type AppLinkRepository = {
  list(): Promise<AppLink[]>;
  create(input: AppLinkInput): Promise<AppLink>;
  update(id: string, input: AppLinkInput): Promise<AppLink | null>;
  delete(id: string): Promise<boolean>;
  reorder(ids: string[]): Promise<AppLink[] | null>;
};

const fields = `id, name, description, url, icon, sort_order AS "sortOrder"`;

async function persistOrder(client: PoolClient, ids: string[]) {
  await client.query(
    `UPDATE app_links AS link SET sort_order = (ordered.position - 1)::integer
     FROM unnest($1::uuid[]) WITH ORDINALITY AS ordered(id, position)
     WHERE link.id = ordered.id`,
    [ids],
  );
}

export function createAppLinkRepository(database: Pick<Pool, "query" | "connect">): AppLinkRepository {
  return {
    async list() {
      const result = await database.query<AppLink>(
        `SELECT ${fields} FROM app_links ORDER BY sort_order ASC, name ASC, id ASC`,
      );
      return result.rows;
    },
    async create(input) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE app_links IN SHARE ROW EXCLUSIVE MODE");
        const current = await client.query<{ id: string }>(
          "SELECT id FROM app_links ORDER BY sort_order ASC, name ASC, id ASC",
        );
        const position = Math.min(input.sortOrder, current.rows.length);
        const result = await client.query<AppLink>(
          `INSERT INTO app_links (name, description, url, icon, sort_order)
           VALUES ($1, $2, $3, $4, $5) RETURNING ${fields}`,
          [input.name, input.description, input.url, input.icon, position],
        );
        const saved = result.rows[0];
        const ids = current.rows.map((link) => link.id);
        ids.splice(position, 0, saved.id);
        await persistOrder(client, ids);
        await client.query("COMMIT");
        return saved;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async update(id, input) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        await client.query("LOCK TABLE app_links IN SHARE ROW EXCLUSIVE MODE");
        const current = await client.query<{ id: string }>(
          "SELECT id FROM app_links ORDER BY sort_order ASC, name ASC, id ASC",
        );
        if (!current.rows.some((link) => link.id === id)) {
          await client.query("ROLLBACK");
          return null;
        }
        const ids = current.rows.filter((link) => link.id !== id).map((link) => link.id);
        const position = Math.min(input.sortOrder, ids.length);
        ids.splice(position, 0, id);
        const result = await client.query<AppLink>(
          `UPDATE app_links SET name = $2, description = $3, url = $4, icon = $5, sort_order = $6
           WHERE id = $1 RETURNING ${fields}`,
          [id, input.name, input.description, input.url, input.icon, position],
        );
        await persistOrder(client, ids);
        await client.query("COMMIT");
        return result.rows[0];
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async delete(id) {
      const result = await database.query(`DELETE FROM app_links WHERE id = $1`, [id]);
      return result.rowCount === 1;
    },
    async reorder(ids) {
      const client = await database.connect();
      try {
        await client.query("BEGIN");
        // Serialize reorders with CRUD so a concurrent deletion cannot cause a partial reorder.
        await client.query("LOCK TABLE app_links IN SHARE ROW EXCLUSIVE MODE");
        const current = await client.query<{ id: string }>("SELECT id FROM app_links");
        const requested = new Set(ids);
        if (!ids.length || requested.size !== ids.length || current.rows.length !== ids.length ||
            current.rows.some((link) => !requested.has(link.id))) {
          await client.query("ROLLBACK");
          return null;
        }
        await persistOrder(client, ids);
        const result = await client.query<AppLink>(`SELECT ${fields} FROM app_links ORDER BY sort_order ASC`);
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
