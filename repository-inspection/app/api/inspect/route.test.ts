import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

async function createZipFile(
  name: string,
  files: Record<string, string | Uint8Array>,
) {
  const zip = new JSZip();

  for (const [path, content] of Object.entries(files)) {
    zip.file(path, content);
  }

  const blob = await zip.generateAsync({ type: "blob" });
  return new File([blob], name, { type: "application/zip" });
}

async function inspectZip(file: File) {
  const formData = new FormData();
  formData.append("repository", file);

  const response = await POST(new Request("http://localhost/api/inspect", {
    method: "POST",
    body: formData,
  }));
  const body = await response.json();

  return { response, body };
}

describe("repository inspection API", () => {
  const originalOpenAiKey = process.env.OPENAI_API_KEY;
  const consoleErrorSpy = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    process.env.OPENAI_API_KEY = originalOpenAiKey;
    consoleErrorSpy.mockClear();
  });

  it("filters generated, dependency, binary, and secret files from the summary", async () => {
    const file = await createZipFile("sample.zip", {
      "sample/package.json": JSON.stringify({
        name: "sample-project",
        scripts: { build: "next build", test: "vitest run" },
        dependencies: { next: "16.2.6", react: "19.2.4" },
        devDependencies: { typescript: "5.0.0" },
      }),
      "sample/README.md": "# Sample\n\nSetup instructions.",
      "sample/app/page.tsx": "export default function Page() { return null; }",
      "sample/app/page.test.tsx": "import { test } from 'vitest';",
      "sample/.github/workflows/CI-pipeline.yml": "name: CI",
      "sample/Dockerfile": "FROM node:22",
      "sample/node_modules/library/index.js": "ignored dependency",
      "sample/.git/config": "ignored git metadata",
      "sample/.env": "OPENAI_API_KEY=should-not-appear",
      "sample/public/logo.png": new Uint8Array([137, 80, 78, 71]),
    });

    const { response, body } = await inspectZip(file);

    expect(response.status).toBe(200);
    expect(body.usedFallback).toBe(true);
    expect(body.model).toBe("deterministic-fallback");
    expect(body.summary.projectName).toBe("sample-project");
    expect(body.summary.detectedStack).toEqual(
      expect.arrayContaining(["Node.js", "TypeScript", "React", "Next.js"]),
    );
    expect(body.summary.testFiles).toContain("sample/app/page.test.tsx");
    expect(body.summary.ciFiles).toContain(
      "sample/.github/workflows/CI-pipeline.yml",
    );
    expect(body.summary.deploymentFiles).toContain("sample/Dockerfile");
    expect(body.report.repositoryStructureAssessment).toContain("source");
    expect(body.report.codeQualityAssessment).toContain("code quality");
    expect(body.report.dependencyAndConfigurationAssessment).toContain(
      "Dependency",
    );
    expect(body.report.scores.map((score: { label: string }) => score.label)).toEqual(
      expect.arrayContaining([
        "Code quality evidence",
        "Dependencies and configuration",
      ]),
    );
    expect(body.summary.fileTree).not.toEqual(
      expect.arrayContaining([
        "sample/node_modules/library/index.js",
        "sample/.git/config",
        "sample/.env",
        "sample/public/logo.png",
      ]),
    );
    expect(JSON.stringify(body.summary)).not.toContain("should-not-appear");
  });

  it("returns DORA-inspired evidence without claiming direct DORA metrics", async () => {
    const file = await createZipFile("delivery-ready.zip", {
      "package.json": JSON.stringify({
        name: "delivery-ready",
        scripts: { build: "next build", test: "vitest run" },
        dependencies: { next: "16.2.6" },
      }),
      ".github/workflows/CI-pipeline.yml": "name: CI",
      "Dockerfile": "FROM node:22",
      "src/health.ts": "export const health = 'ok';",
    });

    const { body } = await inspectZip(file);

    expect(body.summary.doraEvidence.continuousIntegration).toContain(
      "CI workflow files were detected",
    );
    expect(body.summary.doraEvidence.testAutomation).toContain(
      "test script was detected",
    );
    expect(body.summary.doraEvidence.deploymentAutomation).toContain(
      "Build or containerization evidence",
    );
    expect(body.report.doraReadiness.map((item: { label: string }) => item.label)).toEqual(
      expect.arrayContaining([
        "Continuous integration",
        "Test automation",
        "Deployment automation",
        "Monitoring and recovery evidence",
      ]),
    );
  });

  it("rejects non-zip uploads", async () => {
    const formData = new FormData();
    formData.append(
      "repository",
      new File(["not a zip"], "notes.txt", { type: "text/plain" }),
    );

    const response = await POST(new Request("http://localhost/api/inspect", {
      method: "POST",
      body: formData,
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Only .zip");
  });

  it("rejects uploads over the configured 60 MB limit before parsing", async () => {
    const oversizedFile = new File(
      [new Uint8Array(61 * 1024 * 1024)],
      "large-repo.zip",
      { type: "application/zip" },
    );

    const { response, body } = await inspectZip(oversizedFile);

    expect(response.status).toBe(500);
    expect(body.error).toContain("under 60 MB");
  });
});
