import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "./client.js";

const input = { title: "Test", description: "Kurztext", details: "Bedingungen", url: "https://example.test/benefit" };
const benefit = { id: "benefit-1", sortOrder: 0, ...input };
afterEach(() => vi.restoreAllMocks());

describe("Benefits API client", () => {
  it("loads the list and details through authenticated requests", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ benefits: [benefit] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ benefit })));
    expect(await api.benefits.list()).toEqual([benefit]);
    expect(await api.benefits.get(benefit.id)).toEqual(benefit);
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/benefits", expect.objectContaining({ credentials: "include" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/benefits/benefit-1", expect.objectContaining({ credentials: "include" }));
  });

  it("sends POST, PUT and DELETE with the expected fields", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ benefit }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ benefit })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true })));
    expect(await api.benefits.create(input)).toEqual(benefit);
    expect(await api.benefits.update(benefit.id, input)).toEqual(benefit);
    expect(await api.benefits.delete(benefit.id)).toEqual({ success: true });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "/api/benefits", expect.objectContaining({
      method: "POST", body: JSON.stringify(input), credentials: "include",
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, "/api/benefits/benefit-1", expect.objectContaining({
      method: "PUT", body: JSON.stringify(input),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(3, "/api/benefits/benefit-1", expect.objectContaining({ method: "DELETE" }));
  });

  it("reports errors rather than returning successful data", async () => {
    vi.spyOn(globalThis, "fetch").mockImplementation(async () => new Response(JSON.stringify({ error: "Nur für Admins." }), { status: 403 }));
    await expect(api.benefits.create(input)).rejects.toBeInstanceOf(ApiError);
    await expect(api.benefits.update(benefit.id, input)).rejects.toMatchObject({ status: 403, message: "Nur für Admins." });
  });
  it("saves card order through an authenticated PUT", async () => {
    const ids = ["benefit-2", "benefit-1"];
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ benefits: [benefit] })));
    expect(await api.benefits.reorder(ids)).toEqual([benefit]);
    expect(fetchMock).toHaveBeenCalledWith("/api/benefits/order", expect.objectContaining({
      method: "PUT", credentials: "include", body: JSON.stringify({ ids }),
    }));
  });
});
