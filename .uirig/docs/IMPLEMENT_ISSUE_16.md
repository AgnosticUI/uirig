# Implementation Plan: Issue #16 — Interactive State & Click-Occlusion Math (`states` / `stress`)

- **Issue:** `#16` — `Interactive State & Click-Occlusion Math (states / stress)`
- **Pillar:** `Pillar 3: Deterministic Blind-Spot Killers` (`engine: states`)
- **Branch:** `feat/issue-16-states` (merged to `main`)
- **Status:** `Completed & Merged`
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Added a deterministic interactive state & click-occlusion verification engine (`src/core/states.ts`, exposed via `uirig states`, `uirig check`, `--only=states`, and MCP `uirig_states`) using native Chromium DevTools Protocol (`CSS.forcePseudoState`) and Shadow-DOM-piercing `elementsFromPoint(x, y)` geometry:

1. **`click_occluded`:** Samples the center `(50%, 50%)` and safely inset `(25%, 25%)` / `(75%, 75%)` coordinates of every viewport- and overflow-clipped interactive control through Light DOM, nested open `ShadowRoot.elementsFromPoint(x, y)`, and same-origin `<iframe>` layers. Flags controls whose topmost hit-test target (`pointer-events !== 'none'`, including `opacity: 0` click-stealers) is unrelated to the control, its composed descendants, or an enclosing / `for="id"` `<label>`.
2. **`missing_focus_visible`:** Forces `:focus-visible` on each interactive control via CDP `CSS.forcePseudoState` (restoring `[]` immediately afterward) and compares rest vs. `:focus-visible` computed styles (`outline`, `border`, `box-shadow`, `background-color`, `color`, `text-decoration`). Flags controls where `:focus-visible` produces zero measurable visual change.
3. **Scoping & Shadow DOM Parity:** Honors `--scope` / `--selectors`, `--exclude`, and `data-uirig-ignore="states|all"` / `uirig.config.json` ignore rules across Light DOM and open `ShadowRoot` boundaries.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Branch & Plan Scaffold** (`docs(plan): initialize branch and tracking for issue #16` — `1f0b8dd`)
- [x] **Chunk 1: Pure Click-Occlusion & Focus-Visible Evaluators (`src/interfaces/locator.ts`, `src/core/states.ts`, `tests/unit/states.test.ts`)** (`feat(states): add click-occlusion math and CDP :focus-visible engine`)
- [x] **Chunk 2: Live Chromium CDP `CSS.forcePseudoState` & Shadow-Piercing `elementsFromPoint` Collector (`src/core/states.ts`, `tests/unit/states.test.ts`)** (`feat(states): add click-occlusion math and CDP :focus-visible engine`)
- [x] **Chunk 3: Wire `states` into `check.ts`, `violation-budget.ts`, `agent-stream.ts`, `console-report.ts`, `fs.ts`, `index.ts`, and `mcp.ts`** (`feat(states): integrate interactive states engine across check, CLI, MCP, and reporters` — `e1317b9`)
- [x] **Chunk 4: Documentation Sync (`README.md`, `AGENTS.md`, `.uirig/docs/`), Full Verification & Merge**

---

## 3. Acceptance Checklist (from Issue #16)

- [x] Flags interactive elements with zero visual style change under `:focus-visible`.
- [x] Flags interactive elements whose center/inset points are occluded by an unrelated element (`pointer-events !== 'none'`, including `opacity: 0` click-stealers).
- [x] Exempts floating `<label for="id">` overlays, `pointer-events: none` controls, off-screen/overflow-clipped controls, and Shadow DOM host buttons (`<my-button tabindex="0">`).
- [x] Works across nested open Shadow DOM boundaries and same-origin iframes.
- [x] Respects `--scope`, `--exclude`, and ignore rules.
