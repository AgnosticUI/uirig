# `uirig` (`@rlevin/uirig`)

**The first line of defense for AI-generated UIs and Web Components.**

`uirig` acts as a fast, zero-config guardrail: auditing live running viewports inside isolated headless Chromium contexts to catch design drift, light/dark contrast failures, layout breaks, Cumulative Layout Shift (CLS), and structural DOM hallucinations without brittle screenshot diffs (before you ever run a heavy `axe-core` audit or Lighthouse profile).

---

## Why `uirig`? (And Why It Beats Just Running `axe` or `Lighthouse` First)

General-purpose auditors like `axe-core` and Lighthouse are essential for final compliance, **but they are blind to layout breaks, design drift, and Shadow DOM nuances that AI coding agents introduce every day:**

1. **Structural Layout & Overflow Fuzzing (`stress`):** `axe` and Lighthouse never test what happens when copy grows by +30% or when a long unbreakable email/URL hits a flex container. `uirig` mutates text nodes inside an isolated browser context to catch clipped buttons, overlapping siblings, horizontal scrollbar bleed (`100vw`), squished avatars, stuck `opacity: 0` elements, and `< 24x24px` tap-target collisions.
2. **Dark-Mode Theme Parity (`dark-mode`):** `axe` only checks whatever theme is currently rendered. `uirig` automatically emulates `prefers-color-scheme: dark` and `data-theme="dark"` in an isolated context—re-running Porter-Duff composited contrast checks and catching large surfaces stranded in blinding light mode (`luminance > 0.85`).
3. **Design System Token Drift (`tokens`):** `axe` does not know your design system's spacing, color, typography, or border-radius scale. `uirig` crawls rendered computed styles across both Light DOM and open `ShadowRoot` trees, flags off-scale hardcoded values, and suggests the nearest passing token (`suggestedToken`).
4. **Session-Window CLS & Runtime Crash Capture (`cls` + `runtime`):** Measures Google's W3C 1s/5s session-window Cumulative Layout Shift (`hadRecentInput: false`) and captures uncaught `pageerror` / `console.error` exceptions during navigation.
5. **Markup & Prompt-Injection Hygiene (`dom`):** Verifies `aria-labelledby` / `label[for]` ID resolution across Light + Shadow DOM, detects broken `<img>` elements (`naturalWidth === 0`), blocks unsafe `javascript:` URIs and missing `rel="noopener"`, and flags invisible AI prompt-injection traps.
6. **Renderer-Agnostic A2UI Surface Attribution (`a2ui`):** When auditing generative UIs rendered inside `<a2ui-surface>` or `[data-a2ui-surface]` (across Lit, React, Vue, Angular, or Flutter Web), `uirig` climbs composed `ShadowRoot.host` boundaries to resolve the exact `surfaceId`, `a2uiComponentId`, `a2uiComponentType`, `catalogId`, `wirePath`, and a ready-to-apply `suggestedPatch` into an out-of-band `a2ui` diagnostic block—and generates catalog-neutral `updateComponents` `remediationAdvice` without ever mutating A2UI wire schemas.

---

## Installation & Quick Start

### Zero-Config Instant Audit (No Config File Required)
Run `uirig` directly against any running dev server URL or standalone `.html` file:

```bash
# Audit a live local dev server (auto-discovers tokens & scrapes live :root CSS vars)
npx @rlevin/uirig http://localhost:5173 --auto-tokens

# Audit a standalone local HTML file (starts an ephemeral 127.0.0.1 server automatically)
npx @rlevin/uirig ./dist/index.html

# Inspect with a visible Chromium window
npx @rlevin/uirig http://localhost:5173 --headed
```

### Project Setup (`uirig init`)
Scaffold `uirig.config.json`, `.uirig/session.json`, and an AI coding agent skill file (`.uirig/SKILL.md`):

```bash
npx @rlevin/uirig init
npx @rlevin/uirig check
```

---

## Configuration (`uirig.config.json`)

```json
{
  "$schema": "./node_modules/@rlevin/uirig/schema/uirig.config.schema.json",
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./tokens/design.tokens.json",
  "themes": ["light", "dark"],
  "changedPaths": {
    "include": ["src/components/**", "src/styles/**"],
    "exclude": ["**/*.test.ts", "**/*.spec.ts"]
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
    { "rule": "tokens", "selector": ".legacy-widget" },
    { "rule": "all", "url": "http://localhost:5173/storybook/*" }
  ]
}
```

