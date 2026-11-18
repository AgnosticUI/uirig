# Implementation Plan: Issue #11 — Group Child Failures by Shared Parent (`--group-by-root`)

- **Issue:** `AgnosticUI/uirig#11` — `Root-Cause Grouping & Cascading Deduplication (--group-by-root)`
- **Branch:** `feat/issue-11-group-by-root`
- **Status:** In Progress (Chunks 0–2 Complete; Chunk 3 Next)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a `--group-by-root` CLI flag that collapses multiple child violations sharing the same enclosing Web Component host or parent container into **one root-cause violation** with `childCount` and `sampleChildren` details—shrinking `--json` payloads by 70–90% and preventing AI agents from wasting tokens patching symptoms instead of the parent cause.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold** (`docs(plan): add implementation plan and continuity capsule for issue #11 (--group-by-root)`)
- [x] **Chunk 1: Pure Parent Grouper Utility + 1-to-1 Unit Tests** (`feat(grouper): add parent container violation grouper and unit tests`)
- [x] **Chunk 2: JSON Stream & Runner Integration** (`feat(runner): integrate --group-by-root into JSON stream and check command`)
- **Chunk 3: CLI Flag Parsing (`--group-by-root`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Action:**
    - Parse `--group-by-root` boolean flag in `parseAuditCommandArgs()` and forward `groupByRoot` to `executeCheckCommand()` in `runCli()`.
    - Document `--group-by-root` in `SHARED_AUDIT_OPTIONS`, `CLI_HELP_TEXT`, and subcommand examples.
    - Output complete copy-pasteable `src/index.ts` and `tests/unit/index.test.ts` from line 1 to EOF covering default `groupByRoot: false`, `--group-by-root` flag parsing, and `--help` output.
  - **Commit:** `feat(cli): expose --group-by-root flag and update help output`
- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_11.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Commit:** `docs: document --group-by-root flag and update session continuity capsule`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#11`)
- [x] `groupViolationsByRootCause()` collapses cascading contrast, token, and overflow violations under their shared parent container or Web Component host.
- [x] Collapsed violations include `childCount` and up to 3 `sampleChildren` selectors, while singletons remain untouched.
- [x] Integrated into `formatAgenticJsonStream()` and `executeCheckCommand()`.
- CLI flag `--group-by-root` wired in `src/index.ts` with 1-to-1 unit tests and synced docs (`README.md`, `AGENTS.md`).
