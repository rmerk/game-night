---
name: backpressure-gate
description: Run the pre-commit quality gate (tests + typecheck + lint). Use before committing to ensure all checks pass.
disable-model-invocation: true
---

# Backpressure Gate

Run all quality checks that must pass before committing.

## Steps

1. Run the three checks sequentially — stop on first failure:

```bash
pnpm test && pnpm run typecheck && vp lint
```

2. Report the result:
   - **All passed**: Confirm the gate is green and it's safe to commit.
   - **Failure**: Show which check failed, the relevant error output, and suggest a fix.
