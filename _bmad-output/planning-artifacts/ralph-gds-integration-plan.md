# GDS Autonomous Loop (Ralph-Inspired)

## Context

The mahjong-game project has Epic 1 complete (162 tests, Story 2-1 done) and uses the BMad GDS workflow with three skills: `gds-create-story`, `gds-dev-story`, `gds-code-review`. This plan describes how to run these autonomously in a bash loop — one phase per story per iteration, fresh context each time — inspired by Ralph's loop mechanics but driven by GDS's sprint-status.yaml and story files.

This is NOT a pure Ralph implementation. It borrows Ralph's best operational ideas (autonomous loop, subagent context management, "don't assume not implemented", backpressure) while keeping GDS as the task engine. Two waves of expert review validated this approach.

## Architecture

### Files Created

| File | Purpose |
|------|---------|
| `loop.sh` | Bash orchestration — modes: create/build/review/auto, max iteration support |
| `PROMPT_auto.md` | Primary prompt — phase detection + all three phases |
| `PROMPT_create.md` | Manual create-story mode |
| `PROMPT_build.md` | Manual dev-story mode |
| `PROMPT_review.md` | Manual code-review mode |
| `AGENTS.md` (modified) | Appended Ralph operational section (~15 lines) |

### State Machine

```
BACKLOG → (create) → READY-FOR-DEV → (build Step 4) → IN-PROGRESS → (build Step 9) → REVIEW
                                                            ↑                            │
                                                            │    (review finds issues)    │
                                                            └────────────────────────────┘
                                                                                         │
                                                              (review clean) → DONE
```

### Phase Detection Priority (PROMPT_auto.md)

1. Story in `review` → run code-review (close feedback loops first)
2. Story in `in-progress` → run dev-story (resume work / fix review items)
3. Story in `ready-for-dev` → run dev-story (implement next story)
4. Story in `backlog` → run create-story (create next story spec)
5. All done → exit

### Review Feedback Loop

When code-review finds issues, it always chooses option 2 (create action items):
1. Review creates `[AI-Review][severity]` tasks → status: `review` → `in-progress`
2. Next iteration: dev-story Step 3 detects review continuation, prioritizes review items
3. Dev fixes items, dual-marks in both Review Follow-ups and Action Items sections
4. Story returns to `review` → next iteration reviews again
5. Convergence guard: warning after 3+ review cycles on same story

### Key Ralph Concepts Adopted

- **Autonomous bash loop** — one phase per iteration, fresh context each time
- **Subagent context management** — main agent as scheduler, fan out to Sonnet subagents
- **"Don't assume not implemented"** — guardrail 99999, search before writing
- **`@` file reference syntax** — `Study @AGENTS.md` inlines files into context
- **999-numbered guardrails** — escalating criticality for invariants
- **Backpressure** — `pnpm -r test && pnpm run typecheck && vp lint` before every commit
- **`--output-format stream-json`** — structured logging for debugging autonomous runs

### Key Ralph Concepts NOT Adopted

- **`specs/` directory** — GDS story files serve as implementation specs
- **`IMPLEMENTATION_PLAN.md`** — sprint-status.yaml tracks story lifecycle
- **Gap analysis planning mode** — GDS create-story handles context analysis
- **"Start AGENTS.md empty"** — project already has established patterns from Epic 1

## Per-Epic Workflow

```bash
git checkout -b epic-2/card-rules-validation
./loop.sh auto          # runs until all stories done or HALT
# Monitor: git log, sprint-status.yaml
git checkout main && git merge epic-2/card-rules-validation
```

### Operator Role

Watch the first 2-3 iterations closely. Check git log for sensible commits. If the agent generates wrong patterns, add code utilities or update AGENTS.md Learnings to steer correction. Tune reactively based on observed failures.

### Sandboxing

`--dangerously-skip-permissions` grants full access. For autonomous unattended runs, consider running inside Docker or a VM to limit blast radius. Ensure no production credentials are accessible from the dev environment.

### When to Intervene

- Review→fix cycle exceeds 3 iterations for the same story
- HALT condition triggered (3 consecutive failures, missing config, unauthorized deps)
- `git push` fails (merge conflict or network issue)
- Sprint-status.yaml gets corrupted or out of sync with story files