### Ignoring Intentional Exceptions (`data-uirig-ignore` & `ignore` Rules)

1. **In HTML / Web Component Markup (`data-uirig-ignore`):** Add `data-uirig-ignore` on any element (or container) to exempt it and its subtree—including nested `ShadowRoot` nodes—from specific engines or all rules:

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

## Design Token Setup (`tokensPath`, `--tokens-path`, & `--auto-tokens`)

`uirig`'s `tokens` engine audits rendered Light DOM and Web Component `ShadowRoot` styles (`color`, `backgroundColor`, `padding*`, `margin*`, `fontSize`, and `borderRadius`) against your design system's valid values—and feeds your color palette into `contrast` / `dark-mode` so violations include an actionable `suggestedToken`.

You never have to manually flatten nested token dictionaries or copy CSS variables into arrays. You can supply tokens in any of three ways (ordered from highest to lowest precedence):

1. **CLI Override (`--tokens-path=<path>` / `--token-path=<path>`):** Point directly at a token file on the command line (overrides `config.tokensPath` when both are set):

```bash
npx @rlevin/uirig check http://localhost:5173 --tokens-path=./design.tokens.json --verbose
```

2. **Config File (`tokensPath` in `uirig.config.json`):** Set a relative path to your project's token file (resolved relative to `uirig.config.json`):

```json
{
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./tokens/design.tokens.json"
}
```

3. **Zero-Config Auto-Discovery (`--auto-tokens` or `"autoTokens": true`):** When neither `--tokens-path` nor `tokensPath` is set, `uirig` scans workspace token files (`*.tokens.json`, `*token*.json`, and Tailwind v4 `@theme` CSS blocks) **and** scrapes live `:root` / `html` CSS custom properties (`--*`) directly from the rendered page in Chromium:

```bash
npx @rlevin/uirig http://localhost:5173 --auto-tokens --verbose
```

### Supported Token File Formats

Files referenced by `tokensPath` or `--tokens-path` may use **any** of these four formats—`uirig` automatically normalizes hex, `hsl()`, `oklch()`, and `rgb()`/`rgba()` colors to computed `rgb(...)` strings and converts `rem`/`em` lengths to `px`:

1. **W3C Design Tokens Format (`$value` leaves):**

```json
{
  "color": {
    "brand": { "primary": { "$value": "#2563eb", "$type": "color" } },
    "surface": { "canvas": { "$value": "#ffffff", "$type": "color" } }
  },
  "spacing": { "md": { "$value": "1rem", "$type": "dimension" } },
  "font": { "size": { "body": { "$value": "16px", "$type": "dimension" } } },
  "radius": { "card": { "$value": "0.5rem", "$type": "dimension" } }
}
```

2. **Style Dictionary Format (`value` leaves):**

```json
{
  "color": { "text": { "primary": { "value": "#0f172a" } } },
  "size": { "padding": { "base": { "value": "12px" } } }
}
```

3. **CSS Custom Properties Stylesheet (`.css` with `:root`, `[data-theme]`, or `@theme`):**

```css
:root {
  --brand-primary: #2563eb;
  --color-action: var(--brand-primary);
  --space-4: 1rem;
  --font-size-md: 16px;
  --radius-md: 0.5rem;
}
```

4. **Flat Scale JSON (`colors`, `spacing`, `fontSizes`, `radii` string arrays — e.g. `config/default_tokens.json`):**

```json
{
  "colors": ["rgb(255, 255, 255)", "rgb(17, 24, 39)", "rgb(37, 99, 235)"],
  "spacing": ["0px", "4px", "8px", "16px", "24px", "32px"],
  "fontSizes": ["12px", "14px", "16px", "20px", "24px"],
  "radii": ["0px", "4px", "8px", "9999px"]
}
```

*(If a file cannot be parsed or contains no recognized color/length tokens, `uirig` exits with `ERR_TOKENS_SCHEMA` and prints the supported formats and `--auto-tokens` fallback guidance.)*

### Ignoring Intentional One-Off Exceptions
You can silence known exceptions without weakening global budgets:

