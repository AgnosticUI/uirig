# Implementation Plan: Issue #15 — Violation Priority Ranking & Output Limits (`--top` / `--max-tokens`)

- **Issue:** `AgnosticUI/uirig#15` — `Token-Budgeted & Priority-Ranked Output (--top / --max-tokens)`
- **Branch:** `feat/issue-15-token-budget`
- **Status:** In Progress (Chunks 0–1 Complete; Chunk 2 Next)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Rank violations from most important to least important and let users limit output size with `--top <n>` and `--max-tokens <budget>` so AI coding agents fix the biggest page-breaking issues first without overflowing their prompt window or receiving broken JSON.

### Target CLI & JSON Behavior
- **CLI flags (supported on `check`, standalone subcommands, and `uirig <url-or-file>`):**
  - `--top=<n>` / `--top <n>` (positive integer, e.g., `--top=5`)
  - `--max-tokens=<budget>` / `--max-tokens <budget>` (positive integer, e.g., `--max-tokens=1200`)
- **JSON stream output (`IAgenticJsonStreamPayload` in `src/utils/agent-stream.ts`):**
  - `violations` is always ranked from highest priority to lowest (even when `--top` / `--max-tokens` are not passed).
  - Whenever violations are trimmed (`truncatedCount > 0`), include top-level fields:
    - `totalViolations`: total unique violations before trimming
    - `truncatedCount`: how many lower-priority violations were omitted
- **Terminal console output (`src/commands/check.ts`):**
  - When `--top` or `--max-tokens` trims the list, print a short summary line (e.g., `Showing top 5 of 24 violations (19 omitted; re-run without --top/--max-tokens to see all).`).

### Out of Scope
- Grouping child failures under a shared parent element (Issue #11 `--group-by-root`).
- Auto-fix diff generation (Issue #13 `--fix` / `jsonPatch`).

---

## 2. How Violation Priority Ranking Works

Violations are ranked using a simple 100-down-to-20 point scale so the most disruptive bugs always appear first:

1. **Category Base Score (Primary Rank):**
   - **100 pts — Page Jumps & JS Crashes (`cls`, `runtime`):** Fix these first because moving elements or broken scripts invalidate everything else on the page.
   - **80 pts — Layout Breaks & Tiny Tap Targets (`stress`):** Horizontal scrollbars, clipped containers, squished avatars, and `<24px` interactive targets.
   - **70 pts — Hidden Prompt-Injection Text (`dom` security rule):** Security traps hidden in the DOM.
   - **60 pts — Unreadable Text (`contrast`, `dark-mode`):** Low WCAG text contrast and stranded bright surfaces in dark mode.
   - **40 pts — Off-Scale Styling (`tokens`):** Hardcoded colors, spacing, font sizes, or radii instead of design tokens.
   - **20 pts — HTML & Link Cleanup (`dom`):** Missing `alt` attributes, broken ARIA IDs, and link hygiene.
2. **Repeat-Count Tie-Breaker (`occurrenceCount`):**
   - Adds up to `+19` bonus points (`Math.min(occurrenceCount - 1, 19)`) so a bug repeating across 12 cards ranks ahead of a single-element bug in the same category without jumping over a higher category.
3. **Predictable Tie-Breaker:**
   - Ties on total points sort alphabetically by `(viewport, selector, violationType)`.

### Safe Token Limiting (`--max-tokens`)
- Estimates token count at roughly 1 token per 4 characters (`Math.ceil(chars / 4)`).
- Packs whole serialized violation objects one by one until adding the next object would exceed `maxTokens`, guaranteeing **100% valid JSON** every time.

---

## 3. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_15.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #15 (--top / --max-tokens)`

- [x] **Chunk 1: Violation Priority Sorter & Output Limiter + Unit Tests**
  - **Files:** `src/utils/violation-budget.ts`, `tests/unit/violation-budget.test.ts`
  - **Commit:** `feat(budget): add violation priority sorter and token-budget limiter with unit tests`

- **Chunk 2: JSON Stream & Console Report Ranking Integration**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`
  - **Action:**
    - Update `formatAgenticJsonStream(report, options?: { top?: number; maxTokens?: number })` to always rank violations by priority, apply `--top` / `--max-tokens` limits, and include `totalViolations` + `truncatedCount` on `IAgenticJsonStreamPayload` when trimmed.
    - Wire `top?: number` and `maxTokens?: number` into `ICheckCommandOptions` and `executeCheckCommand()` in `src/commands/check.ts`, printing a clear notice in terminal output when violations are omitted.
    - Add unit tests in `tests/unit/agent-stream.test.ts` verifying priority ranking order, `totalViolations` / `truncatedCount` fields, and valid `JSON.parse()` output under tight `--max-tokens` limits.
  - **Commit:** `feat(runner): integrate violation priority ranking and --top / --max-tokens limits into JSON stream and check command`

- **Chunk 3: CLI Flag Parsing (`--top` / `--max-tokens`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Action:**
    - Parse `--top=<n>` / `--top <n>` and `--max-tokens=<budget>` / `--max-tokens <budget>` (validating positive integers and returning `unknown` with a clear error message on invalid values).
    - Forward `top` and `maxTokens` into `executeCheckCommand()` in `runCli()`.
    - Document `--top=<n>` and `--max-tokens=<budget>` in `SHARED_AUDIT_OPTIONS`, `CLI_HELP_TEXT`, and subcommand examples.
    - Update `tests/unit/index.test.ts` for default `top: undefined, maxTokens: undefined`, valid flag parsing, invalid value errors, and `--help` text.
  - **Commit:** `feat(cli): expose --top and --max-tokens flags with validation and help docs`

- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_15.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document `--top=<n>` and `--max-tokens=<budget>` in `README.md` and `AGENTS.md`.
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_15.md` and update `.uirig/docs/NEXT_PROMPT.md` for the next issue.
  - **Commit:** `docs: document --top and --max-tokens flags and update session continuity capsule`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#15`)
- [x] Violations rank deterministically from highest page impact (`cls` / `runtime` = 100) to lowest (`dom` = 20), with repeat-count tie-breaking.
- `--top <n>` returns at most `n` violations plus `totalViolations` and `truncatedCount` metadata when trimmed.
- `--max-tokens <budget>` keeps serialized JSON output within the estimated token limit without ever producing broken JSON.
- Invalid flag values (`--top=0`, `--top=-3`, `--max-tokens=abc`) fail fast with POSIX exit code `1` and a clear CLI error message.
- All unit tests pass with zero `any` or `@ts-ignore`.
