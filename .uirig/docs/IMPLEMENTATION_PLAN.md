# Implementation Plan: GitHub Issue #7

**Issue:** `feat/fix: improve dark_mode_contrast_drop accuracy ([data-theme], ancestor opacity) and log matched selector count` (`AgnosticUI/uirig#7`)  
**Status:** Planned (0 / 4 Chunks Complete)

---

## Context & Engineering Diagnosis

1. **Dark-Mode Theme Parity (`.dark` + `[data-theme="dark"]` + `prefers-color-scheme: dark`):**
   - VitePress (used by AgnosticUI's documentation site) toggles `.dark` on `<html>`, while AgnosticUI components scope dark tokens to `[data-theme="dark"]`.
   - `src/core/dark-mode.ts` currently sets `colorScheme: 'dark'` and `data-theme="dark"` without adding `.dark` to `<html>`, and does not restore original `<html>` attributes/classes after auditing.
2. **Ancestor CSS `opacity` Stacking Group Compositing (`matrix.ts`):**
   - `src/core/matrix.ts` walks up `parentElement` and `ShadowRoot.host` boundaries collecting `backgroundColor` strings, ignoring `computed.opacity`.
   - When a Light DOM custom element host (e.g., `<ag-button style="opacity: 0.6">`) wraps an inner Shadow DOM `<button>`, CSS renders the entire subtree into an offscreen compositing group and blends it at `opacity: 0.6` over the parent backdrop—washing out contrast for descendant text nodes.
3. **Selector Filter (`-s` / `--selector`) & Matched Selector Telemetry (`index.ts`, `check.ts`, `fs.ts`, `agent-stream.ts`):**
   - Passing `-s='<selector>'` / `--selector=<selector>` should filter violations to matched nodes/subtrees across Light + Shadow DOM and explicitly print the matched element count (`Selectors matched on page: <N>`), warning when `0` elements match so selector typos never produce silent false-passes.

---

## Cohesive Implementation Chunks

### Chunk 1: Ancestor CSS `opacity` Stacking Group Compositing in `matrix.ts`
- **Files:** `src/core/matrix.ts`, `tests/unit/matrix.test.ts`
- **Scope:**
  - [ ] Define `IAncestorStyleLayer` (`{ backgroundColor: string; opacity: number }`) and `compositeContrastLayers()` in `src/core/matrix.ts` to model true CSS `opacity < 1` offscreen compositing groups from `<html>` down through Light DOM and `ShadowRoot.host` ancestors to leaf text nodes.
  - [ ] Update `extractTextContrastSnapshots()` and `evaluateContrastEntry()` to collect and composite `styleLayers`.
  - [ ] Add unit and live Chromium Shadow DOM tests in `tests/unit/matrix.test.ts` (including `<ag-button style="opacity: 0.6">` wrapping a Shadow DOM `<button>`).

### Chunk 2: Multi-Convention Dark-Mode Activation & Restoration in `dark-mode.ts`
- **Files:** `src/core/dark-mode.ts`, `tests/unit/dark-mode.test.ts`
- **Scope:**
  - [ ] Update `runDarkModeAudit()` in `src/core/dark-mode.ts` to activate `colorScheme: 'dark'`, `data-theme="dark"`, and `.dark` on `document.documentElement` (plus `data-bs-theme="dark"` when `data-bs-theme` is already present), and restore the original `<html>` state inside a `try / finally` block.
  - [ ] Update `collectAncestorBackgroundLayers()` in `dark-mode.ts` to respect ancestor `opacity` when computing stranded surface luminance.
  - [ ] Add unit & live Chromium tests in `tests/unit/dark-mode.test.ts` covering VitePress `.dark` + AgnosticUI `[data-theme="dark"]` coexistence, attribute restoration, and `<ag-button style="opacity: 0.6">` dark-mode contrast drops.

### Chunk 3: CLI `-s` / `--selector` Flag Parsing & Help Docs in `index.ts`
- **Files:** `src/index.ts`, `tests/unit/index.test.ts`
- **Scope:**
  - [ ] Add `-s <selector>`, `-s=<selector>`, `--selector <selector>`, and `--selector=<selector>` parsing to `parseAuditCommandArgs()` in `src/index.ts` and forward `selector` to `executeCheckCommand()`.
  - [ ] Document `-s, --selector=<css>` in `CLI_HELP_TEXT` and `SUBCOMMAND_HELP_SPECS`.
  - [ ] Add 1-to-1 parser and dispatch unit tests in `tests/unit/index.test.ts`.

### Chunk 4: Selector Matching, Telemetry Count & Reporters (`check.ts`, `fs.ts`, `agent-stream.ts`)
- **Files:** `src/commands/check.ts`, `src/utils/fs.ts`, `src/utils/agent-stream.ts`, `tests/unit/check.test.ts`, `tests/unit/fs.test.ts`, `tests/unit/agent-stream.test.ts`
- **Scope:**
  - [ ] Add `selector?: string` to `ICheckCommandOptions` and `matchedSelectorCount?: number` to `IViewportAuditReport` / `ICheckExecutionReport`.
  - [ ] Query matching elements across Light DOM and open `ShadowRoot` trees when `selector` is set, filter engine violations to matched elements or their descendants, and log `Selectors matched on page: <N>` (emitting a visible warning when `0` elements match).
  - [ ] Surface `matchedSelectorCount` in `.uirig/github_pr_comment.md` (`src/utils/fs.ts`) and `--json` output (`src/utils/agent-stream.ts`), and add 1-to-1 unit tests.
