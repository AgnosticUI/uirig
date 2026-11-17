# Implementation Plan: Issue #5 — Semantic Spatial Brief (`--spatial-brief`)

- **Issue:** `#5` — `"No-Vision Required" Semantic Spatial Brief (--spatial-brief)`
- **Pillar:** Pillar 2: Token & AI Cost Savers (`ai-native`, `pillar: token-efficiency`)
- **Status:** In Progress (Chunks 0–3 complete; Chunk 4 next)
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

1. **In-Page Geometry Collector (`collectSpatialNodes` in `src/utils/spatial-brief.ts`):**
   - Self-contained browser evaluation function traversing `document` and open `ShadowRoot` boundaries.
   - Extracts viewport-relative `getBoundingClientRect()` values rounded to integers (`x`, `y`, `width`, `height`).
   - Skips non-rendered elements (`width <= 0 || height <= 0`, `display: none`, `visibility: hidden`, `opacity: 0`).
   - Collects semantic HTML5/ARIA landmarks, top-level custom element hosts (`tagName.includes('-')`), and explicit `--selectors` targets.

2. **Pure Formatter (`formatSpatialBrief` in `src/utils/spatial-brief.ts`):**
   - Deduplicates identical `(label, x, y, width, height)` entries, sorts in reading order (`y` then `x`), and enforces `DEFAULT_MAX_SPATIAL_NODES = 20`.

3. **Runner, JSON Stream, PR Reporter & CLI Integration:**
   - Wired into `src/commands/check.ts`, `src/utils/agent-stream.ts`, `src/utils/fs.ts`, and `src/index.ts`.

---

## 3. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #5 (--spatial-brief)`

- [x] **Chunk 1: Types & Pure Spatial Brief Formatter + Unit Tests**
  - **Files:** `src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`
  - **Commit:** `feat(spatial-brief): add SpatialNode types, formatter, and unit tests`

- [x] **Chunk 2: In-Page DOM & Shadow-DOM Landmark Collector + Unit Tests**
  - **Files:** `src/utils/spatial-brief.ts`, `tests/unit/spatial-brief.test.ts`
  - **Commit:** `feat(spatial-brief): implement Shadow-DOM-aware landmark and selector geometry collector`

- [x] **Chunk 3: Runner, JSON Stream & PR Comment Reporter Integration**
  - **Files:** `src/commands/check.ts`, `src/utils/agent-stream.ts`, `src/utils/fs.ts`, `tests/unit/agent-stream.test.ts`, `tests/unit/fs.test.ts`
  - **Commit:** `feat(runner): integrate spatialBrief collection into check execution, JSON stream, and PR report`

- [ ] **Chunk 4: CLI Flag Wiring (`--spatial-brief`), Subcommand `--help` & Unit Tests**
  - **Files:** `src/index.ts`, `tests/unit/index.test.ts`
  - **Action:**
    - Parse `--spatial-brief` boolean flag in CLI argument parser and forward `spatialBrief` into `executeCheckCommand()`.
    - Document `--spatial-brief` in top-level and `check` subcommand `--help` output.
    - Add unit tests in `tests/unit/index.test.ts` verifying flag parsing and `--help` output.
  - **Commit:** `feat(cli): expose --spatial-brief flag and update help output`

- [ ] **Chunk 5: Docs Sync & Next-Issue Capsule Handoff**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_5.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document `--spatial-brief` in `README.md` and `AGENTS.md`.
    - Mark Chunk 4 & 5 `[x]` in `.uirig/docs/IMPLEMENT_ISSUE_5.md` and point `.uirig/docs/NEXT_PROMPT.md` to the next roadmap issue.
  - **Commit:** `docs: document --spatial-brief flag and update session continuity capsule`

---

## 4. Acceptance Checklist (from Issue #5)
- [x] `--spatial-brief` collector & formatter emit accurate viewport-relative `[x,y wxh]` coordinates for semantic landmarks and target selectors.
- [x] Typical full-page landmark output stays under ~60 tokens (`DEFAULT_MAX_SPATIAL_NODES = 20`).
- [x] Traverses open Shadow DOM boundaries to capture top-level custom element containers.
- [ ] CLI flag `--spatial-brief` wired end-to-end in `src/index.ts` with 1-to-1 unit specs in `tests/unit/index.test.ts`.
