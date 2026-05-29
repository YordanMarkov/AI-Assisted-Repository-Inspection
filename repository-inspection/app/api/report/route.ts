import OpenAI from "openai";
import { buildCompactContext, type DeterministicSummary } from "@/lib/repository-summary";

export const runtime = "nodejs";

const MODEL = process.env.OPENAI_MODEL || "gpt-5-nano";

type InspectionReport = {
  overview: string;
  repositoryStructureAssessment: string;
  architectureSummary: string;
  codeQualityAssessment: string;
  dependencyAndConfigurationAssessment: string;
  readmeAssessment: string;
  collaborationAssessment: string;
  documentationAssessment: string;
  testingAssessment: string;
  maintainabilityRisks: string[];
  deploymentReadiness: string;
  doraReadiness: Array<{
    label: string;
    status: "Strong" | "Partial" | "Weak" | "Missing";
    evidence: string;
  }>;
  bestPracticeRecommendations: Array<{
    area: string;
    priority: "High" | "Medium" | "Low";
    finding: string;
    recommendation: string;
    example: string;
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
    "readmeAssessment",
    "collaborationAssessment",
    "documentationAssessment",
    "testingAssessment",
    "maintainabilityRisks",
    "deploymentReadiness",
    "doraReadiness",
    "bestPracticeRecommendations",
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
    readmeAssessment: { type: "string" },
    collaborationAssessment: { type: "string" },
    documentationAssessment: { type: "string" },
    testingAssessment: { type: "string" },
    maintainabilityRisks: { type: "array", items: { type: "string" } },
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
    bestPracticeRecommendations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["area", "priority", "finding", "recommendation", "example"],
        properties: {
          area: { type: "string" },
          priority: { type: "string", enum: ["High", "Medium", "Low"] },
          finding: { type: "string" },
          recommendation: { type: "string" },
          example: { type: "string" },
        },
      },
    },
    suggestedImprovements: { type: "array", items: { type: "string" } },
    prioritizedActionPoints: { type: "array", items: { type: "string" } },
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

