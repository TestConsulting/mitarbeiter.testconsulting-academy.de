import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./client.js";

const input = { name: "Wiki", description: "Teamwissen", icon: "W", url: "https://wiki.example.test/", sortOrder: 1 };
const link = { ...input, id: "link-1" };

afterEach(() => vi.restoreAllMocks());

describe("application links API client", () => {
  it("lists links through the authenticated API", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ links: [link] })));
    expect(await api.links.list()).toEqual([link]);
    expect(fetchMock).toHaveBeenCalledWith("/api/links", expect.objectContaining({ credentials: "include" }));
  });

  it("uses POST, PUT and DELETE with the expected payloads", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ link }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ link })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    expect(await api.links.create(input)).toEqual(link);
    expect(await api.links.update(link.id, input)).toEqual(link);
    expect(await api.links.delete(link.id)).toEqual({ success: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/links", expect.objectContaining({ method: "POST", body: JSON.stringify(input), credentials: "include" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/links/link-1", expect.objectContaining({ method: "PUT", body: JSON.stringify(input) }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/links/link-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("preserves API errors instead of treating them as successful changes", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "Nur für Admins." }), { status: 403 }));
    const result = api.links.create(input);
    await expect(result).rejects.toBeInstanceOf(ApiError);
    await expect(result).rejects.toMatchObject({ status: 403, message: "Nur für Admins." });
  });

  it("saves the complete order and returns the persisted links", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ links: [link] })));
    expect(await api.links.reorder([link.id])).toEqual([link]);
    expect(fetchMock).toHaveBeenCalledWith("/api/links/order", expect.objectContaining({
      method: "PUT", body: JSON.stringify({ ids: [link.id] }), credentials: "include",
    }));
  });
});
