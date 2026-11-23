# `uirig` (`@rlevin/uirig`)

**The first line of defense for AI-generated UIs and Web Components.**

`uirig` acts as a fast, zero-config guardrail: auditing live running viewports inside isolated headless Chromium contexts to catch design drift, light/dark contrast failures, layout breaks, Cumulative Layout Shift (CLS), and structural DOM hallucinations without brittle screenshot diffs (before you ever run a heavy `axe-core` audit or Lighthouse profile).

---

## Why `uirig`? (And Why It Beats Just Running `axe` or `Lighthouse` First)

`uirig` is not a replacement for comprehensive WCAG audits (`axe-core`) or full performance profiling (`Lighthouse`). Instead, it acts as a fast, deterministic **first line of defense** tailored to modern component architectures and AI-assisted development:

* **Catches Design-System Drift `axe` Misses:** `axe` won't tell you that an AI agent hardcoded `#3b82f6` instead of `--ag-color-primary`, or that `+30%` longer German translation copy overflowed `<ag-card>`.
* **Pierces Web Component Shadow DOMs & Audits `<slot>` + Computed AX Tree Integrity:** `Lighthouse` won't climb inside a Lit or Stencil `ShadowRoot` to tell a coding agent *which custom element* (`hostComponent`) broke dark-mode contrast, layout bounds, dropped an orphaned `slot="..."` child, or severed its computed accessibility name (`ax_empty_name` / `ax_hidden_focus`).
* **Renderer-Agnostic A2UI Surface Attribution (`<a2ui-surface>` / `[data-a2ui-surface]`):** Automatically resolves composed ancestors across Lit, React, Vue, Angular, and Flutter Web A2UI v1.0 surfaces into an out-of-band `a2ui` diagnostic block (`surfaceId`, `a2uiComponentId`, `a2uiComponentType`, `catalogId`, `wirePath`, `suggestedPatch`) and catalog-neutral `updateComponents` `remediationAdvice` with zero changes to A2UI wire schemas.
* **Zero Screenshot Diff Flakiness & Zero Vision-Token Bloat:** Measures deterministic Euclidean bounding boxes, Porter-Duff alpha-composited luminance contrast (including CSS `background-clip: text` gradient color stops), and W3C session-window CLS scores—plus `--spatial-brief` delivers macro-layout coordinates in ~40 plain-text tokens instead of 1,500–3,000+ vision tokens.
* **Root-Cause Grouped, Priority-Ranked & Token-Budgeted for AI Agents:** Collapse cascading child failures under their shared parent container with `--group-by-root`, automatically sort violations from highest page impact (`cls` / `runtime` > `stress` > `contrast` / `dark-mode` > `tokens` > `dom`), and cap output with `--top=<n>` and `--max-tokens=<budget>`.
* **Zero-Config & Component-Scoped First Runs:** Point `npx @rlevin/uirig` directly at a localhost URL or a standalone `.html` file with zero configuration files required, pass `--auto-tokens` to auto-discover `:root` CSS variables, Tailwind v4 `@theme`, and W3C `.tokens.json` scales, evaluate multiple theme skins with `--themes`, or scope audits to specific components with `--selectors` or `--changed`.
* **Built as an Agentic Guardrail for AI Design System Harnesses:** Drop `uirig` into your AI design system harness (`AGENTS.md` or `.uirig/SKILL.md`) so agents like Claude Code, Cursor, and Codex can self-heal UI regressions before a human ever opens a browser. Running `--json` streams deduplicated violations with Shadow host attribution, `suggestedToken` fixes, and POSIX exit codes (`0`, `1`, `2`) to `stdout` while keeping colored telemetry on `stderr`.

### Works Alongside Google Modern Web Guidance

`uirig` and **Google's Modern Web Guidance** solve complementary halves of the AI UI engineering loop without overlapping:

| Layer | Tool | Role in the Agent Loop |
| :--- | :--- | :--- |
| **1. Static Authoring & Refactoring** | **Google Modern Web Guidance** *(Agent Skill + CLI)* | Injects Baseline web-platform patterns (native `<dialog>`, Popover API, modern CSS layout) before code is generated—and scans source files (`legacy-scan`) to modernize outdated patterns. |
| **2. Live Runtime Verification** | **`uirig`** *(MCP Server + CLI)* | Audits the live rendered DOM and Shadow DOM in headless Chromium to catch design-system token drift, Porter-Duff contrast drops, `<slot>` mismatches, CLS, and geometric overflow that static guidance and source scanners cannot observe. |

