# Implementation Blueprint: uirig Scoped MVP

This document defines the focused Phase 1 engineering scope, core architectural compromises, and verification invariants required to ship **uirig**: a zero-config, framework-blind UI verification gate for CI/CD pipelines and **the deterministic verification engine for AI Design System Harnesses**.

While design tokens, `AGENTS.md` files, and Figma MCP servers give AI agents *context* on how to build UI, context alone cannot guarantee rendered quality. `uirig` closes the harness loop by providing fast, machine-readable, deterministic ground truth over live browser viewports—catching visual, geometric, and token drift without stuffing bulky style guides into LLM context windows.

## 1. The 4-Tool High-Signal MVP Matrix

To deliver immediate end-to-end design governance without code-generation fragility, the MVP focuses entirely on **four core commands** executed over a live running browser viewport:

```text
                       [uirig MVP Execution Suite]
                                    │
                         uirig check --config=uirig.config.json
                                    │
         ┌──────────────────────────┼──────────────────────────┐
         ▼                          ▼                          ▼
   uirig tokens               uirig contrast               uirig stress
   Audits runtime computed    Verifies legible text via   Fuzzes DOM elements 
   styles against JSON scale  computed luminance contrast  with expansion copy 
   via shadow-piercing hooks  directly on rendered pixels  to catch parent breaches
         │                          │                          │
         └──────────────────────────┼──────────────────────────┘
                                    ▼
                                uirig cls
                                Tracks unexpected vertical component
                                shifts during render layout cycles
```

---

## 2. Command Specifications & Telemetry Mechanics

### 2.1 uirig tokens (Design System Drift Auditor)
*   **Description:** Audits the running application to catch hardcoded styles, unauthorized color hexes, or arbitrary layout margins that bypass design system rules.
*   **The Mechanics:** Launches an isolated browser context, opens the target URL, and runs a recursive shadow-piercing tree walker that visits every visible DOM node (including components inside an open Shadow DOM). It evaluates `window.getComputedStyle(element)`. If any color, padding metric, font-size value, or border-radius falls outside the permitted scale defined in `uirig.config.json`, compilation blocks with an error.

### 2.2 uirig contrast (Rendered Pixel Contrast Gate)
*   **Description:** Enforces accessible, WCAG-compliant typography text legibility across all running application viewports.
*   **The Mechanics:** Inspects elements via Playwright. Rather than guessing contrast by reading code text strings, it reads the element's actual rendered foreground color and resolves its nearest non-transparent ancestor element's background color. It runs relative luminance calculations ($Y = 0.2126R + 0.7152G + 0.0722B$). If any pair yields a contrast ratio below 4.5:1, it logs a violation.

### 2.3 uirig stress (Geometric Invariant Fuzzer)
*   **Description:** Tests layout durability against data expansion stress entirely via geometric coordinate calculation rules—completely eliminating noisy screenshot pixel diffs.
*   **The Mechanics:** Injects a pseudo-localization string configuration (+30% character tracking) into running text element targets. It monitors element boxes via native browser `getBoundingClientRect()` loops, logging structural breaks under three strict conditions, governed by the `overflowPixelTolerance` safety buffer:
    1.  **Container Overflow:** A child node's right or bottom bounding coordinate breaches its parent container's bounding parameters past the allowed pixel tolerance.
    2.  **Rogue Scrollbar:** The global document scroll width breaks window containment parameters (`document.documentElement.scrollWidth > window.innerWidth`).
    3.  **Touch Target Collision:** Interactive target fields overlap or map closer than the minimum safety rim threshold.

### 2.4 uirig cls (Cumulative Layout Shift Monitor)
*   **Description:** Tracks visual layout instability and layout shifts during initial paint and rendering cycles.
*   **The Mechanics:** Instantiates a native browser `PerformanceObserver` instance inside the Playwright context targeting `layout-shift` entries. It records positional changes across vertical render intervals. If the accumulated layout shift metric breaks the configured `clsMaxLimit` threshold budget, it fails the build.

---

## 3. High-Signal MVP Technical Stack & CI/CD Contract

*   **Runtime Engine:** Node.js 22+ LTS Stable Releases
*   **Automation Driver Context:** Playwright Core v1.64+ (Headless browser configuration layers)
*   **System Configuration Identity:** Single configuration architecture file (`uirig.config.json`)
*   **Agentic Harness Contract (`--json`):** Streams structured, zero-bloat JSON violation tokens (`remediationAdvice`, offending selectors, and measured deltas) directly to `stdout`, enabling coding agents to run `uirig check --json` as a self-healing post-edit verification loop.

---

## 4. POSIX Exit Code Diagnostics
*   `0`: Operational Success (All geometric bounds, contrast ratios, and token drift checks passed).
*   `1`: Critical Configuration Error, broken syntax, or WCAG contrast failure below 4.5:1.
*   `2`: Layout boundary collapse, horizontal scrollbar leak, or CLS threshold budget breach verified by the fuzzer rigs.
