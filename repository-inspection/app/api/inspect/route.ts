import JSZip from "jszip";
import OpenAI from "openai";

export const runtime = "nodejs";

const MAX_ZIP_SIZE_BYTES = 60 * 1024 * 1024;
const MAX_FILES_TO_SCAN = 2500;
const MAX_TREE_ENTRIES = 400;
const MAX_IMPORTANT_FILE_CHARS = 2400;
const MAX_TOTAL_CONTEXT_CHARS = 28000;

const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

const ignoredSegments = new Set([
  ".git",
  ".hg",
  ".svn",
  ".next",
  ".nuxt",
  "node_modules",
  "dist",
  "build",
  "out",
  "target",
  "coverage",
  ".cache",
  ".turbo",
  ".vercel",
  "vendor",
]);

const binaryExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".ico",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".mp4",
  ".mov",
  ".mp3",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
]);

const textExtensions = new Set([
  ".md",
  ".txt",
  ".json",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".html",
  ".yml",
  ".yaml",
  ".xml",
  ".toml",
  ".ini",
  ".sql",
  ".java",
  ".py",
  ".cs",
  ".go",
  ".rs",
  ".php",
  ".rb",
  ".sh",
  ".dockerfile",
]);

type ImportantFile = {
  path: string;
  excerpt: string;
};

type DeterministicSummary = {
  projectName: string;
  uploadedFileName: string;
  fileCount: number;
  ignoredPathCount: number;
  scannedTextFileCount: number;
  configFileCount: number;
  evidenceSignalCount: number;
  fileTree: string[];
  detectedStack: string[];
  importantFiles: string[];
  documentationFiles: string[];
  testFiles: string[];
  deploymentFiles: string[];
  ciFiles: string[];
  sourceFolders: string[];
  packageScripts: Record<string, string>;
  dependencies: string[];
  devDependencies: string[];
  doraEvidence: {
    continuousIntegration: string;
    testAutomation: string;
    deploymentAutomation: string;
    monitoringRecovery: string;
  };
  importantFileExcerpts: ImportantFile[];
  safety: {
    maxZipSizeMb: number;
    maxFilesToScan: number;
    maxTreeEntries: number;
    maxContextChars: number;
    excludedPaths: string[];
  };
};

type InspectionReport = {
  overview: string;
  repositoryStructureAssessment: string;
  architectureSummary: string;
  codeQualityAssessment: string;
  dependencyAndConfigurationAssessment: string;
  documentationAssessment: string;
  testingAssessment: string;
  maintainabilityRisks: string[];
  deploymentReadiness: string;
  doraReadiness: Array<{
    label: string;
    status: "Strong" | "Partial" | "Weak" | "Missing";
    evidence: string;
  }>;
  suggestedImprovements: string[];
  prioritizedActionPoints: string[];
  scores: Array<{
    label: string;
    value: number;
    rationale: string;
  }>;
  aiAccuracyNote: string;
};

const reportSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "overview",
    "repositoryStructureAssessment",
    "architectureSummary",
    "codeQualityAssessment",
    "dependencyAndConfigurationAssessment",
    "documentationAssessment",
    "testingAssessment",
    "maintainabilityRisks",
    "deploymentReadiness",
    "doraReadiness",
    "suggestedImprovements",
    "prioritizedActionPoints",
    "scores",
    "aiAccuracyNote",
  ],
  properties: {
    overview: { type: "string" },
    repositoryStructureAssessment: { type: "string" },
    architectureSummary: { type: "string" },
    codeQualityAssessment: { type: "string" },
    dependencyAndConfigurationAssessment: { type: "string" },
    documentationAssessment: { type: "string" },
    testingAssessment: { type: "string" },
    maintainabilityRisks: {
      type: "array",
      items: { type: "string" },
    },
    deploymentReadiness: { type: "string" },
    doraReadiness: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "status", "evidence"],
        properties: {
          label: { type: "string" },
          status: {
            type: "string",
            enum: ["Strong", "Partial", "Weak", "Missing"],
          },
          evidence: { type: "string" },
        },
      },
    },
    suggestedImprovements: {
      type: "array",
      items: { type: "string" },
    },
    prioritizedActionPoints: {
      type: "array",
      items: { type: "string" },
    },
    scores: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["label", "value", "rationale"],
        properties: {
          label: { type: "string" },
          value: { type: "number", minimum: 0, maximum: 100 },
          rationale: { type: "string" },
        },
      },
    },
    aiAccuracyNote: { type: "string" },
  },
};

