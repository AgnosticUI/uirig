# Implementation Plan: uirig — Scoped Architecture

## Implementation Checklist

### Phase 1: Specifications & Documentation Design (MVP)
- [x] Lock down 4-tool agnostic validation core scope definitions
- [x] Refactor schemas, tolerance budgets, and treemaps inside docs/TECHNICAL_DESIGN_DOC.md
- [x] Complete command syntax reference matrix inside README.md

### Phase 2: Workspace Environment Scaffolding (MVP)
- [x] **Task 2.1: Environment Initialization**
  * **Action:** Built `package.json` with `"type": "module"`, `tsconfig.json`, `tsconfig.build.json`, and global binary entrypoint `bin/uirig` -> `dist/index.js`.
- [x] **Task 2.2: Local Dependency Acquisition**
  * **Action:** Installed `typescript`, `vitest`, `playwright`, `colorjs.io`, `chokidar`, `ws`, and `@types/node`.
- [x] **Task 2.3: Configuration Profile Footprint**
  * **Action:** Generated schema parameters for `uirig.config.json` defining `targetUrls`, `tokensPath`, `viewports`, `clsMaxLimit`, `overflowPixelTolerance`, and `touchTargetMinSpacingPx`.

### Phase 3: Browser Telemetry Cores & Fuzzers (MVP)
- [x] **Task 3.1: Shadow-Piercing Token Crawler (`uirig tokens`)**
  * **Action:** Implemented `src/core/tokens.ts` + `tests/unit/tokens.test.ts` to recursively climb running viewports, piercing open Shadow DOM boundaries to evaluate computed styles framework-blindly against design token scales.
- [x] **Task 3.2: Rendered Luminance Contrast Gate (`uirig contrast`)**
  * **Action:** Implemented `src/core/matrix.ts` + `tests/unit/matrix.test.ts` with Porter-Duff Source-Over ancestor alpha compositing and WCAG 2.1 contrast calculation (`>= 4.5:1`) via `colorjs.io`.
- [x] **Task 3.3: Geometric Invariant Overflow Rig (`uirig stress`)**
  * **Action:** Implemented `src/core/adversary.ts` + `tests/unit/adversary.test.ts` with `+30%` pseudo-localization text expansion and Euclidean bounding-box checks for parent-child overflow, horizontal scrollbars, and touch-target spacing.
- [x] **Task 3.4: Layout Shift Monitor Core (`uirig cls`)**
  * **Action:** Implemented `src/core/cls.ts` + `tests/unit/cls.test.ts` with pre-navigation `PerformanceObserver` (`layout-shift`) and W3C 1s/5s session-window scoring against `clsMaxLimit`.

### Phase 4: Local Spot Checking Test Bed
- [x] **Task 4.1: Isolated Vite + Lit Sandbox Initialization**
  * **Action:** Scaffolded Vite + Lit TypeScript sandbox in `playground/` and excluded `playground/` + `ANNOUNCEMENTS/` in `src/core/crawler.ts`.
- [x] **Task 4.2: Local AgnosticUI CLI Component, Token & Dark-Mode Toggle Installation**
  * **Action:** Installed local AgnosticUI Lit Web Components (`button`, `card`, `input`), `ag-tokens.css` / `ag-tokens-dark.css`, and `#theme-toggle` (`playground/src/theme-toggle.ts`).
- [x] **Task 4.3: Baseline & Adversarial Test Fixture Assembly**
  * **Action:** Built compliant and adversarial fixtures in `playground/index.html`, `playground/src/main.ts`, and `playground/src/cls-trap.ts`.
- [x] **Task 4.4: Live `uirig` 4-Tool Spot-Check Verification**
  * **Action:** Verified all 4 tools end-to-end against live AgnosticUI Web Components (`playground/src/spot-check.ts`, `tests/integration/playground-spotcheck.test.ts`) and added shared ANSI terminal styler (`src/utils/formatter.ts`).

### Phase 5: CI/CD Orchestration & Reporting (MVP)
- [x] **Task 5.1: Isolated Parallel Context Dispatcher**
  * **Action:** Implemented `src/commands/check.ts` + `tests/unit/check.test.ts` launching a single Chromium instance and running isolated `BrowserContext` sessions concurrently with POSIX exit codes (`0`, `1`, `2`).
