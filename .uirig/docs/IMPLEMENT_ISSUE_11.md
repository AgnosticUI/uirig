# Implementation Plan: Issue #11 — Group Child Failures by Shared Parent (`--group-by-root`)

- **Issue:** `AgnosticUI/uirig#11` — `Root-Cause Grouping & Cascading Deduplication (--group-by-root)`
- **Branch:** `feat/issue-11-group-by-root`
- **Status:** In Progress (Chunks 0–1 Complete; Chunk 2 Next)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a `--group-by-root` CLI flag that collapses multiple child violations sharing the same enclosing Web Component host or parent container into **one root-cause violation** with `childCount` and `sampleChildren` details—shrinking `--json` payloads by 70–90% and preventing AI agents from wasting tokens patching symptoms instead of the parent cause.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold** (`docs(plan): add implementation plan and continuity capsule for issue #11 (--group-by-root)`)
- [x] **Chunk 1: Pure Parent Grouper Utility + 1-to-1 Unit Tests** (`feat(grouper): add parent container violation grouper and unit tests`)
- **Chunk 2: JSON Stream & Runner Integration**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`
  - **Action:**
    - Add optional `childCount?: number` and `sampleChildren?: Array<string>` fields to `IAgenticViolation` in `src/utils/agent-stream.ts`.
    - Update `formatAgenticJsonStream(report, options?: { top?: number; maxTokens?: number; groupByRoot?: boolean })` to run `groupViolationsByRootCause()` prior to priority sorting and `--top` / `--max-tokens` limits when `groupByRoot` is true.
    - Wire `groupByRoot?: boolean` into `ICheckCommandOptions` and `executeCheckCommand()` in `src/commands/check.ts` (printing a concise grouping summary in terminal output when enabled).
    - Output complete copy-pasteable files from line 1 to EOF (`src/utils/agent-stream.ts`, `src/commands/check.ts`, `tests/unit/agent-stream.test.ts`).
  - **Commit:** `feat(runner): integrate --group-by-root into JSON stream and check command`
- **Chunk 3: CLI Flag Parsing (`--group-by-root`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Commit:** `feat(cli): expose --group-by-root flag and update help output`
- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_11.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Commit:** `docs: document --group-by-root flag and update session continuity capsule`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#11`)
- [x] `groupViolationsByRootCause()` collapses cascading contrast, token, and overflow violations under their shared parent container or Web Component host.
- [x] Collapsed violations include `childCount` and up to 3 `sampleChildren` selectors, while singletons remain untouched.
- Integrated into `formatAgenticJsonStream()` and `executeCheckCommand()`.
- CLI flag `--group-by-root` wired in `src/index.ts` with 1-to-1 unit tests and synced docs (`README.md`, `AGENTS.md`).
