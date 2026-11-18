# Implementation Plan: Issue #17 — Web Component `<slot>` & Content-Model Integrity

- **Issue:** `AgnosticUI/uirig#17` — `Web Component <slot> & Content-Model Integrity (dom)`
- **Branch:** `feat/issue-17-slot-integrity`
- **Status:** In Progress (Chunks 0–1 Complete; Chunk 2 Final Docs Sync Next)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Extend the `dom` verification engine (`src/core/dom.ts`) to inspect open `ShadowRoot` `<slot>` assignments on custom elements and flag **orphaned light-DOM children** that were silently dropped by the browser because:
1. They carry a `slot="foo"` attribute that does not match any `<slot name="foo">` inside the host's `ShadowRoot` (hallucinated slot name), **or**
2. They have no `slot` attribute (default slot content), yet the host's `ShadowRoot` defines only named `<slot name="...">` elements and no unnamed default `<slot>` (and the child is not purely `<style>`, `<script>`, `<template>`, or empty whitespace).

When an orphaned child is detected, emit a `dom` violation (`rule: 'orphaned_slot_content'`) whose `detail` and `remediationAdvice` list the **exact valid slot names** defined in that custom element's `ShadowRoot` (e.g. `header`, `footer`, or `default`).

### Out of Scope
- Closed `ShadowRoot` instances (`el.shadowRoot === null`), since closed shadow trees are intentionally encapsulated from external DOM inspection.
- Slotted content inside native `<slot>` fallback trees (only direct light-DOM element children of custom element hosts with an open `ShadowRoot` are checked).

---

## 2. How `<slot>` Assignment Detection Works (Plain-English Rules)

For every custom element host (`el.tagName.includes('-')`) with an open `el.shadowRoot`:
1. **Discover Valid Slots in `el.shadowRoot`:**
   - Query `el.shadowRoot.querySelectorAll('slot')`.
   - Collect all non-empty `name` attributes into `namedSlots: Array<string>` and check whether an unnamed default `<slot>` exists (`hasDefaultSlot: boolean`).
   - *(Note: If `shadowRoot` contains zero `<slot>` elements at all, any non-ignored light-DOM element child inside that custom element is orphaned because the component renders no slots.)*
2. **Inspect Direct Light-DOM Element Children (`Array.from(el.children)`):**
   - Skip `<style>`, `<script>`, `<template>`, and `[hidden]` / `aria-hidden="true"` utility nodes.
   - Check `child.assignedSlot` (and cross-check against `namedSlots` / `hasDefaultSlot` so both real Chromium and lightweight unit-test DOM stubs behave identically):
     - **Case A — Named Slot Mismatch:** `const requestedSlot = child.getAttribute('slot')`. If `requestedSlot` is non-empty and `!namedSlots.includes(requestedSlot)` (or `child.assignedSlot === null`), flag `orphaned_slot_content`.
     - **Case B — Missing Default Slot:** If `requestedSlot` is null/empty and `!hasDefaultSlot` (or `child.assignedSlot === null`), flag `orphaned_slot_content`.
3. **Actionable Error Message (`detail`):**
   - When `namedSlots` or `hasDefaultSlot` exist:
     `Orphaned light-DOM child <span slot="card-header"> inside <ag-card>: slot "card-header" does not exist. Valid slots: "header", "footer" (or default unnamed slot).`
   - When the custom element defines no `<slot>` elements at all:
     `Orphaned light-DOM child <p> inside <ag-badge>: <ag-badge> defines no <slot> elements in its ShadowRoot.`
---

## 3. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon passing `npm run build && npm run typecheck:all && npm test`, followed by updating this checklist and `.uirig/docs/NEXT_PROMPT.md`.

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_17.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-17-slot-integrity`, save this implementation plan, and initialize the continuity capsule.
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #17 (<slot> integrity)`

- [x] **Chunk 1: Core `<slot>` Integrity Audit in `src/core/dom.ts` + Locator Type & 1-to-1 Unit Tests**
  - **Files:** `src/interfaces/locator.ts`, `src/core/dom.ts`, `tests/unit/dom.test.ts`
  - **Action:**
    - Add `'orphaned_slot_content'` to `DomViolationRule` in `src/interfaces/locator.ts`.
    - Add Web Component `<slot>` audit inside `src/core/dom.ts` (traversing Light DOM and nested open `ShadowRoot` trees, respecting `data-uirig-ignore="dom"` / `ignoreRules` and `--selectors`, and listing valid slot names in `detail`).
    - Update `tests/unit/dom.test.ts` with unit specs covering hallucinated `slot="card-header"`, unslotted children when no default `<slot>` exists, valid slot assignments, and `data-uirig-ignore="dom"`.
  - **Commit:** `feat(dom): detect orphaned Web Component <slot> content with valid slot hints`

- **Chunk 2: Agentic Stream Remediation & Docs Sync (`agent-stream.ts`, `README.md`, `AGENTS.md`)**
  - **Files:** `src/utils/agent-stream.ts`, `tests/unit/agent-stream.test.ts`, `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_17.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Ensure `normalizeViewportViolations()` in `src/utils/agent-stream.ts` emits clear, targeted `remediationAdvice` for `orphaned_slot_content` (instructing the agent to update or remove the `slot` attribute to match one of the host's valid slots).
    - Document `<slot>` & content-model integrity under the `dom` engine in `README.md` and `AGENTS.md` (outputting all modified files in full from line 1 to EOF).
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_17.md` and point `.uirig/docs/NEXT_PROMPT.md` to the next roadmap issue (`#10` Zero-Config Design Token Auto-Discovery `--auto-tokens`).
  - **Commit:** `docs: document Web Component <slot> integrity checks and update session continuity capsule`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#17`)
- [x] Hallucinated `slot="invalid-name"` attributes on light-DOM children of custom elements are caught by `uirig dom` and `uirig check`.
- [x] Unslotted light-DOM children inside custom elements lacking a default `<slot>` are caught with `rule: 'orphaned_slot_content'`.
- [x] Error details and JSON `remediationAdvice` list the valid slot names defined by the custom element's `ShadowRoot`.
- [x] Valid named and default `<slot>` assignments pass with zero false positives.
- [x] Respects `data-uirig-ignore="dom"`, `uirig.config.json` `ignore`, and `--selectors`.
- All unit tests pass and documentation (`README.md`, `AGENTS.md`) is synced.
