# `uirig`: Tool Expansion ROI Matrix & Strategic Pivot (Phase 7)

Living evaluation table tracking candidate verification tools, browser security/integrity gates, and engine upgrades before committing engineering effort.

## Strategic Positioning Guardrail
`uirig` is intentionally scoped as **the first line of defense for AI-generated UIs and Web Components**: a fast, zero-config deterministic guardrail that catches design token drift, light/dark contrast breakage, geometric overflow, CLS, and structural DOM hallucinations before heavier QA tools (`axe-core`, Lighthouse, or DAST scanners) run.

* **Zero-Config Hook:** `npx uirig <url-or-file>` runs immediately with sensible defaults (no `uirig.config.json` required on first run).
* **No Active State-Mutating Fuzzing:** Active form or URL submission fuzzing is excluded from default runs so `uirig` remains safe and side-effect-free against staging environments.
* **Honest Tool Boundaries:** Structural markup checks are scoped under `uirig dom` rather than `uirig a11y` so the tool never masquerades as a full WCAG replacement for `axe-core`.

## Evaluation Criteria
* **Effort:** `S` (1 to 2 micro-chunks, pure DOM/CSS check or parser adapter), `M` (2 to 4 micro-chunks, isolated Playwright context + observer), `L` (multi-file architecture or unstable external spec).
* **Value:** Alignment with `uirig`'s core thesis (deterministic, framework-blind, live-viewport ground truth for CI/CD and AI Design System Harnesses).
* **Status:** `Approved (MVP Pivot)` | `Deferred (v1.1)` | `Deferred (v1.2)` | `Hold (Wait for v1.0)` | `Rejected (Out of Scope)`

---

## Ranked Candidate Matrix

