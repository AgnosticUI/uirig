# `uirig` — Post-MVP Tool Expansion ROI Matrix (Phase 7)

Living evaluation table tracking candidate verification tools, browser security fuzzers, and engine upgrades before committing engineering effort.

## Evaluation Criteria
* **Effort:** `S` (1–2 micro-chunks, pure DOM/CSS check or parser adapter), `M` (2–4 micro-chunks, isolated Playwright context + fuzzer/observer), `L` (multi-file architecture or unstable external spec).
* **Value:** Alignment with `uirig`'s core thesis—*deterministic, framework-blind, live-viewport ground truth for CI/CD and AI Design System Harnesses*.
* **Status:** `Approved (Next)` | `Approved (Quick Win)` | `Evaluating` | `Deferred (v1.1)` | `Deferred` | `Rejected`

---

## Ranked Candidate Matrix

| ROI Rank | Tool / Upgrade | Link / Reference | Summary | Effort | Value | Status |
| :---: | :--- | :--- | :--- | :---: | :---: | :--- |
| **#1** | **`uirig xss`** *(New Tool + Prompt-Injection & Clickjacking Guard)* | OWASP DOM XSS & AI Agent Security | Isolated context DOM XSS canary fuzzer, clickjacking/tabnabbing auditor, and hidden AI prompt-injection detector. | **M** | **High** | **Approved (Next)** |
| **#2** | **Local HTML File Target Support** *(Upgrade: `check.ts`)* | Inspired by [nexu-io/open-design](https://github.com) | Serves local `.html` paths (`./dist/index.html`) over an ephemeral `127.0.0.1` HTTP server during `uirig check`. | **S** | **High** | **Approved (Quick Win)** |
| **#2** | **Uncaught Runtime JS / Console Errors Gate** *(Upgrade: `check.ts`)* | Inspired by [impeccable.style/slop](https://impeccable.style) (`JavaScript errors on load`) | Captures uncaught `pageerror` exceptions and `console.error` failures during page navigation. | **S** | **High** | **Approved (Quick Win)** |
| **#2** | **`adversary.ts` Accuracy & Edge-Case Pack** *(4 Quick-Win Upgrades)* | Inspired by `break-ui`, `taste-skill`, `DESIGN.md` & `hallmark` | Exempts `overflow-x: auto/scroll` blocks; checks `24x24px` tap-target boxes, unbreakable email/URL overflow, squished avatars (`flex-shrink: 0`), `100vw` scrollbars, and stuck `opacity: 0` reveals. | **S** | **High** | **Approved (Quick Win)** |
| **#2** | **`uirig a11y`** *(Unified Forms, ARIA & Media Gate)* | Inspired by UX Tigers, Eleken, `aria-check` & `asset-probe` | Pierces Light & Shadow DOM to audit `<label>`/`aria-*` ID links, paste-blocked inputs, unlabeled icon buttons, broken `<img>` assets, and unmuted autoplay media. | **S–M** | **High** | **Approved (Quick Win)** |
| **#3** | **`uirig dark-mode`** *(New Tool)* | Theme Parity & Luminance Inversion Gate | Emulates `colorScheme: 'dark'` + `[data-theme="dark"]`, re-runs WCAG contrast, and flags surfaces stranded at bright light luminance (`> 0.85`). | **S** | **High** | **Evaluating (v1.1)** |
| **#3** | **`uirig rtl`** *(New Tool)* | Inspired by `ui-ux-pro-max` `--rtl` check | Sets `dir="rtl"` in an isolated context and reuses `adversary.ts` geometry math to catch horizontal scrollbars and clipped Arabic/Hebrew labels. | **S** | **High** | **Evaluating (v1.1)** |
| **#4** | **`uirig dead-click`** *(New Tool)* | Inspired by `dead-click` CLI concept | Clicks visible buttons in an isolated context with `MutationObserver` + network listeners to flag fake AI-generated stub buttons with zero side effects. | **M** | **High** | **Evaluating (v1.1)** |
| **#4** | **`uirig motion`** *(New Tool)* | Inspired by `ui-ux-pro-max` & `hallmark` (Floor #2) | Emulates `reducedMotion: 'reduce'` to flag non-zero animations and audits layout-thrashing `transition: all` / `width` / `height` transitions. | **S** | **Med** | **Evaluating (v1.1)** |
| **#5** | **`uirig focus`** *(New Tool)* | WCAG 2.4.11 (`Focus Not Obscured`) & `tab-walk` | Tabs through controls and modals to verify `:focus-visible` style deltas, modal focus containment, and `elementFromPoint()` visibility behind sticky headers. | **M** | **High** | **Evaluating (v1.2)** |
| **#5** | **`uirig stream`** *(New Tool)* | AI Product Engineering (LLM UI Resilience) | Feeds chunked partial Markdown/code tokens into chat containers to catch unclosed `<pre>` overflow and scroll-anchor jitter. | **M** | **Med** | **Evaluating (v1.2)** |
| **#6** | **`uirig dark-lint`** *(New Tool)* | Inspired by `dark-lint` & UX Tigers | Deterministic DOM heuristics for pre-checked marketing checkboxes and cookie banners lacking a "Reject All" button alongside "Accept All". | **S** | **Med** | **Evaluating (v1.2)** |
| **Deferred (v1.1)** | **`DESIGN.md` Token Importer** *(Upgrade: `check.ts`)* | [google-labs-code/design.md](https://github.com) & [VoltAgent/awesome-design-md](https://github.com) | Parses `DESIGN.md` YAML frontmatter and interleaved ```` ```yaml ```` blocks into `ITokenScaleConfig`. Deferred to v1.1 to avoid YAML/{ref}/rem-to-px false-positive drift in MVP. | **S–M** | **High** | **Deferred (v1.1)** |
| **Deferred** | **`uirig dsds`** *(New Tool)* | [designsystemdocspec.org](https://designsystemdocspec.org) (v0.23.1 Draft) | Validates structured component documentation YAML/JSON (`for: human`, `for: agent`, `checkedBy`). Deferred until DSDS reaches `v1.0` schema stability. | **M** | **Med** | **Hold (Wait for v1.0)** |
| **Rejected** | **Full Aesthetic / Studio Generators** | `ui-ux-pro-max`, `taste-skill`, `open-design` | Upstream generative style catalogs and Electron design studios. Out of scope—conflicts with `uirig`'s framework-blind deterministic verification thesis. | **L** | **Low** | **Rejected (Out of Scope)** |

---

## Approved MVP Tools — "The Why" & Runtime Mechanism

### 1. `uirig xss` (Live DOM XSS Canary Fuzzer, Clickjacking & AI Prompt-Injection Shield)
* **Why It Exists:** AI coding agents and rapid frontend PRs frequently wire untrusted query strings, search filters, or Markdown previews into `innerHTML`, `dangerouslySetInnerHTML`, or `href` attributes—and RAG/agentic web apps are increasingly targeted by invisible prompt-injection text hidden in rendered DOM nodes. Static regex linters miss runtime sink execution inside Web Components and Shadow DOM.
* **How It Works:** Spawns an isolated Playwright `BrowserContext`, plants a global canary trap (`window.__uirigXssTriggered = false`), injects non-destructive canary strings into URL query parameters and visible text inputs/textareas, and audits Light + Shadow DOM for unescaped canary execution, `javascript:` URIs, `target="_blank"` anchors missing `rel="noopener"`, missing `X-Frame-Options` / `CSP frame-ancestors` headers, and hidden prompt-injection traps (`font-size: 0px`, zero-width Unicode characters, or text color matching background color).

### 2. Local `.html` File Target Support (`targetUrls: ["./dist/index.html"]`)
* **Why It Exists:** AI prototyping agents (Claude Code, Cursor, OpenDesign) and static site generators (Astro, Eleventy, Next.js static export) produce standalone `.html` files on disk. Requiring developers to manually boot a background dev server and wait on ports adds friction and CI flakiness.
* **How It Works:** Detects non-HTTP file paths in `targetUrls`, automatically spins up an ephemeral Node `http.createServer()` on `127.0.0.1:0` serving the target directory over real HTTP (so relative CSS/JS/assets resolve cleanly without `file://` CORS blocks), and tears down the server in `finally`.

### 3. Uncaught Runtime JS / Console Errors Gate (`check.ts`)
* **Why It Exists:** A page can pass static CSS and layout checks while throwing an `Uncaught TypeError` on hydration that leaves buttons dead or components broken.
* **How It Works:** Attaches Playwright `page.on('pageerror')` and `console.error` listeners during navigation so runtime script crashes are captured deterministically alongside layout and token audits.

### 4. `adversary.ts` Accuracy & Edge-Case Pack (`uirig stress` Upgrades)
* **Why It Exists:** Real-world UIs break on unbreakable strings (long emails/URLs), flex-shrunk avatars (`flex-shrink: 0` missing), `100vw` horizontal scrollbar bleed, tiny mobile tap targets, and scroll-reveal animations stuck at `opacity: 0`—while intentional `overflow-x: auto` code blocks should not trigger false overflow alerts.
* **How It Works:** Extends `adversary.ts` with space-free email stress strings, pre/post `width / height` aspect-ratio checks on `<img>`/`<svg>`, vertical `scrollHeight > clientHeight` clipping checks, `24x24px` minimum tap-target box assertions, `opacity: 0` stuck-reveal detection, and explicit `overflow-x: auto/scroll` container exemptions.

### 5. `uirig a11y` (Unified Forms, ARIA References & Broken Media Gate)
* **Why It Exists:** AI-generated UIs routinely ship placeholder-only inputs without `<label>` elements, icon-only `<button>` elements without `aria-label`, broken `aria-labelledby` ID pointers, broken `<img>` assets (`naturalWidth === 0`), and unmuted `<video autoplay>` tags.
* **How It Works:** Runs a single read-only Light + Shadow DOM sweep to verify accessible names on all form fields and buttons, ID resolution for ARIA attributes, valid loaded image dimensions, and muted autoplay media compliance.
