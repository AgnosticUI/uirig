# Implementation Plan: Issue #19 — Computed Accessibility Tree Snapshot (`dom` / `contrast`)

- **Issue:** `AgnosticUI/uirig#19` — `Computed Accessibility Tree Snapshot (dom / contrast)`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Branch:** `feat/issue-19-ax-tree`
- **Status:** In Progress (Chunks 0–1 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Extend the `dom` verification engine (`src/core/dom.ts`) with native Chromium DevTools Protocol (CDP) `Accessibility.getFullAXTree` inspection so `uirig` catches screen-reader and keyboard focus defects across Light DOM and open `ShadowRoot` boundaries without adding external dependencies (`axe-core`).

### Rules Implemented
1. **`ax_empty_name`:** Flags interactive AX roles (`button`, `link`, `textbox`, `combobox`, `checkbox`, `radio`, `tab`, `menuitem`) that are visible/non-ignored in Chromium's computed accessibility tree whose computed accessible `name.value` is empty or whitespace-only (including custom elements like `<div role="button">` or icon-only Shadow DOM buttons whose accessible name was severed).
2. **`ax_hidden_focus`:** Flags keyboard-focusable controls (`tabIndex >= 0`, including native interactive elements and custom elements with `tabindex="0"`) nested inside an ancestor with `aria-hidden="true"` or `inert`, which creates a keyboard trap invisible to screen readers.

### Out of Scope
- Adding external third-party accessibility libraries (`axe-core`); uses Chromium's built-in CDP `Accessibility.getFullAXTree` and `DOM.resolveNode` primitives exclusively.

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_19.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-19-ax-tree` from `main` and mark `#19` as active in `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #19 (computed AX tree)`

- [x] **Chunk 1: Pure AX Tree Rule Evaluators (`ax_empty_name`, `ax_hidden_focus`) & Type Contracts**
  - **Files:** `src/interfaces/locator.ts`, `src/core/ax-tree.ts`, `tests/unit/ax-tree.test.ts`
  - **Action:**
    - Extend `IDomIntegrityViolation['rule']` in `src/interfaces/locator.ts` with `'ax_empty_name' | 'ax_hidden_focus'`.
    - Create `src/core/ax-tree.ts` with pure, deterministic evaluators (`evaluateAxNodeForEmptyName()`, `evaluateAxNodeForHiddenFocus()`) and interactive role constants (`button`, `link`, `textbox`, `combobox`, `checkbox`, `radio`, `tab`, `menuitem`).
    - Write 1-to-1 unit tests in `tests/unit/ax-tree.test.ts` covering empty/whitespace names, valid labels, and `aria-hidden="true"` / `inert` focus traps.
  - **Commit:** `feat(dom): add pure AX-tree rule evaluators for ax_empty_name and ax_hidden_focus`

- [ ] **Chunk 2: Live Chromium CDP `Accessibility.getFullAXTree` Collector & Shadow DOM Host Attribution**
  - **Files:** `src/core/ax-tree.ts`, `src/core/dom.ts`, `tests/unit/ax-tree.test.ts`
  - **Action:**
    - Add `auditComputedAccessibilityTree(page, options)` in `src/core/ax-tree.ts` using `page.context().newCDPSession(page)` -> `Accessibility.getFullAXTree` + `DOM.resolveNode` to map offending AX nodes back to DOM elements, piercing Shadow DOM selectors (`host >> shadow-root >> inner`), `hostComponent`, `--selectors` scope, and `data-uirig-ignore="dom"` rules.
    - Wire `auditComputedAccessibilityTree()` into `runDomIntegrityAudit()` in `src/core/dom.ts` (deduplicating overlapping `unlabeled_control` / `ax_empty_name` on the exact same selector).
    - Add live Chromium E2E tests in `tests/unit/ax-tree.test.ts` covering `<div role="button"></div>`, Shadow DOM `<ag-icon-button>` with severed accessible name, and `<button>` trapped inside `<div aria-hidden="true">`.
  - **Commit:** `feat(dom): integrate native CDP Accessibility.getFullAXTree inspection into dom engine`

- [ ] **Chunk 3: Agentic Stream Remediation Advice, Docs Sync & Final Verification**
  - **Files:** `src/utils/agent-stream.ts`, `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_19.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Add tailored `remediationAdvice` formatting for `ax_empty_name` and `ax_hidden_focus` in `src/utils/agent-stream.ts`.
    - Document computed AX-tree checks in `README.md` and `AGENTS.md`.
    - Run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#19`.
  - **Commit:** `docs(dom): document computed AX tree snapshot checks and remediation advice (#19)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#19`)
- [ ] Flags interactive elements (including Shadow DOM hosts) with an empty computed accessible name in Chromium's AX tree (`ax_empty_name`).
- [ ] Flags keyboard-focusable controls (`tabIndex >= 0`) trapped inside `aria-hidden="true"` or `inert` ancestors (`ax_hidden_focus`).
- [ ] Adds zero external dependencies by relying strictly on native Chromium CDP primitives.
- [ ] Respects `--selectors` scoping and `data-uirig-ignore="dom"` / `uirig.config.json` ignore rules.
- [ ] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