- [x] **Task 5.2: Markdown PR Comment Reporter**
  * **Action:** Implemented `src/utils/fs.ts` + `tests/unit/fs.test.ts` synthesizing evaluation results into `.uirig/github_pr_comment.md`.
- [x] **Task 5.3: Agentic JSON Tool Stream Output Generator**
  * **Action:** Implemented `src/utils/agent-stream.ts` + `tests/unit/agent-stream.test.ts` and `logTelemetry()` `stderr` routing in `src/utils/formatter.ts`, emitting deterministic JSON with `remediationAdvice` to `stdout` when `--json` is set.
- [x] **Task 5.4: Retrofit `uirig init` to Emit `.uirig/SKILL.md`**
  * **Action:** Updated `src/commands/init.ts` + `tests/unit/init.test.ts` to scaffold `.uirig/SKILL.md` alongside `uirig.config.json` and `.uirig/session.json`.
- [x] **Task 5.5: Design System Harness Agent Recipe (`AGENTS.md`)**
  * **Action:** Created root `AGENTS.md` with the zero-bloat post-edit `npx uirig check --json` verification loop.
- [x] **Task 5.6: Root CLI Entry Router (`src/index.ts` + `bin/uirig`)**
  * **Action:** Implemented `src/index.ts`, `bin/uirig`, and `tests/unit/index.test.ts` supporting `init`, `check`, `tokens`, `contrast`, `stress`, `cls`, `manifest`, `--only`, `--config`, `--json`, and `--headed`.

### Phase 6: Documentation MVP
- [x] **Task 6.1: `README.md`**
  * **Action:** Completed `README.md` with value proposition, 4-tool table, setup instructions, CLI reference, CI/CD workflow, Git pre-commit hook, and AI Design System Harness loop.
- [x] **Task 6.2: LinkedIn Announcement & Repo Hygiene**
  * **Action:** Created `ANNOUNCEMENTS/2026-11-12-mvp-launch.md` and `.gitignore`.

### Phase 7: MVP Security, Accuracy & High-ROI Tool Additions
- [x] **Task 7.1: Determine Best ROI Tools To Add**
  * **Action:** Evaluated candidate specifications and design engineering tools into `docs/ROADMAP_ROI_MATRIX.md`, electing 5 high-ROI additions for MVP and deferring lower-ROI/unstable-spec candidates to Post-MVP.
- [ ] **Task 7.2: Live DOM XSS Canary Fuzzer & Prompt-Injection Shield (`uirig xss`)**
  * **Why:** Static linters miss runtime sink execution inside Shadow DOM and cannot catch indirect AI prompt-injection traps hidden in rendered text.
  * **Action:** Build `src/core/xss.ts` (and wire `uirig xss` + `check.ts`) to inject non-destructive canary vectors into inputs and URL query params (`window.__uirigXssTriggered`), flag `javascript:` URIs, `target="_blank"` missing `rel="noopener"`, missing clickjacking headers (`X-Frame-Options` / `CSP frame-ancestors`), and invisible prompt-injection traps (`font-size: 0px`, zero-width Unicode, text color matching background color).
- [ ] **Task 7.3: Local `.html` File Target Support (`targetUrls: ["./dist/index.html"]`)**
  * **Why:** AI prototyping agents and static site generators output standalone `.html` files; serving them automatically over an ephemeral `127.0.0.1` port removes manual dev-server setup friction.
  * **Action:** Build `src/utils/static-server.ts` and integrate into `src/commands/check.ts` so local `.html` paths in `targetUrls` spin up and tear down an isolated HTTP server automatically.
- [ ] **Task 7.4: Uncaught Runtime JS & Console Error Gate (`check.ts`)**
  * **Why:** A page can pass static CSS and geometry checks while throwing an `Uncaught TypeError` on hydration that breaks interactivity.
  * **Action:** Attach Playwright `page.on('pageerror')` and `console.error` listeners inside `src/commands/check.ts` to capture runtime script exceptions during navigation.