function normalizePath(path: string) {
  return path.replaceAll("\\", "/").replace(/^\/+/, "");
}

function getPathSegments(path: string) {
  return normalizePath(path)
    .split("/")
    .filter(Boolean);
}

function getExtension(path: string) {
  const filename = path.split("/").pop() || "";
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function isIgnoredPath(path: string) {
  const lowerSegments = getPathSegments(path).map((segment) =>
    segment.toLowerCase(),
  );

  if (lowerSegments.some((segment) => ignoredSegments.has(segment))) {
    return true;
  }

  const filename = lowerSegments.at(-1) || "";
  if (filename.startsWith(".env")) return true;
  if (filename.endsWith(".min.js") || filename.endsWith(".map")) return true;

  return binaryExtensions.has(getExtension(path));
}

function isReadableTextFile(path: string) {
  const filename = path.split("/").pop()?.toLowerCase() || "";
  if (
    filename === "dockerfile" ||
    filename === "makefile" ||
    filename === "readme" ||
    filename === "license"
  ) {
    return true;
  }

  return textExtensions.has(getExtension(path));
}

function isImportantFile(path: string) {
  const normalized = normalizePath(path).toLowerCase();
  const filename = normalized.split("/").pop() || "";

  return (
    filename === "readme.md" ||
    filename === "package.json" ||
    filename === "pom.xml" ||
    filename === "dockerfile" ||
    filename === "docker-compose.yml" ||
    filename === "docker-compose.yaml" ||
    filename === "tsconfig.json" ||
    filename === "eslint.config.mjs" ||
    filename === "next.config.ts" ||
    filename === "next.config.js" ||
    filename === "requirements.txt" ||
    filename === "pyproject.toml" ||
    filename === "go.mod" ||
    filename === "cargo.toml" ||
    filename === "contributing.md" ||
    filename === "license" ||
    normalized.includes(".github/workflows/")
  );
}

function unique(values: string[]) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function detectStack(paths: string[], packageJson: PackageJson | null) {
  const stack = new Set<string>();
  const allDeps = {
    ...(packageJson?.dependencies || {}),
    ...(packageJson?.devDependencies || {}),
  };

  if (paths.some((path) => path.endsWith("package.json"))) stack.add("Node.js");
  if (
    paths.some(
      (path) =>
        path.endsWith("tsconfig.json") ||
        path.endsWith(".ts") ||
        path.endsWith(".tsx"),
    )
  ) {
    stack.add("TypeScript");
  }
  if (allDeps.react || paths.some((path) => path.endsWith(".jsx") || path.endsWith(".tsx"))) {
    stack.add("React");
  }
  if (allDeps.next || paths.some((path) => path.endsWith("next.config.ts") || path.endsWith("next.config.js"))) {
    stack.add("Next.js");
  }
  if (allDeps.tailwindcss || paths.some((path) => path.includes("tailwind"))) {
    stack.add("Tailwind CSS");
  }
  if (paths.some((path) => path.endsWith("pom.xml"))) stack.add("Java / Maven");
  if (paths.some((path) => path.endsWith("requirements.txt") || path.endsWith("pyproject.toml"))) {
    stack.add("Python");
  }
  if (paths.some((path) => path.endsWith("go.mod"))) stack.add("Go");
  if (paths.some((path) => path.endsWith("Cargo.toml"))) stack.add("Rust");
  if (paths.some((path) => path.toLowerCase().includes("dockerfile"))) stack.add("Docker");
  if (paths.some((path) => path.includes(".github/workflows/"))) stack.add("GitHub Actions");

  return unique([...stack]);
}

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

function parsePackageJson(excerpts: ImportantFile[]) {
  const packageFile = excerpts.find((file) =>
    file.path.toLowerCase().endsWith("package.json"),
  );
  if (!packageFile) return null;

  try {
    return JSON.parse(packageFile.excerpt) as PackageJson;
  } catch {
    return null;
  }
}

function inferProjectName(uploadedFileName: string, packageJson: PackageJson | null) {
  if (packageJson?.name) return packageJson.name;
  return uploadedFileName.replace(/\.zip$/i, "");
}

function buildDoraEvidence(paths: string[], packageJson: PackageJson | null) {
  const scripts = packageJson?.scripts || {};
  const hasCi = paths.some((path) => path.includes(".github/workflows/"));
  const hasTestScript = Boolean(scripts.test);
  const hasBuildScript = Boolean(scripts.build);
  const hasDocker = paths.some((path) => {
    const lower = path.toLowerCase();
    return lower.endsWith("dockerfile") || lower.endsWith("docker-compose.yml") || lower.endsWith("docker-compose.yaml");
  });
  const hasMonitoring = paths.some((path) => {
    const lower = path.toLowerCase();
    return (
      lower.includes("sentry") ||
      lower.includes("monitoring") ||
      lower.includes("observability") ||
      lower.includes("health")
    );
  });

  return {
    continuousIntegration: hasCi
      ? "CI workflow files were detected."
      : "No CI workflow files were detected.",
    testAutomation: hasTestScript
      ? "A test script was detected in package metadata."
      : "No clear test script was detected in package metadata.",
    deploymentAutomation: hasDocker || hasBuildScript
      ? "Build or containerization evidence was detected."
      : "No clear build or deployment automation evidence was detected.",
    monitoringRecovery: hasMonitoring
      ? "Monitoring, health, or observability-related files were detected."
      : "No monitoring or recovery evidence was detected from repository files.",
  };
}

function countEvidenceSignals(summary: Omit<DeterministicSummary, "evidenceSignalCount">) {
  return [
    summary.detectedStack.length,
    summary.documentationFiles.length,
    summary.testFiles.length,
    summary.deploymentFiles.length,
    summary.ciFiles.length,
    Object.keys(summary.packageScripts).length,
  ].reduce((total, count) => total + count, 0);
}

async function buildSummary(file: File): Promise<DeterministicSummary> {
  if (file.size > MAX_ZIP_SIZE_BYTES) {
    throw new Error("ZIP is too large. Please upload a repository under 60 MB.");
  }

  const zip = await JSZip.loadAsync(await file.arrayBuffer());
  const rawEntries = Object.values(zip.files);
  const ignoredPathCount = rawEntries.filter((entry) =>
    isIgnoredPath(entry.name),
  ).length;

  const entries = rawEntries
    .filter((entry) => !entry.dir)
    .map((entry) => ({
      entry,
      path: normalizePath(entry.name),
    }))
    .filter(({ path }) => !isIgnoredPath(path))
    .slice(0, MAX_FILES_TO_SCAN);

  const paths = entries.map(({ path }) => path);
  const importantFiles: ImportantFile[] = [];
  let scannedTextFileCount = 0;

  for (const { entry, path } of entries) {
    if (!isReadableTextFile(path)) continue;
    scannedTextFileCount += 1;

    if (!isImportantFile(path)) continue;

    const text = await entry.async("string");
    importantFiles.push({
      path,
      excerpt: text.slice(0, MAX_IMPORTANT_FILE_CHARS),
    });
  }

  const packageJson = parsePackageJson(importantFiles);
  const lowerPaths = paths.map((path) => path.toLowerCase());
  const documentationFiles = paths.filter((path) => {
    const lower = path.toLowerCase();
    return (
      lower.endsWith("readme.md") ||
      lower.endsWith("contributing.md") ||
      lower.endsWith("license") ||
      lower.includes("/docs/")
    );
  });
  const testFiles = paths.filter((path) => {
    const lower = path.toLowerCase();
    return (
      lower.includes("/test/") ||
      lower.includes("/tests/") ||
      lower.includes("__tests__") ||
      lower.endsWith(".test.ts") ||
      lower.endsWith(".test.tsx") ||
      lower.endsWith(".spec.ts") ||
      lower.endsWith(".spec.tsx") ||
      lower.endsWith(".test.js") ||
      lower.endsWith(".spec.js")
    );
  });
  const deploymentFiles = paths.filter((path) => {
    const lower = path.toLowerCase();
    return (
      lower.endsWith("dockerfile") ||
      lower.endsWith("docker-compose.yml") ||
      lower.endsWith("docker-compose.yaml") ||
      lower.endsWith("vercel.json") ||
      lower.endsWith("netlify.toml") ||
      lower.endsWith("render.yaml")
    );
  });
  const ciFiles = paths.filter((path) =>
    path.toLowerCase().includes(".github/workflows/"),
  );
  const sourceFolders = unique(
    paths
      .map((path) => path.split("/").slice(0, 2).join("/"))
      .filter((path) => {
        const lower = path.toLowerCase();
        return (
          lower === "src" ||
          lower === "app" ||
          lower === "pages" ||
          lower === "server" ||
          lower === "client" ||
          lower.startsWith("src/") ||
          lower.startsWith("app/")
        );
      }),
  );

  const partialSummary = {
    projectName: inferProjectName(file.name, packageJson),
    uploadedFileName: file.name,
    fileCount: paths.length,
    ignoredPathCount,
    scannedTextFileCount,
    configFileCount: lowerPaths.filter((path) =>
      /(^|\/)(package\.json|tsconfig\.json|eslint|next\.config|vite\.config|docker-compose|dockerfile|pom\.xml|pyproject\.toml|go\.mod|cargo\.toml|vercel\.json)$/.test(
        path,
      ),
    ).length,
    fileTree: paths.slice(0, MAX_TREE_ENTRIES),
    detectedStack: detectStack(paths, packageJson),
    importantFiles: importantFiles.map((file) => file.path),
    documentationFiles,
    testFiles,
    deploymentFiles,
    ciFiles,
    sourceFolders,
    packageScripts: packageJson?.scripts || {},
    dependencies: unique(Object.keys(packageJson?.dependencies || {})).slice(0, 60),
    devDependencies: unique(Object.keys(packageJson?.devDependencies || {})).slice(0, 60),
    doraEvidence: buildDoraEvidence(paths, packageJson),
    importantFileExcerpts: importantFiles,
    safety: {
      maxZipSizeMb: MAX_ZIP_SIZE_BYTES / 1024 / 1024,
      maxFilesToScan: MAX_FILES_TO_SCAN,
      maxTreeEntries: MAX_TREE_ENTRIES,
      maxContextChars: MAX_TOTAL_CONTEXT_CHARS,
      excludedPaths: [...ignoredSegments].sort(),
    },
  };

  return {
    ...partialSummary,
    evidenceSignalCount: countEvidenceSignals(partialSummary),
  };
}

function buildCompactContext(summary: DeterministicSummary) {
  return JSON.stringify(summary, null, 2).slice(0, MAX_TOTAL_CONTEXT_CHARS);
}

function fallbackReport(summary: DeterministicSummary): InspectionReport {
  const hasDocs = summary.documentationFiles.length > 0;
  const hasTests =
    summary.testFiles.length > 0 || Boolean(summary.packageScripts.test);
  const hasDeployment = summary.deploymentFiles.length > 0;
  const hasCi = summary.ciFiles.length > 0;

  return {
    overview: `${summary.projectName} contains ${summary.fileCount} inspected files and uses ${summary.detectedStack.join(", ") || "an undetected stack"}.`,
    repositoryStructureAssessment:
      summary.sourceFolders.length > 0
        ? `The repository exposes clear source areas: ${summary.sourceFolders.join(", ")}.`
        : "The repository structure is difficult to assess because no common source folders were detected.",
    architectureSummary:
      summary.sourceFolders.length > 0
        ? `Main source areas detected: ${summary.sourceFolders.join(", ")}.`
        : "No clear source folder structure was detected from the file tree.",
    codeQualityAssessment: hasTests
      ? "Basic code quality evidence exists through tests or test scripts, but complexity and duplication still need deeper static analysis."
      : "Code quality confidence is limited because no automated testing evidence was detected. This prototype does not compute cyclomatic complexity or duplication directly.",
    dependencyAndConfigurationAssessment:
      summary.dependencies.length || summary.devDependencies.length
        ? "Dependency metadata was detected. Configuration quality should be reviewed for scripts, build commands, and clear environment setup."
        : "No dependency metadata was detected, so dependency and configuration health could not be assessed deeply.",
    documentationAssessment: hasDocs
      ? "Documentation files were detected, but their completeness should be reviewed for setup, usage, and architecture notes."
      : "No clear documentation files were detected.",
    testingAssessment: hasTests
      ? "Testing evidence was detected through test files or package scripts."
      : "No clear automated testing evidence was detected.",
    maintainabilityRisks: [
      hasTests ? "Test depth still needs manual review." : "Missing automated testing evidence.",
      hasDocs ? "Documentation completeness is not guaranteed." : "Missing onboarding documentation.",
      hasDeployment ? "Deployment files should be validated." : "Missing deployment configuration evidence.",
    ],
    deploymentReadiness: hasDeployment
      ? "Deployment-related files were detected."
      : "Deployment readiness is weak because no deployment files were detected.",
    doraReadiness: [
      {
        label: "Continuous integration",
        status: hasCi ? "Partial" : "Missing",
        evidence: summary.doraEvidence.continuousIntegration,
      },
      {
        label: "Test automation",
        status: hasTests ? "Partial" : "Weak",
        evidence: summary.doraEvidence.testAutomation,
      },
      {
        label: "Deployment automation",
        status: hasDeployment ? "Partial" : "Weak",
        evidence: summary.doraEvidence.deploymentAutomation,
      },
      {
        label: "Monitoring and recovery evidence",
        status: "Missing",
        evidence: summary.doraEvidence.monitoringRecovery,
      },
    ],
    suggestedImprovements: [
      "Document setup, environment variables, run commands, and architecture.",
      "Add or strengthen automated tests.",
      "Add CI workflow checks for lint, build, and tests.",
      "Add deployment documentation and containerization if appropriate.",
    ],
    prioritizedActionPoints: [
      "Add README setup and usage instructions.",
      "Add basic automated tests for the highest-risk modules.",
      "Add CI checks before deployment.",
    ],
    scores: [
      { label: "Repository structure", value: summary.sourceFolders.length ? 70 : 45, rationale: "Based on detected source folder structure." },
      { label: "Code quality evidence", value: hasTests ? 55 : 25, rationale: "Based on test and script evidence, not full static analysis." },
      { label: "Dependencies and configuration", value: summary.configFileCount ? 60 : 30, rationale: "Based on dependency/configuration files and scripts." },
      { label: "Documentation", value: hasDocs ? 55 : 20, rationale: "Based on documentation file evidence." },
      { label: "Testing", value: hasTests ? 55 : 15, rationale: "Based on test files and scripts." },
      { label: "Deployment readiness", value: hasDeployment ? 60 : 25, rationale: "Based on deployment file evidence." },
      { label: "DORA-inspired readiness", value: hasCi && hasTests ? 60 : 30, rationale: "Based on CI, testing, deployment, and recovery repository signals." },
    ],
    aiAccuracyNote:
      "This fallback report is generated from deterministic checks only because AI output was unavailable.",
  };
}

async function generateAiReport(summary: DeterministicSummary) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.responses.create({
    model: MODEL,
    instructions:
      "You are an AI-assisted software repository inspector. Use only the repository summary provided by deterministic scanning. Do not invent files, tools, metrics, deployment history, incidents, or code behavior. Separate facts from interpretation. Include concise repository structure, architecture, code quality evidence, dependency/configuration, documentation, testing, maintainability, deployment, and DORA-inspired readiness observations. For code quality, comment only on repository evidence such as tests, scripts, structure, configuration, and maintainability signals; do not claim full static analysis, complexity measurement, vulnerability scanning, or duplication detection unless evidence exists. For DORA, do not claim to measure DORA metrics directly; only assess repository evidence that supports delivery readiness.",
    input: `Generate a concise software quality and maintainability inspection report for this repository summary:\n\n${buildCompactContext(summary)}`,
    max_output_tokens: 2800,
    text: {
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "repository_inspection_report",
        strict: true,
        schema: reportSchema,
      },
    },
  });

  return JSON.parse(response.output_text) as InspectionReport;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("repository");

    if (!(file instanceof File)) {
      return Response.json(
        { error: "Please upload a ZIP file using the repository field." },
        { status: 400 },
      );
    }

    if (!file.name.toLowerCase().endsWith(".zip")) {
      return Response.json(
        { error: "Only .zip repository uploads are supported." },
        { status: 400 },
      );
    }

    const summary = await buildSummary(file);
    let report: InspectionReport;
    let usedFallback = false;

    try {
      report = await generateAiReport(summary);
    } catch (error) {
      usedFallback = true;
      report = fallbackReport(summary);
      console.error("AI report generation failed:", error);
    }

    return Response.json({
      summary,
      report,
      model: usedFallback ? "deterministic-fallback" : MODEL,
      usedFallback,
      createdAt: new Date().toISOString(),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Repository inspection failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}
