# Implementation Plan: Issue #13 — Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`)

- **Issue:** `AgnosticUI/uirig#13` — `Deterministic Auto-Fix Patch Generation (--fix / jsonPatch)`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Track:** Track B (Source-Code Auto-Fix Path)
- **Depends on:** `AgnosticUI/uirig#9` (`sourceFile` and `lineNumber` attribution)
- **Branch:** `feat/issue-13-autofix-patches`
- **Status:** Complete (Chunks 0–3 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Generate deterministic unified diffs (`unifiedDiff`) in `--json` output and support direct file patching + re-verification via `--fix` for unambiguous, 1-to-1 violations when `sourceFile` and `lineNumber` (from Issue `#9`) are resolved inside `cwd`.

### Eligible Deterministic Fix Rules (Zero Ambiguity Only)
1. **Token Drift (`tokens`):** Replace an exact hardcoded CSS declaration value (e.g., `color: #3b82f6;`) on `sourceFile:lineNumber` with `var(--token-name)`.
2. **Contrast / Dark-Mode Color (`contrast`, `dark-mode`):** Replace a single CSS color literal on `sourceFile:lineNumber` with `var(--suggested-token)` when `suggestedToken` is resolved.
3. **Missing `alt=""` (`dom` -> `broken_image`):** Insert `alt=""` on an `<img>` tag at `sourceFile:lineNumber` when `alt` is omitted.
4. **Unsafe `javascript:` URI (`dom` -> `unsafe_uri`):** Replace `href="javascript:..."` on an `<a>` tag at `sourceFile:lineNumber` with `href="#"`.

### Safety Guardrails
- **Never Guess Ambiguous Fixes:** Structural layout violations (`stress`, `cls`), multi-match lines, minified files, or violations without a verified local `sourceFile` inside `cwd` emit `unifiedDiff: null` and are never modified on disk.
- **Read-Only by Default:** `--json` emits `unifiedDiff` without touching disk; files are modified on disk **only** when `--fix` is explicitly passed, followed by an automatic re-audit pass.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_13.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-13-autofix-patches` after `#9` merges and mark `#13` active in `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #13 (--fix / unifiedDiff)`

- [x] **Chunk 1: Deterministic Patch Generator (`src/core/autofix.ts`) & Unit Tests**
  - **Files:** `src/core/autofix.ts`, `tests/unit/autofix.test.ts`
  - **Action:**
    - Implement `computeDeterministicAutoFix()` and `applyDeterministicAutoFixes()` in `src/core/autofix.ts`.
    - Add unit tests in `tests/unit/autofix.test.ts` covering valid unified diff generation, safe disk patching, and refusal on ambiguous/structural/out-of-workspace violations.
  - **Commit:** `feat(autofix): add deterministic unifiedDiff generator for unambiguous token and DOM fixes`

- [x] **Chunk 2: `--fix` Disk Applier, Re-Verification Loop & CLI/Agent-Stream Wiring**
  - **Files:** `src/utils/agent-stream.ts`, `src/commands/check.ts`, `src/index.ts`, `tests/unit/autofix.test.ts`
  - **Action:**
    - Attach `unifiedDiff: string | null` to `IAgenticViolation` in `src/utils/agent-stream.ts` when resolvable.
    - Wire `--fix` in `src/index.ts` and `ICheckCommandOptions` (`src/commands/check.ts`): apply non-overlapping deterministic patches to disk and re-run the audit pass to confirm `exitCode === 0`.
    - Add E2E tests in `tests/unit/autofix.test.ts` verifying `--json` emits `unifiedDiff` without modifying files, while `--fix` patches the file and passes re-verification.
  - **Commit:** `feat(cli): wire --fix patch application and re-verification loop into check`

- [x] **Chunk 3: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_13.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Document `unifiedDiff` and `--fix` in `README.md` and `AGENTS.md`, run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#13`.
  - **Commit:** `docs(autofix): document unifiedDiff output and --fix CLI flag (#13)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#13`)
- [x] `--json` emits a valid `unifiedDiff` for unambiguous token and DOM hygiene violations when `sourceFile` and `lineNumber` are resolved.
- [x] `--fix` cleanly patches target files on disk and re-verifies zero regressions.
- [x] Ambiguous structural/layout violations (`stress`, `cls`) and out-of-workspace files never generate or apply unsafe auto-fixes.
- [x] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
