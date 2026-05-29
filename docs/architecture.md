# Architecture

This project is a Next.js application for AI-assisted repository quality and maintainability inspection. The production app lives in `repository-inspection/`.

## Runtime Flow

1. The user chooses either a public GitHub repository URL or a local ZIP archive.
2. Local ZIP archives are parsed in the browser with JSZip to avoid sending large files to the server.
3. Public GitHub repositories are fetched through the `/api/github-summary` route and summarized server-side.
4. `lib/repository-summary.ts` builds deterministic evidence: file tree, stack hints, README quality, tests, CI, deployment files, and DORA-inspired signals.
5. `/api/report` sends only the compact deterministic summary to OpenAI and receives a structured JSON report.
6. The UI renders deterministic evidence separately from AI interpretation and stores recent reports in browser localStorage.

## Main Areas

| Area | Path | Responsibility |
| --- | --- | --- |
| UI | `repository-inspection/app/page.tsx` | Upload/URL input, report rendering, export, history |
| Styling | `repository-inspection/app/globals.css` | Experiment-style layout and responsive report UI |
| Report API | `repository-inspection/app/api/report/route.ts` | OpenAI report generation and deterministic fallback |
| GitHub API | `repository-inspection/app/api/github-summary/route.ts` | Public GitHub repository download and metadata sampling |
| Health API | `repository-inspection/app/api/health/route.ts` | Lightweight operational health check |
| Repository scanner | `repository-inspection/lib/repository-summary.ts` | Deterministic repository evidence extraction |
| Tests | `*.test.ts` | API behavior, scanner behavior, and fallback report checks |

## Extension Points

- Add new stack detection rules in `detectStack`.
- Add new README quality signals in `detectReadmeSignals`.
- Add new DORA-inspired evidence in `buildDoraEvidence`.
- Add new report sections by updating the report schema, fallback report, UI type, and Markdown export together.

## Data and Privacy Boundary

The frontend or GitHub route extracts a compact repository summary. The OpenAI request receives that summary, not the full repository archive. Generated folders, dependency folders, binary files, private environment files, minified files, and source maps are excluded from inspection.
