# Operations and Recovery

This document captures the lightweight monitoring and recovery approach for the repository inspection prototype.

## Health Check

The application exposes:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "service": "repository-inspection",
  "checkedAt": "ISO timestamp"
}
```

Use this route to confirm that the deployed Next.js serverless functions can respond.

## Deployment Verification

After a Vercel deployment:

1. Open the deployed app URL.
2. Check `/api/health`.
3. Run a small public GitHub repository inspection.
4. Confirm the report includes deterministic evidence, DORA-inspired readiness, and best-practice recommendations.

## Recovery Checklist

If inspection fails in production:

1. Check Vercel deployment logs for API route errors.
2. Confirm `OPENAI_API_KEY` exists in Vercel environment variables.
3. Confirm the Vercel project root directory is `repository-inspection`.
4. Test `/api/health` to separate app availability from OpenAI or GitHub failures.
5. Re-run GitHub Actions CI to verify lint, typecheck, tests, and build.

## Known Limits

- Private GitHub repositories are out of scope.
- The app does not persist reports in a database.
- The app does not perform full static analysis, vulnerability scanning, or DORA metric measurement.
- AI-generated findings are grounded in deterministic repository evidence but still need human judgment.
