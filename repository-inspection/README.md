# Repository Inspection App

This is the Next.js application for the AI-Assisted Repository Inspection experiment.

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

## Setup

Install dependencies:

```bash
npm ci
```

Create a local `.env` file:

```env
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-5-nano
```

## Run Locally

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Test and Quality Checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Deployment

The Vercel project root directory should be `repository-inspection`. Add `OPENAI_API_KEY` in Vercel project environment variables.

The `/api/health` route can be used as a lightweight deployment health check.
