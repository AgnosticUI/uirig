# Implementation Plan: Issue #15 — Violation Priority Ranking & Output Limits (`--top` / `--max-tokens`)

- **Issue:** `AgnosticUI/uirig#15` — `Token-Budgeted & Priority-Ranked Output (--top / --max-tokens)`
- **Branch:** `feat/issue-15-token-budget`
- **Status:** In Progress (Chunks 0–3 Complete; Chunk 4 Final Docs Sync Next)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Rank violations from most important to least important and let users limit output size with `--top <n>` and `--max-tokens <budget>` so AI coding agents fix the biggest page-breaking issues first without overflowing their prompt window or receiving broken JSON.

---

## 2. How Violation Priority Ranking Works

1. **Category Base Score (Primary Rank):**
   - **100 pts — Page Jumps & JS Crashes (`cls`, `runtime`)**
   - **80 pts — Layout Breaks & Tiny Tap Targets (`stress`)**
   - **70 pts — Hidden Prompt-Injection Text (`dom` security rule)**
   - **60 pts — Unreadable Text (`contrast`, `dark-mode`)**
   - **40 pts — Off-Scale Styling (`tokens`)**
   - **20 pts — HTML & Link Cleanup (`dom`)**
2. **Repeat-Count Tie-Breaker (`occurrenceCount`):** Adds up to `+19` bonus points (`Math.min(occurrenceCount - 1, 19)`).
3. **Predictable Tie-Breaker:** Alphabetical by `(viewport, selector, violationType)`.

---

## 3. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold** (`docs(plan): add implementation plan and continuity capsule for issue #15 (--top / --max-tokens)`)
- [x] **Chunk 1: Violation Priority Sorter & Output Limiter + Unit Tests** (`feat(budget): add violation priority sorter and token-budget limiter with unit tests`)
- [x] **Chunk 2: JSON Stream & Console Report Ranking Integration** (`feat(runner): integrate violation priority ranking and --top / --max-tokens limits into JSON stream and check command`)
- [x] **Chunk 3: CLI Flag Parsing (`--top` / `--max-tokens`), Subcommand `--help` & Unit Tests** (`feat(cli): expose --top and --max-tokens flags with validation and help docs`)
- **Chunk 4: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_15.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Commit:** `docs: document --top and --max-tokens flags and update session continuity capsule`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#15`)
- [x] Violations rank deterministically from highest page impact (`cls` / `runtime` = 100) to lowest (`dom` = 20), with repeat-count tie-breaking.
- [x] `--top <n>` returns at most `n` violations plus `totalViolations` and `truncatedCount` metadata when trimmed.
- [x] `--max-tokens <budget>` keeps serialized JSON output within the estimated token limit without ever producing broken JSON.
- [x] Invalid flag values (`--top=0`, `--top=-3`, `--max-tokens=abc`) fail fast with POSIX exit code `1` and a clear CLI error message.
- All unit tests pass and documentation is synced (`README.md`, `AGENTS.md`).
