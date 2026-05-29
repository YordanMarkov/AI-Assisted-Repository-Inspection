# AI-Assisted Repository Inspection

Experiment #5 for AI-assisted software quality and maintainability analysis.

This project is a developer-facing prototype that inspects software repositories and generates a structured quality report. It supports two inspection modes:

- Public GitHub repository URL
- Local repository ZIP upload

The tool first performs deterministic repository analysis, then sends a compact summary to the OpenAI API for an AI-assisted report. It is designed to avoid sending full repositories or sensitive files to the model.

## Quick Start

Install, run, and verify the application from the Next.js app directory:

```bash
cd repository-inspection
npm ci
npm run dev
```

Open `http://localhost:3000`.

Run the local quality checks:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Create `repository-inspection/.env` with:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5-nano
```

## Features

- Inspect a public GitHub repository by URL
- Inspect a local repository ZIP file
- Filter generated, dependency, binary, and sensitive files
- Detect repository structure and technology indicators
- Detect documentation, tests, CI/CD files, deployment files, and configuration files
- Generate an AI-assisted maintainability and quality report
- Include DORA-inspired delivery readiness signals
- Export reports as Markdown or JSON
- Print or save reports as PDF through the browser
- Store recent inspection reports locally in browser storage
- Reopen previous local reports from report history
- Run automated tests for filtering, summary generation, and API behavior
- Expose `/api/health` for lightweight deployment verification

## Experiment Context

The research goal is to explore whether an AI-assisted repository inspection tool can help developers understand existing projects faster and identify quality and maintainability issues more consistently.

The generated report focuses on:

- Project overview
- Repository structure
- Architecture clarity
- Code quality evidence
- Dependency and configuration health
- Documentation quality
- Testing evidence
- Maintainability risks
- Deployment readiness
- DORA-inspired delivery readiness
- Suggested improvements
- Prioritized action points

The DORA section does not claim to measure DORA metrics directly. It checks repository evidence that can support delivery readiness, such as CI workflows, test automation, deployment automation, documentation, and monitoring or recovery signals.

## Tech Stack

- Next.js
- React
- TypeScript
- CSS
- OpenAI API
- JSZip
- Vitest
- GitHub Actions
- Vercel

## Project Structure

```text
AI-Assisted-Repository-Inspection/
  README.md
  CONTRIBUTING.md
  docs/
    architecture.md
    operations.md
  .github/workflows/
    CI-pipeline.yml
    CD-pipeline.yml
  repository-inspection/
    app/
      api/
        github-summary/
        health/
        inspect/
        report/
      page.tsx
      globals.css
    lib/
      repository-summary.ts
    package.json
    vercel.json
```

The actual Next.js app lives in:

```text
repository-inspection/
```

## Local Setup

Install dependencies:

```bash
cd repository-inspection
npm install
```

Create a local environment file:

```text
repository-inspection/.env
```

Add your OpenAI API key:

```env
OPENAI_API_KEY=your_api_key_here
```

Optional model override:

```env
OPENAI_MODEL=gpt-5-nano
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## Scripts

Run linting:

```bash
npm run lint
```

Run tests:

```bash
npm test
```

Build for production:

```bash
npm run build
```

## Vercel Deployment

In Vercel, set the project Root Directory to:

```text
repository-inspection
```

Add this environment variable in Vercel:

```text
OPENAI_API_KEY
```

If using the included CD workflow with a deploy hook, add this GitHub repository secret:

```text
VERCEL_DEPLOY_HOOK_URL
```

The app avoids Vercel's request body limit for local ZIP inspection by scanning the ZIP in the browser and sending only the compact summary to the API route.

## Cost and Privacy Controls

The app is designed to keep OpenAI usage small:

- Maximum ZIP size: 60 MB
- Maximum scanned files: 2500
- Maximum file tree entries sent to AI context: 400
- Maximum compact AI context: 28000 characters
- One AI report request per inspection
- Default model: `gpt-5-nano`

The scanner excludes:

- `.git`
- `node_modules`
- `.next`
- `dist`
- `build`
- `target`
- `.env*`
- binary and media files
- minified and source map files

The OpenAI API key is never used in frontend code. It is read only from server-side environment variables.

## Operations and Recovery

The app includes a lightweight health check:

```text
GET /api/health
```

Use it after deployment to confirm the serverless app can respond before testing GitHub or OpenAI-dependent flows. Recovery steps and deployment verification notes are documented in `docs/operations.md`.

## CI/CD

The repository includes GitHub Actions workflows:

- CI: install dependencies, lint, typecheck, test, and build the app
- CD: trigger a Vercel deployment after successful CI on `main`

## Current Scope

In scope:

- ZIP upload inspection
- Public GitHub repository inspection
- Deterministic repository summary
- OpenAI-generated report
- DORA-inspired delivery readiness
- Local report history
- Markdown and JSON export
- Automated tests
- Vercel deployment
- Health check route and recovery notes

Out of scope:

- Private GitHub repositories
- GitHub OAuth
- Full static code analysis
- Full security scanning
- Dependency vulnerability scanning
- SonarQube-style complexity analysis
- Persistent database storage
- Multi-user report management

## Notes

This prototype supports software onboarding and maintainability review. It should not replace human code review. AI-generated findings are grounded in deterministic repository evidence, but they still require developer judgment.
