# Implementation Plan: Issue #11 — Group Child Failures by Shared Parent (`--group-by-root`)

- **Issue:** `AgnosticUI/uirig#11` — `Root-Cause Grouping & Cascading Deduplication (--group-by-root)`
- **Branch:** `feat/issue-11-group-by-root`
- **Status:** Planned (Chunk 0 — No code written yet)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a `--group-by-root` CLI flag that collapses multiple child violations sharing the same offending parent container, Web Component host (`hostComponent`), or CSS surface into **one root-cause violation** with `childCount` and `sampleChildren` details—shrinking `--json` payloads by 70–90% and preventing AI agents from wasting tokens patching symptoms instead of the parent cause.

### Target CLI & JSON Behavior
- **CLI flag (supported on `check`, standalone subcommands, and `uirig <url-or-file>`):**
  - `--group-by-root` (boolean flag, default `false`)
- **JSON stream output (`IAgenticViolation` in `src/utils/agent-stream.ts`):**
  - When `--group-by-root` collapses 2 or more child violations under a shared parent:
    - `selector` is promoted to the shared parent container / Web Component host (e.g., `ag-card#pricing` or `div.card-grid`)
    - `childCount`: total number of collapsed child failures under that parent
    - `sampleChildren`: up to 3 representative child selectors that failed (e.g., `["ag-card#pricing >> shadow-root >> h3", "ag-card#pricing >> shadow-root >> p"]`)
    - `remediationAdvice`: updated to note that fixing the parent container resolves all `childCount` child failures
- **Terminal console output (`src/commands/check.ts`):**
  - When `--group-by-root` is enabled and collapses violations, print a short summary line showing how many child violations were grouped into root causes.

### Out of Scope
- Priority sorting and `--top` / `--max-tokens` limits (already shipped in Issue #15; `--group-by-root` runs *before* priority sorting and `--top` / `--max-tokens` so limits count root causes rather than duplicate child symptoms).
- Automatic code patching (covered by Issue #13 `--fix`).

---

## 2. How Parent Grouping Works (Plain-English Rules)

After `normalizeViewportViolations()` produces individual `IAgenticViolation` items (before `deduplicateAgenticViolations()`), `--group-by-root` groups violations that share:
1. **Same Audit Context:** `(url, viewport, engine, violationType)`
2. **Same Shared Parent Key** (resolved in priority order):
   - **Rule A — Web Component Host (`hostComponent`):** If `hostComponent` is non-null (e.g., `ag-card`), all violations of the same `(engine, violationType)` inside that component share the parent key `host:<hostComponent>` (or the host selector prefix before `>> shadow-root >>`, e.g., `ag-card#pro`).
   - **Rule B — Stress Container (`relatedSelector` / parent path):** For `container_overflow` or parent-scoped layout breaks, group by the parent container path (everything before the final ` > ` child segment, or the explicit parent container).
   - **Rule C — Shared Background / Surface Contrast (`contrast` / `dark-mode`):** When multiple text elements inside the same parent container path (prefix before the final ` > ` segment) fail with the exact same background color (`bg rgb(...)` in `measuredDelta`), collapse them under that shared parent container.
3. **Singletons Stay Untouched:** If a parent group only has 1 violation (`childCount === 1`), keep the original violation untouched without adding `childCount`.
---

## 3. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon passing `npm run build && npm run typecheck:all && npm test`, followed by updating this checklist and `.uirig/docs/NEXT_PROMPT.md`.

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_11.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-11-group-by-root`, save this implementation plan, and initialize the continuity capsule.
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #11 (--group-by-root)`

- **Chunk 1: Pure Parent Grouper Utility + 1-to-1 Unit Tests**
  - **Files:** `src/utils/root-cause-grouper.ts`, `tests/unit/root-cause-grouper.test.ts`
  - **Action:**
    - Implement `extractParentContainerSelector(selector)` to extract the enclosing Web Component host (before `>> shadow-root >>`) or immediate parent container (before the last ` > `).
    - Implement `groupViolationsByRootCause(violations)` that collapses 2+ child violations sharing `(url, viewport, engine, violationType, parentKey)` into 1 parent violation with `childCount` and `sampleChildren` (up to 3), while leaving singletons untouched.
    - Write complete 1-to-1 unit tests in `tests/unit/root-cause-grouper.test.ts` covering Shadow DOM host grouping, light-DOM parent container grouping, distinct background/engine isolation, and single-item pass-through.
  - **Commit:** `feat(grouper): add parent container violation grouper and unit tests`

- **Chunk 2: JSON Stream & Runner Integration**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`
  - **Action:**
    - Add optional `childCount?: number` and `sampleChildren?: Array<string>` fields to `IAgenticViolation` in `src/utils/agent-stream.ts`.
    - Update `formatAgenticJsonStream(report, options?: { top?: number; maxTokens?: number; groupByRoot?: boolean })` to run `groupViolationsByRootCause()` prior to priority ranking and `--top` / `--max-tokens` limits when `groupByRoot` is true.
    - Wire `groupByRoot?: boolean` into `ICheckCommandOptions` and `executeCheckCommand()` in `src/commands/check.ts` (printing a concise grouping summary in terminal output when enabled).
    - Output full copy-pasteable files (`src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`) with unit tests verifying `--group-by-root` + `--top` interaction.
  - **Commit:** `feat(runner): integrate --group-by-root into JSON stream and check command`

- **Chunk 3: CLI Flag Parsing (`--group-by-root`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Action:**
    - Parse `--group-by-root` boolean flag in `parseAuditCommandArgs()` and forward `groupByRoot` to `executeCheckCommand()` in `runCli()`.
    - Document `--group-by-root` in `SHARED_AUDIT_OPTIONS`, `CLI_HELP_TEXT`, and subcommand examples.
    - Output complete copy-pasteable `src/index.ts` and `tests/unit/index.test.ts` covering default `groupByRoot: false`, `--group-by-root` flag parsing, and `--help` output.
  - **Commit:** `feat(cli): expose --group-by-root flag and update help output`

- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_11.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document `--group-by-root` in `README.md` and `AGENTS.md` (outputting both files in full from line 1 to EOF).
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_11.md` and point `.uirig/docs/NEXT_PROMPT.md` to the next roadmap issue (`#17` Web Component `<slot>` & Content-Model Integrity).
  - **Commit:** `docs: document --group-by-root flag and update session continuity capsule`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#11`)
- `--group-by-root` collapses cascading contrast, token, and overflow violations under their shared parent container or Web Component host.
- Collapsed violations include `childCount` and up to 3 `sampleChildren` selectors.
- Singletons (`childCount === 1`) remain untouched.
- Works seamlessly alongside `--top`, `--max-tokens`, and `--spatial-brief`.
- All unit tests pass with zero `any` or `@ts-ignore`.
