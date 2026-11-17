# Implementation Plan: Issue #5 — Semantic Spatial Brief (`--spatial-brief`)

- **Issue:** `#5` — `"No-Vision Required" Semantic Spatial Brief (--spatial-brief)`
- **Pillar:** Pillar 2: Token & AI Cost Savers (`ai-native`, `pillar: token-efficiency`)
- **Status:** Planned (No code written yet)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a `--spatial-brief` CLI flag (and `spatialBrief` field in `--json` output) that emits an ultra-compact, plain-text bounding-box summary of top-level landmarks, custom elements, and `--selectors` targets—delivering macro-layout awareness in **~40–60 plain-text tokens** instead of 1,500–3,000+ screenshot vision tokens.

### Target Output Format

- **CLI text mode (`uirig check --spatial-brief`):**

      header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]

- **JSON mode (`uirig check --spatial-brief --json`):**
  Includes top-level `"spatialBrief": "header[0,0 1440x64] | ..."` when `--spatial-brief` is enabled.

### Out of Scope
- Multi-breakpoint sweeps (Issue #11 `--sweep`).
- Violation root-cause grouping (Issue #4 `--group-by-root`).
- Deep leaf-node dumps (must remain bounded to landmarks, top-level custom element hosts, and explicit `--selectors` targets).

---

## 2. Architectural Design

1. **In-Page Geometry Collector (Browser Context):**
   - Runs inside the active browser evaluation context and traverses open `ShadowRoot` boundaries.
   - Extracts viewport-relative `getBoundingClientRect()` values rounded to integers (`x`, `y`, `width`, `height`).
   - Skips non-rendered elements (`width === 0 || height === 0`, `display: none`, `visibility: hidden`).
   - Collects:
     1. Semantic HTML5 & ARIA landmarks (`header`, `nav`, `aside`, `main`, `footer`, `[role="banner"]`, `[role="navigation"]`, `[role="complementary"]`, `[role="main"]`, `[role="contentinfo"]`).
     2. Top-level custom element hosts (`tagName.includes('-')`) acting as structural containers.
     3. Any explicit `--selectors` passed by the user.
   - Sorts nodes in deterministic reading order: top-to-bottom (`y`), then left-to-right (`x`).

2. **Pure Formatter (`formatSpatialBrief`):**
   - Pure TypeScript helper taking `SpatialNode` and returning `tag[x,y wxh] | ...`.
   - Deduplicates identical elements/rects (e.g., `<header role="banner">`) and enforces a safety node cap so large DOMs never exceed the token budget.

3. **Runner & CLI Integration:**
   - Wire `spatialBrief?: boolean` into CLI flags, run options, text reporter, and `--json` output.

---

## 3. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon completion, followed by updating `.uirig/docs/NEXT_PROMPT.md`.

### Chunk 0: Planning & Scaffold
- **Files:** `.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`
- **Action:** Save this implementation plan and initial next-prompt pointer.
- **Commit:** `docs(plan): add implementation plan and next-prompt tracker for issue #5 (--spatial-brief)`

### Chunk 1: Types & Pure Spatial Brief Formatter + Unit Tests
- **Files:** `src/types.ts`, `src/spatial-brief.ts`, `tests/spatial-brief.test.ts`
- **Action:**
  - Define `SpatialNode` (`label`, `x`, `y`, `width`, `height`, `shadowDepth?`).
  - Implement `formatSpatialBrief(nodes: SpatialNode[]): string` with integer rounding, zero-size filtering, deduplication, and `y -> x` sorting.
  - Add unit tests covering formatting, `y -> x` ordering, hidden/zero-rect filtering, and duplicate deduplication.
- **Commit:** `feat(spatial-brief): add SpatialNode types, formatter, and unit tests`

### Chunk 2: In-Page DOM & Shadow-DOM Landmark Collector
- **Files:** `src/spatial-brief.ts`
- **Action:**
  - Implement `collectSpatialNodes(selectors?: string[])` that traverses `document` and open `ShadowRoot` trees.
  - Capture semantic landmarks, top-level custom element hosts, and explicit `--selectors` targets with viewport-relative bounding rects.
- **Commit:** `feat(spatial-brief): implement Shadow-DOM-aware landmark and selector geometry collector`

### Chunk 3: Runner & Report Schema Integration
- **Files:** `src/runner.ts`, `src/reporter.ts` (or repo equivalents)
- **Action:**
  - Wire `spatialBrief?: boolean` into run options.
  - Execute `collectSpatialNodes` when enabled and attach `spatialBrief: string` to the run result and `--json` payload.
- **Commit:** `feat(runner): integrate spatialBrief collection into check execution and JSON report`

### Chunk 4: CLI Flag Wiring & End-to-End Integration Test
- **Files:** `src/cli.ts`, `tests/integration/spatial-brief.e2e.test.ts` (or repo test structure)
- **Action:**
  - Register `--spatial-brief` CLI flag and print the formatted brief in text output mode.
  - Add an integration test verifying Chromium layout extraction (side-by-side `<aside>` + `<main>` vs. stacked layout, plus open Shadow DOM custom element host) and verifying output stays under ~60 tokens.
- **Commit:** `feat(cli): expose --spatial-brief flag and add end-to-end layout verification test`

### Chunk 5: Docs & Cleanup
- **Files:** `README.md`, `.uirig/docs/NEXT_PROMPT.md`
- **Action:**
  - Document `--spatial-brief` in `README.md` CLI options and AI agent usage examples.
  - Update `.uirig/docs/NEXT_PROMPT.md` to point to the next roadmap issue (e.g., Issue #8 `--top` / `--max-tokens` or Issue #10 `<slot>` integrity).
- **Commit:** `docs: document --spatial-brief flag and update next-prompt pointer`

---

## 4. Acceptance Checklist (from Issue #5)
- `--spatial-brief` emits accurate viewport-relative `[x,y wxh]` coordinates for semantic landmarks and target selectors.
- Typical full-page landmark output stays under ~60 tokens.
- Traverses open Shadow DOM boundaries to capture top-level custom element containers.
- All unit and integration tests pass; clean git history with atomic micro-chunk commits.
