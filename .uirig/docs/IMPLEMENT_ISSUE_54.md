# Issue #54: Resolve Enclosing Shadow DOM Surface Background for Projected `<slot>` Nodes
**Current Focus:** Phase 1 > Step 1.1 > Micro-chunk 1.1.1 (Enhance composed Shadow DOM `<slot>` surface background resolution in `src/core/matrix.ts`)

* **Repository:** `AgnosticUI/uirig`
* **Active Branch:** `fix/slotted-surface-background-54`
* **Issue:** `#54` — `Resolve enclosing Shadow DOM surface background for projected <slot> nodes in contrast and dark-mode engines`
* **Tracking:** `.uirig/docs/IMPLEMENT_ISSUE_54.md`

---

## 🔄 Phase 1: Composed Shadow DOM Surface Resolution (`contrast` & `dark-mode`)
* **Goal:** Ensure projected `<slot>` text nodes inside Shadow DOM components (`ag-button >> shadow-root >> slot`, `ag-selection-button >> shadow-root >> slot`) always resolve their enclosing Shadow DOM control surface background (including `background-color`, `background-image` gradients, and sibling/backdrop layers) instead of falling through to `body`.

### 🔄 Step 1.1: Enclosing Shadow DOM Surface Stack Extraction (`src/core/matrix.ts`)
- [ ] 🔄 Micro-chunk 1.1.1: Enhance `collectAncestorStyleLayers` inside `extractTextContrastSnapshots` (`src/core/matrix.ts`) to resolve enclosing Shadow DOM surface backgrounds across `assignedSlot` / `parentElement` / `ShadowRoot.host`, including gradient `background-image` surfaces on `<button>`/`<label>` containers and `elementsFromPoint` backdrop layers when ancestor `background-color` is transparent.
- [ ] ⬜ Micro-chunk 1.1.2: Add co-developed unit tests in `tests/unit/matrix.test.ts` and `tests/unit/dark-mode.test.ts` covering `ag-button >> shadow-root >> slot` and `ag-selection-button >> shadow-root >> slot` with solid, gradient, and layered Shadow DOM backgrounds across both `contrast` and `dark-mode`.

---

## ⬜ Phase 2: Verification, Merge & Issue Closure
* **Goal:** Verify zero regressions across `matrix` and `dark-mode`, merge `fix/slotted-surface-background-54` into `main`, and close Issue #54.

### ⬜ Step 2.1: Merge & Close Issue #54
- [ ] ⬜ Micro-chunk 2.1.1: Run `npx vitest run tests/unit/matrix.test.ts tests/unit/dark-mode.test.ts && npm run typecheck:all`, merge `fix/slotted-surface-background-54` into `main`, and close Issue #54 via `gh issue close 54`.
