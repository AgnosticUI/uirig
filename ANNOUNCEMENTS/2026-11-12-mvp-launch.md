# LinkedIn Announcement — `uirig` MVP Launch (2026-11-12)

AI coding agents, `AGENTS.md` files, and Figma MCP servers give LLMs great *context* on how to build UI.

Context alone doesn't guarantee rendered quality.

Static CSS linters miss computed runtime styles and Web Component Shadow DOM internals. Visual screenshot diffs drown teams in noisy 2px anti-aliasing false positives.

That's why I built **`uirig`**—an open-source, zero-config, framework-blind UI verification gate for CI/CD pipelines and AI Design System Harnesses.

`uirig` spins up isolated headless Chromium contexts and audits your live running viewports across four deterministic checks:

1. **`uirig tokens`** — Pierces open Shadow DOM boundaries to catch hardcoded colors, spacing, font sizes, and border radii that drift from your design token scale.
2. **`uirig contrast`** — Composites ancestor alpha layers (Porter-Duff Source-Over) and verifies true WCAG 2.1 luminance contrast (`>= 4.5:1`) on rendered text.
3. **`uirig stress`** — Injects `+30%` pseudo-localization text expansion and checks Euclidean bounding boxes for container overflow, horizontal scrollbars, and crowded touch targets.
4. **`uirig cls`** — Attaches a pre-navigation `PerformanceObserver` and enforces W3C session-window Cumulative Layout Shift budgets.

And when run with `--json` (`npx uirig check --json`), `uirig` streams clean, normalized violations with concrete `remediationAdvice` and deterministic POSIX exit codes (`0`, `1`, `2`) directly to `stdout`—giving coding agents like Claude Code, Cursor, and Codex a closed-loop self-healing gate until the UI actually passes.

Zero bulky style guides stuffed into your LLM context window. Just fast, deterministic ground truth in a real browser.

Check it out, try it on your design system or web app, and let me know what checks you'd add next!

#DesignSystems #FrontendEngineering #WebComponents #Playwright #AIEngineering #DevTools #Accessibility #OpenSource
