# `uirig`

**The deterministic, framework-blind UI quality gate for CI/CD pipelines and AI Design System Harnesses.**

`uirig` launches an isolated headless Chromium browser and runs four high-signal verification engines concurrently across your live viewports—piercing open Shadow DOM boundaries to catch design token drift, WCAG 2.1 contrast failures, +30% text-expansion layout breaks, and Cumulative Layout Shift (CLS) regressions without brittle screenshot diffs.

---

## Why `uirig`?

* **Framework-Blind & Shadow-DOM Ready:** Audits React, Vue, Svelte, Lit, Web Components, and plain HTML via live browser `getComputedStyle()` and `getBoundingClientRect()` APIs.
* **Zero Screenshot Diff Flakiness:** Measures deterministic Euclidean bounding boxes, Porter-Duff alpha-composited luminance contrast, and W3C session-window CLS scores instead of noisy pixel comparisons.
* **Built for AI Design System Harnesses:** Running `uirig check --json` streams normalized violations with concrete `remediationAdvice` to `stdout`, enabling coding agents (Claude Code, Cursor, Codex) to self-heal UI regressions until exit code `0`.
* **Fast Parallel Execution:** Launches a single Chromium binary and fans out isolated incognito `BrowserContext` sessions concurrently per viewport.

---

## The 4-Tool Verification Suite

| Engine | CLI Gate | What It Audits | Failure Exit Code |
| :--- | :--- | :--- | :---: |
| **1. Design Tokens** | `tokens` | Walks Light DOM and open `ShadowRoot` trees to flag hardcoded colors, padding, font sizes, or border radii outside your token scale. | `1` |
| **2. WCAG Contrast** | `contrast` | Composites ancestor alpha layers (Porter-Duff Source-Over) and verifies WCAG 2.1 AA text contrast (`>= 4.5:1`) via `colorjs.io`. | `1` |
| **3. Geometric Stress** | `stress` | Injects `+30%` pseudo-localization text expansion and checks parent-child containment, horizontal scrollbars, and touch-target spacing. | `2` |
| **4. Layout Shift** | `cls` | Attaches a pre-navigation `PerformanceObserver` (`layout-shift`) and enforces Google's W3C 1s/5s session-window `clsMaxLimit` budget. | `2` |

---

## Installation & Setup

### Prerequisites
* **Node.js 22+**
* **Playwright Chromium browser binary**

### Local Setup

```bash
npm install
npx playwright install chromium
npm run build
```

### Bootstrap a Workspace

Run `init` in your project root to scaffold `uirig.config.json`, `.uirig/session.json`, and `.uirig/SKILL.md`:

```bash
npx uirig init
```

---

## Configuration (`uirig.config.json`)

```json
{
  "$schema": "https://json-schema.org",
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./config/default_tokens.json",
  "thresholdBudgets": {
    "clsMaxLimit": 0.1,
    "overflowPixelTolerance": 2,
    "touchTargetMinSpacingPx": 24
  },
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ]
}
```

---

## CLI Command Reference

### `uirig init`
Scaffolds `uirig.config.json`, `.uirig/session.json`, and `.uirig/SKILL.md` in the current directory without overwriting existing files.

### `uirig check [options]`
Launches a single Chromium instance and executes all 4 verification engines across every configured `(url, viewport)` pair in isolated parallel `BrowserContext` sessions. Also writes a standalone Markdown PR report to `.uirig/github_pr_comment.md`.

### Standalone Engine Commands (`tokens`, `contrast`, `stress`, `cls`)
Run any individual verification engine in isolation for rapid inner-loop debugging or targeted AI agent re-checks:

```bash
npx uirig tokens [--config=<path>] [--json] [--headed]
npx uirig contrast [--config=<path>] [--json] [--headed]
npx uirig stress [--config=<path>] [--json] [--headed]
npx uirig cls [--config=<path>] [--json] [--headed]
```

### Shared Audit Options
* `--config=<path>` (or `--config <path>`): Use a custom configuration file path.
* `--only=<tool>`: Filter `uirig check` to a single engine (`tokens`, `contrast`, `stress`, or `cls`).
* `--json`: Route diagnostic logs to `stderr` and write a single parseable JSON report (`IAgenticJsonStreamPayload`) to `stdout`.
* `--headed`: Run Chromium with a visible browser window for local inspection.

### `uirig manifest`
Prints an ASCII directory tree of your project while excluding build artifacts and isolated sandboxes (`node_modules`, `.git`, `dist`, `playground`).

### POSIX Exit Codes
* `0`: All token, contrast, geometric stress, and CLS checks passed.
* `1`: Configuration/token load error, design token drift, or WCAG contrast failure (`< 4.5:1`).
* `2`: Structural layout break (`container_overflow`, `horizontal_scrollbar`, `touch_target_collision`) or CLS budget breach.

---

## Common Use Cases

### 1. GitHub Actions CI/CD Gate
```yaml
- name: Run uirig UI verification gate
  run: |
    npm run build
    npx vite --port 5173 &
    npx wait-on http://localhost:5173
    npx uirig check --config=uirig.config.json
```
On every run, `uirig check` generates `.uirig/github_pr_comment.md`, ready to post directly onto Pull Requests.

### 2. Git Pre-Commit Hook (`.git/hooks/pre-commit`)
```bash
#!/usr/bin/env bash
set -e
npx uirig check --config=uirig.config.json
```

### 3. AI Design System Harness Loop (`AGENTS.md` + `--json`)
`uirig init` generates `.uirig/SKILL.md` and this repository includes `AGENTS.md` so coding agents (Claude Code, Cursor, Codex) can self-verify UI changes:
```bash
npx uirig check --json
```
Each item in `violations[]` includes `engine`, `selector`, `inShadowDom`, `measuredDelta`, and actionable `remediationAdvice` so the agent can patch CSS/templates and re-run until `exitCode === 0`.

---

## License

MIT