| ROI Rank | Tool / Upgrade | Link / Reference | Summary | Effort | Value | Status |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| **#1** | **Zero-Config Instant Target CLI & Local `.html` Server** *(Upgrade: `index.ts`, `check.ts`)* | Inspired by [nexu-io/open-design](https://github.com) | Allows `npx uirig <url-or-file>` without `uirig.config.json`, serving local `.html` paths (`./dist/index.html`) over an ephemeral `127.0.0.1` HTTP server automatically. | **S** | **High** | **Approved (MVP Pivot)** |
| **#1** | **`uirig dark-mode`** *(Promoted to MVP Core)* | Theme Parity & Luminance Inversion Gate | Emulates `colorScheme: 'dark'` + `[data-theme="dark"]`, re-runs `matrix.ts` contrast, and flags large surfaces stranded at bright light luminance (`> 0.85`). | **S** | **High** | **Approved (MVP Pivot)** |
| **#1** | **`uirig dom`** *(Unified DOM & Markup Integrity Gate)* | Replaces `a11y` & active `xss` fuzzing | Read-only Light + Shadow DOM sweep catching dangling `aria-labelledby`/`for` IDs, unlabeled controls, broken `<img>` loads, unmuted autoplay, unsafe `javascript:` URIs, tabnabbing, and AI prompt-injection traps. | **S–M** | **High** | **Approved (MVP Pivot)** |
| **#1** | **Agentic Shadow Host Attribution & Token Suggestions** *(Upgrade: `agent-stream.ts`, `matrix.ts`)* | AI Design System Harness Loop | Resolves `hostComponent` (`<ag-button>`) and `shadowPath` up `ShadowRoot.host`, deduplicates repeating pattern violations, and suggests nearest passing design tokens (`suggestedToken`). | **S** | **High** | **Approved (MVP Pivot)** |
| **#2** | **Uncaught Runtime JS / Console Errors Gate** *(Upgrade: `check.ts`)* | Inspired by [impeccable.style/slop](https://impeccable.style) | Captures uncaught `pageerror` exceptions and `console.error` failures during page navigation. | **S** | **High** | **Approved (MVP Pivot)** |
| **#2** | **`adversary.ts` Accuracy & False-Positive Hardening** *(Upgrade: `stress`)* | Inspired by `break-ui`, `taste-skill`, & WCAG 2.5.8 | Exempts `overflow-x/y: auto/scroll` containers (`+2px` buffer) and inline paragraph `<a>` links; enforces `24x24px` tap targets on controls, long space-free strings (emails/URLs), avatar aspect ratios, `100vw` bleed, and visible layout-occupying `opacity: 0` elements (exempting `.sr-only` / `aria-hidden`). | **S** | **High** | **Approved (MVP Pivot)** |
| **#3** | **`uirig rtl`** *(New Tool)* | Inspired by `ui-ux-pro-max` `--rtl` check | Sets `dir="rtl"` in an isolated context and reuses `adversary.ts` geometry math to catch horizontal scrollbars and clipped Arabic/Hebrew labels. | **S** | **Med** | **Deferred (v1.1)** |
| **#3** | **`uirig motion`** *(New Tool)* | Inspired by `ui-ux-pro-max` & `hallmark` | Emulates `reducedMotion: 'reduce'` to flag non-zero animations and audits layout-thrashing `transition: all` / `width` / `height` transitions. | **S** | **Med** | **Deferred (v1.1)** |
| **#4** | **`DESIGN.md` Token Importer** *(Upgrade: `check.ts`)* | [google-labs-code/design.md](https://github.com) & [VoltAgent/awesome-design-md](https://github.com) | Parses `DESIGN.md` YAML frontmatter and interleaved ```` ```yaml ```` blocks into `ITokenScaleConfig`. Deferred to v1.1 to avoid YAML/{ref}/rem-to-px false-positive drift in MVP. | **S–M** | **Med** | **Deferred (v1.1)** |
| **#5** | **`uirig focus`** *(New Tool)* | WCAG 2.4.11 (`Focus Not Obscured`) & `tab-walk` | Tabs through controls and modals to verify `:focus-visible` style deltas, modal focus containment, and `elementFromPoint()` visibility behind sticky headers. | **M** | **Med** | **Deferred (v1.2)** |
| **#5** | **`uirig dead-click`** *(New Tool)* | Inspired by `dead-click` CLI concept | Clicks visible buttons in an isolated context with `MutationObserver` + network listeners to flag fake AI-generated stub buttons with zero side effects. | **M** | **Med** | **Deferred (v1.2)** |
| **#6** | **`uirig stream`** *(New Tool)* | AI Product Engineering (LLM UI Resilience) | Feeds chunked partial Markdown/code tokens into chat containers to catch unclosed `<pre>` overflow and scroll-anchor jitter. | **M** | **Low** | **Deferred (v1.2)** |
| **#6** | **`uirig dark-lint`** *(New Tool)* | Inspired by `dark-lint` & UX Tigers | Deterministic DOM heuristics for pre-checked marketing checkboxes and cookie banners lacking a "Reject All" button alongside "Accept All". | **S** | **Low** | **Deferred (v1.2)** |
| **Hold** | **`uirig dsds`** *(New Tool)* | [designsystemdocspec.org](https://designsystemdocspec.org) (v0.23.1 Draft) | Validates structured component documentation YAML/JSON (`for: human`, `for: agent`, `checkedBy`). Deferred until DSDS reaches `v1.0` schema stability. | **M** | **Med** | **Hold (Wait for v1.0)** |
| **Rejected** | **Active State-Mutating XSS Fuzzing** *(Previously `uirig xss` canary submission)* | OWASP DAST Scanners | Submitting canary payloads into live forms or query params risks mutating staging state or triggering WAF rate limits; replaced by passive hygiene + prompt-injection checks inside `uirig dom`. | **M** | **Low** | **Rejected (Out of Scope)** |
| **Rejected** | **Full Aesthetic / Studio Generators** | `ui-ux-pro-max`, `taste-skill`, `open-design` | Upstream generative style catalogs and Electron design studios. Out of scope: conflicts with `uirig`'s framework-blind deterministic verification thesis. | **L** | **Low** | **Rejected (Out of Scope)** |
---

## Approved MVP Pivot Additions: "The Why" & Runtime Mechanism

### 1. Zero-Config Instant Target CLI & Local `.html` Server (`index.ts` + `static-server.ts`)
* **Why It Exists:** Requiring `uirig init` and a config file before seeing value creates onboarding friction. Meanwhile, AI prototyping agents and static site generators produce standalone `.html` files on disk.
* **How It Works:** When a positional URL or `.html` file path is passed (`npx uirig ./dist/index.html` or `npx uirig http://localhost:5173`), `uirig` loads `uirig.config.json` if present or falls back to sensible built-in defaults, spinning up an ephemeral `127.0.0.1:0` HTTP server for local `.html` files and tearing it down in `finally`.

### 2. `uirig dark-mode` (Theme Parity & Stranded-Surface Gate)
* **Why It Exists:** Broken dark mode (hardcoded light backgrounds/text) is one of the top failure modes of AI-generated UIs and component libraries.
* **How It Works:** Emulates `colorScheme: 'dark'` + `[data-theme="dark"]` in an isolated context, re-runs Porter-Duff composited contrast checks (`matrix.ts`), suggests nearest passing dark tokens, and flags large layout surfaces (`width > 120px && height > 60px`) stranded at bright light luminance (`> 0.85`).

### 3. `uirig dom` (Unified DOM, ARIA Reference & Hygiene Gate)
* **Why It Exists:** AI-generated UIs frequently ship placeholder-only inputs without `<label>`, icon-only buttons without accessible names, dangling `aria-labelledby` ID pointers, broken `<img>` tags, `javascript:` URIs, and invisible prompt-injection traps (without needing a heavy WCAG suite or risky active fuzzers as a first-pass check).
* **How It Works:** Runs a single read-only Light + Shadow DOM sweep verifying accessible names, ARIA/label ID resolution, valid loaded image dimensions (`complete === true && naturalWidth === 0`), muted autoplay media, safe URI/link attributes (`rel="noopener noreferrer"`), frame headers, and hidden prompt-injection traps (`font-size: 0px`, zero-width Unicode, opaque matching foreground/background text).

### 4. Agentic Shadow Host Attribution & Token-Aware Remediation (`agent-stream.ts` + `matrix.ts`)
* **Why It Exists:** AI coding agents burn context tokens when violations lack Web Component host context, repeat dozens of times for identical list items, or suggest raw hex codes instead of design system tokens.
* **How It Works:** Resolves `hostComponent` (e.g., `<ag-button>`) and `shadowPath` up `ShadowRoot.host`, groups repeating selector patterns (`occurrenceCount`), and computes the nearest passing token from `tokensPath` (`suggestedToken`) in `remediationAdvice`.

### 5. `adversary.ts` Accuracy & False-Positive Hardening (`uirig stress` Upgrades)
* **Why It Exists:** Real-world UIs break on long space-free strings (emails and URLs), flex-shrunk avatars (`flex-shrink: 0` missing), `100vw` horizontal scrollbar bleed, and tiny tap targets, while naive geometric rules trigger noisy false positives on `.sr-only` utilities, inline text links, and `overflow-y: auto` containers.
* **How It Works:** Hardens `adversary.ts` with `overflow-x/y: auto/scroll` exemptions (`+2px` sub-pixel buffer), inline paragraph link exemptions on `24x24px` tap-target checks, long space-free email/URL stress strings, pre/post avatar aspect-ratio checks, `100vw` bleed detection, and layout-occupying `opacity: 0` detection that exempts `.sr-only`, `aria-hidden="true"`, `inert`, and collapsed `[aria-expanded="false"]` subtrees.
