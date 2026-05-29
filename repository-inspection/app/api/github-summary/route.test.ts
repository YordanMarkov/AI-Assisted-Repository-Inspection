import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("GitHub summary API", () => {
  it("requires a GitHub URL", async () => {
    const response = await POST(
      new Request("http://localhost/api/github-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("GitHub repository URL");
  });

  it("rejects non-GitHub URLs", async () => {
    const response = await POST(
      new Request("http://localhost/api/github-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com/owner/repo" }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("github.com");
  });
});
