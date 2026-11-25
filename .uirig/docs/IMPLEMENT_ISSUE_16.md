# Implementation Plan: Issue #16 — Interactive State & Click-Occlusion Math (`states` / `stress`)

- **Issue:** `#16` — `Interactive State & Click-Occlusion Math (states / stress)`
- **Pillar:** `Pillar 3: Deterministic Blind-Spot Killers` (`engine: states`)
- **Branch:** `feat/issue-16-states`
- **Status:** `In Progress (Chunk 0)`
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Add a deterministic interactive state & click-occlusion verification engine (`src/core/states.ts`, exposed via `uirig states`, `uirig check`, `--only=states`, and MCP `uirig_states`) using native Chromium DevTools Protocol (`CSS.forcePseudoState`) and Shadow-DOM-piercing `elementsFromPoint(x, y)` geometry:

1. **`click_occluded`:** Samples the center coordinate `(x, y)` of every visible interactive control (`button`, `a[href]`, `input:not([type="hidden"])`, `select`, `textarea`, `[role="button"]`, `[role="link"]`, `[role="tab"]`, `[tabindex]:not([tabindex="-1"])`) through Light DOM and nested open `ShadowRoot.elementsFromPoint(x, y)` layers. Flags any control whose topmost hit-test target (`pointer-events !== 'none'`) is an unrelated element rather than the control itself, a composed descendant, or an associated `<label>`.
2. **`missing_focus_visible`:** Forces `:focus-visible` on each interactive control via CDP `CSS.forcePseudoState` (restoring `[]` immediately afterward) and compares rest vs. `:focus-visible` computed styles (`outline`, `border`, `box-shadow`, `background-color`, `color`, `text-decoration`). Flags controls where `:focus-visible` produces zero measurable visual change (e.g., `outline: none` with no replacement focus ring).
3. **Scoping & Shadow DOM Parity:** Honors `--scope` / `--selectors`, `--exclude`, and `data-uirig-ignore="states|all"` / `uirig.config.json` ignore rules across Light DOM and open `ShadowRoot` boundaries.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Branch & Plan Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_16.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-16-states` from `main` and initialize tracking docs.
- [ ] **Chunk 1: Pure Click-Occlusion & Focus-Visible Evaluators (`src/interfaces/locator.ts`, `src/core/states.ts`, `tests/unit/states.test.ts`)**
  - **Action:** Add `IInteractiveStateViolation` and `'states'` to `UirigEngineName` in `src/interfaces/locator.ts`; implement pure visual-delta and hit-test evaluators in `src/core/states.ts` with 1-to-1 unit tests in `tests/unit/states.test.ts`.
- [ ] **Chunk 2: Live Chromium CDP `CSS.forcePseudoState` & Shadow-Piercing `elementsFromPoint` Collector (`src/core/states.ts`, `tests/unit/states.test.ts`)**
  - **Action:** Implement `runInteractiveStatesAudit(page, options)` using `createBrowserDomWalker`, Shadow-piercing `elementsFromPoint`, and CDP `CSS.forcePseudoState` (`['focus-visible']` & `['hover']`), plus live Chromium E2E tests.
- [ ] **Chunk 3: Wire `states` into `check.ts`, `agent-stream.ts`, `console-report.ts`, `index.ts`, and `mcp.ts`**
  - **Action:** Register `'states'` across `AuditToolName`, `executeCheckCommand`, `formatAgenticJsonStream`, `formatViewportConsoleSection`, CLI subcommands/help, and MCP tools (`uirig_states`).
- [ ] **Chunk 4: Documentation Sync, Full Verification & Merge**
  - **Action:** Update `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_16.md`, and `.uirig/docs/NEXT_PROMPT.md`; run `npm test && npx tsc --noEmit`; merge `feat/issue-16-states` to `main` and close Issue `#16`.

---

## 3. Acceptance Checklist (from Issue #16)

- [ ] Flags interactive elements with zero visual style change under `:focus-visible`.
- [ ] Flags interactive elements whose center point is occluded by an unrelated element (`pointer-events !== 'none'`).
- [ ] Works across open Shadow DOM boundaries.
- [ ] Respects `--scope`, `--exclude`, and ignore rules.