1. **In HTML / Web Component Markup (`data-uirig-ignore`):**

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

## Design Token Setup (`tokensPath`, `--tokens-path`, & `--auto-tokens`)

`uirig`'s `tokens` engine audits rendered Light DOM and Web Component `ShadowRoot` styles (`color`, `backgroundColor`, `padding*`, `margin*`, `fontSize`, and `borderRadius`) against your design system's valid values—and feeds your color palette into `contrast` / `dark-mode` so violations include an actionable `suggestedToken`.

You never have to manually flatten nested token dictionaries or copy CSS variables into arrays. You can supply tokens in any of three ways (ordered from highest to lowest precedence):

1. **CLI Override (`--tokens-path=<path>` / `--token-path=<path>`):** Point directly at a token file on the command line (overrides `config.tokensPath` when both are set):

```bash
npx @rlevin/uirig check http://localhost:5173 --tokens-path=./design.tokens.json --verbose
```

2. **Config File (`tokensPath` in `uirig.config.json`):** Set a relative path to your project's token file (resolved relative to `uirig.config.json`):

```json
{
  "targetUrls": ["http://localhost:5173"],
  "tokensPath": "./tokens/design.tokens.json"
}
```

3. **Zero-Config Auto-Discovery (`--auto-tokens` or `"autoTokens": true`):** When neither `--tokens-path` nor `tokensPath` is set, `uirig` scans workspace token files (`*.tokens.json`, `*token*.json`, and Tailwind v4 `@theme` CSS blocks) **and** scrapes live `:root` / `html` CSS custom properties (`--*`) directly from the rendered page in Chromium:

```bash
npx @rlevin/uirig http://localhost:5173 --auto-tokens --verbose
```

### Supported Token File Formats

Files referenced by `tokensPath` or `--tokens-path` may use **any** of these four formats—`uirig` automatically normalizes hex, `hsl()`, `oklch()`, and `rgb()`/`rgba()` colors to computed `rgb(...)` strings and converts `rem`/`em` lengths to `px`:

1. **W3C Design Tokens Format (`$value` leaves):**

```json
{
  "color": {
    "brand": { "primary": { "$value": "#2563eb", "$type": "color" } },
    "surface": { "canvas": { "$value": "#ffffff", "$type": "color" } }
  },
  "spacing": { "md": { "$value": "1rem", "$type": "dimension" } },
  "font": { "size": { "body": { "$value": "16px", "$type": "dimension" } } },
  "radius": { "card": { "$value": "0.5rem", "$type": "dimension" } }
}
```

2. **Style Dictionary Format (`value` leaves):**

```json
{
  "color": { "text": { "primary": { "value": "#0f172a" } } },
  "size": { "padding": { "base": { "value": "12px" } } }
}
```

3. **CSS Custom Properties Stylesheet (`.css` with `:root`, `[data-theme]`, or `@theme`):**

```css
:root {
  --brand-primary: #2563eb;
  --color-action: var(--brand-primary);
  --space-4: 1rem;
  --font-size-md: 16px;
  --radius-md: 0.5rem;
}
```

4. **Flat Scale JSON (`colors`, `spacing`, `fontSizes`, `radii` string arrays — e.g. `config/default_tokens.json`):**

```json
{
  "colors": ["rgb(255, 255, 255)", "rgb(17, 24, 39)", "rgb(37, 99, 235)"],
  "spacing": ["0px", "4px", "8px", "16px", "24px", "32px"],
  "fontSizes": ["12px", "14px", "16px", "20px", "24px"],
  "radii": ["0px", "4px", "8px", "9999px"]
}
```

*(If a file cannot be parsed or contains no recognized color/length tokens, `uirig` exits with `ERR_TOKENS_SCHEMA` and prints the supported formats and `--auto-tokens` fallback guidance.)*

### Ignoring Intentional Exceptions

1. **Inline in HTML / Web Components (`data-uirig-ignore`):**

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

## Design Token Setup (`tokensPath`, `--tokens-path`, & `--auto-tokens`)

`uirig`'s `tokens` engine audits rendered Light DOM and Web Component `ShadowRoot` styles (`color`, `backgroundColor`, `padding*`, `margin*`, `fontSize`, and `borderRadius`) against your design system's valid values—and feeds your color palette into `contrast` / `dark-mode` so violations include an actionable `suggestedToken`.

