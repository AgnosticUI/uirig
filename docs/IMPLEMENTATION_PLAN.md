# Implementation Plan: uirig — Scoped Architecture

## Implementation Checklist

### Phase 1: Specifications & Documentation Design (MVP)
- [x] Lock down 4-tool agnostic validation core scope definitions
- [x] Refactor schemas, tolerance budgets, and treemaps inside docs/TECHNICAL_DESIGN_DOC.md
- [x] Complete command syntax reference matrix inside README.md

### Phase 2: Workspace Environment Scaffolding (MVP)
- [ ] **Task 2.1: Environment Initialization**
  * **Action:** Build package.json with `"type": "module"` and global binary pathing mappings pointing to bin/uirig. Generate tsconfig.json.
- [ ] **Task 2.2: Local Dependency Acquisition**
  * **Action:** Install lock-pinned versions of typescript, vitest, playwright, ws, and @types/node completely offline.
- [ ] **Task 2.3: Configuration Profile Footprint**
  * **Action:** Generate initial schema parameters for uirig.config.json defining viewports, clsMaxLimit, and overflowPixelTolerance rules.

### Phase 3: Browser Telemetry Cores & Fuzzers (MVP)
- [x] **Task 3.1: Shadow-Piercing Token Crawler (uirig tokens)**
  * **Action:** Code `src/core/tokens.ts` to recursively climb running viewports, piercing Shadow DOM boundaries to evaluate computed styles framework-blindly against design tokens json fields.
- [x] **Task 3.2: Rendered Luminance Contrast Gate (uirig contrast)**
  * **Action:** Program relative luminance calculations inside `src/core/matrix.ts` utilizing browser calculated color channels and `colorjs.io`.
- [ ] **Task 3.3: Geometric Invariant Overflow Rig (uirig stress)** *(Micro-Chunk 1 Complete | Micro-Chunk 2 Next)*
  * **Action:** Code text-expansion fuzzer routines inside `src/core/adversary.ts` to validate parent-child containment boxes via `getBoundingClientRect()`, evaluating overflows against the `overflowPixelTolerance` buffer threshold.
- [ ] **Task 3.4: Layout Shift Monitor Core (uirig cls)**
  * **Action:** Program `src/core/cls.ts` to capture native browser `layout-shift` performance entries during initialization loops, tracking metrics against the `clsMaxLimit` budget.

### Phase 4: Local Spot Checking Test Bed
- [ ] **Task 4.1: Isolated Vite + Lit Sandbox Initialization**
  * **Action:** Scaffold a lightweight Vite TypeScript app in `playground/` (and add `playground/` to `BLOCKLIST_DIRECTORIES` in `src/core/crawler.ts` so repository scans stay isolated). Configure `experimentalDecorators: true` and `useDefineForClassFields: false` per AgnosticUI's Lit TypeScript requirements.
  - [ ] **Task 4.2: Local AgnosticUI CLI Component, Token & Dark-Mode Toggle Installation**
  * **Action:** Initialize AgnosticUI locally inside `playground/` via `npx agnosticui-cli init --framework lit` and install core Web Components (`npx agnosticui-cli add button card input`) along with `./src/components/ag/styles/ag-tokens.css` and `ag-tokens-dark.css`. Wire a `#theme-toggle` button that toggles `data-theme="dark"` on `document.documentElement` (`<html>`) so both light and dark token modes can be spot-checked.
- [ ] **Task 4.3: Baseline & Adversarial Test Fixture Assembly**
  * **Action:** Build a simple spot-checking page in `playground/index.html` and `playground/src/main.ts` rendering both compliant AgnosticUI components (`<ag-card>`, `<ag-button>`, `<ag-input>`) and deliberate layout/token/contrast traps (e.g., cramped card width, low-contrast inline override, un-sized image causing CLS).
- [ ] **Task 4.4: Live `uirig` 4-Tool Spot-Check Verification**
  * **Action:** Run the Vite dev server (`npm run dev` on `http://localhost:5173`) and execute `crawlPageTokens`, `auditPageContrast`, `runGeometricStressAudit`, and `monitorPageCls` against the live AgnosticUI Web Components to verify Shadow DOM piercing, token alignment, contrast legibility, stress overflow detection, and CLS tracking end-to-end.

### Phase 5: CI/CD Orchestration & Reporting (MVP)
- [ ] **Task 5.1: Isolated Parallel Context Dispatcher**
  * **Action:** Build `src/commands/check.ts` to launch a single Playwright browser, running tasks across separate isolated context incognito sessions concurrently to maximize execution speed without cross-tool pollution.
- [ ] **Task 5.2: Markdown PR Comment Reporter**
  * **Action:** Code `src/utils/fs.ts` to synthesize evaluation results into a single clean markdown report saved directly at `.uirig/github_pr_comment.md`.
- [ ] **Task 5.3: Agentic JSON Tool Stream Output Generator (MVP)**
  * **Action:** Code a conditional fork inside `src/utils/formatter.ts` that skips console text table generation and serializes the raw layout violation array directly to standard output when `options.json` is true, acting as the deterministic feedback loop for AI Design System Harnesses.
- [ ] **Task 5.4: Retrofit `uirig init` to Emit `.uirig/SKILL.md`**
  * **Action:** Update the existing `src/commands/init.ts` scaffolder so that running `uirig init` automatically generates `.uirig/SKILL.md` alongside `uirig.config.json`, giving teams immediate agent-ready instructions on first run.
- [ ] **Task 5.5: Design System Harness Agent Recipe (`AGENTS.md` / CLI Snippet)**
  * **Action:** Define the lightweight agent recipe and optional `AGENTS.md` integration snippet that teaches AI coding agents (Claude Code, Cursor, Codex) how to invoke `uirig check --json` after UI edits and self-correct violations without context bloat.

### Phase 6: Documentation MVP
- [ ] **Task 6.1: README.md**
  * **Action:** Complete `README.md`. Should explain what the tool is and why it is of value. Common use cases (CI/CD, git pre-commit hook, and CLI usage patterns). Full setup instructions. How to use `uirig` for common use cases. Etc. etc. Might be able to extract some of this from the .uirig/SKILL.md and AGENTS.md?
- [ ] **Task 6.2: LI Announcement**
  * **Action:** Craft a LinkedIn Announcement.

### Phase 7: Add Tools
- [ ] **Task 7.1: Determine Best ROI Tools To Add**
  * **Action:** Review following for more tool ideas:
    * 14 Design Tools: https://lnkd.in/p/gCpREqBe, 
    * Add a `dsds` tool which: 1) checks you have a spec in your system, 2) checks it validates. See https://designsystemdocspec.org/quickstart
    * Need an XSS tool that injects vectors and confirms they are either escaped when appropriate or disallowed entirely when appropriate.
    * Other XSS related checks worthwhile in the same spirit?
