import type { Pool } from "pg";
import { z } from "zod";
import { isValidAppLinkUrl } from "@portal/shared";

export const portalContentSchema = z.object({
  version: z.literal(1),
  updateExistingLinks: z.boolean().optional(),
  links: z.array(z.object({
    name: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    url: z.string().trim().max(2048).refine(isValidAppLinkUrl),
    icon: z.string().min(1).max(12),
    sortOrder: z.number().int().min(0).max(2147483647),
  }).strict()),
  benefits: z.array(z.object({
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    details: z.string().trim().min(1).max(5000),
  }).strict()),
}).strict();

export type PortalContent = z.infer<typeof portalContentSchema>;

export async function exportPortalContent(database: Pick<Pool, "connect">): Promise<PortalContent> {
  const client = await database.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const links = await client.query<PortalContent["links"][number]>(
      'SELECT name, description, url, icon, sort_order AS "sortOrder" FROM app_links ORDER BY sort_order, name, id',
    );
    const benefits = await client.query<PortalContent["benefits"][number]>(
      "SELECT title, description, details FROM benefits ORDER BY title, id",
    );
    const content = portalContentSchema.parse({ version: 1, links: links.rows, benefits: benefits.rows });
    await client.query("COMMIT");
    return content;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function importPortalContent(database: Pick<Pool, "connect">, input: unknown) {
  const content = portalContentSchema.parse(input);
  const client = await database.connect();
  const added = { links: 0, benefits: 0 };
  try {
    await client.query("BEGIN");
    await client.query("LOCK TABLE app_links, benefits IN SHARE ROW EXCLUSIVE MODE");
    for (const link of content.links) {
      if (content.updateExistingLinks) {
        await client.query(
          `UPDATE app_links SET name = $1, description = $2, icon = $4
           WHERE btrim(url) = $3`,
          [link.name, link.description, link.url, link.icon],
        );
      }
      const result = await client.query(
        `INSERT INTO app_links (name, description, url, icon, sort_order)
         SELECT $1, $2, $3, $4, COALESCE((SELECT MAX(sort_order) + 1 FROM app_links), 0)
         WHERE NOT EXISTS (SELECT 1 FROM app_links WHERE btrim(url) = $3)`,
        [link.name, link.description, link.url, link.icon],
      );
      added.links += result.rowCount ?? 0;
    }
    for (const benefit of content.benefits) {
      const result = await client.query(
        `INSERT INTO benefits (title, description, details)
         SELECT $1, $2, $3
         WHERE NOT EXISTS (SELECT 1 FROM benefits WHERE btrim(title) = $1)`,
        [benefit.title, benefit.description, benefit.details],
      );
      added.benefits += result.rowCount ?? 0;
    }
    await client.query("COMMIT");
    return added;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