You never have to manually flatten nested token dictionaries or copy CSS variables into arrays. You can supply tokens in any of three ways (ordered from highest to lowest precedence):

1. **CLI Override (`--tokens-path=<path>` / `--token-path=<path>`):** Point directly at a token file on the command line (overrides `config.tokensPath` when both are set):

   ```bash
   npx @rlevin/uirig check http://localhost:5173 --tokens-path=./design.tokens.json --verbose
   ```

2. **Config File (`tokensPath` in `uirig.config.json`):** Set a relative path to your project's token file (resolved relative to `uirig.config.json`):

   ```json
   {
     "targetUrls": ["http://localhost:5173"],
     "tokensPath": "./tokens/design.tokens.json"
   }
   ```

3. **Zero-Config Auto-Discovery (`--auto-tokens` or `"autoTokens": true`):** When neither `--tokens-path` nor `tokensPath` is set, `uirig` scans workspace token files (`*.tokens.json`, `*token*.json`, and Tailwind v4 `@theme` CSS blocks) **and** scrapes live `:root` / `html` CSS custom properties (`--*`) directly from the rendered page in Chromium:

   ```bash
   npx @rlevin/uirig http://localhost:5173 --auto-tokens --verbose
   ```

### Supported Token File Formats

Files referenced by `tokensPath` or `--tokens-path` may use **any** of these four formats—`uirig` automatically normalizes hex, `hsl()`, `oklch()`, and `rgb()`/`rgba()` colors to computed `rgb(...)` strings and converts `rem`/`em` lengths to `px`:

1. **W3C Design Tokens Format (`$value` leaves):**

   ```json
   {
     "color": {
       "brand": { "primary": { "$value": "#2563eb", "$type": "color" } },
       "surface": { "canvas": { "$value": "#ffffff", "$type": "color" } }
     },
     "spacing": { "md": { "$value": "1rem", "$type": "dimension" } },
     "font": { "size": { "body": { "$value": "16px", "$type": "dimension" } } },
     "radius": { "card": { "$value": "0.5rem", "$type": "dimension" } }
   }
   ```

2. **Style Dictionary Format (`value` leaves):**

   ```json
   {
     "color": { "text": { "primary": { "value": "#0f172a" } } },
     "size": { "padding": { "base": { "value": "12px" } } }
   }
   ```

3. **CSS Custom Properties Stylesheet (`.css` with `:root`, `[data-theme]`, or `@theme`):**

   ```css
   :root {
     --brand-primary: #2563eb;
     --color-action: var(--brand-primary);
     --space-4: 1rem;
     --font-size-md: 16px;
     --radius-md: 0.5rem;
   }
   ```

4. **Flat Scale JSON (`colors`, `spacing`, `fontSizes`, `radii` string arrays — e.g. `config/default_tokens.json`):**

   ```json
   {
     "colors": ["rgb(255, 255, 255)", "rgb(17, 24, 39)", "rgb(37, 99, 235)"],
     "spacing": ["0px", "4px", "8px", "16px", "24px", "32px"],
     "fontSizes": ["12px", "14px", "16px", "20px", "24px"],
     "radii": ["0px", "4px", "8px", "9999px"]
   }
   ```

