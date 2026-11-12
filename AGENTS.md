# AGENTS.md — `uirig` Design System Harness Instructions

This repository uses **`uirig`** as its deterministic, live-viewport UI verification gate.

## Mandatory Post-Edit UI Verification Loop

Whenever you create or modify HTML, CSS, Web Components, Lit templates, or UI styles:

1. **Verify the local dev server is reachable** on the URL(s) listed in `uirig.config.json` (`targetUrls`).
2. **Run the deterministic JSON verification gate:**
   ```bash
   npx uirig check --json
   ```
3. **Evaluate the POSIX exit code and JSON `stdout` payload:**
   - **Exit Code `0` (`"passed": true`):** All 4 engines (`tokens`, `contrast`, `stress`, `cls`) passed. You may finish your task.
   - **Exit Code `1`:** Design token drift (`token_drift`) or WCAG 2.1 contrast failure (`contrast_drop` < 4.5:1).
   - **Exit Code `2`:** Structural layout break (`container_overflow`, `horizontal_scrollbar`, `touch_target_collision`) or Cumulative Layout Shift budget breach (`cls_breach`).
4. **Self-Heal & Re-Verify:**
   - Inspect each item in `violations[]` (`engine`, `selector`, `inShadowDom`, `measuredDelta`, `remediationAdvice`).
   - Patch the offending CSS or component template directly using `remediationAdvice`.
   - Re-run `npx uirig check --json` until `exitCode` is `0`.

## Ground Rules for AI Agents

- **Do not bypass `uirig.config.json` budgets** (`clsMaxLimit`, `overflowPixelTolerance`, `touchTargetMinSpacingPx`) to silence failures—fix the underlying layout or token usage.
- **Shadow DOM paths:** Selectors formatted as `host-tag >> shadow-root >> inner-selector` indicate an element inside an open `ShadowRoot`.
- **Full skill reference:** See `.uirig/SKILL.md` for detailed telemetry schemas.
