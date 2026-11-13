# `uirig` — Patch v0.2.2 Plan (Enable `<slot>` Traversal in `createBrowserDomWalker`)

**Baseline:** `@rlevin/uirig@0.2.1`  
**Purpose:** Remove `'SLOT'` from `nonVisualTags` in `src/utils/dom-walker.ts` so `matrix.ts` (`hasSlottedDirectText`) actively audits the contrast of Light DOM text projected into Shadow DOM `<slot>` elements (catching low-contrast slotted text such as `ag-button[title="Monochrome Disabled"]`).

---

## Root Cause & Fix

* **Root Cause:** In `v0.2.1`, `src/core/matrix.ts` added `hasSlottedDirectText()` to evaluate `<slot>` elements against their enclosing Shadow DOM background stack, **but** `src/utils/dom-walker.ts` still listed `'SLOT'` in `nonVisualTags`. Consequently, `walkElements()` skipped `<slot>` before `matrix.ts` could inspect it.
* **Fix:** Remove `'SLOT'` from `nonVisualTags` in `src/utils/dom-walker.ts`. Because `<slot>` has `display: contents` by default and contains no direct text nodes unless assigned via `assignedNodes({ flatten: true })`, removing `'SLOT'` from `nonVisualTags` introduces zero false positives in `tokens.ts`, `adversary.ts`, or `dom.ts` while enabling full contrast auditing of slotted text in `matrix.ts` and `dark-mode.ts`.

---

## Implementation Checklist (`v0.2.2`)

- [x] **Micro-Chunk 1 (`dom-walker` + `matrix` test):** Remove `'SLOT'` from `nonVisualTags` in `src/utils/dom-walker.ts` and add a low-contrast slotted `<ag-button>` regression test in `tests/unit/matrix.test.ts`.
- [x] **Micro-Chunk 2 (`release`):** Bump version to `0.2.2` (`npm version 0.2.2 --no-git-tag-version`), commit, and publish via `npm run release` + `npm run release:publish`.