*(If a file cannot be parsed or contains no recognized color/length tokens, `uirig` exits with `ERR_TOKENS_SCHEMA` and prints the supported formats and `--auto-tokens` fallback guidance.)*

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
npx @rlevin/uirig tokens [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig contrast [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig dark-mode [<url-or-file>] [--tokens-path=<path>] [--auto-tokens] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig stress [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig cls [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
npx @rlevin/uirig dom [<url-or-file>] [--themes=<csv>] [--changed] [--base=<ref>] [--selectors=<csv>] [--config=<path>] [--group-by-root] [--top=<n>] [--max-tokens=<budget>] [--spatial-brief] [--verbose] [--json] [--headed]
```

### Shared Options
* `--tokens-path=<path>` (alias: `--token-path=<path>`): Path to a W3C Design Tokens JSON (`$value`), Style Dictionary JSON (`value`), flat scale JSON, or CSS custom properties (`.css`) file; overrides `tokensPath` in `uirig.config.json`.
* `--auto-tokens`: Auto-discover design tokens from workspace files (`*.tokens.json`, Style Dictionary JSON, Tailwind v4 `@theme` CSS) and live `:root` CSS custom properties when `tokensPath` / `--tokens-path` is not set.
* `--themes=<csv>`: Evaluate the target across multiple theme skins (e.g. `--themes="light, dark, enterprise-dark"`) via `data-theme` and color-scheme emulation in a single session.
* `--changed`: Inspect `git diff` (filtered by optional `changedPaths` globs) to infer modified custom element tags/selectors and skip browser execution cleanly (`exitCode: 0`) when no UI/component/template files changed.
* `--base=<ref>`: Git base ref for `--changed` diff comparison (e.g. `--base=main` or `--base=origin/main` in CI/CD pull requests).
* `--fix`: Apply deterministic, unambiguous 1-to-1 fixes on disk (when `sourceFile` and `lineNumber` are resolved inside the workspace) and automatically run a re-verification pass.
* `-s, --selectors=<csv>`: Filter element-level checks to matching CSS selectors (comma-separated and repeatable; pierces Web Component `ShadowRoot` boundaries).
* `--group-by-root`: Collapse cascading child failures under their shared parent container or Web Component host (`childCount` + up to 3 `sampleChildren`).
* `--top=<n>`: Keep only the top `N` highest-priority violations (`cls` / `runtime` > `stress` > `contrast` / `dark-mode` > `tokens` > `dom`) and include `totalViolations` + `truncatedCount` metadata when trimmed.
* `--max-tokens=<budget>`: Cap serialized JSON output to approximately `N` LLM tokens without ever cutting off valid JSON object boundaries.
* `--spatial-brief`: Emit an ultra-compact, plain-text bounding-box summary (`header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836]`) of semantic landmarks, top-level custom elements, and target selectors (~40 tokens, zero vision screenshots required).
* `--verbose`: Print every individual failing selector path, source-map `file:line`, Shadow DOM host, A2UI component ID, measured delta, and suggested token beneath each engine summary.
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
Eliminate Chromium cold-start latency inside AI coding hosts (Claude Code, Cursor, Windsurf, Codex) by registering `uirig mcp`, which keeps a warm headless Chromium pool alive across edits and exposes `uirig_check`, `uirig_tokens`, `uirig_contrast`, `uirig_dark_mode`, `uirig_stress`, `uirig_cls`, `uirig_dom`, and `uirig_a2ui_delta` as native MCP tools:

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

2. **Inspect terminal `file:line` attribution, structured JSON, multi-theme parity, and auto-fix patches (Terminal 2):**

   > **Note:** When running `uirig` from within the cloned `uirig` repository, use `npm run uirig -- <command>` (which wraps `node ./bin/uirig`) rather than `npx uirig`. Because the local `package.json` declares `"name": "@rlevin/uirig"`, `npx` resolves against the local workspace (where `node_modules/.bin/uirig` is not self-linked) instead of downloading from npm, resulting in `uirig: command not found`. Include `--` after `npm run uirig` so npm forwards flags like `--auto-tokens`, `--verbose`, `--json`, `--themes`, and `--fix` directly to the CLI (run `npm run build` first if `dist/` has not been compiled yet). Also note that if you modify the `uirig` library source code itself, you must re-run `npm run build` so `./bin/uirig` reflects those changes.

   With `http://localhost:5173` running in Terminal 1, run `npm run uirig -- check` against the live sandbox in a second terminal (pass `--auto-tokens` to scrape the playground's live `--ag-*` CSS variables, or `--tokens-path=<path>` to point at a custom token file):

   ```bash
   # 1. Human-readable terminal report with inline [file:line], Shadow DOM host, and A2UI attribution
   npm run uirig -- check http://localhost:5173 --auto-tokens --verbose

   # 2. Structured JSON report with source-map file:line, A2UI attribution, and unifiedDiff
   npm run uirig -- check http://localhost:5173 --json

   # 3. Multi-theme Light & Dark contrast parity matrix
   npm run uirig -- check http://localhost:5173 --themes light,dark

   # 4. Preview and apply deterministic auto-fixes (e.g., replacing href="javascript:void(0)")
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
