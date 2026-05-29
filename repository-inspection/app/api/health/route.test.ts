import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("health API", () => {
  it("returns an operational health response", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      status: "ok",
      service: "repository-inspection",
    });
    expect(typeof body.checkedAt).toBe("string");
  });
});
