import { describe, expect, it, vi } from "vitest";
import { exportPortalContent, importPortalContent, type PortalContent } from "./portal-content.js";

const content: PortalContent = {
  version: 1,
  links: [{ name: "Portal", description: "Company tool", url: "https://example.test/", icon: "TC", sortOrder: 0 }],
  benefits: [{ title: "Training", description: "Learning", details: "Annual training budget" }],
};

function databaseWith(query = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 })) {
  const release = vi.fn();
  return { query, release, connect: vi.fn().mockResolvedValue({ query, release }) };
}

describe("portal content transfer", () => {
  it("updates existing link content only when explicitly enabled, preserving order and benefits", async () => {
    const database = databaseWith();
    await importPortalContent(database, { ...content, updateExistingLinks: true, benefits: [] });
    const updates = database.query.mock.calls.filter(([sql]) => sql.startsWith("UPDATE"));
    expect(updates).toEqual([[
      expect.stringContaining("UPDATE app_links SET name = $1, description = $2, icon = $4"),
      ["Portal", "Company tool", "https://example.test/", "TC"],
    ]]);
    expect(updates[0][0]).not.toContain("sort_order");
    expect(database.query.mock.calls.some(([sql]) => sql.includes("INSERT INTO benefits"))).toBe(false);
  });

  it("transfers email links", async () => {
    const database = databaseWith();
    const mailLink = { ...content.links[0], url: "mailto:backoffice@testconsulting.de" };
    await importPortalContent(database, { ...content, links: [mailLink], benefits: [] });
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO app_links"), [
      mailLink.name, mailLink.description, mailLink.url, mailLink.icon,
    ]);
  });

  it("exports only links and benefits in one consistent snapshot", async () => {
    const database = databaseWith();
    database.query.mockImplementation(async (sql: string) => {
      if (sql.includes("FROM app_links")) return { rows: content.links };
      if (sql.includes("FROM benefits")) return { rows: content.benefits };
      return { rows: [] };
    });
    expect(await exportPortalContent(database)).toEqual(content);
    expect(database.query).toHaveBeenNthCalledWith(1, "BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    expect(database.query).toHaveBeenLastCalledWith("COMMIT");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it.each([0, 1])("adds only missing entries (inserted per table: %s)", async (rowCount) => {
    const database = databaseWith();
    database.query.mockResolvedValue({ rows: [], rowCount });
    expect(await importPortalContent(database, content)).toEqual({ links: rowCount, benefits: rowCount });
    expect(database.query).toHaveBeenNthCalledWith(2, "LOCK TABLE app_links, benefits IN SHARE ROW EXCLUSIVE MODE");
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE NOT EXISTS (SELECT 1 FROM app_links WHERE btrim(url) = $3)"),
      ["Portal", "Company tool", "https://example.test/", "TC"],
    );
    expect(database.query).toHaveBeenCalledWith(
      expect.stringContaining("WHERE NOT EXISTS (SELECT 1 FROM benefits WHERE btrim(title) = $1)"),
      ["Training", "Learning", "Annual training budget"],
    );
    const sql = database.query.mock.calls.map(([statement]) => statement).join("\n");
    expect(sql).not.toMatch(/UPDATE|DELETE|users|tickets|portal_sessions/);
    expect(sql).toContain("MAX(sort_order) + 1");
    expect(database.query).toHaveBeenLastCalledWith("COMMIT");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it.each([
    { ...content, version: 2 },
    { ...content, users: [] },
    { ...content, benefits: [{ title: "", description: "Test", details: "Test" }] },
    { ...content, links: [{ ...content.links[0], url: "javascript:alert(1)" }] },
    { ...content, links: [{ ...content.links[0], url: "https://user:secret@example.test" }] },
  ])("rejects invalid exports before touching the database", async (input) => {
    const database = databaseWith();
    await expect(importPortalContent(database, input)).rejects.toThrow();
    expect(database.connect).not.toHaveBeenCalled();
  });

  it.each([exportPortalContent, (database: Parameters<typeof importPortalContent>[0]) =>
    importPortalContent(database, content)])("rolls back and releases on failure", async (operation) => {
    const database = databaseWith();
    database.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error("Database failure"))
      .mockResolvedValue({ rows: [] });
    await expect(operation(database)).rejects.toThrow("Database failure");
    expect(database.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(database.release).toHaveBeenCalledOnce();
  });
});
