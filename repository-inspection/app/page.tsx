"use client";

import type { ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { buildRepositorySummary } from "@/lib/repository-summary";

const STEP_ORDER = ["upload", "extract", "summarize", "report"] as const;

const STEP_LABELS = {
  upload: "Upload ZIP",
  extract: "Extract Repository",
  summarize: "Build Summary",
  report: "Generate Report",
};

type DoraStatus = "Strong" | "Partial" | "Weak" | "Missing";

type InspectionResponse = {
  summary: {
    projectName: string;
    uploadedFileName: string;
    fileCount: number;
    ignoredPathCount: number;
    scannedTextFileCount: number;
    configFileCount: number;
    evidenceSignalCount: number;
    detectedStack: string[];
    githubLanguages?: string[];
    importantFiles: string[];
    documentationFiles: string[];
    testFiles: string[];
    deploymentFiles: string[];
    ciFiles: string[];
    sourceFolders: string[];
    packageScripts: Record<string, string>;
    readmeAnalysis: {
      readmeFiles: string[];
      detectedStackHints: string[];
      qualitySignals: string[];
      missingSignals: string[];
    };
    githubActivity?: {
      recentCommitCount: number;
      sampledCommitMessages: string[];
      contributorCount: number;
      topContributors: Array<{
        login: string;
        contributions: number;
      }>;
      collaborationSignals: string[];
    };
    doraEvidence: {
      continuousIntegration: string;
      testAutomation: string;
      deploymentAutomation: string;
      monitoringRecovery: string;
    };
    safety: {
      maxZipSizeMb: number;
      maxFilesToScan: number;
      maxTreeEntries: number;
      maxContextChars: number;
      excludedPaths: string[];
    };
  };
  report: {
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
      status: DoraStatus;
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
  model: string;
  usedFallback: boolean;
  createdAt: string;
};

type HistoryItem = {
  id: string;
  name: string;
  date: string;
  score: string;
  result: InspectionResponse;
};

const emptyHistory: HistoryItem[] = [];
const legacyMockHistoryNames = new Set([
  "portfolio-api.zip",
  "experiment-4.zip",
  "todo-react.zip",
]);

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function getDoraStatusClass(status: string) {
  return `dora-status ${status.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

function getPriorityClass(priority: string) {
  return `priority-badge ${priority.toLowerCase().replace(/[^a-z]+/g, "-")}`;
}

function buildMarkdown(result: InspectionResponse) {
  const { summary, report } = result;
  const scoreLines = report.scores
    .map((score) => `- ${score.label}: ${score.value}/100 - ${score.rationale}`)
    .join("\n");
  const riskLines = report.maintainabilityRisks
    .map((risk) => `- ${risk}`)
    .join("\n");
  const improvementLines = report.suggestedImprovements
    .map((item) => `- ${item}`)
    .join("\n");
  const doraLines = report.doraReadiness
    .map((item) => `- ${item.label}: ${item.status} - ${item.evidence}`)
    .join("\n");
  const bestPracticeLines = (report.bestPracticeRecommendations || [])
    .map(
      (item) =>
        `- ${item.area} (${item.priority}): ${item.finding} Recommendation: ${item.recommendation} Example: ${item.example}`,
    )
    .join("\n");
  const actionLines = report.prioritizedActionPoints
    .map((item, index) => `${index + 1}. ${item}`)
    .join("\n");

  return `# Repository Inspection Report

Project: ${summary.projectName}
Uploaded file: ${summary.uploadedFileName}
Created at: ${formatDate(result.createdAt)}
Model: ${result.model}

## Project Overview
${report.overview}

## Repository Structure Assessment
${report.repositoryStructureAssessment}

## Architecture Summary
${report.architectureSummary}

## Code Quality Assessment
${report.codeQualityAssessment}

## Dependency and Configuration Assessment
${report.dependencyAndConfigurationAssessment}

## README Assessment
${report.readmeAssessment}

## Collaboration Assessment
${report.collaborationAssessment}

## Documentation Assessment
${report.documentationAssessment}

## Testing Assessment
${report.testingAssessment}

## Maintainability Risks
${riskLines}

## Deployment Readiness
${report.deploymentReadiness}

## DORA-Inspired Delivery Readiness
${doraLines}

## Best Practice Recommendations
${bestPracticeLines}

## Suggested Improvements
${improvementLines}

## Prioritized Action Points
${actionLines}

## Quality Scores
${scoreLines}

## AI Accuracy Note
${report.aiAccuracyNote}
`;
}

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [githubUrl, setGithubUrl] = useState("");
  const [inputMode, setInputMode] = useState<"zip" | "github">("github");
  const [isInspecting, setIsInspecting] = useState(false);
  const [result, setResult] = useState<InspectionResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>(emptyHistory);

  useEffect(() => {
    const savedHistory = window.localStorage.getItem("inspection-history");
    if (!savedHistory) return;

    try {
      const parsedHistory = JSON.parse(savedHistory) as Partial<HistoryItem>[];
      const realHistory = parsedHistory.filter(
        (item): item is HistoryItem => {
          if (!item.result || !item.name) return false;
          return !legacyMockHistoryNames.has(item.name.toLowerCase());
        },
      );
      window.localStorage.setItem(
        "inspection-history",
        JSON.stringify(realHistory),
      );
      window.setTimeout(() => setHistory(realHistory), 0);
    } catch {
      window.setTimeout(() => setHistory(emptyHistory), 0);
    }
  }, []);

  const doneSteps = useMemo(() => {
    if (result) return STEP_ORDER;
    if (isInspecting) return STEP_ORDER.slice(0, 3);
    if (selectedFile || githubUrl.trim()) return STEP_ORDER.slice(0, 1);
    return [];
  }, [githubUrl, result, selectedFile, isInspecting]);

  const progress = Math.round((doneSteps.length / STEP_ORDER.length) * 100);

  const statusMessage = useMemo(() => {
    if (errorMessage) return errorMessage;

    if (isInspecting) {
      return "Filtering generated folders, reading project metadata, and preparing compact AI context.";
    }

    if (result?.usedFallback) {
      return "Inspection completed with deterministic fallback because AI generation was unavailable.";
    }

    if (result) {
      return "Inspection complete. Review deterministic facts, AI analysis, DORA readiness, and action points.";
    }

    if (selectedFile || githubUrl.trim()) {
      return "Repository selected. Start the inspection to generate a maintainability report.";
    }

    return "Upload a zipped software repository or enter a public GitHub repository URL to begin.";
  }, [errorMessage, githubUrl, result, selectedFile, isInspecting]);

  const scanFacts = [
    { label: "Files scanned", value: result?.summary.fileCount.toString() },
    {
      label: "Ignored paths",
      value: result?.summary.ignoredPathCount.toString(),
    },
    {
      label: "Config files",
      value: result?.summary.configFileCount.toString(),
    },
    {
      label: "Evidence signals",
      value: result?.summary.evidenceSignalCount.toString(),
    },
  ];

  const reportSections = result
    ? [
        { title: "Project Overview", body: result.report.overview },
        {
          title: "Repository Structure Assessment",
          body: result.report.repositoryStructureAssessment,
        },
        {
          title: "Code Quality Assessment",
          body: result.report.codeQualityAssessment,
        },
        {
          title: "Dependency and Configuration Assessment",
          body: result.report.dependencyAndConfigurationAssessment,
        },
        {
          title: "README Assessment",
          body: result.report.readmeAssessment,
        },
        {
          title: "Collaboration Assessment",
          body: result.report.collaborationAssessment,
        },
        {
          title: "Documentation Assessment",
          body: result.report.documentationAssessment,
        },
        {
          title: "Architecture Summary",
          body: result.report.architectureSummary,
        },
        { title: "Testing Assessment", body: result.report.testingAssessment },
        {
          title: "Maintainability Risks",
          body: result.report.maintainabilityRisks.join(" "),
        },
        {
          title: "Deployment Readiness",
          body: result.report.deploymentReadiness,
        },
        {
          title: "Suggested Improvements",
          body: result.report.suggestedImprovements.join(" "),
        },
      ]
    : [];

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setResult(null);
    setErrorMessage("");
  }

  function handleGithubUrlChange(event: ChangeEvent<HTMLInputElement>) {
    setGithubUrl(event.target.value);
    setResult(null);
    setErrorMessage("");
  }

  async function startInspection() {
    if (isInspecting) return;
    if (inputMode === "zip" && !selectedFile) return;
    if (inputMode === "github" && !githubUrl.trim()) return;

    setIsInspecting(true);
    setErrorMessage("");
    setResult(null);

    try {
      const summary =
        inputMode === "zip"
          ? await buildRepositorySummary(selectedFile as File)
          : await fetchGithubSummary(githubUrl);

      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ summary }),
      });
      const responseText = await response.text();
      const data = responseText ? JSON.parse(responseText) : {};

      if (!response.ok) {
        throw new Error(data.error || responseText || "Inspection failed.");
      }

      const inspection = data as InspectionResponse;
      setResult(inspection);

      const averageScore = Math.round(
        inspection.report.scores.reduce((total, score) => total + score.value, 0) /
          Math.max(inspection.report.scores.length, 1),
      ).toString();
      const nextHistory = [
        {
          id: `${inspection.createdAt}-${inspection.summary.uploadedFileName}`,
          name: inspection.summary.uploadedFileName,
          date: formatDate(inspection.createdAt),
          score: averageScore,
          result: inspection,
        },
        ...history.filter(
          (item) => item.name !== inspection.summary.uploadedFileName,
        ),
      ].slice(0, 6);

      setHistory(nextHistory);
      window.localStorage.setItem(
        "inspection-history",
        JSON.stringify(nextHistory),
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not complete repository inspection.",
      );
    } finally {
      setIsInspecting(false);
    }
  }

  async function fetchGithubSummary(url: string) {
    const response = await fetch("/api/github-summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const responseText = await response.text();
    const data = responseText ? JSON.parse(responseText) : {};

    if (!response.ok) {
      throw new Error(data.error || responseText || "GitHub inspection failed.");
    }

    return data.summary;
  }

  function handleExportMarkdown() {
    if (!result) return;
    downloadTextFile(`${result.summary.projectName}-inspection.md`, buildMarkdown(result));
  }

  function handleDownloadJson() {
    if (!result) return;
    downloadTextFile(
      `${result.summary.projectName}-inspection.json`,
      JSON.stringify(result, null, 2),
    );
  }

  function handleOpenHistoryItem(item: HistoryItem) {
    setResult(item.result);
    setSelectedFile(null);
    setErrorMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handlePrint() {
    window.print();
  }

  return (
    <main className="inspection-app">
      <h1>AI-Assisted Repository Inspection</h1>

      <p className="instructions">
        Upload a zipped software repository or inspect a public GitHub
        repository. The system will inspect the project structure, detect
        technology indicators, summarize important files, and generate a
        software quality and maintainability report, including a DORA-inspired
        delivery readiness view.
      </p>

      <section className="input-form" aria-label="Repository upload form">
        <div className="input-mode-section">
          <div className="input-mode-label">Choose inspection source</div>
          <div className="input-choice-grid" aria-label="Repository input mode">
          <button
            className={
              inputMode === "zip" ? "input-choice active" : "input-choice"
            }
            type="button"
            onClick={() => setInputMode("zip")}
          >
            <span className="choice-title">Local ZIP upload</span>
            <span className="choice-description">
              Inspect a repository archive from your computer.
            </span>
          </button>
          <button
            className={
              inputMode === "github" ? "input-choice active" : "input-choice"
            }
            type="button"
            onClick={() => setInputMode("github")}
          >
            <span className="choice-title">Public GitHub repository</span>
            <span className="choice-description">
              Paste a github.com URL and inspect it directly.
            </span>
          </button>
          </div>
        </div>

        {inputMode === "zip" ? (
          <label className="zip-dropzone">
            <span className="zip-dropzone-icon">+</span>
            <span className="zip-dropzone-title">Upload zipped repository</span>
            <span className="zip-dropzone-help">
              ZIP files only. Folders such as node_modules, .git, dist, build,
              target, and private environment values are excluded from inspection.
            </span>
            <input
              className="sr-only"
              type="file"
              accept=".zip,application/zip"
              onChange={handleFileChange}
            />
          </label>
        ) : (
          <div className="github-input-box">
            <div className="github-input-header">
              <span className="github-input-icon">GH</span>
              <div>
                <label htmlFor="github-url">
                  Public GitHub repository URL
                </label>
                <p>
                  Example: https://github.com/vercel/next.js
                </p>
              </div>
            </div>
            <input
              id="github-url"
              type="url"
              value={githubUrl}
              onChange={handleGithubUrlChange}
              placeholder="https://github.com/owner/repository"
            />
            <p className="github-input-note">
              Public repositories only. Large repositories still use the same 60
              MB ZIP limit and compact AI context cap.
            </p>
          </div>
        )}

        <div className="selected-file-box">
          <span className="summary-label">Selected repository</span>
          <pre className="pipeline-input-preview">
            {inputMode === "zip"
              ? selectedFile?.name || "No repository selected yet."
              : githubUrl || "No GitHub repository URL entered yet."}
          </pre>
        </div>

        <div className="pipeline-primary-row">
          <button
            type="button"
            className="submit-button secondary-button pipeline-main-button"
            disabled={
              isInspecting ||
              (inputMode === "zip" ? !selectedFile : !githubUrl.trim())
            }
            onClick={startInspection}
          >
            {isInspecting ? "Inspecting repository..." : "Run Inspection"}
          </button>

          <button
            type="button"
            className="toggle-advanced-button"
            disabled={!result}
            onClick={handleExportMarkdown}
          >
            Export Markdown
          </button>

          <button
            type="button"
            className="toggle-advanced-button"
            disabled={!result}
            onClick={handlePrint}
          >
            Print / Save PDF
          </button>
        </div>
      </section>

      <section className="pipeline-status-card">
        <div className="pipeline-status-header">
          <div>
            <h2>Inspection Status</h2>
            <p>{statusMessage}</p>
          </div>
          <div className="pipeline-status-percent">{progress}%</div>
        </div>

        <div className="progress-bar-shell">
          <div
            className={`progress-bar-fill ${isInspecting ? "busy" : ""}`}
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="progress-step-row">
          {STEP_ORDER.map((step) => (
            <div
              className={`progress-step ${
                doneSteps.includes(step) ? "done" : ""
              }`}
              key={step}
            >
              {STEP_LABELS[step]}
            </div>
          ))}
        </div>
      </section>

      {isInspecting ? (
        <section className="thinking-card" aria-live="polite">
          <div className="thinking-spinner" aria-hidden="true" />
          <div>
            <h2>Inspection in progress</h2>
            <p>
              Reading repository evidence, building a compact summary, and
              generating the maintainability report.
            </p>
          </div>
        </section>
      ) : null}

      <section className="history-wrapper">
        <div className="history-header">
          <h2>Repository Report</h2>
          <p>
            The report separates deterministic repository facts from
            AI-generated interpretation so conclusions stay grounded in the
            uploaded project.
          </p>
        </div>

        <section className="pipeline-card">
          <div className="pipeline-card-header">
            <div>
              <h3>
                {result?.summary.projectName ||
                  (inputMode === "zip" ? selectedFile?.name : githubUrl) ||
                  "Current Inspection"}
              </h3>
              <p className="pipeline-meta">
                Mode: repository inspection - Status:{" "}
                {result ? `Report ready via ${result.model}` : "Waiting for inspection"}
              </p>
            </div>

            <div className="pipeline-header-actions">
              <button
                className="mini-button"
                disabled={!result}
                onClick={handleDownloadJson}
              >
                Download JSON
              </button>
              <button
                className="mini-button"
                disabled={!result}
                onClick={handleExportMarkdown}
              >
                Download Markdown
              </button>
              <button
                className="mini-button"
                disabled={!result}
                onClick={handlePrint}
              >
                Print / Save PDF
              </button>
            </div>
          </div>

          <div className="step-panels">
            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">Deterministic Summary</div>
              </div>

              <div className="fact-grid">
                {scanFacts.map((fact) => (
                  <div className="fact-card" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{fact.value || "--"}</strong>
                  </div>
                ))}
              </div>

              <div className="pretty-analysis">
                <section className="pretty-section">
                  <h4>Detected Stack</h4>
                  <ul>
                    {result ? (
                      result.summary.detectedStack.length ? (
                        result.summary.detectedStack.map((item) => (
                          <li key={item}>{item}</li>
                        ))
                      ) : (
                        <li className="not-detected">
                          Not detected from repository evidence.
                        </li>
                      )
                    ) : (
                      <li className="pending-detection">
                        No inspection run yet.
                      </li>
                    )}
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>Important Files</h4>
                  <ul>
                    {(result?.summary.importantFiles.length
                      ? result.summary.importantFiles.slice(0, 12)
                      : ["README, package files, Docker files, CI workflows, source folders, and tests will appear here."]
                    ).map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>Repository Evidence</h4>
                  <ul>
                    <li>
                      Documentation files:{" "}
                      {result?.summary.documentationFiles.length ?? "--"}
                    </li>
                    <li>
                      Test files: {result?.summary.testFiles.length ?? "--"}
                    </li>
                    <li>
                      CI files: {result?.summary.ciFiles.length ?? "--"}
                    </li>
                    <li>
                      Deployment files:{" "}
                      {result?.summary.deploymentFiles.length ?? "--"}
                    </li>
                    <li>
                      Package scripts:{" "}
                      {result
                        ? Object.keys(result.summary.packageScripts).join(", ") ||
                          "None detected"
                        : "--"}
                    </li>
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>README Evidence</h4>
                  <ul>
                    <li>
                      README files:{" "}
                      {result?.summary.readmeAnalysis.readmeFiles.length ?? "--"}
                    </li>
                    <li>
                      README stack hints:{" "}
                      {result
                        ? result.summary.readmeAnalysis.detectedStackHints.join(", ") ||
                          "Not detected"
                        : "--"}
                    </li>
                    <li>
                      GitHub language metadata:{" "}
                      {result
                        ? result.summary.githubLanguages?.join(", ") ||
                          "Unavailable for this inspection"
                        : "--"}
                    </li>
                    <li>
                      README quality signals:{" "}
                      {result
                        ? result.summary.readmeAnalysis.qualitySignals.join(", ") ||
                          "None detected"
                        : "--"}
                    </li>
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>GitHub Activity Evidence</h4>
                  <ul>
                    <li>
                      Recent commits sampled:{" "}
                      {result?.summary.githubActivity?.recentCommitCount ?? "Unavailable"}
                    </li>
                    <li>
                      Sampled contributors:{" "}
                      {result?.summary.githubActivity?.contributorCount ?? "Unavailable"}
                    </li>
                    <li>
                      Commit messages:{" "}
                      {result?.summary.githubActivity?.sampledCommitMessages
                        .slice(0, 3)
                        .join(" | ") || "Unavailable for local ZIP inspections"}
                    </li>
                  </ul>
                </section>

              </div>
            </section>

            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">AI Quality Report</div>
              </div>

              <div className="pretty-markdown">
                {(reportSections.length
                  ? reportSections
                  : [
                      {
                        title: "Waiting for Inspection",
                        body: "Run the inspection to generate project overview, architecture, documentation, testing, maintainability, deployment, and improvement sections.",
                      },
                    ]
                ).map((section) => (
                  <section className="pretty-section" key={section.title}>
                    <h4>{section.title}</h4>
                    <p className="pretty-paragraph">{section.body}</p>
                  </section>
                ))}
              </div>
            </section>
          </div>

          <section className="history-panel dora-panel">
            <div className="panel-header">
              <div className="panel-title">
                DORA-Inspired Delivery Readiness
              </div>
            </div>

            <p className="pretty-paragraph dora-note">
              This does not claim to measure DORA metrics directly. It checks
              repository evidence that supports delivery capability, such as CI,
              tests, deployment automation, documentation, and recovery signals.
            </p>

            <div className="dora-grid">
              {(result?.report.doraReadiness.length
                ? result.report.doraReadiness
                : [
                    {
                      label: "Continuous integration",
                      status: "--",
                      evidence: "Run the inspection to evaluate this signal.",
                    },
                    {
                      label: "Test automation",
                      status: "--",
                      evidence: "Run the inspection to evaluate this signal.",
                    },
                    {
                      label: "Deployment automation",
                      status: "--",
                      evidence: "Run the inspection to evaluate this signal.",
                    },
                    {
                      label: "Monitoring and recovery evidence",
                      status: "--",
                      evidence: "Run the inspection to evaluate this signal.",
                    },
                  ]
              ).map((signal) => (
                <section className="pretty-section" key={signal.label}>
                  <div className="dora-heading">
                    <h4>{signal.label}</h4>
                    <span className={getDoraStatusClass(signal.status)}>
                      {signal.status}
                    </span>
                  </div>
                  <p className="pretty-paragraph">{signal.evidence}</p>
                </section>
              ))}
            </div>
          </section>

          <section className="history-panel best-practices-panel">
            <div className="panel-header">
              <div className="panel-title">Best Practice Recommendations</div>
            </div>

            <p className="pretty-paragraph dora-note">
              These items connect repository evidence to concrete improvement
              steps, so the report shows what to fix and why it matters.
            </p>

            <div className="best-practice-grid">
              {(result?.report.bestPracticeRecommendations?.length
                ? result.report.bestPracticeRecommendations
                : [
                    {
                      area: "Waiting for inspection",
                      priority: "--",
                      finding:
                        "Run the inspection to discover repo-specific weak spots.",
                      recommendation:
                        "Recommendations will appear here after analysis.",
                      example:
                        "Examples will be tailored to the repository evidence.",
                    },
                  ]
              ).map((item, index) => (
                <section className="best-practice-card" key={`${item.area}-${index}`}>
                  <div className="best-practice-heading">
                    <div className="best-practice-title-group">
                      <span className="practice-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <h4>{item.area}</h4>
                    </div>
                    <span
                      className={getPriorityClass(item.priority)}
                      aria-label={`Priority: ${item.priority}`}
                    >
                      {item.priority} priority
                    </span>
                  </div>
                  <p>
                    <strong>Finding:</strong> {item.finding}
                  </p>
                  <p>
                    <strong>Best practice:</strong> {item.recommendation}
                  </p>
                  <p>
                    <strong>Example:</strong> {item.example}
                  </p>
                </section>
              ))}
            </div>
          </section>

          <div className="step-panels report-lower-grid">
            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">Quality Scores</div>
              </div>

              <div className="score-list">
                {(result?.report.scores.length
                  ? result.report.scores
                  : [
                      { label: "Repository structure", value: 0, rationale: "" },
                      { label: "Documentation", value: 0, rationale: "" },
                      { label: "Testing", value: 0, rationale: "" },
                      { label: "Deployment readiness", value: 0, rationale: "" },
                      { label: "DORA-inspired readiness", value: 0, rationale: "" },
                    ]
                ).map((score) => (
                  <div className="score-row" key={score.label}>
                    <div className="score-header">
                      <span>{score.label}</span>
                      <strong>{result ? score.value : "--"}/100</strong>
                    </div>
                    <div className="run-progress-bar">
                      <div
                        className="run-progress-fill"
                        style={{ width: result ? `${score.value}%` : "0%" }}
                      />
                    </div>
                    {score.rationale ? (
                      <p className="score-rationale">{score.rationale}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">Report History</div>
              </div>

              <div className="history-list">
                {history.length === 0 ? (
                  <p className="empty-state">
                    No repository reports yet. Run an inspection to add the
                    first real result here.
                  </p>
                ) : (
                  history.map((item) => (
                    <button
                      className="history-item"
                      key={item.id}
                      onClick={() => handleOpenHistoryItem(item)}
                    >
                      <span>
                        <strong>{item.name}</strong>
                        <small>{item.date} - click to reopen</small>
                      </span>
                      <em title="Average quality score">
                        <span>{item.score}</span>
                        <small>avg score</small>
                      </em>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
