# `uirig`

**The first line of defense for AI-generated UIs and Web Components.**

`uirig` acts as a fast, zero-config guardrail: auditing live running viewports inside isolated headless Chromium contexts to catch design drift, light/dark contrast failures, layout breaks, Cumulative Layout Shift (CLS), and structural DOM hallucinations without brittle screenshot diffs (before you ever run a heavy `axe-core` audit or Lighthouse profile).

---

## Why `uirig`? (And Why It Beats Just Running `axe` or `Lighthouse` First)

`uirig` is not a replacement for comprehensive WCAG audits (`axe-core`) or full performance profiling (`Lighthouse`). Instead, it acts as a fast, deterministic **first line of defense** tailored to modern component architectures and AI-assisted development:

* **Catches Design-System Drift `axe` Misses:** `axe` won't tell you that an AI agent hardcoded `#3b82f6` instead of `--ag-color-primary`, or that `+30%` longer German translation copy overflowed `<ag-card>`.
* **Pierces Web Component Shadow DOMs:** `Lighthouse` won't climb inside a Lit or Stencil `ShadowRoot` to tell a coding agent *which custom element* (`hostComponent`) broke dark-mode contrast or layout bounds.
* **Zero Screenshot Diff Flakiness:** Measures deterministic Euclidean bounding boxes, Porter-Duff alpha-composited luminance contrast, and W3C session-window CLS scores instead of noisy pixel diffs.
* **Zero-Config First Run:** Point `npx uirig` directly at a localhost URL or a standalone `.html` file with zero configuration files required.
* **Built for AI Design System Harnesses:** Agents like Claude Code, Cursor, and Codex can self-heal UI regressions before a human ever opens a browser using `--json` mode, which streams deduplicated violations with Shadow host attribution and token-aware `remediationAdvice` to `stdout` until exit code `0`.

---

## Quick Start (Zero Config)

Run `uirig` immediately against any running URL or local `.html` file (no `uirig.config.json` required):

```bash
# Audit a live dev server
npx uirig http://localhost:5173

# Audit a standalone AI-generated HTML file (auto-served on an ephemeral local port)
npx uirig ./dist/index.html

# Stream deduplicated JSON remediation diffs for an AI coding agent
npx uirig http://localhost:5173 --json
```

---

## The 6-Tool Verification Suite

| Engine | CLI Gate | What It Audits | Failure Exit Code |
| :--- | :--- | :--- | :---: |
| **1. Design Tokens** | `tokens` | Walks Light DOM and open `ShadowRoot` trees to flag hardcoded colors, spacing, font sizes, or border radii outside your token scale. | `1` |
| **2. WCAG Contrast** | `contrast` | Composites ancestor alpha layers (Porter-Duff Source-Over), verifies WCAG 2.1 AA contrast (`>= 4.5:1`), and suggests nearest passing tokens. | `1` |
| **3. Dark-Mode Parity** | `dark-mode` | Emulates dark color scheme / `[data-theme="dark"]`, re-audits contrast, and flags surfaces stranded at bright light luminance (`> 0.85`). | `1` |
| **4. Geometric Stress** | `stress` | Injects `+30%` longer text and long space-free strings (like emails and URLs) to check container overflow, `100vw` bleed, avatar squishing, and `24x24px` tap targets. | `2` |
| **5. Layout Shift** | `cls` | Enforces W3C 1s/5s session-window `clsMaxLimit` budgets across live page loads, catching unexpected layout jumps before users see them. | `2` |
| **6. DOM Integrity** | `dom` | Catches dangling `aria-labelledby`/`for` IDs, unlabeled controls, broken `<img>` loads, `javascript:` URIs, and hidden AI prompt-injection traps. | `1` |

*(Full suite runs also automatically fail with exit code `1` if the page throws uncaught runtime JavaScript errors during load.)*
---

## Installation & Workspace Setup

### Prerequisites
* **Node.js 22+**
* **Playwright Chromium browser binary**

```bash
npm install -D uirig
npx playwright install chromium
```

### Optional Workspace Initialization (`uirig init`)
When you are ready to enforce custom design tokens, multi-viewport budgets, or AI agent skills in a repository, run `init` to scaffold `uirig.config.json`, `.uirig/session.json`, and `.uirig/SKILL.md`:

```bash
npx uirig init
```