function buildBestPracticeRecommendations(
  summary: DeterministicSummary,
): InspectionReport["bestPracticeRecommendations"] {
  const hasDocs = summary.documentationFiles.length > 0;
  const hasTests =
    summary.testFiles.length > 0 || Boolean(summary.packageScripts.test);
  const hasDeployment = summary.deploymentFiles.length > 0;
  const hasCi = summary.ciFiles.length > 0;
  const hasReadme = summary.readmeAnalysis.readmeFiles.length > 0;
  const hasGitHubActivity = Boolean(summary.githubActivity);
  const recommendations: InspectionReport["bestPracticeRecommendations"] = [];
  const addRecommendation = (
    recommendation: InspectionReport["bestPracticeRecommendations"][number],
  ) => {
    if (!recommendations.some((item) => item.area === recommendation.area)) {
      recommendations.push(recommendation);
    }
  };

  if (!hasReadme || summary.readmeAnalysis.missingSignals.length > 0) {
    addRecommendation({
      area: "README and onboarding",
      priority: "High",
      finding: hasReadme
        ? `The README is missing or weak on: ${summary.readmeAnalysis.missingSignals.slice(0, 3).join(", ")}.`
        : "No README was detected, so new users cannot quickly understand or run the project.",
      recommendation:
        "Use the README as the first quality gate: explain purpose, setup, environment variables, run/test commands, deployment, and architecture notes.",
      example:
        "Add sections named Overview, Tech Stack, Setup, Environment, Run, Test, Deploy, and Project Structure.",
    });
  }

  if (!hasTests) {
    addRecommendation({
      area: "Automated testing",
      priority: "High",
      finding:
        "No clear test files or package test script were detected, which makes regressions harder to catch.",
      recommendation:
        "Add a small but reliable test suite around the highest-risk behavior first, then run it through a package script and CI.",
      example:
        "Create tests for core parsing, validation, API responses, and important UI states; expose them through npm test.",
    });
  } else {
    addRecommendation({
      area: "Test quality and coverage",
      priority: "Medium",
      finding:
        "Testing evidence was detected, but the scanner cannot confirm coverage, risk focus, or whether critical paths are protected.",
      recommendation:
        "Review whether tests cover the most important user flows, API contracts, edge cases, and failure states instead of only checking happy paths.",
      example:
        "Keep the test script, then add tests for validation failures, empty states, integration boundaries, and one high-value end-to-end flow.",
    });
  }

  if (!hasCi) {
    addRecommendation({
      area: "Continuous integration",
      priority: hasTests ? "Medium" : "High",
      finding:
        "No CI workflow was detected, so quality checks may depend on manual discipline.",
      recommendation:
        "Add a GitHub Actions workflow that installs dependencies and runs lint, tests, and build checks on pull requests.",
      example:
        "Use workflow steps for npm ci, npm run lint, npm test, and npm run build.",
    });
  } else {
    addRecommendation({
      area: "CI quality gates",
      priority: "Medium",
      finding:
        "CI workflow evidence was detected, so the next improvement is making sure it blocks the right risks before merge or deployment.",
      recommendation:
        "Use CI as a quality gate for linting, tests, build verification, and dependency installation consistency.",
      example:
        "Check that pull requests run install, lint, test, and build jobs before code reaches the main branch.",
    });
  }

  if (!hasDeployment) {
    addRecommendation({
      area: "Deployment readiness",
      priority: "Medium",
      finding:
        "No deployment configuration or deployment documentation was detected.",
      recommendation:
        "Document the production build command, required environment variables, and deployment target so releases are repeatable.",
      example:
        "For Vercel, document the root directory, build command, output behavior, and required project environment variables.",
    });
  }

  if (summary.detectedStack.length === 0) {
    addRecommendation({
      area: "Technology stack clarity",
      priority: "Medium",
      finding:
        "The scanner could not confidently detect the technology stack from dependencies, files, README hints, or GitHub language metadata.",
      recommendation:
        "Make the stack explicit in dependency files and README documentation so maintainers and tools can understand the project quickly.",
      example:
        "Add a Tech Stack section such as Frontend: Next.js + React, Testing: Vitest, Deployment: Vercel.",
    });
  }

  addRecommendation({
    area: "Code quality evidence",
    priority: hasTests ? "Medium" : "High",
    finding: hasTests
      ? "The repository has test evidence, but the inspection cannot verify static analysis, formatting, complexity, or duplication checks."
      : "Without tests or visible static checks, code quality depends mostly on manual review.",
    recommendation:
      "Make code quality measurable with repeatable checks for linting, formatting, type safety, tests, and build health.",
    example:
      "Expose scripts such as lint, test, typecheck, and build, then run them locally and in CI.",
  });

  if (
    !hasDocs ||
    !summary.readmeAnalysis.qualitySignals.some((signal) =>
      signal.toLowerCase().includes("architecture"),
    )
  ) {
    addRecommendation({
      area: "Maintainability documentation",
      priority: "Medium",
      finding:
        "Architecture or project-structure guidance appears missing or light.",
      recommendation:
        "Add short architecture notes that explain where key code lives, how data flows, and which files are safe extension points.",
      example:
        "Include a Project Structure table with app routes, API routes, shared libraries, tests, and deployment files.",
    });
  }

  if (summary.dependencies.length || summary.devDependencies.length) {
    addRecommendation({
      area: "Dependency hygiene",
      priority: "Medium",
      finding:
        "Dependency metadata was detected, but the scanner cannot confirm update policy, unused packages, or audit status.",
      recommendation:
        "Keep dependencies understandable and reviewable by documenting major libraries, removing unused packages, and checking for known vulnerabilities.",
      example:
        "Add a short Dependencies note in the README and run npm audit or the package manager equivalent before releases.",
    });
  }

  if (!hasGitHubActivity) {
    addRecommendation({
      area: "Collaboration evidence",
      priority: "Low",
      finding:
        "Commit and contributor evidence is unavailable for this inspection, which limits collaboration assessment.",
      recommendation:
        "For public repositories, keep commit messages descriptive and add contribution guidance when more than one person works on the project.",
      example:
        "Use commit messages like Add repository summary tests or Fix Vercel build root instead of vague messages like update.",
    });
  } else {
    addRecommendation({
      area: "Collaboration workflow",
      priority: "Low",
      finding:
        "GitHub activity was available, but sampled commits alone cannot prove review quality or team workflow consistency.",
      recommendation:
        "Keep collaboration easy to audit with descriptive commits, pull request descriptions, and lightweight contribution notes.",
      example:
        "Use PR descriptions that list the change, test evidence, and any deployment or configuration impact.",
    });
  }

  return recommendations.slice(0, 6);
}

