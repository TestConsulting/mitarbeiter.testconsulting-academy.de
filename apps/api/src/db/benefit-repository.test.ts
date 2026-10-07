import { describe, expect, it, vi } from "vitest";
import { createBenefitRepository } from "./benefit-repository.js";

const input = { title: "Test", description: "Kurztext", details: "Details" };
const benefit = { id: "benefit-1", ...input };

describe("Benefit repository", () => {
  it("lists Benefits in stable title order and loads individual details", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [benefit] }) };
    const repository = createBenefitRepository(database);
    expect(await repository.list()).toEqual([benefit]);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("ORDER BY title ASC, id ASC"));
    expect(await repository.findById(benefit.id)).toEqual(benefit);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id = $1"), [benefit.id]);
  });

  it("parameterizes user content on insert and update", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [benefit] }) };
    const repository = createBenefitRepository(database);
    expect(await repository.create(input)).toEqual(benefit);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("VALUES ($1, $2, $3)"), [
      input.title, input.description, input.details,
    ]);
    expect(await repository.update(benefit.id, input)).toEqual(benefit);
    expect(database.query).toHaveBeenLastCalledWith(expect.stringContaining("WHERE id = $1"), [
      benefit.id, input.title, input.description, input.details,
    ]);
  });

  it("reports missing records and unsuccessful deletions", async () => {
    const database = { query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }) };
    const repository = createBenefitRepository(database);
    expect(await repository.findById("missing")).toBeNull();
    expect(await repository.update("missing", input)).toBeNull();
    expect(await repository.delete("missing")).toBe(false);
    database.query.mockResolvedValue({ rows: [], rowCount: 1 });
    expect(await repository.delete(benefit.id)).toBe(true);
  });
});
