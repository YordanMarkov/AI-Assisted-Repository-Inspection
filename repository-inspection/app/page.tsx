"use client";

import type { ChangeEvent } from "react";
import { useMemo, useState } from "react";

const STEP_ORDER = ["upload", "extract", "summarize", "report"] as const;

const STEP_LABELS = {
  upload: "Upload ZIP",
  extract: "Extract Repository",
  summarize: "Build Summary",
  report: "Generate Report",
};

const scanFacts = [
  { label: "Files scanned", value: "1,248" },
  { label: "Ignored folders", value: "7" },
  { label: "Config files", value: "12" },
  { label: "Evidence signals", value: "19" },
];

const scores = [
  { label: "Repository structure", value: 82 },
  { label: "Documentation", value: 58 },
  { label: "Testing", value: 41 },
  { label: "Deployment readiness", value: 64 },
  { label: "DORA-inspired readiness", value: 55 },
];

const reportSections = [
  {
    title: "Project Overview",
    body: "React frontend with Node tooling, a compact app directory, and visible build configuration. The repository is understandable, but onboarding would benefit from clearer setup notes.",
  },
  {
    title: "Documentation Assessment",
    body: "README exists but should include installation, environment variables, run commands, test commands, and a short architecture overview.",
  },
  {
    title: "Architecture Summary",
    body: "The app uses a compact frontend structure. The report should identify source folders, routing, API boundaries, storage layer evidence, and whether responsibilities are separated clearly.",
  },
  {
    title: "Testing Assessment",
    body: "No dedicated test folders or test script were detected in the current summary. Add focused unit tests around parsing, filtering, and report generation first.",
  },
  {
    title: "Maintainability Risks",
    body: "Main risks include missing automated tests, incomplete onboarding documentation, unclear deployment evidence, and limited architectural explanation.",
  },
  {
    title: "Deployment Readiness",
    body: "Build tooling is present. Add Docker, docker-compose, and CI workflow evidence before treating the project as deployment-ready.",
  },
  {
    title: "Suggested Improvements",
    body: "Prioritize parser tests, README setup instructions, CI checks, Docker Compose, report export validation, and a short architecture decision summary.",
  },
];

const doraSignals = [
  {
    label: "Continuous integration",
    status: "Partial",
    evidence: "Build and lint scripts are present; CI workflow evidence should be checked.",
  },
  {
    label: "Test automation",
    status: "Weak",
    evidence: "No clear test suite detected in the current repository summary.",
  },
  {
    label: "Deployment automation",
    status: "Partial",
    evidence: "Build tooling exists; Docker and deployment workflow evidence are expected.",
  },
  {
    label: "Monitoring and recovery evidence",
    status: "Missing",
    evidence: "Repository inspection can flag missing observability files, but cannot measure incidents.",
  },
];

