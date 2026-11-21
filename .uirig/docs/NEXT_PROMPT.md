# Session Continuity: Issue #25 (`fix/missing-tokens-path`)

## Current Context
- **Repository:** `AgnosticUI/uirig`
- **Active Branch:** `fix/missing-tokens-path`
- **Issue:** `#25` — `fix(check): skip or gracefully degrade missing tokensPath when running non-token audits`
- **Files Modified So Far:**
  - `src/commands/check.ts`
  - `tests/unit/check.test.ts`

## What Is Done & Passing
1. **Turn 1 (GREEN):** When `options.only` is `'stress'`, `'cls'`, or `'dom'`, `executeCheckCommand()` skips `loadTokenScale()` completely (`tokenScale = null`) without throwing `ERR_TOKENS_MISSING`.
   - Covered by test: `skips loading tokensPath when only is stress, cls, or dom` in `tests/unit/check.test.ts`.
2. **Turn 2 (In Progress / Written):** When `options.only` is `'contrast'` or `'dark-mode'` AND an explicit `options.target` is passed AND `loadTokenScale()` throws `ERR_TOKENS_MISSING`, `executeCheckCommand()` catches the error, logs a `[tokens:warn]` warning to `stderr` (`console.error`), and degrades gracefully to `tokenScale = null`.
   - Covered by test: `warns to stderr and falls back to null when tokensPath is missing for contrast or dark-mode with explicit target` in `tests/unit/check.test.ts`.

## Remaining Work (Turn 3 — Final)
1. **Verify Turn 2 is GREEN:** Run `npx vitest run tests/unit/check.test.ts`.
2. **Turn 3 (RED -> GREEN) — Guard Strict `ERR_TOKENS_MISSING` Cases:**
   - **Given** a `uirig.config.json` with a missing `tokensPath`
   - **When** `executeCheckCommand()` runs with:
     - `only: 'tokens'` (even with an explicit `target`), OR
     - full `uirig check` (`only: undefined`), OR
     - `only: 'contrast'` / `'dark-mode'` *without* an explicit `target` (configured workspace run)
   - **Then** `executeCheckCommand()` still rejects with `/ERR_TOKENS_MISSING/`.
3. **Final Check & Commit:**
   - Run full test suite (`npm test` or `npx vitest run`) and typecheck (`npm run build` / `tsc --noEmit`).
   - Commit on `fix/missing-tokens-path` referencing `#25`.

## Paste This Prompt Into Your Next Session
> Continue TDD on branch `fix/missing-tokens-path` for Issue #25 using `.uirig/docs/NEXT_PROMPT.md`. Let's verify Turn 2 is green, add Turn 3's regression test ensuring `only: 'tokens'`, full `uirig check` (`only: undefined`), and workspace `contrast`/`dark-mode` runs without an explicit `target` still throw `ERR_TOKENS_MISSING`, and wrap up the commit.