function completeBestPracticeRecommendations(
  report: InspectionReport,
  summary: DeterministicSummary,
): InspectionReport {
  const deterministicRecommendations = buildBestPracticeRecommendations(summary);
  const recommendations = [...(report.bestPracticeRecommendations || [])];

  for (const recommendation of deterministicRecommendations) {
    if (recommendations.length >= 4) break;
    if (!recommendations.some((item) => item.area === recommendation.area)) {
      recommendations.push(recommendation);
    }
  }

  return {
    ...report,
    bestPracticeRecommendations: recommendations.slice(0, 6),
  };
}

function fallbackReport(summary: DeterministicSummary): InspectionReport {
  const hasDocs = summary.documentationFiles.length > 0;
  const hasTests =
    summary.testFiles.length > 0 || Boolean(summary.packageScripts.test);
  const hasDeployment = summary.deploymentFiles.length > 0;
  const hasCi = summary.ciFiles.length > 0;
  const hasReadme = summary.readmeAnalysis.readmeFiles.length > 0;
  const hasGitHubActivity = Boolean(summary.githubActivity);
  const hasMonitoringEvidence =
    !summary.doraEvidence.monitoringRecovery.toLowerCase().startsWith("no ");
  const hasQualityScripts = Boolean(
    summary.packageScripts.lint &&
      summary.packageScripts.typecheck &&
      summary.packageScripts.build,
  );
  const bestPracticeRecommendations = buildBestPracticeRecommendations(summary);

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
    readmeAssessment: hasReadme
      ? `README evidence was detected. Quality signals found: ${summary.readmeAnalysis.qualitySignals.join(", ") || "none"}. Missing or weak README signals: ${summary.readmeAnalysis.missingSignals.join(", ") || "none"}.`
      : "No README file was detected, which weakens onboarding and project understanding.",
    collaborationAssessment: hasGitHubActivity
      ? `${summary.githubActivity?.recentCommitCount || 0} recent commits and ${summary.githubActivity?.contributorCount || 0} sampled contributors were found. Commit style and collaboration should be reviewed from the sampled evidence.`
      : "Collaboration and commit-history evidence is unavailable for this inspection mode.",
    documentationAssessment: hasDocs
      ? "Documentation files were detected, but their completeness should be reviewed for setup, usage, and architecture notes."
      : "No clear documentation files were detected.",
    testingAssessment: hasTests
      ? "Testing evidence was detected through test files or package scripts."
      : "No clear automated testing evidence was detected.",
    maintainabilityRisks: [
      hasTests ? "Test depth still needs manual review." : "Missing automated testing evidence.",
      hasDocs ? "Documentation completeness is not guaranteed." : "Missing onboarding documentation.",
      hasReadme ? "README may still omit important setup or architecture details." : "Missing README evidence.",
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
        status: hasMonitoringEvidence ? "Partial" : "Missing",
        evidence: summary.doraEvidence.monitoringRecovery,
      },
    ],
    bestPracticeRecommendations,
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
      { label: "Code quality evidence", value: hasQualityScripts && hasTests ? 75 : hasTests ? 55 : 25, rationale: "Based on lint, typecheck, build, test, and script evidence, not full static analysis." },
      { label: "Dependencies and configuration", value: summary.configFileCount && Object.keys(summary.packageScripts).length >= 5 ? 70 : summary.configFileCount ? 60 : 30, rationale: "Based on dependency/configuration files and scripts." },
      { label: "README quality", value: hasReadme ? Math.min(80, 25 + summary.readmeAnalysis.qualitySignals.length * 8) : 10, rationale: "Based on README setup, usage, testing, deployment, and architecture signals." },
      { label: "Collaboration evidence", value: hasGitHubActivity ? Math.min(80, 30 + (summary.githubActivity?.contributorCount || 0) * 8) : 0, rationale: "Based on public GitHub commit and contributor metadata when available." },
      { label: "Documentation", value: summary.documentationFiles.length >= 3 ? 70 : hasDocs ? 55 : 20, rationale: "Based on README, contribution, and docs file evidence." },
      { label: "Testing", value: hasTests && summary.testFiles.length >= 4 ? 70 : hasTests ? 55 : 15, rationale: "Based on test files and scripts." },
      { label: "Deployment readiness", value: hasDeployment && hasMonitoringEvidence ? 70 : hasDeployment ? 60 : 25, rationale: "Based on deployment file and health check evidence." },
      { label: "DORA-inspired readiness", value: hasCi && hasTests && hasDeployment && hasMonitoringEvidence ? 75 : hasCi && hasTests ? 60 : 30, rationale: "Based on CI, testing, deployment, and recovery repository signals." },
    ],
    aiAccuracyNote:
      "This fallback report is generated from deterministic checks only because AI output was unavailable.",
  };
}

