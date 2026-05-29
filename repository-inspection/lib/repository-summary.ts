import JSZip from "jszip";

export const MAX_ZIP_SIZE_BYTES = 60 * 1024 * 1024;
export const MAX_FILES_TO_SCAN = 2500;
export const MAX_TREE_ENTRIES = 400;
export const MAX_IMPORTANT_FILE_CHARS = 2400;
export const MAX_TOTAL_CONTEXT_CHARS = 28000;

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

export type ImportantFile = {
  path: string;
  excerpt: string;
};

export type DeterministicSummary = {
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

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
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
  if (
    allDeps.react ||
    paths.some((path) => path.endsWith(".jsx") || path.endsWith(".tsx"))
  ) {
    stack.add("React");
  }
  if (
    allDeps.next ||
    paths.some(
      (path) => path.endsWith("next.config.ts") || path.endsWith("next.config.js"),
    )
  ) {
    stack.add("Next.js");
  }
  if (allDeps.tailwindcss || paths.some((path) => path.includes("tailwind"))) {
    stack.add("Tailwind CSS");
  }
  if (paths.some((path) => path.endsWith("pom.xml"))) stack.add("Java / Maven");
  if (
    paths.some(
      (path) => path.endsWith("requirements.txt") || path.endsWith("pyproject.toml"),
    )
  ) {
    stack.add("Python");
  }
  if (paths.some((path) => path.endsWith("go.mod"))) stack.add("Go");
  if (paths.some((path) => path.endsWith("Cargo.toml"))) stack.add("Rust");
  if (paths.some((path) => path.toLowerCase().includes("dockerfile"))) {
    stack.add("Docker");
  }
  if (paths.some((path) => path.includes(".github/workflows/"))) {
    stack.add("GitHub Actions");
  }

  return unique([...stack]);
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
    return (
      lower.endsWith("dockerfile") ||
      lower.endsWith("docker-compose.yml") ||
      lower.endsWith("docker-compose.yaml")
    );
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

function countEvidenceSignals(
  summary: Omit<DeterministicSummary, "evidenceSignalCount">,
) {
  return [
    summary.detectedStack.length,
    summary.documentationFiles.length,
    summary.testFiles.length,
    summary.deploymentFiles.length,
    summary.ciFiles.length,
    Object.keys(summary.packageScripts).length,
  ].reduce((total, count) => total + count, 0);
}

export async function buildRepositorySummary(file: File): Promise<DeterministicSummary> {
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

export function buildCompactContext(summary: DeterministicSummary) {
  return JSON.stringify(summary, null, 2).slice(0, MAX_TOTAL_CONTEXT_CHARS);
}
