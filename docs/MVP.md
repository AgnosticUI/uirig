# Implementation Plan: uirig (Scoped Architecture)

## Strategic Positioning
**`uirig` is the first line of defense for AI-generated UIs and Web Components.**
It acts as a fast, zero-config guardrail: auditing live running viewports inside isolated headless Chromium contexts to catch design drift, light/dark contrast failures, layout breaks, Cumulative Layout Shift (CLS), and structural DOM hallucinations without brittle screenshot diffs (before heavier audits like `axe-core` or Lighthouse ever run).

---

## Implementation Checklist

### Phase 1: Specifications & Documentation Design (MVP)
- [x] Lock down 4-tool agnostic validation core scope definitions
- [x] Refactor schemas, tolerance budgets, and treemaps inside `docs/TECHNICAL_DESIGN_DOC.md`
- [x] Complete command syntax reference matrix inside `README.md`

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
  * **Action:** Implemented `src/core/adversary.ts` + `tests/unit/adversary.test.ts` with `+30%` text expansion and Euclidean bounding-box checks for parent-child overflow, horizontal scrollbars, and touch-target spacing.
- [x] **Task 3.4: Layout Shift Monitor Core (`uirig cls`)**
  * **Action:** Implemented `src/core/cls.ts` + `tests/unit/cls.test.ts` with pre-navigation `PerformanceObserver` (`layout-shift`) and W3C 1s/5s session-window scoring against `clsMaxLimit`.

### Phase 4: Local Spot Checking Test Bed
- [x] **Task 4.1: Isolated Vite + Lit Sandbox Initialization**
  * **Action:** Scaffolded Vite + Lit TypeScript sandbox in `playground/` and excluded `playground/` + `ANNOUNCEMENTS/` in `src/core/crawler.ts`.
- [x] **Task 4.2: Local AgnosticUI CLI Component, Token & Dark-Mode Toggle Installation**
  * **Action:** Installed local AgnosticUI Lit Web Components (`button`, `card`, `input`), `ag-tokens.css` / `ag-tokens-dark.css`, and `#theme-toggle` (`playground/src/theme-toggle.ts`).
- [x] **Task 4.3: Baseline & Adversarial Test Fixture Assembly**
  * **Action:** Built compliant and adversarial fixtures in `playground/index.html`, `playground/src/main.ts`, and `playground/src/cls-trap.ts`.
- [x] **Task 4.4: Live `uirig` 4-Tool Playground Verification**
  * **Action:** Verified all 4 tools end-to-end against live AgnosticUI Web Components (`playground/src/check.ts`, `tests/integration/playground.test.ts`) and added shared ANSI terminal styler (`src/utils/formatter.ts`).

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
  * **Action:** Completed `README.md` with value proposition, setup instructions, CLI reference, CI/CD workflow, Git pre-commit hook, and AI Design System Harness loop.
- [x] **Task 6.2: LinkedIn Announcement & Repo Hygiene**
  * **Action:** Created `ANNOUNCEMENTS/2026-11-12-mvp-launch.md` and `.gitignore`.