async function generateAiReport(summary: DeterministicSummary) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: MODEL,
    instructions:
      "You are an AI-assisted software repository inspector. Use only the repository summary provided by deterministic scanning. Do not invent files, tools, metrics, deployment history, incidents, or code behavior. Separate facts from interpretation. Include concise repository structure, architecture, code quality evidence, dependency/configuration, README quality, documentation, testing, collaboration/commit-history evidence when available, maintainability, deployment, and DORA-inspired readiness observations. Add 4 to 6 bestPracticeRecommendations that explain where the repository is weak and how to improve it. Do not make the recommendations only about README quality. Cover multiple applicable areas such as code quality evidence, automated testing, CI, deployment readiness, dependency/configuration hygiene, maintainability documentation, stack clarity, or collaboration workflow. Each best practice must be tied to detected evidence or missing evidence from the summary and include a short concrete example. Avoid generic advice that could apply to every project. You may use README-derived stack hints, but clearly treat them as README evidence instead of confirmed dependency evidence. For code quality, comment only on repository evidence such as tests, scripts, structure, configuration, and maintainability signals; do not claim full static analysis, complexity measurement, vulnerability scanning, or duplication detection unless evidence exists. For collaboration, use only sampled public GitHub commit/contributor metadata and avoid judging individual developers. For DORA, do not claim to measure DORA metrics directly; only assess repository evidence that supports delivery readiness.",
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

  return completeBestPracticeRecommendations(
    JSON.parse(response.output_text) as InspectionReport,
    summary,
  );
}

export async function POST(request: Request) {
  try {
    const { summary } = (await request.json()) as {
      summary?: DeterministicSummary;
    };

    if (!summary?.uploadedFileName || !Array.isArray(summary.fileTree)) {
      return Response.json(
        { error: "A valid repository summary is required." },
        { status: 400 },
      );
    }

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
      error instanceof Error ? error.message : "Repository report generation failed.";

    return Response.json({ error: message }, { status: 500 });
  }
}