### Configuration (`uirig.config.json`)

```json
{
  "\$schema": "https://json-schema.org",
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./config/default_tokens.json",
  "thresholdBudgets": {
    "clsMaxLimit": 0.1,
    "overflowPixelTolerance": 2,
    "touchTargetMinSpacingPx": 24,
    "darkModeMaxSurfaceLuminance": 0.85
  },
  "viewports": [
    { "name": "mobile", "width": 375, "height": 812 },
    { "name": "desktop", "width": 1440, "height": 900 }
  ],
  "ignore": [
    { "rule": "tokens", "selector": ".legacy-embed" }
  ]
}
```

### Bundler-Proof Element Escape Hatches
Because `uirig` evaluates live computed DOM styles after bundlers strip CSS comments, you can exempt intentional one-off overrides directly in markup (including across Shadow DOM boundaries):

```html
<div data-uirig-ignore="tokens">Intentional one-off hero gradient</div>
<section data-uirig-ignore="all">Legacy third-party widget</section>
```

---

## CLI Command Reference

### Instant Target Run (`npx uirig <url-or-file> [options]`)
Runs all 6 verification engines against a single URL or local `.html` path using `uirig.config.json` if present, or sensible built-in defaults if not.

### `uirig check [options]`
Launches a single Chromium instance and executes all 6 verification engines across every configured `(url, viewport)` pair in isolated parallel `BrowserContext` sessions. Writes a standalone Markdown PR report to `.uirig/github_pr_comment.md`.

### Standalone Engine Commands
Run any individual verification engine in isolation for rapid inner-loop debugging or targeted AI agent re-checks:

```bash
npx uirig tokens [<url-or-file>] [--config=<path>] [--json] [--headed]
npx uirig contrast [<url-or-file>] [--config=<path>] [--json] [--headed]
npx uirig dark-mode [<url-or-file>] [--config=<path>] [--json] [--headed]
npx uirig stress [<url-or-file>] [--config=<path>] [--json] [--headed]
npx uirig cls [<url-or-file>] [--config=<path>] [--json] [--headed]
npx uirig dom [<url-or-file>] [--config=<path>] [--json] [--headed]
```

### Shared Options
* `--config=<path>`: Use a custom configuration file path.
* `--only=<tool>`: Filter `check` to a single engine (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, or `dom`).
* `--json`: Route diagnostic logs to `stderr` and write a single deduplicated JSON report to `stdout`.
* `--headed`: Run Chromium with a visible browser window for local inspection.
* `<command> --help`: Print detailed mechanics, flags, and exit codes for any subcommand.

### POSIX Exit Codes
* `0`: All token, contrast, dark-mode parity, geometric stress, CLS, DOM integrity, and runtime checks passed.
* `1`: Design token drift, WCAG/dark-mode contrast failure, DOM/ARIA/hygiene violation, uncaught runtime JS error, or config error.
* `2`: Structural layout break (overflow, horizontal scrollbar, tap-target collision) or CLS budget breach.

---

## Common Use Cases

### 1. AI Design System Harness Loop (`AGENTS.md` + `--json`)
`uirig init` generates `.uirig/SKILL.md` so coding agents (Claude Code, Cursor, Codex) can self-verify UI changes after every edit:
```bash
npx uirig http://localhost:5173 --json
```
Each deduplicated entry in `violations[]` includes `engine`, `hostComponent`, `offendingSelectorPath`, `suggestedToken`, and `remediationAdvice` so the agent can patch CSS/templates and re-run until `exitCode === 0`.

### 2. GitHub Actions CI/CD Gate
```yaml
- name: Run uirig UI verification gate
  run: |
    npm run build
    npx uirig ./dist/index.html
```
On every `uirig check` run, `.uirig/github_pr_comment.md` is generated and ready to post onto Pull Requests.

### 3. Git Pre-Commit Hook (`.git/hooks/pre-commit`)
```bash
#!/usr/bin/env bash
set -e
npx uirig check --config=uirig.config.json
```

### 4. Local Development & Playground
```bash
# Typecheck and run the unit test suite
npm run typecheck:all && npm test

# Start the interactive Vite + Lit playground
npm run playground:dev

# Run end-to-end playground verification (headless or headed)
npm run playground:test
npm run playground:test:headed
```

---

## License

MIT
