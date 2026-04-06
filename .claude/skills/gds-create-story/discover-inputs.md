# Discover Inputs Protocol

**Objective:** Intelligently load project files (whole or sharded) based on the workflow's Input Files configuration.

**Prerequisite:** Only execute this protocol if the workflow defines an Input Files section. If no input file patterns are configured, skip this entirely.

**Token-efficiency principle:** Prefer claude-mem structural tools (`smart_outline`, `smart_search`) over full file reads. Full file reads are token-heavy and should be a last resort when the structural view is insufficient.

---

## Step 1: Parse Input File Patterns

- Read the Input Files table from the workflow configuration.
- For each input group (prd, architecture, epics, ux, etc.), note the **load strategy** if specified.

## Step 2: Load Files Using Smart Strategies

For each pattern in the Input Files table, work through the following substeps in order:

### 2a: Structural Discovery First (claude-mem)

Before loading any file fully, use claude-mem tools to understand what exists and what's relevant:

1. **`smart_search`** — Search for the input group name (e.g., "architecture", "epics", "ux") scoped to the planning artifacts directory. This finds relevant files and shows their structural context with minimal tokens.
2. **`smart_outline`** — For each discovered file, get a structural outline (headings, sections, exports) to assess relevance before committing to a full read.
3. If the structural view provides sufficient context for the workflow's needs, store the result in `{pattern_name_content}` and mark as **RESOLVED**. Move to the next pattern.
4. If the structural view is insufficient (e.g., you need exact acceptance criteria text, specific schema definitions, or verbatim requirements), proceed to Step 2b for targeted full loading.

### 2b: Targeted Full Loading

Only when structural views from Step 2a are insufficient, load files with the appropriate strategy:

#### FULL_LOAD Strategy

Load ALL files in the sharded directory. Use this for PRD, Architecture, UX, brownfield docs, or whenever the full picture is needed.

1. Use the glob pattern to find ALL `.md` files (e.g., `{planning_artifacts}/*architecture*/*.md`).
2. Load EVERY matching file completely.
3. Concatenate content in logical order: `index.md` first if it exists, then alphabetical.
4. Store the combined result in a variable named `{pattern_name_content}` (e.g., `{architecture_content}`).

#### SELECTIVE_LOAD Strategy

Load a specific shard using a template variable. Example: used for epics with `{{epic_num}}`.

1. Check for template variables in the sharded pattern (e.g., `{{epic_num}}`).
2. If the variable is undefined, ask the user for the value OR infer it from context.
3. Resolve the template to a specific file path.
4. Load that specific file.
5. Store in variable: `{pattern_name_content}`.

#### INDEX_GUIDED Strategy

Load index.md, analyze the structure and description of each doc in the index, then intelligently load relevant docs.

**DO NOT BE LAZY** -- use best judgment to load documents that might have relevant information, even if there is only a 5% chance of relevance.

1. Load `index.md` from the sharded directory.
2. Parse the table of contents, links, and section headers.
3. Analyze the workflow's purpose and objective.
4. Identify which linked/referenced documents are likely relevant.
   - *Example:* If the workflow is about authentication and the index shows "Auth Overview", "Payment Setup", "Deployment" -- load the auth docs, consider deployment docs, skip payment.
5. Load all identified relevant documents.
6. Store combined content in variable: `{pattern_name_content}`.

**When in doubt, LOAD IT** -- context is valuable, and being thorough is better than missing critical info.

---

After applying the matching strategy, mark the pattern as **RESOLVED** and move to the next pattern.

### 2c: Try Whole Document if No Sharded Found

If no sharded matches were found OR no sharded pattern exists for this input:

1. Attempt a glob match on the "whole" pattern (e.g., `{planning_artifacts}/*prd*.md`).
2. If matches are found, use `smart_outline` first to assess relevance and size. Only load files fully when the structural view is insufficient.
3. Store content in variable: `{pattern_name_content}` (e.g., `{prd_content}`).
4. Mark pattern as **RESOLVED** and move to the next pattern.

### 2d: Handle Not Found

If no matches were found via claude-mem tools, glob, or whole patterns:

1. Use `smart_search` with broader terms as a final attempt to locate the content elsewhere in the project.
2. If still not found, set `{pattern_name_content}` to empty string.
3. Note in session: "No {pattern_name} files found" -- this is not an error, just unavailable. Offer the user a chance to provide the file.

## Step 3: Report Discovery Results

List all loaded content variables with file counts and method used. Example:

```
OK Loaded {prd_content} from smart_outline: 5 sharded files (structural view sufficient)
OK Loaded {architecture_content} from full read: Architecture.md (needed verbatim specs)
OK Loaded {epics_content} from selective load: epics/epic-3.md
-- No ux_design files found (smart_search fallback also returned no results)
```

This gives the workflow transparency into what context is available and how tokens were spent.
