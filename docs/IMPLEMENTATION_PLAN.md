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
- [ ] **Task 3.1: Shadow-Piercing Token Crawler (uirig tokens)**
  * **Action:** Code src/core/tokens.ts to recursively climb running viewports, piercing Shadow DOM boundaries to evaluate computed styles framework-blindly against design tokens json fields.
- [ ] **Task 3.2: Rendered Luminance Contrast Gate (uirig contrast)**
  * **Action:** Program relative luminance calculations inside src/core/matrix.ts utilizing browser calculated color channels.
- [ ] **Task 3.3: Geometric Invariant Overflow Rig (uirig stress)**
  * **Action:** Code text-expansion fuzzer routines inside src/core/adversary.ts to validate parent-child containment boxes via getBoundingClientRect(), evaluating overflows against the overflowPixelTolerance buffer threshold.
- [ ] **Task 3.4: Layout Shift Monitor Core (uirig cls)**
  * **Action:** Program src/core/cls.ts to capture native browser layout-shift performance entries during initialization loops, tracking metrics against the clsMaxLimit budget.

### Phase 4: CI/CD Orchestration & Reporting (MVP)
- [ ] **Task 4.1: Isolated Parallel Context Dispatcher**
  * **Action:** Build src/commands/check.ts to launch a single Playwright browser, running tasks across separate isolated context incognito sessions concurrently to maximize execution speed without cross-tool pollution.
- [ ] **Task 4.2: Markdown PR Comment Reporter**
  * **Action:** Code src/utils/fs.ts to synthesize evaluation results into a single clean markdown report saved directly at .uirig/github_pr_comment.md.
  