const history = [
  { name: "portfolio-api.zip", date: "May 28, 2026", score: "74" },
  { name: "experiment-4.zip", date: "May 24, 2026", score: "68" },
  { name: "todo-react.zip", date: "May 19, 2026", score: "52" },
];

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [isInspecting, setIsInspecting] = useState(false);
  const [hasReport, setHasReport] = useState(false);

  const doneSteps = useMemo(() => {
    if (hasReport) return STEP_ORDER;
    if (isInspecting) return STEP_ORDER.slice(0, 3);
    if (fileName) return STEP_ORDER.slice(0, 1);
    return [];
  }, [fileName, hasReport, isInspecting]);

  const progress = Math.round((doneSteps.length / STEP_ORDER.length) * 100);

  const statusMessage = useMemo(() => {
    if (isInspecting) {
      return "Filtering generated folders, reading project metadata, and preparing the AI context.";
    }

    if (hasReport) {
      return "Inspection complete. Review the deterministic summary, AI report, and action points below.";
    }

    if (fileName) {
      return "Repository selected. Start the inspection to generate a maintainability report.";
    }

    return "Upload a zipped software repository to begin the inspection pipeline.";
  }, [fileName, hasReport, isInspecting]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setHasReport(false);
    setIsInspecting(false);
  }

  function startInspection() {
    if (!fileName || isInspecting) return;

    setIsInspecting(true);
    window.setTimeout(() => {
      setIsInspecting(false);
      setHasReport(true);
    }, 900);
  }

  return (
    <main className="inspection-app">
      <h1>AI-Assisted Repository Inspection</h1>

      <p className="instructions">
        Upload a zipped software repository. The system will inspect the project
        structure, detect technology indicators, summarize important files, and
        generate a software quality and maintainability report, including a
        DORA-inspired delivery readiness view.
      </p>

      <section className="input-form" aria-label="Repository upload form">
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

        <div className="selected-file-box">
          <span className="summary-label">Selected repository</span>
          <pre className="pipeline-input-preview">
            {fileName || "No repository selected yet."}
          </pre>
        </div>

        <div className="pipeline-primary-row">
          <button
            type="button"
            className="submit-button secondary-button pipeline-main-button"
            disabled={!fileName || isInspecting}
            onClick={startInspection}
          >
            {isInspecting ? "Inspecting repository..." : "Run Inspection"}
          </button>

          <button type="button" className="toggle-advanced-button">
            Export Markdown
          </button>

          <button type="button" className="toggle-advanced-button">
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
              <h3>{fileName || "Current Inspection"}</h3>
              <p className="pipeline-meta">
                Mode: ZIP upload analysis - Status:{" "}
                {hasReport ? "Report ready" : "Waiting for inspection"}
              </p>
            </div>

            <div className="pipeline-header-actions">
              <button className="mini-button">Download JSON</button>
              <button className="mini-button">Download HTML</button>
              <button className="mini-button">Print / Save PDF</button>
            </div>
          </div>

          <div className="run-progress-row">
            <div className="run-progress-bar">
              <div
                className="run-progress-fill"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="run-progress-text">{progress}% complete</span>
          </div>

          <div className="run-step-pill-row">
            {STEP_ORDER.map((step) => (
              <span
                className={`run-step-pill ${
                  doneSteps.includes(step) ? "done" : ""
                }`}
                key={step}
              >
                {STEP_LABELS[step]}
              </span>
            ))}
          </div>

          <div className="step-panels">
            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">Deterministic Summary</div>
                <div className="panel-actions">
                  <button className="mini-button">Copy</button>
                </div>
              </div>

              <div className="fact-grid">
                {scanFacts.map((fact) => (
                  <div className="fact-card" key={fact.label}>
                    <span>{fact.label}</span>
                    <strong>{hasReport ? fact.value : "--"}</strong>
                  </div>
                ))}
              </div>

              <div className="pretty-analysis">
                <section className="pretty-section">
                  <h4>Detected Stack</h4>
                  <ul>
                    <li>TypeScript</li>
                    <li>React</li>
                    <li>Next.js</li>
                    <li>Tailwind CSS</li>
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>Important Files</h4>
                  <ul>
                    <li>README and documentation files</li>
                    <li>package.json</li>
                    <li>tsconfig.json</li>
                    <li>eslint.config.mjs</li>
                    <li>Dockerfile, docker-compose, and CI workflows</li>
                    <li>source folders and test folders</li>
                  </ul>
                </section>

                <section className="pretty-section">
                  <h4>Filtered Paths</h4>
                  <ul>
                    <li>node_modules</li>
                    <li>.git and .next</li>
                    <li>dist, build, target</li>
                    <li>media files and secret env values</li>
                  </ul>
                </section>
              </div>
            </section>

            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">AI Quality Report</div>
                <div className="panel-actions">
                  <button className="mini-button">Copy</button>
                </div>
              </div>

              <div className="pretty-markdown">
                {reportSections.map((section) => (
                  <section className="pretty-section" key={section.title}>
                    <h4>{section.title}</h4>
                    <p className="pretty-paragraph">
                      {hasReport
                        ? section.body
                        : "Run the inspection to generate this report section."}
                    </p>
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
              {doraSignals.map((signal) => (
                <section className="pretty-section" key={signal.label}>
                  <div className="dora-heading">
                    <h4>{signal.label}</h4>
                    <span>{hasReport ? signal.status : "--"}</span>
                  </div>
                  <p className="pretty-paragraph">
                    {hasReport
                      ? signal.evidence
                      : "Run the inspection to evaluate this delivery readiness signal."}
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
                {scores.map((score) => (
                  <div className="score-row" key={score.label}>
                    <div className="score-header">
                      <span>{score.label}</span>
                      <strong>{hasReport ? score.value : "--"}/100</strong>
                    </div>
                    <div className="run-progress-bar">
                      <div
                        className="run-progress-fill"
                        style={{ width: hasReport ? `${score.value}%` : "0%" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="history-panel">
              <div className="panel-header">
                <div className="panel-title">Report History</div>
              </div>

              <div className="history-list">
                {history.map((item) => (
                  <button className="history-item" key={item.name}>
                    <span>
                      <strong>{item.name}</strong>
                      <small>{item.date}</small>
                    </span>
                    <em>{item.score}</em>
                  </button>
                ))}
              </div>
            </section>
          </div>
        </section>
      </section>
    </main>
  );
}
