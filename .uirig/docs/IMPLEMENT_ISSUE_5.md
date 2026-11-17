# Implementation Plan: Issue #5 — Semantic Spatial Brief (`--spatial-brief`)

- **Issue:** `#5` — `"No-Vision Required" Semantic Spatial Brief (--spatial-brief)`
- **Pillar:** Pillar 2: Token & AI Cost Savers (`ai-native`, `pillar: token-efficiency`)
- **Status:** Complete (All Chunks 0–5 implemented, verified, and documented)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a `--spatial-brief` CLI flag (and `spatialBrief` field in `--json` output) that emits an ultra-compact, plain-text bounding-box summary of top-level landmarks, custom elements, and `--selectors` targets—delivering macro-layout awareness in **~40–60 plain-text tokens** instead of 1,500–3,000+ screenshot vision tokens.

### Target Output Format

- **CLI text mode (`uirig check --spatial-brief`):**

      header[0,0 1440x64] | aside[0,64 260x836] | main[260,64 1180x836] | footer[0,900 1440x120]

- **JSON mode (`uirig check --spatial-brief --json`):**
  Includes top-level `"spatialBrief": "header[0,0 1440x64] | ..."` when `--spatial-brief` is enabled.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Scaffold** (`docs(plan): add implementation plan and continuity capsule for issue #5 (--spatial-brief)`)
- [x] **Chunk 1: Types & Pure Spatial Brief Formatter + Unit Tests** (`feat(spatial-brief): add SpatialNode types, formatter, and unit tests`)
- [x] **Chunk 2: In-Page DOM & Shadow-DOM Landmark Collector + Unit Tests** (`feat(spatial-brief): implement Shadow-DOM-aware landmark and selector geometry collector`)
- [x] **Chunk 3: Runner, JSON Stream & PR Comment Reporter Integration** (`feat(runner): integrate spatialBrief collection into check execution, JSON stream, and PR report`)
- [x] **Chunk 4: CLI Flag Wiring (`--spatial-brief`), Subcommand `--help` & Unit Tests** (`feat(cli): expose --spatial-brief flag and update help output`)
- [x] **Chunk 5: Docs Sync & Next-Issue Capsule Handoff** (`docs: document --spatial-brief flag and update session continuity capsule`)

---

## 3. Acceptance Checklist (from Issue #5)
- [x] `--spatial-brief` collector & formatter emit accurate viewport-relative `[x,y wxh]` coordinates for semantic landmarks and target selectors.
- [x] Typical full-page landmark output stays under ~60 tokens (`DEFAULT_MAX_SPATIAL_NODES = 20`).
- [x] Traverses open Shadow DOM boundaries to capture top-level custom element containers.
- [x] CLI flag `--spatial-brief` wired end-to-end in `src/index.ts` with 1-to-1 unit specs in `tests/unit/index.test.ts` and documented in `README.md` and `AGENTS.md`.
