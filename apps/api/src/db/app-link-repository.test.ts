import { describe, expect, it, vi } from "vitest";
import { createAppLinkRepository } from "./app-link-repository.js";
import type { AppLinkInput } from "@portal/shared";

const firstId = "6b71a41f-cad8-4caf-a561-ba14e882a1f7";
const secondId = "6fcd08b1-4355-4c5f-a1b8-9b408121d8a9";

function fixture() {
  const client = { query: vi.fn(), release: vi.fn() };
  const database = { query: vi.fn(), connect: vi.fn().mockResolvedValue(client) };
  return { client, repository: createAppLinkRepository(database) };
}

describe("application link order persistence", () => {
  const input: AppLinkInput = {
    name: "Wiki", description: "Teamwissen", icon: "W", url: "https://wiki.example.test/", sortOrder: 0,
  };

  it.each([
    { id: secondId, position: 0, ids: [secondId, firstId] },
    { id: firstId, position: 1, ids: [secondId, firstId] },
    { id: firstId, position: 2147483647, ids: [secondId, firstId] },
    { id: firstId, position: 0, ids: [firstId, secondId] },
  ])("updates $id and moves it to position $position atomically", async ({ id, position, ids }) => {
    const { client, repository } = fixture();
    const saved = { id, ...input, sortOrder: Math.min(position, 1) };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }, { id: secondId }] })
      .mockResolvedValueOnce({ rows: [saved] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    expect(await repository.update(id, { ...input, sortOrder: position })).toEqual(saved);
    expect(client.query).toHaveBeenNthCalledWith(2, "LOCK TABLE app_links IN SHARE ROW EXCLUSIVE MODE");
    expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("UPDATE app_links SET"), [
      id, input.name, input.description, input.url, input.icon, Math.min(position, 1),
    ]);
    expect(client.query).toHaveBeenNthCalledWith(5, expect.stringContaining("WITH ORDINALITY"), [ids]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([0, 2147483647])("inserts a new link at position %s and shifts existing links", async (position) => {
    const { client, repository } = fixture();
    const saved = { id: secondId, ...input, sortOrder: Math.min(position, 1) };
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }] })
      .mockResolvedValueOnce({ rows: [saved] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({});
    expect(await repository.create({ ...input, sortOrder: position })).toEqual(saved);
    expect(client.query).toHaveBeenNthCalledWith(5, expect.stringContaining("WITH ORDINALITY"), [
      position === 0 ? [secondId, firstId] : [firstId, secondId],
    ]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back editing a missing link without changing the order", async () => {
    const { client, repository } = fixture();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }] })
      .mockResolvedValueOnce({});
    expect(await repository.update(secondId, input)).toBeNull();
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE app_links"))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each(["create", "update"] as const)("rolls back link data when saving the order fails during %s", async (operation) => {
    const { client, repository } = fixture();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }] })
      .mockResolvedValueOnce({ rows: [{ id: firstId, ...input }] })
      .mockRejectedValueOnce(new Error("Order failed"))
      .mockResolvedValueOnce({});
    const result = operation === "create" ? repository.create(input) : repository.update(firstId, input);
    await expect(result).rejects.toThrow("Order failed");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("locks the link table and commits all positions together", async () => {
    const { client, repository } = fixture();
    const links = [{ id: secondId, sortOrder: 0 }, { id: firstId, sortOrder: 1 }];
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }, { id: secondId }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: links })
      .mockResolvedValueOnce({});
    expect(await repository.reorder([secondId, firstId])).toEqual(links);
    expect(client.query).toHaveBeenNthCalledWith(1, "BEGIN");
    expect(client.query).toHaveBeenNthCalledWith(2, "LOCK TABLE app_links IN SHARE ROW EXCLUSIVE MODE");
    expect(client.query).toHaveBeenNthCalledWith(4, expect.stringContaining("UPDATE app_links"), [[secondId, firstId]]);
    expect(client.query).toHaveBeenLastCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalledOnce();
  });

  it.each([
    { ids: [] }, { ids: [firstId] }, { ids: [firstId, firstId] }, { ids: [firstId, "missing"] },
  ])("rolls back a stale or invalid order $ids", async ({ ids }) => {
    const { client, repository } = fixture();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }, { id: secondId }] })
      .mockResolvedValueOnce({});
    expect(await repository.reorder(ids)).toBeNull();
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.query.mock.calls.some(([sql]) => String(sql).includes("UPDATE app_links"))).toBe(false);
    expect(client.release).toHaveBeenCalledOnce();
  });

  it("rolls back a failed update and releases the connection", async () => {
    const { client, repository } = fixture();
    client.query
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ id: firstId }, { id: secondId }] })
      .mockRejectedValueOnce(new Error("Write failed"))
      .mockResolvedValueOnce({});
    await expect(repository.reorder([secondId, firstId])).rejects.toThrow("Write failed");
    expect(client.query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalledOnce();
  });
});
