# AGENTS.md: `uirig` (`@rlevin/uirig`) Design System Harness Instructions

This repository uses **`@rlevin/uirig`** as its deterministic, live-viewport UI verification gate (acting as a fast **first line of defense** for AI-generated UIs and Web Components before heavier audits like `axe-core` or Lighthouse run).

## Mandatory Post-Edit UI Verification Loop

Whenever you create or modify HTML, CSS, Web Components, Lit templates, A2UI surfaces, or UI styles:

1. **Run the deterministic JSON verification gate:**
   - If `uirig.config.json` is configured and your dev server is running:

```bash
npx @rlevin/uirig check --changed --base=main --json
```

   - Or target a live URL, standalone `.html` file, or specific edited component (`--selectors` / `-s`) directly (add `--auto-tokens` when no `tokensPath` is configured, `--themes="light, dark"` or `--themes="enterprise-light, enterprise-dark"` for multi-theme matrix evaluation, `--fix` to auto-apply safe 1-to-1 patches on disk, and `--group-by-root`, `--spatial-brief`, and `--top` / `--max-tokens` for compact feedback):

```bash
npx @rlevin/uirig http://localhost:5173 --auto-tokens --group-by-root --spatial-brief --top=5 --json
npx @rlevin/uirig ./dist/index.html --auto-tokens --selectors="ag-button, .pricing-card" --max-tokens=1200 --json
```

   *(If `@rlevin/uirig` is already installed in `node_modules`, `npx uirig ...` works interchangeably.)*
2. **Evaluate the POSIX exit code and JSON `stdout` payload:**
   - **Exit Code `0` (`"passed": true`):** All engines (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`, `states`, and optional `sweep`) and runtime JS error checks passed. You may finish your task.
   - **Exit Code `1`:** Design token drift (`tokens`), light/dark WCAG contrast failure (`contrast`, `dark-mode`, including worst-case CSS `background-clip: text` gradient stops), structural DOM/ARIA/computed AX tree (`ax_empty_name`, `ax_hidden_focus`)/Web Component `<slot>` violation (`dom`), interactive state/click-occlusion failure (`states`: `click_occluded`, `missing_focus_visible`), or uncaught runtime JS error.
   - **Exit Code `2`:** Structural layout break (`stress` / `sweep`: container overflow, `100vw` scrollbar bleed, squished avatar, `<24px` tap target) or Cumulative Layout Shift budget breach (`cls`).
3. **Verify Macro-Layout via `spatialBrief` (No Vision Screenshots Required):**
   - When `--spatial-brief` is passed, inspect the top-level `"spatialBrief"` field (e.g. `header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836]`) to confirm side-by-side vs. stacked alignment and bounding-box dimensions without attaching vision screenshots.
4. **Self-Heal & Re-Verify (Root Causes & Highest Impact First):**
   - When `--group-by-root` is passed, cascading child failures inside the same container or Web Component host collapse into a single parent entry with `childCount` and `sampleChildren`—fix the parent container/host rather than patching individual children.
   - `violations` is always sorted from highest impact (`cls` / `runtime` = 100 pts, `stress` / `sweep` = 80 pts, `states` = 75 pts) to lowest (`tokens` = 40 pts, `dom` = 20 pts). When `--top` or `--max-tokens` trims the list, `totalViolations` and `truncatedCount` tell you how many lower-priority items remain.
   - Inspect each entry in `violations`:
     - `engine` & `violationType` (including `ax_empty_name`, `ax_hidden_focus`, and `orphaned_slot_content`)
     - `hostComponent` (the enclosing Web Component tag, e.g., `ag-button`)
     - `a2ui` (when inside `<a2ui-surface>` or `[data-a2ui-surface]`: `{ surfaceId, a2uiComponentId, a2uiComponentType, catalogId, wirePath, suggestedPatch }`; `null` otherwise)
     - `sourceFile`, `lineNumber`, & `columnNumber` (workspace-relative `file:line:column` resolved from CSS/JS source maps or `data-source-loc` dev attributes when present; `null` otherwise)
     - `unifiedDiff` (ready-to-apply single-line unified diff when `sourceFile` and `lineNumber` resolve to an unambiguous 1-to-1 fix; `null` for structural/layout violations or unmapped files)
     - `selector` (including `::shadow` / `>> shadow-root >>` boundaries, or the shared parent container when grouped)
     - `occurrenceCount` / `childCount` / `sampleChildren`
     - `suggestedToken` (nearest passing design token when available)
     - `remediationAdvice` (actionable fix guidance scoped to the offending element, source file/line, custom element slots, or A2UI `updateComponents` delta)
   - For A2UI surfaces in opt-in self-healing mode (`runA2uiSelfHealingLoop` / `buildA2uiUpdateComponentsDelta`), emit minimal A2UI v1.0 `updateComponents` deltas scoped to `a2uiComponentId` and re-verify until `exitCode` is `0` (`<= 2` turns).
   - Otherwise, apply `unifiedDiff` (or pass `--fix` for unambiguous 1-to-1 fixes), or open `sourceFile` at `lineNumber` directly and patch the offending CSS or component template using `suggestedToken` and `remediationAdvice`, then re-run `npx @rlevin/uirig check --json` until `exitCode` is `0`.

## Ground Rules for AI Agents

- **Browser Setup:** If Chromium is not yet cached, `uirig` auto-installs its matching binary on first run (or falls back to system Chrome). To pre-install explicitly in CI or mixed-Playwright workspaces, run `npx @rlevin/uirig install` (or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`).
- **Do not bypass `uirig.config.json` budgets** (`clsMaxLimit`, `overflowPixelTolerance`, `touchTargetMinSpacingPx`, `darkModeMaxSurfaceLuminance`) or sprinkle `data-uirig-ignore` attributes to silence legitimate failures. Fix the underlying layout, contrast, or token usage instead.
- **Prefer design tokens over raw values:** When `suggestedToken` is present in a violation, apply the semantic CSS custom property rather than hardcoding hex colors or pixel values.
- **Shadow DOM paths:** Selectors formatted as `host-tag::shadow > inner-selector` or `host-tag >> shadow-root >> inner-selector` indicate an element inside an open `ShadowRoot` owned by `hostComponent`.
- **Full skill reference:** See `.uirig/SKILL.md` for detailed telemetry schemas and engine rules.
