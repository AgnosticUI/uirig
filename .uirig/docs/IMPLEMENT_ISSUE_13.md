# Implementation Plan: Issue #13 — Deterministic Auto-Fix Patch Generation (`--fix` / `jsonPatch`)

- **Issue:** `AgnosticUI/uirig#13` — `Deterministic Auto-Fix Patch Generation (--fix / jsonPatch)`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Track:** Track B (Source-Code Auto-Fix Path)
- **Depends on:** `AgnosticUI/uirig#9` (`sourceFile` and `lineNumber` attribution)
- **Branch:** `feat/issue-13-autofix-patches`
- **Status:** Planned
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Generate deterministic unified diffs (`unifiedDiff` and optional RFC 6902 `jsonPatch`) in `--json` output and support direct file patching + re-verification via `--fix` for unambiguous, 1-to-1 violations when `sourceFile` and `lineNumber` (from Issue `#9`) or exact attribute targets are resolved.

### Eligible Deterministic Fix Rules (Zero Ambiguity Only)
1. **Token Drift (`tokens`):** Replace an exact hardcoded CSS declaration value (e.g., `color: #3b82f6;` or `padding: 13px;`) on the resolved `sourceFile:lineNumber` with its nearest approved token (`suggestedToken` / `var(--token-name)`).
2. **Missing `alt=""` (`dom` -> `broken_image` / missing `alt`):** Insert `alt=""` on an `<img>` tag at `sourceFile:lineNumber` when `alt` is omitted.
3. **Unsafe `javascript:` URI (`dom` -> `unsafe_uri`):** Replace `href="javascript:..."` on an `<a>` tag at `sourceFile:lineNumber` with `href="#"`.

### Safety Guardrails
- **Never Guess Ambiguous Fixes:** Structural layout violations (`stress`, `cls`), multi-match lines, minified files, or violations without a verified local `sourceFile` inside `cwd` never emit or apply auto-fixes (`unifiedDiff` omitted / `null`).
- **Read-Only by Default:** `--json` computes and emits `unifiedDiff` without touching disk; files are modified on disk **only** when `--fix` is explicitly passed, followed by an automatic re-audit pass to confirm zero regressions.

---

## 2. Micro-Chunk Execution Breakdown

- [ ] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_13.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-13-autofix-patches` after `#9` merges and mark `#13` active in `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #13 (--fix / unifiedDiff)`

- [ ] **Chunk 1: Deterministic Patch Generator (`src/core/autofix.ts`) & Unit Tests**
  - **Files:** `src/core/autofix.ts`, `tests/unit/autofix.test.ts`
  - **Action:**
    - Implement `computeDeterministicAutoFix(violation, cwd)` in `src/core/autofix.ts` supporting exact 1-to-1 line replacements for `suggestedToken` CSS values, missing `alt=""` on `<img>`, and `javascript:` `href` URIs, emitting standard unified diff format (`--- a/<file>`, `+++ b/<file>`, `@@ ... @@`).
    - Enforce strict safety checks (file exists inside `cwd`, single unambiguous match on target line, skip layout/stress/CLS violations).
    - Add unit tests in `tests/unit/autofix.test.ts` covering valid unified diff generation and refusal on ambiguous/structural violations.
  - **Commit:** `feat(autofix): add deterministic unifiedDiff generator for unambiguous token and DOM fixes`

- [ ] **Chunk 2: `--fix` Disk Applier, Re-Verification Loop & CLI/Agent-Stream Wiring**
  - **Files:** `src/core/autofix.ts`, `src/utils/agent-stream.ts`, `src/commands/check.ts`, `src/index.ts`, `tests/unit/autofix.test.ts`
  - **Action:**
    - Attach `unifiedDiff` to `IAgenticViolation` in `src/utils/agent-stream.ts` when resolvable.
    - Wire `--fix` in `src/index.ts` and `ICheckCommandOptions` (`src/commands/check.ts`): apply non-overlapping deterministic patches to disk and re-run the audit pass to confirm `exitCode === 0`.
    - Add E2E tests in `tests/unit/autofix.test.ts` verifying `--json` emits `unifiedDiff` without modifying files, while `--fix` patches the file and passes re-verification.
  - **Commit:** `feat(cli): wire --fix patch application and re-verification loop into check`

- [ ] **Chunk 3: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_13.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Document `unifiedDiff` and `--fix` in `README.md` and `AGENTS.md`, run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#13`.
  - **Commit:** `docs(autofix): document unifiedDiff output and --fix CLI flag (#13)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#13`)
- [ ] `--json` emits a valid `unifiedDiff` for unambiguous token and DOM hygiene violations when `sourceFile` and `lineNumber` are resolved.
- [ ] `--fix` cleanly patches target files on disk and re-verifies zero regressions.
- [ ] Ambiguous structural/layout violations (`stress`, `cls`) and out-of-workspace files never generate or apply unsafe auto-fixes.
- [ ] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