Pairing Modern Web Guidance's skill with the `uirig` MCP server gives coding agents a complete **"Author with Modern Web Guidance → Verify with `uirig`"** closed loop (documented automatically in `.uirig/SKILL.md` when you run `uirig init`).

---

## Quick Start (Zero Config)

Run `uirig` immediately against any running URL or local `.html` file (no installation or `uirig.config.json` required):

```bash
# Audit a live dev server
npx @rlevin/uirig http://localhost:5173

# Audit a standalone AI-generated HTML file (auto-served on an ephemeral local port)
npx @rlevin/uirig ./dist/index.html

# Auto-discover :root CSS variables, Tailwind v4 @theme, and W3C .tokens.json with zero config
npx @rlevin/uirig ./dist/index.html --auto-tokens --verbose

# Apply deterministic 1-to-1 fixes on disk and re-verify automatically
npx @rlevin/uirig ./dist/index.html --auto-tokens --fix

# Evaluate across multiple theme skins (Light, Dark, compound brand skins) in one pass
npx @rlevin/uirig http://localhost:5173 --themes="light, dark, enterprise-dark" --json

# Scope checks incrementally to components modified in git diff (or against --base=main)
npx @rlevin/uirig http://localhost:5173 --changed --base=main --json

# Scope checks to specific components or CSS selectors (Light DOM + Shadow DOM)
npx @rlevin/uirig http://localhost:5173 --selectors="#hero, ag-button, .pricing-card"

# Use repeated flags if you prefer
npx @rlevin/uirig <URL> -s="#hero" -s="ag-button" -s=".pricing-card"

# Group cascading child failures by parent + emit ~40-token layout coordinates + top 5 issues
npx @rlevin/uirig http://localhost:5173 --group-by-root --spatial-brief --top=5 --json
```