- [ ] **Task 7.5: Geometric Stress Accuracy & Edge-Case Pack (`adversary.ts`)**
  * **Why:** Real-world UIs break on space-free emails, squished flex avatars (`flex-shrink: 0` missing), `100vw` scrollbars, tiny tap targets, and stuck `opacity: 0` animations, while intentional `overflow-x: auto` code blocks should not trigger false positives.
  * **Action:** Upgrade `src/core/adversary.ts` to exempt `overflow-x: auto/scroll` containers, enforce `24x24px` minimum tap-target boxes, inject unbreakable email stress strings, detect pre/post avatar aspect-ratio squishing, check vertical `scrollHeight > clientHeight` clipping, and flag `100vw` scrollbar bleed and stuck `opacity: 0` elements.
- [ ] **Task 7.6: Unified Forms, ARIA References & Broken Media Gate (`uirig a11y`)**
  * **Why:** AI-generated UIs frequently ship placeholder-only inputs without `<label>`, unlabeled icon-only buttons, broken `aria-labelledby` IDs, broken `<img>` tags (`naturalWidth === 0`), and unmuted autoplay media.
  * **Action:** Build `src/core/a11y.ts` (and wire `uirig a11y` + `check.ts`) to run a single Light + Shadow DOM sweep verifying accessible names, ARIA/label ID resolution, valid image dimensions, and muted autoplay compliance.
- [ ] **Task 7.7: CLI Help Colorization & Subcommand-Specific `--help` Coverage (`src/index.ts`)**
  * **Why:** Currently `CLI_HELP_TEXT` renders unstyled monochrome output and `uirig <subcommand> --help` (e.g., `npx uirig stress --help`) prints the generic global help instead of explaining the specific tool's purpose, mechanics, flags, and exit codes.
  * **Action:** Refactor `src/index.ts` + `tests/unit/index.test.ts` to render dynamic ANSI-styled help output (`renderHelpText(topic?)`) and support dedicated `--help` pages for `init`, `check`, `tokens`, `contrast`, `stress`, `cls`, `manifest`, `xss`, and `a11y`.
- [ ] **Task 7.8: Runtime-Native Rule Escape Hatches (`data-uirig-ignore` & Config `ignore`)**
  * **Why:** Because `uirig` evaluates live computed DOM styles after bundlers strip CSS comments, developers need a bundler-proof way to intentionally exempt one-off landing page overrides, legacy embeds, or specific routes without disabling entire validation gates globally.
  * **Action:** Add a shared `isElementIgnored(el, ruleName, url, config)` helper across `tokens.ts`, `matrix.ts`, `adversary.ts`, `xss.ts`, and `a11y.ts` that respects both element/ancestor `data-uirig-ignore="<rule>|all"` attributes (including across Shadow DOM boundaries) and `ignore: [{ rule, selector?, url? }]` entries in `uirig.config.json`.

---

## Post-MVP Backlog (v1.1 & v1.2 — Tracked in `docs/ROADMAP_ROI_MATRIX.md`)

### v1.1 — Theme Parity, Internationalization & Token Ecosystem
- [ ] **`DESIGN.md` Token Importer (`tokensPath: "./DESIGN.md"`):** Parse YAML frontmatter and interleaved ```` ```yaml ```` blocks (`colors`, `spacing`, `typography`, `rounded`) via `colorjs.io` (deferred from MVP to avoid `rem`-to-`px` and alias false positives).
- [ ] **Dark-Mode Luminance Inversion Gate (`uirig dark-mode`):** Emulate `colorScheme: 'dark'` + `[data-theme="dark"]`, re-run `matrix.ts` contrast, and flag surfaces stranded at bright light luminance (`> 0.85`).
- [ ] **RTL Mirror Overflow Gate (`uirig rtl`):** Load pages with `dir="rtl"` and reuse `adversary.ts` geometry math to catch horizontal scrollbars and clipped labels in Arabic/Hebrew layouts.
- [ ] **Reduced-Motion & Layout-Thrashing Transition Gate (`uirig motion`):** Emulate `reducedMotion: 'reduce'` and flag `transition: all` or reflow-heavy `width`/`height`/`top`/`left` transitions.

### v1.2 — Interactive State Fuzzers & External Spec Validators
- [ ] **Keyboard Focus-Ring & Occlusion Gate (`uirig focus`):** Tab through controls and modals to verify `:focus-visible` style deltas, modal focus traps, and `elementFromPoint()` visibility behind sticky headers (WCAG 2.4.11).
- [ ] **Unresponsive Stub-Button Detector (`uirig dead-click`):** Click visible buttons with `MutationObserver` + network/navigation listeners to catch fake AI-generated buttons with zero side effects.
