import { describe, expect, it, vi } from "vitest";
import { createBenefitRepository } from "./benefit-repository.js";

const input = { title: "Test", description: "Kurztext", details: "Details" };
const benefit = { id: "benefit-1", sortOrder: 0, url: null, ...input };

function createDatabase() {
  const query = vi.fn().mockResolvedValue({ rows: [benefit] });
  const release = vi.fn();
  return { query, release, connect: vi.fn().mockResolvedValue({ query, release }) };
}

describe("Benefit repository", () => {
  it("lists Benefits in persisted order and loads individual details", async () => {
    const database = createDatabase();
    const repository = createBenefitRepository(database);
    expect(await repository.list()).toEqual([benefit]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY sort_order ASC, title ASC, id ASC"));
    expect(await repository.findById(benefit.id)).toEqual(benefit);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id = $1"), [benefit.id]);
  });

  it("parameterizes user content on insert and update", async () => {
    const database = createDatabase();
    const repository = createBenefitRepository(database);
    expect(await repository.create(input)).toEqual(benefit);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("COALESCE(MAX(sort_order) + 1, 0)"), [
      input.title, input.description, input.details, null,
    ]);
    expect(database.query).toHaveBeenCalledWith("LOCK TABLE benefits IN SHARE ROW EXCLUSIVE MODE");
    expect(database.query).toHaveBeenLastCalledWith("COMMIT");
    expect(database.release).toHaveBeenCalledOnce();
    expect(await repository.update(benefit.id, input)).toEqual(benefit);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id = $1"), [
      benefit.id, input.title, input.description, input.details, null,
    ]);
  });

  it("stores and clears an optional URL with parameterized queries", async () => {
    const database = createDatabase();
    const repository = createBenefitRepository(database);
    const linked = { ...input, url: "https://example.test/benefit" };
    await repository.create(linked);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO benefits"), [
      input.title, input.description, input.details, linked.url,
    ]);
    await repository.update(benefit.id, linked);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("url = $5"), [
      benefit.id, input.title, input.description, input.details, linked.url,
    ]);
    await repository.update(benefit.id, { ...linked, url: null });
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("url = $5"), [
      benefit.id, input.title, input.description, input.details, null,
    ]);
  });

  it("reports missing records and unsuccessful deletions", async () => {
    const database = createDatabase();
    database.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const repository = createBenefitRepository(database);
    expect(await repository.findById("missing")).toBeNull();
    expect(await repository.update("missing", input)).toBeNull();
    expect(await repository.delete("missing")).toBe(false);
    database.query.mockResolvedValue({ rows: [], rowCount: 1 });
    expect(await repository.delete(benefit.id)).toBe(true);
  });

  it("persists a complete reorder atomically", async () => {
    const database = createDatabase();
    expect(await createBenefitRepository(database).reorder([benefit.id])).toEqual([benefit]);
    expect(database.query).toHaveBeenCalledWith("LOCK TABLE benefits IN SHARE ROW EXCLUSIVE MODE");
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("WITH ORDINALITY"), [[benefit.id]]);
    expect(database.query).toHaveBeenLastCalledWith("COMMIT");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it.each([{ ids: [] }, { ids: ["missing"] }, { ids: [benefit.id, benefit.id] }, { ids: [benefit.id, "extra"] }])("rejects incomplete or duplicate order $ids", async ({ ids }) => {
    const database = createDatabase();
    expect(await createBenefitRepository(database).reorder(ids)).toBeNull();
    expect(database.query).not.toHaveBeenCalledWith(expect.stringContaining("UPDATE benefits"), expect.anything());
    expect(database.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(database.release).toHaveBeenCalledOnce();
  });

  it.each(["create", "reorder"] as const)("rolls back %s on database errors", async (method) => {
    const database = createDatabase();
    database.query.mockRejectedValueOnce(new Error("Database failure")).mockResolvedValue({ rows: [] });
    const repository = createBenefitRepository(database);
    await expect(method === "create" ? repository.create(input) : repository.reorder([benefit.id])).rejects.toThrow("Database failure");
    expect(database.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(database.release).toHaveBeenCalledOnce();
  });
});
