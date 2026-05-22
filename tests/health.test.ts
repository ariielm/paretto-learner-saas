import { describe, it, expect } from "vitest";
import { GET } from "@/app/health/route";

describe("GET /health", () => {
  it("retorna 200 com status ok", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; version: string };
    expect(body.status).toBe("ok");
    expect(typeof body.version).toBe("string");
  });
});
