import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import type { DeterministicSummary } from "@/lib/repository-summary";

const summary: DeterministicSummary = {
  projectName: "sample",
  uploadedFileName: "sample.zip",
  fileCount: 5,
  ignoredPathCount: 2,
  scannedTextFileCount: 4,
  configFileCount: 2,
  evidenceSignalCount: 8,
  fileTree: ["package.json", "src/page.tsx"],
  detectedStack: ["Node.js", "TypeScript", "React"],
  importantFiles: ["package.json", "README.md"],
  documentationFiles: ["README.md"],
  testFiles: ["src/page.test.tsx"],
  deploymentFiles: ["vercel.json"],
  ciFiles: [".github/workflows/CI-pipeline.yml"],
  sourceFolders: ["src"],
  packageScripts: { build: "next build", test: "vitest run" },
  dependencies: ["next", "react"],
  devDependencies: ["vitest"],
  doraEvidence: {
    continuousIntegration: "CI workflow files were detected.",
    testAutomation: "A test script was detected in package metadata.",
    deploymentAutomation: "Build or containerization evidence was detected.",
    monitoringRecovery: "No monitoring or recovery evidence was detected from repository files.",
  },
  importantFileExcerpts: [{ path: "README.md", excerpt: "# Sample" }],
  safety: {
    maxZipSizeMb: 60,
    maxFilesToScan: 2500,
    maxTreeEntries: 400,
    maxContextChars: 28000,
    excludedPaths: ["node_modules", ".git"],
  },
};

describe("repository report API", () => {
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

  it("generates a deterministic fallback report from a compact summary", async () => {
    const response = await POST(
      new Request("http://localhost/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.usedFallback).toBe(true);
    expect(body.summary.uploadedFileName).toBe("sample.zip");
    expect(body.report.repositoryStructureAssessment).toContain("src");
    expect(body.report.codeQualityAssessment).toContain("code quality");
    expect(body.report.scores.map((score: { label: string }) => score.label)).toEqual(
      expect.arrayContaining([
        "Code quality evidence",
        "Dependencies and configuration",
      ]),
    );
  });

  it("rejects invalid summaries", async () => {
    const response = await POST(
      new Request("http://localhost/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary: { uploadedFileName: "broken.zip" } }),
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("valid repository summary");
  });
});
