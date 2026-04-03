# Context Curation Guide

How the controller extracts and curates context from the story file for each
subagent type. The controller's primary job is ensuring each subagent gets
exactly what it needs — no more, no less.

## Principle: Curate, Don't Dump

Each subagent should receive the minimum context needed to do its job well.
Dumping the full story file into every subagent recreates the context bloat
problem that this architecture is designed to solve.

## Per-Task Context Extraction

For each task in the story's Tasks/Subtasks section:

### 1. Task Text (verbatim)
- Copy the full task line and ALL subtask lines (including checkboxes)
- Include file paths, prop signatures, behavioral guards — everything
- Do NOT summarize or paraphrase

### 2. Acceptance Criteria (subset)
- Read the AC numbers in parentheses after the task title (e.g., "AC: 2, 3")
- Copy ONLY those numbered ACs from the Acceptance Criteria section
- Include the full AC text with Given/When/Then and reference tags

### 3. Dev Notes (curated subset)
Select ONLY relevant sections from Dev Notes:

| Dev Notes Section | Include When |
|-------------------|-------------|
| Architecture Patterns | Always |
| Component File Placement | Task creates new files |
| Existing Code To Reuse | Task integrates with existing components |
| Key Protocol Types | Task consumes or produces protocol types |
| Relevant Resolved Actions | Task handles game actions/events |
| Testing Standards | Always |
| Previous Story Intelligence | Task touches area with known pitfalls |
| Scope Boundaries | Task is near a scope boundary |

**Never include for implementer:** Execution Gate, Git Intelligence, full
References section.

### 4. Gotchas (filtered)
- Read each gotcha and evaluate: does this gotcha relate to the files,
  components, or behaviors this task touches?
- Include only matching gotchas
- Example: Task creating `useTileSelection` needs gotchas about rackStore
  separation and DnD coexistence. It does NOT need gotchas about vote
  prompts or courtesy pass blind tiles.

### 5. Project Conventions (static)
Always include the same conventions block (from CLAUDE.md).

## Subagent Context Matrix

| Context Piece | Implementer | Spec Reviewer | Quality Reviewer | DoD Reviewer |
|---------------|:-----------:|:-------------:|:----------------:|:------------:|
| Task text (verbatim) | Yes | Yes | via diff | Yes (all tasks) |
| Mapped ACs | Yes | Yes | via requirements | Yes (all ACs) |
| Dev Notes (curated) | Yes | No | No | No |
| Gotchas (filtered) | Yes | No | No | No |
| Project conventions | Yes | No | Yes (in criteria) | No |
| Implementer's report | No | Yes | Yes (summary) | No |
| Git SHAs (base/head) | No | No | Yes | No |
| Full story file | No | No | No | Yes |
| DoD checklist | No | No | No | Yes |

## Review Continuation Context

When the story has a "Senior Developer Review (AI)" section (review continuation):
- Extract review findings as individual fix tasks
- Each finding becomes a task dispatched to a fix implementer subagent
- The finding text IS the task spec (what to fix and why)
- Include the relevant code file path and the original AC it relates to
- After fix, run normal two-stage review (spec then quality)

## Model Selection Guidance

| Task Characteristics | Recommended Model |
|---------------------|-------------------|
| Single file, clear spec, isolated logic | haiku |
| New composable/component with props/emits | sonnet |
| Multi-file integration, store wiring | sonnet |
| Cross-cutting concerns, architecture decisions | opus |
| Spec reviewer (any task) | sonnet |
| Code quality reviewer (any task) | sonnet |
| DoD reviewer | opus |