*(If `@rlevin/uirig` is already installed in your repository's `node_modules`, you can run `npx uirig ...` directly.)*

---

## The 6-Tool Verification Suite

| Engine | CLI Gate | What It Audits | Failure Exit Code |
| :--- | :--- | :--- | :---: |
| **1. Design Tokens** | `tokens` | Walks Light DOM and open `ShadowRoot` trees to flag hardcoded colors, spacing, font sizes, or radii outside your configured or `--auto-tokens` scale. | `1` |
| **2. WCAG Contrast** | `contrast` | Composites ancestor alpha/opacity layers (Porter-Duff Source-Over), evaluates worst-case CSS `background-clip: text` gradient color stops, verifies WCAG 2.1 AA contrast (`>= 4.5:1`), and suggests nearest passing tokens. | `1` |
| **3. Dark-Mode Parity** | `dark-mode` | Emulates dark color scheme / `[data-theme="dark"]`, re-audits contrast, and flags surfaces stranded at bright light luminance (`> 0.85`). | `1` |
| **4. Geometric Stress** | `stress` | Injects `+30%` longer text and long space-free strings (like emails and URLs) to check container overflow, `100vw` bleed, avatar squishing, and `24x24px` tap targets. | `2` |
| **5. Layout Shift** | `cls` | Enforces W3C 1s/5s session-window `clsMaxLimit` budgets across live page loads, catching unexpected layout jumps before users see them. | `2` |
| **6. DOM & AX Integrity** | `dom` | Inspects Chromium's computed accessibility tree (`ax_empty_name`, `ax_hidden_focus`) plus dangling `aria-labelledby`/`for` IDs, unlabeled controls, broken `<img>` loads, `javascript:` URIs, orphaned Web Component `<slot>` children, and hidden AI prompt-injection traps. | `1` |

*(Full suite runs also automatically fail with exit code `1` if the page throws uncaught runtime JavaScript errors during load.)*

---

## Installation & Workspace Setup

### Prerequisites
* **Node.js 22+**
* **Playwright Chromium browser binary**

```bash
npm install -D @rlevin/uirig
npx playwright install chromium
```

### Optional Workspace Initialization (`uirig init`)
When you are ready to enforce custom design tokens, multi-viewport budgets, or AI agent skills in a repository, run `init` to scaffold `uirig.config.json`, `.uirig/session.json`, and `.uirig/SKILL.md`:

```bash
npx @rlevin/uirig init
```

### Configuration (`uirig.config.json`)

```json
{
  "$schema": "https://json-schema.org",
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./config/default_tokens.json",
  "autoTokens": false,
  "themes": ["light", "dark"],
  "changedPaths": {
    "include": ["src/components/**", "src/app/**/_components/**", "app/views/**"],
    "exclude": ["src/toys/**", "src/experimental/**"]
  },
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

*(When `tokensPath` is omitted and `--auto-tokens` or `"autoTokens": true` is active, `uirig` automatically discovers design tokens from W3C `*.tokens.json`, Style Dictionary JSON, Tailwind v4 `@theme` CSS blocks, and live `:root` CSS custom properties. Explicit `tokensPath` always takes precedence. When `changedPaths` is omitted, `--changed` automatically detects standard frontend component extensions as well as server-rendered templates like `.erb`, `.jinja2`, `.heex`, `.twig`, and `.cshtml` across any folder layout.)*

### Bundler-Proof Rule Escape Hatches
Because `uirig` evaluates live computed DOM styles after bundlers strip CSS comments, you can exempt intentional one-off overrides in two ways:

1. **In Markup (`data-uirig-ignore`):** Add `data-uirig-ignore` to an element, ancestor container, or Web Component host. Exemptions cascade down to child elements and across open `ShadowRoot` boundaries:

```html
<!-- Exempt a single rule -->
<div data-uirig-ignore="tokens">Intentional one-off hero gradient</div>

<!-- Exempt multiple comma-separated rules -->
<ag-card data-uirig-ignore="tokens, dark-mode">Custom promotional card</ag-card>

<!-- Exempt all engines on a third-party widget -->
<section data-uirig-ignore="all">Legacy third-party embed</section>
```

2. **In `uirig.config.json` (`ignore`):** Exempt specific selectors or route URLs (including trailing `*` wildcards) centrally without touching markup:

```json
"ignore": [
  { "rule": "tokens", "selector": ".legacy-embed" },
  { "rule": "contrast", "url": "http://localhost:5173/admin/*" },
  { "rule": "all", "selector": "#third-party-chat" }
]
```

---

## CLI Command Reference

*(If `@rlevin/uirig` is installed locally in `node_modules`, `npx uirig` can be used interchangeably with `npx @rlevin/uirig`.)*

### Instant Target Run (`npx @rlevin/uirig <url-or-file> [options]`)
Runs all 6 verification engines against a single URL or local `.html` path using `uirig.config.json` if present, or sensible built-in defaults if not.

### `uirig check [options]`
Launches a single Chromium instance and executes all 6 verification engines across every configured `(url, viewport, theme)` tuple in isolated parallel `BrowserContext` sessions. Writes a standalone Markdown PR report to `.uirig/github_pr_comment.md`.

### Standalone Engine Commands
Run any individual verification engine in isolation for rapid inner-loop debugging or targeted AI agent re-checks:

```bash
npx @rlevin/uirig tokens [<url-or-file>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig contrast [<url-or-file>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig dark-mode [<url-or-file>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig stress [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig cls [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig dom [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
```

### Shared Options
* `--auto-tokens`: Auto-discover design tokens from workspace files (`*.tokens.json`, Style Dictionary JSON, Tailwind v4 `@theme` CSS) and live `:root` CSS custom properties when `tokensPath` is not set.
* `--themes=<csv>`: Evaluate the target across multiple theme skins (e.g. `--themes="light, dark, enterprise-dark"`) via `data-theme` and color-scheme emulation in a single session.
* `--changed`: Inspect `git diff` (filtered by optional `changedPaths` globs) to infer modified custom element tags/selectors and skip browser execution cleanly (`exitCode: 0`) when no UI/component/template files changed.
* `--base=<ref>`: Git base ref for `--changed` diff comparison (e.g. `--base=main` or `--base=origin/main` in CI/CD pull requests).
* `--fix`: Apply deterministic, unambiguous 1-to-1 fixes on disk (when `sourceFile` and `lineNumber` are resolved inside the workspace) and automatically run a re-verification pass.
* `-s, --selectors=<csv>`: Filter element-level checks to matching CSS selectors (comma-separated and repeatable; pierces Web Component `ShadowRoot` boundaries).
* `--group-by-root`: Collapse cascading child failures under their shared parent container or Web Component host (`childCount` + up to 3 `sampleChildren`).
* `--top=<n>`: Keep only the top `N` highest-priority violations (`cls` / `runtime` > `stress` > `contrast` / `dark-mode` > `tokens` > `dom`) and include `totalViolations` + `truncatedCount` metadata when trimmed.
* `--max-tokens=<budget>`: Cap serialized JSON output to approximately `N` LLM tokens without ever cutting off valid JSON object boundaries.
* `--spatial-brief`: Emit an ultra-compact, plain-text bounding-box summary (`header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836]`) of semantic landmarks, top-level custom elements, and target selectors (~40 tokens, zero vision screenshots required).
* `--verbose`: Print every individual failing selector path, Shadow DOM host, measured delta, and suggested token beneath each engine summary.
* `--config=<path>`: Use a custom configuration file path.
* `--only=<tool>`: Filter `check` to a single engine (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, or `dom`).
* `--json`: Route colored diagnostic logs to `stderr` and write a single deduplicated JSON report (including `sourceFile`, `lineNumber`, `columnNumber`, and `unifiedDiff`) to `stdout`.
* `--headed`: Run Chromium with a visible browser window for local inspection.
* `<command> --help` / `help <command>`: Print detailed mechanics, flags, exit codes, and examples for any subcommand.

### POSIX Exit Codes
* `0`: All token, contrast, dark-mode parity, geometric stress, CLS, DOM integrity, and runtime checks passed.
* `1`: Design token drift, WCAG/dark-mode contrast failure, DOM/ARIA/hygiene violation, uncaught runtime JS error, or config error.
* `2`: Structural layout break (overflow, horizontal scrollbar, tap-target collision) or CLS budget breach.

---

## How Self-Healing Actually Works: Sensor vs. Actor Ownership

`uirig` never silently rewrites your UI or mutates your application state on its own. Instead, self-healing works as a closed-loop **Sensor vs. Actor** cycle between `uirig` and your AI coding agent (or opt-in A2UI harness):

| Responsibility | Owner | What Happens at Runtime |
| :--- | :--- | :--- |
| **Deterministic Measurement & Attribution** | **`uirig` (The Sensor)** | Audits live Chromium viewports across Light/Dark themes and ShadowRoots, emitting structured `violations[]` with `hostComponent`, `a2ui` component IDs (`a2uiComponentId`, `wirePath`), `suggestedToken`, `remediationAdvice`, and POSIX exit codes (`0`, `1`, `2`). |
| **UI/UX Authorship & Code/Delta Synthesis** | **LLM Agent / Studio Harness (The Actor)** | Owns all creative layout decisions, copywriting, component selection, and code edits. Reads `exitCode !== 0`, patches the offending CSS/template or emits an A2UI v1.0 `updateComponents` delta, and re-runs `uirig` until `exitCode === 0`. |
| **End-User Experience** | **CI Gate or Coding Host** | In **Mode 1 (Always-On Detection)**, users see a deterministic pass/fail CI check and Markdown PR report. In **Mode 2 (Opt-In Self-Healing)**, Turn 1's defect is repaired automatically behind the scenes in ~2–4s and the user receives the verified UI alongside a concise audit summary (*"Auto-repaired 1 unlabeled icon button; verified `exitCode: 0`"*). |

### End-to-End 2-Turn Self-Healing Trace (`A2UI v1.0`)

1. **Turn 1 — Initial Audit (`exitCode: 1`):** The agent generates an `<a2ui-surface>` Support Center ticket drawer and runs `uirig`:

```bash
npx @rlevin/uirig http://localhost:5173 --selectors="a2ui-surface" --themes="light,dark" --json
```

`uirig` detects an icon-only button missing an accessible name inside `<ag-icon-button>` and emits component-attributed JSON to `stdout`:

```json
{
  "tool": "uirig",
  "exitCode": 1,
  "passed": false,
  "violations": [
    {
      "engine": "dom",
      "violationType": "unlabeled_control",
      "viewport": "desktop (1440x900) [theme: light]",
      "hostComponent": "ag-icon-button",
      "a2ui": {
        "surfaceId": "support-ticket",
        "a2uiComponentId": "close_drawer_btn",
        "a2uiComponentType": "IconButton",
        "catalogId": "agnosticui-v1",
        "wirePath": "/components/1"
      },
      "remediationAdvice": "In A2UI updateComponents for surface 'support-ticket', update component 'close_drawer_btn' (IconButton): add a non-empty 'ariaLabel' or 'label' property so the rendered control exposes an accessible name."
    }
  ]
}
```

2. **Turn 2 — Minimal `updateComponents` Delta & Re-Verification (`exitCode: 0`):** Using `a2ui.a2uiComponentId`, the agent (or `runA2uiSelfHealingLoop()`) emits a standard A2UI v1.0 delta touching only `close_drawer_btn` and re-runs `uirig` to confirm `exitCode === 0`:

```json
{
  "updateComponents": {
    "surfaceId": "support-ticket",
    "components": [
      { "id": "close_drawer_btn", "ariaLabel": "Close Drawer Btn" }
    ]
  }
}
```

---

## Common Use Cases

### 1. AI Design System Harness Loop (`AGENTS.md` + `--auto-tokens --group-by-root --spatial-brief --top=5 --json`)
`uirig init` generates `.uirig/SKILL.md` so coding agents (Claude Code, Cursor, Codex) can auto-discover design tokens (`--auto-tokens`), verify macro-layout (`spatialBrief`), collapse cascading child failures under their parent (`--group-by-root`), and tackle the highest-impact defects first without prompt bloat:

```bash
npx @rlevin/uirig http://localhost:5173 --auto-tokens --group-by-root --spatial-brief --top=5 --json
```

Each entry in `violations` includes `engine`, `hostComponent`, `a2ui` (when inside `<a2ui-surface>` or `[data-a2ui-surface]`), `sourceFile` / `lineNumber` / `columnNumber` (when CSS/JS source maps or dev metadata hooks like `data-source-loc` are present; `null` in unmapped production builds), `selector`, `childCount` / `sampleChildren` (when grouped), `suggestedToken`, and `remediationAdvice` so the agent can jump directly to the exact file and line without grepping the repository.

### 2. Native MCP Server Mode (`uirig mcp`)
Eliminate Chromium cold-start latency inside AI coding hosts (Claude Code, Cursor, Windsurf, Codex) by registering `uirig mcp`, which keeps a warm headless Chromium pool alive across edits and exposes `uirig_check`, `uirig_tokens`, `uirig_contrast`, `uirig_dark_mode`, `uirig_stress`, `uirig_cls`, and `uirig_dom` as native MCP tools:

```json
{
  "mcpServers": {
    "uirig": {
      "command": "npx",
      "args": ["-y", "@rlevin/uirig", "mcp"]
    }
  }
}
```

*(You can also inspect or debug tools interactively via `npx @modelcontextprotocol/inspector npx @rlevin/uirig mcp`, or run over HTTP/SSE with `npx @rlevin/uirig mcp --transport=sse --port=3333`.)*

### 3. GitHub Actions CI/CD Gate

```yml
- name: Run uirig UI verification gate
  run: |
    npm run build
    npx @rlevin/uirig ./dist/index.html --changed --base=origin/\${{ github.base_ref }} --verbose
```

On every `uirig check` run, `.uirig/github_pr_comment.md` is generated and ready to post onto Pull Requests.

### 4. Git Pre-Commit Hook (`.git/hooks/pre-commit`)

```bash
#!/usr/bin/env bash
set -e
npx @rlevin/uirig check --changed --config=uirig.config.json
```

### 5. Local Development & Playground

`uirig` ships with a self-contained **Vite + Lit + AgnosticUI** spot-checking sandbox in `playground/` that renders live open-`ShadowRoot` Web Components (`<ag-card>`, `<ag-input>`, `<ag-button>`) alongside deliberate adversarial traps and an `<a2ui-surface>` fixture:

- **Section 1 (`#baseline-card`)** — Compliant AgnosticUI Lit Web Components bound to `--ag-*` light/dark semantic tokens (`0 PASS`).
- **Section 2 (`#adversarial-traps`)** — Deliberate token-drift and contrast trap styled in source-mapped `playground/src/traps.css` (`2.54:1` contrast) plus a cramped `120px` geometric overflow trap (`#overflow-trap-box`).
- **Section 3 (`#a2ui-ax-traps`)** — `<a2ui-surface id="playground-support-ticket">` generative ticket drawer containing an unlabeled icon button (`unlabeled_control` + `ax_empty_name`), a `data-source-loc`-attributed `javascript:void(0)` link (`unsafe_uri`), and a post-paint un-sized banner (`#cls-trap-slot`) that triggers measurable CLS (`> 0.1`).

#### 3-Step Hands-On Walkthrough

1. **Start the live playground & spot-check runner (Terminal 1):**

   ```bash
   npm run playground:dev
   ```

   Vite serves the sandbox at `http://localhost:5173` and automatically runs all 6 core `uirig` validation engines + v0.3.0 diagnostics (`file:line`, `<ag-*>` Shadow DOM host, `a2ui` component IDs, `suggestedToken`, remediation hints, and `unifiedDiff` previews) in headless Chromium on boot.

2. **Inspect structured JSON attribution, multi-theme parity, and auto-fix patches (Terminal 2):**

   > **Note:** When running `uirig` from within the cloned `uirig` repository, use `npm run uirig -- <command>` (which wraps `node ./bin/uirig`) rather than `npx uirig`. Because the local `package.json` declares `"name": "@rlevin/uirig"`, `npx` resolves against the local workspace (where `node_modules/.bin/uirig` is not self-linked) instead of downloading from npm, resulting in `uirig: command not found`. Include `--` after `npm run uirig` so npm forwards flags like `--json`, `--themes`, and `--fix` directly to the CLI (run `npm run build` first if `dist/` has not been compiled yet).

   With `http://localhost:5173` running in Terminal 1, run `npm run uirig -- check` directly against the live sandbox in a second terminal (pass `--auto-tokens` in external repos without `config/default_tokens.json` to auto-harvest all CSS custom properties from the live page):

   ```bash
   # 1. Structured JSON report with source-map file:line, A2UI attribution, and unifiedDiff
   npm run uirig -- check http://localhost:5173 --json

   # 2. Multi-theme Light & Dark contrast parity matrix
   npm run uirig -- check http://localhost:5173 --themes light,dark

   # 3. Preview and apply deterministic auto-fixes (e.g., replacing href="javascript:void(0)")
    #    Note: Applying --fix edits playground/index.html on disk (triggering Vite live-reload in Terminal 1);
    #    run `git checkout -- playground/index.html` afterward to restore the deliberate trap.
    npm run uirig -- check http://localhost:5173 --fix
   ```

3. **Edit & watch Vite live-reload self-heal down to `0 PASS`:**

   Open `playground/src/traps.css` or `playground/index.html` and fix any trap (for example, bind `#contrast-token-trap` to `--ag-background-secondary` / `--ag-text-primary`, add `aria-label="Close ticket"` to `#a2ui-unlabeled-close-btn`, or widen `#overflow-trap-box`). Every file save triggers Vite HMR (Hot Module Replacement) and automatically re-runs the spot-check report in Terminal 1 so you can watch each engine flip from `FAIL` to `0 PASS`.

#### Playground Scripts Reference

```bash
# Run core library unit tests (no Chromium required)
npm test

# Run the local compiled uirig CLI from inside this repository
npm run uirig -- --help

# Start the local Vite + AgnosticUI playground with automatic live 6-engine + v0.3.0 spot-checking on boot and file save
npm run playground:dev

# Run the end-to-end 6-engine + v0.3.0 playground integration test in headless Chromium
npm run playground:test

# Run the live 6-engine + v0.3.0 playground verification in a visible (headed) Chromium browser window
npm run playground:test:headed
```

---

## License

MIT
