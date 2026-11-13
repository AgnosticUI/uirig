# `uirig` — Patch v0.2.1 Plan (Shadow DOM `<slot>` Label & Contrast Resolution)

**Baseline:** `@rlevin/uirig@0.2.0`  
**Purpose:** Eliminate false positives on Web Components that project Light DOM text or icons into Shadow DOM `<slot>` elements (reproduced on `<ag-button title="Monochrome">`).

---

## Root Cause Analysis

1. **Slotted Button Accessible Name (`src/core/dom.ts`):**
   * In the browser DOM, `button.textContent` inside an open `ShadowRoot` does **not** include Light DOM nodes assigned to a `<slot>`.
   * Additionally, consumers frequently place `aria-label` or `aria-labelledby` on the custom element host (`<ag-button aria-label="Close">`) rather than directly on the internal `<button>`.
   * **Fix:** Extend `hasAccessibleLabel()` / button text extraction in `src/core/dom.ts` so `<button>` elements also inspect:
     1. Flattened assigned nodes (`slot.assignedNodes({ flatten: true })`) of any descendant `<slot>` elements (including `aria-label` / `alt` on slotted elements), and
     2. `aria-label` / `aria-labelledby` on `rootNode.host` when `rootNode instanceof ShadowRoot`.

2. **Slotted Text Contrast Compositing (`src/core/matrix.ts`):**
   * When a Light DOM text node is projected into a Shadow DOM `<slot>` (`textNode.assignedSlot !== null`), the browser paints that text inside the `ShadowRoot` slot container (for example, `ag-button >> shadow-root >> button > slot`), **not** directly on the Light DOM host (`<ag-button>`), whose own `backgroundColor` is typically `transparent`.
   * Evaluating contrast on `<ag-button>` causes `collectAncestorBackgroundLayers()` to walk upward to `<html>` (skipping the inner Shadow DOM `<button>` background) and produce false `1.09:1` contrast failures.
   * **Fix:** In `extractTextContrastSnapshots()` (`src/core/matrix.ts`):
     1. Only treat direct text nodes with `child.assignedSlot === null` as painted directly by `currentNode`.
     2. When `currentNode` is a `<slot>` element (`currentNode.tagName === 'SLOT'`), check `(currentNode as HTMLSlotElement).assignedNodes({ flatten: true })` for non-whitespace text nodes and collect `collectAncestorBackgroundLayers(currentNode)` from inside the `ShadowRoot` upward through `ShadowRoot.host`.

---

## Implementation Checklist (`v0.2.1`)

- [x] **Micro-Chunk 1 (`dom`):** Updated `src/core/dom.ts` + `tests/unit/dom.test.ts` to resolve flattened `<slot>` text and `ShadowRoot.host` ARIA labels on `<button>` elements.
- [x] **Micro-Chunk 2 (`matrix`):** Updated `src/core/matrix.ts` + `tests/unit/matrix.test.ts` so slotted Light DOM text nodes (`assignedSlot !== null`) are evaluated against their `<slot>`'s Shadow DOM background stack rather than the transparent host element.
- [x] **Micro-Chunk 3 (`release`):** Bumped version to `0.2.1`, ran `npm run release` + `npm run release:publish`, and closed the GitHub issue.
