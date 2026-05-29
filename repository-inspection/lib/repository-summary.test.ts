import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { buildRepositorySummary } from "./repository-summary";

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

describe("repository summary stack detection", () => {
  it("uses README tech stack evidence when dependency evidence is incomplete", async () => {
    const file = await createZipFile("readme-stack.zip", {
      "README.md": [
        "# Project",
        "",
        "## Tech Stack",
        "",
        "- React",
        "- Next.js",
        "- TypeScript",
        "- Tailwind CSS",
        "- PostgreSQL",
      ].join("\n"),
      "src/page.tsx": "export default function Page() { return null; }",
    });

    const summary = await buildRepositorySummary(file);

    expect(summary.readmeAnalysis.detectedStackHints).toEqual(
      expect.arrayContaining([
        "React",
        "Next.js",
        "TypeScript",
        "Tailwind CSS",
        "PostgreSQL",
      ]),
    );
    expect(summary.detectedStack).toEqual(
      expect.arrayContaining([
        "React",
        "TypeScript",
        "Next.js (README)",
        "Tailwind CSS (README)",
        "PostgreSQL (README)",
      ]),
    );
  });

  it("detects stacks from extensions and config files", async () => {
    const file = await createZipFile("polyglot.zip", {
      "api/main.py": "print('hello')",
      "backend/pom.xml": "<project />",
      "frontend/vite.config.ts": "export default {}",
      "frontend/src/App.vue": "<template />",
      "worker/go.mod": "module worker",
      "Dockerfile": "FROM node:22",
    });

    const summary = await buildRepositorySummary(file);

    expect(summary.detectedStack).toEqual(
      expect.arrayContaining([
        "Python",
        "Java / Maven",
        "Vite",
        "Vue",
        "Go",
        "Docker",
      ]),
    );
  });

  it("detects source folders inside archived repository root folders", async () => {
    const file = await createZipFile("nested-next-app.zip", {
      "project-main/repository-inspection/app/page.tsx":
        "export default function Page() { return null; }",
      "project-main/repository-inspection/lib/repository-summary.ts":
        "export function summarize() { return {}; }",
      "project-main/repository-inspection/package.json": JSON.stringify({
        scripts: { build: "next build", test: "vitest run" },
        dependencies: { next: "16.2.6", react: "19.2.4" },
        devDependencies: { vitest: "4.1.7" },
      }),
    });

    const summary = await buildRepositorySummary(file);

    expect(summary.sourceFolders).toEqual(
      expect.arrayContaining([
        "project-main/repository-inspection/app",
        "project-main/repository-inspection/lib",
      ]),
    );
  });
});
