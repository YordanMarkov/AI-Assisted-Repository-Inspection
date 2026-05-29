# Contributing

This repository is an experiment project, but contributions should still be easy to review and verify.

## Local Quality Checks

Run these commands from the app directory before opening a pull request:

```bash
cd repository-inspection
npm ci
npm run lint
npm run typecheck
npm test
npm run build
```

## Pull Request Expectations

- Explain the user-facing change or quality improvement.
- Mention any affected API routes, report schema fields, or scanner rules.
- Include test evidence in the pull request description.
- Keep generated files, secrets, `.env` files, and local build output out of commits.

## Commit Style

Use descriptive commit messages that make the change reviewable from history.

Good examples:

- Add health endpoint and recovery documentation
- Improve nested source folder detection
- Add typecheck to CI quality gates

Avoid vague messages such as `update`, `fix stuff`, or `changes`.