### Phase 7: MVP Focused Pivot (Zero-Config, Theme Parity, DOM Integrity & Agent Remediation)
- [x] **Task 7.1: Determine Best ROI Tools & Strategic Positioning Pivot**
  * **Action:** Evaluated candidate specifications in `docs/ROADMAP_ROI_MATRIX.md` and repositioned `uirig` as *"the first line of defense for AI-generated UIs and Web Components"* with a focused 6-tool core suite (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`).
- [ ] **Task 7.2: Zero-Config Instant Target CLI (`npx uirig <url-or-file>`) & Local `.html` Server**
  * **Why:** Requiring `uirig init` and a config file before seeing value creates onboarding friction; AI prototyping agents and developers need single-command instant verification on live URLs or standalone `.html` files.
  * **Action:** Build `src/utils/static-server.ts` + `tests/unit/static-server.test.ts` for ephemeral `127.0.0.1` `.html` serving and update `src/index.ts` + `src/commands/check.ts` (plus `tests/unit/index.test.ts` and `tests/unit/check.test.ts`) so `npx uirig <url-or-file>` runs `check` immediately using sensible built-in defaults (and gracefully skips `tokens` when `tokensPath` is omitted in zero-config mode).
- [ ] **Task 7.3: Runtime-Native Rule Escape Hatches (`data-uirig-ignore` & Config `ignore`)**
  * **Why:** Building the shared ignore matcher before adding new engines lets `dark-mode.ts` and `dom.ts` support bundler-proof exemptions from day one without retrofitting.
  * **Action:** Add a shared `isElementIgnored(el, ruleName, url, config)` helper (`src/utils/ignore.ts` + `tests/unit/ignore.test.ts`) and wire it into `tokens.ts`, `matrix.ts`, and `adversary.ts` so both element/ancestor `data-uirig-ignore="<rule>|all"` attributes (across Shadow DOM boundaries) and `ignore: [{ rule, selector?, url? }]` entries in `uirig.config.json` are respected.
- [ ] **Task 7.4: Dark-Mode Theme Parity Gate (`uirig dark-mode`)**
  * **Why:** Broken dark mode (hardcoded light backgrounds/text) is one of the top failure modes of AI-generated UIs, and promoting `dark-mode` into MVP leverages existing Porter-Duff alpha compositing (`matrix.ts`) for high-value design system verification.
  * **Action:** Build `src/core/dark-mode.ts` + `tests/unit/dark-mode.test.ts` (and wire `uirig dark-mode` + `check.ts`) to emulate `colorScheme: 'dark'` + `[data-theme="dark"]`, re-run `matrix.ts` contrast checks, and flag large surfaces stranded at bright light luminance (`> 0.85`).
- [ ] **Task 7.5: Unified DOM & Markup Integrity Gate (`uirig dom`)**
  * **Why:** Calling a lightweight structural check `a11y` invites unfair comparisons to `axe-core`, while active XSS input fuzzing risks side effects on staging servers; a focused `dom` gate acts as a fast "first line of defense" against AI markup hallucinations and prompt-injection traps.
  * **Action:** Build `src/core/dom.ts` + `tests/unit/dom.test.ts` (and wire `uirig dom` + `check.ts`) to sweep Light + Shadow DOM for: (a) dangling `aria-labelledby`/`for` IDs and unlabeled inputs/icon buttons, (b) broken `<img>` (`complete === true && naturalWidth === 0`) and unmuted `<video autoplay>`, (c) passive security hygiene (`javascript:` URIs, `target="_blank"` missing `rel="noopener noreferrer"`, missing frame headers), and (d) AI prompt-injection traps (`font-size: 0px`, zero-width Unicode, opaque matching foreground/background text).
- [ ] **Task 7.6: Uncaught Runtime JS & Console Error Gate (`check.ts`)**
  * **Why:** A page can pass static CSS and geometry checks while throwing an `Uncaught TypeError` on hydration that breaks interactivity.
  * **Action:** Attach Playwright `page.on('pageerror')` and `console.error` listeners inside `src/commands/check.ts` + `tests/unit/check.test.ts` to capture runtime script exceptions during navigation.
- [ ] **Task 7.7: Geometric Stress Accuracy & False-Positive Hardening (`adversary.ts`)**
  * **Why:** Real-world UIs break on space-free strings (like emails and URLs), squished flex avatars (`flex-shrink: 0` missing), `100vw` scrollbars, and tiny tap targets, while naive heuristics trigger noisy false positives on `.sr-only` utilities, inline text links, and `overflow-y: auto` scroll containers.
  * **Action:** Upgrade `src/core/adversary.ts` + `tests/unit/adversary.test.ts` to exempt `overflow-x/y: auto/scroll` containers (with a `2px` sub-pixel buffer), enforce `24x24px` tap targets on standalone controls (exempting inline paragraph `<a>` links), inject long space-free email/URL stress strings, detect pre/post avatar aspect-ratio squishing, flag `100vw` scrollbar bleed, and catch stuck `opacity: 0` layout elements (exempting `.sr-only`, `aria-hidden="true"`, `inert`, and collapsed `[aria-expanded="false"]` subtrees).
- [ ] **Task 7.8: Agentic Component Attribution & Token-Aware Remediation (`agent-stream.ts` + `matrix.ts`)**
  * **Why:** AI coding agents waste tokens when violations lack Shadow host context, repeat 50 times for identical list items, or suggest arbitrary hex codes instead of design system tokens.
  * **Action:** Upgrade `src/utils/agent-stream.ts` + `tests/unit/agent-stream.test.ts` and `src/core/matrix.ts` + `tests/unit/matrix.test.ts` to resolve `hostComponent` (e.g., `<ag-button>`) and `shadowPath` up `ShadowRoot.host`, deduplicate repeating pattern violations (`occurrenceCount` + `sampleSelector`), and compute nearest passing color tokens (`suggestedToken`) in `remediationAdvice`.
- [ ] **Task 7.9: CLI Help Colorization, Subcommand `--help` & Documentation Sync (`src/index.ts`, `README.md`, `SKILL.md`, `AGENTS.md`)**
  * **Why:** Users and agents need dedicated `--help` pages for the updated 6-tool suite (`tokens`, `contrast`, `dark-mode`, `stress`, `cls`, `dom`) and zero-config `<url-or-file>` usage.
  * **Action:** Refactor `src/index.ts` + `tests/unit/index.test.ts` to render ANSI-styled `renderHelpText(topic?)` for all commands, update `src/commands/init.ts` + `tests/unit/init.test.ts`, and synchronize `README.md`, `.uirig/SKILL.md`, `AGENTS.md`, and `docs/TECHNICAL_DESIGN_DOC.md`.

---

## Post-MVP Backlog (v1.1 & v1.2, Tracked in `docs/ROADMAP_ROI_MATRIX.md`)

### v1.1: Internationalization, Motion & Token Ecosystem
- [ ] **`DESIGN.md` Token Importer (`tokensPath: "./DESIGN.md"`):** Parse YAML frontmatter and interleaved ```` ```yaml ```` blocks (`colors`, `spacing`, `typography`, `rounded`) via `colorjs.io` (deferred from MVP to avoid `rem`-to-`px` and alias false positives).
- [ ] **RTL Mirror Overflow Gate (`uirig rtl`):** Load pages with `dir="rtl"` and reuse `adversary.ts` geometry math to catch horizontal scrollbars and clipped labels in Arabic/Hebrew layouts.
- [ ] **Reduced-Motion & Layout-Thrashing Transition Gate (`uirig motion`):** Emulate `reducedMotion: 'reduce'` and flag `transition: all` or reflow-heavy `width`/`height`/`top`/`left` transitions.

### v1.2: Interactive State Fuzzers & External Spec Validators
- [ ] **Keyboard Focus-Ring & Occlusion Gate (`uirig focus`):** Tab through controls and modals to verify `:focus-visible` style deltas, modal focus traps, and `elementFromPoint()` visibility behind sticky headers (WCAG 2.4.11).
- [ ] **Unresponsive Stub-Button Detector (`uirig dead-click`):** Click visible buttons with `MutationObserver` + network/navigation listeners to catch fake AI-generated buttons with zero side effects.
