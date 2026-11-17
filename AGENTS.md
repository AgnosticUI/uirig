# AGENTS.md: `uirig` (`@rlevin/uirig`) Design System Harness Instructions

This repository uses **`@rlevin/uirig`** as its deterministic, live-viewport UI verification gate (acting as a fast **first line of defense** for AI-generated UIs and Web Components before heavier audits like `axe-core` or Lighthouse run).

## Mandatory Post-Edit UI Verification Loop

Whenever you create or modify HTML, CSS, Web Components, Lit templates, or UI styles:

1. **Run the deterministic JSON verification gate:**
   - If `uirig.config.json` is configured and your dev server is running:

         npx @rlevin/uirig check --json

   - Or target a live URL, standalone `.html` file, or specific edited component (`--selectors` / `-s`) directly (add `--spatial-brief` for ~40-token layout coordinates and `--top` / `--max-tokens` to focus on the highest-priority defects):

         npx @rlevin/uirig http://localhost:5173 --spatial-brief --top=5 --json
         npx @rlevin/uirig ./dist/index.html --selectors="ag-button, .pricing-card" --max-tokens=1200 --json

   *(If `@rlevin/uirig` is already installed in `node_modules`, `npx uirig ...` works interchangeably.)*
2. **Evaluate the POSIX exit code and JSON `stdout` payload:**
   - **Exit Code `0` (`"passed": true`):** All 6 engines (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`) and runtime JS error checks passed. You may finish your task.
   - **Exit Code `1`:** Design token drift (`tokens`), light/dark WCAG contrast failure (`contrast`, `dark-mode`), structural DOM/ARIA/hygiene violation (`dom`), or uncaught runtime JS error.
   - **Exit Code `2`:** Structural layout break (`stress`: container overflow, `100vw` scrollbar bleed, squished avatar, `<24px` tap target) or Cumulative Layout Shift budget breach (`cls`).
3. **Verify Macro-Layout via `spatialBrief` (No Vision Screenshots Required):**
   - When `--spatial-brief` is passed, inspect the top-level `"spatialBrief"` field (e.g. `header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836]`) to confirm side-by-side vs. stacked alignment and bounding-box dimensions without attaching vision screenshots.
4. **Self-Heal & Re-Verify (Highest Impact First):**
   - `violations` is always sorted from highest impact (`cls` / `runtime` = 100 pts, `stress` = 80 pts) to lowest (`tokens` = 40 pts, `dom` = 20 pts). When `--top` or `--max-tokens` trims the list, `totalViolations` and `truncatedCount` tell you how many lower-priority items remain.
   - Inspect each deduplicated entry in `violations`:
     - `engine` & `violationType`
     - `hostComponent` (the enclosing Web Component tag, e.g., `ag-button`)
     - `selector` (including `::shadow` boundaries)
     - `occurrenceCount`
     - `suggestedToken` (nearest passing design token when available)
     - `remediationAdvice`
   - Patch the offending CSS or component template directly using `suggestedToken` and `remediationAdvice`.
   - Re-run `npx @rlevin/uirig check --json` (or `npx @rlevin/uirig <target> --selectors="..." --json`) until `exitCode` is `0`.

## Ground Rules for AI Agents

- **Do not bypass `uirig.config.json` budgets** (`clsMaxLimit`, `overflowPixelTolerance`, `touchTargetMinSpacingPx`, `darkModeMaxSurfaceLuminance`) or sprinkle `data-uirig-ignore` attributes to silence legitimate failures. Fix the underlying layout, contrast, or token usage instead.
- **Prefer design tokens over raw values:** When `suggestedToken` is present in a violation, apply the semantic CSS custom property rather than hardcoding hex colors or pixel values.
- **Shadow DOM paths:** Selectors formatted as `host-tag::shadow > inner-selector` indicate an element inside an open `ShadowRoot` owned by `hostComponent`.
- **Full skill reference:** See `.uirig/SKILL.md` for detailed telemetry schemas and engine rules.
