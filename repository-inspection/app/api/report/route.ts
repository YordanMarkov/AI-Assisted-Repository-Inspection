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

function fallbackReport(summary: DeterministicSummary): InspectionReport {
  const hasDocs = summary.documentationFiles.length > 0;
  const hasTests =
    summary.testFiles.length > 0 || Boolean(summary.packageScripts.test);
  const hasDeployment = summary.deploymentFiles.length > 0;
  const hasCi = summary.ciFiles.length > 0;
  const hasReadme = summary.readmeAnalysis.readmeFiles.length > 0;
  const hasGitHubActivity = Boolean(summary.githubActivity);

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
      { label: "README quality", value: hasReadme ? Math.min(80, 25 + summary.readmeAnalysis.qualitySignals.length * 8) : 10, rationale: "Based on README setup, usage, testing, deployment, and architecture signals." },
      { label: "Collaboration evidence", value: hasGitHubActivity ? Math.min(80, 30 + (summary.githubActivity?.contributorCount || 0) * 8) : 0, rationale: "Based on public GitHub commit and contributor metadata when available." },
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

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: MODEL,
    instructions:
      "You are an AI-assisted software repository inspector. Use only the repository summary provided by deterministic scanning. Do not invent files, tools, metrics, deployment history, incidents, or code behavior. Separate facts from interpretation. Include concise repository structure, architecture, code quality evidence, dependency/configuration, README quality, documentation, testing, collaboration/commit-history evidence when available, maintainability, deployment, and DORA-inspired readiness observations. You may use README-derived stack hints, but clearly treat them as README evidence instead of confirmed dependency evidence. For code quality, comment only on repository evidence such as tests, scripts, structure, configuration, and maintainability signals; do not claim full static analysis, complexity measurement, vulnerability scanning, or duplication detection unless evidence exists. For collaboration, use only sampled public GitHub commit/contributor metadata and avoid judging individual developers. For DORA, do not claim to measure DORA metrics directly; only assess repository evidence that supports delivery readiness.",
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
