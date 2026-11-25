# Issue #57: Exclude Non-Visible Overlays & Tooltips (`opacity: 0` / `visibility: hidden`)
**Current Focus:** Phase 1 > Step 1.2 > Micro-chunk 1.2.1 (Skip composed `opacity: 0` / `visibility: hidden` elements in `extractTextContrastSnapshots` in `src/core/matrix.ts`)

* **Repository:** `AgnosticUI/uirig`
* **Active Branch:** `fix/non-visible-overlays-57`
* **Issue:** `#57` — `Exclude non-visible (opacity: 0 / visibility: hidden) overlays and tooltips from contrast and dark-mode engines`
* **Tracking:** `.uirig/docs/IMPLEMENT_ISSUE_57.md`

---

## ✅ Phase 1: Context Inspection & Text Contrast Overlay Filtering
* **Goal:** Inspect visibility handling across `matrix.ts` and `dark-mode.ts`, and exclude `opacity: 0` / `visibility: hidden` overlays and tooltips (including inherited ancestor opacity/visibility across Shadow DOM) from `extractTextContrastSnapshots`.

### ✅ Step 1.1: Context Gathering & Branch Setup
- [x] ✅ Micro-chunk 1.1.1: Create `fix/non-visible-overlays-57` branch and inspect `src/core/dark-mode.ts` and `src/core/matrix.ts`.

---

## 🔄 Phase 2: Contrast & Dark-Mode Engine Updates
* **Goal:** Prevent closed/inactive overlays and tooltips (`div.ag-combobox__no-results`, `div.ag-slider__tooltip`) from triggering false-positive `1.00:1` contrast or stranded-surface failures.

### 🔄 Step 2.1: Text Contrast Overlay & Tooltip Exclusion (`src/core/matrix.ts`)
- [ ] 🔄 Micro-chunk 2.1.1: Add `isEffectivelyInvisibleOverlay(el)` helper inside `extractTextContrastSnapshots` (`src/core/matrix.ts`) checking direct and composed-ancestor `display === 'none'`, `visibility === 'hidden' | 'collapse'`, and effective `opacity <= 0.001`.
- [ ] ⬜ Micro-chunk 2.1.2: Add co-developed unit test in `tests/unit/matrix.test.ts` verifying closed `ag-combobox__no-results` (`opacity: 0`) and `ag-slider__tooltip` (`visibility: hidden`) pass with `0` contrast violations, verify with `npx vitest run tests/unit/matrix.test.ts && npm run typecheck:all`, and commit.

### ⬜ Step 2.2: Dark-Mode Surface Overlay Exclusion (`src/core/dark-mode.ts`)
- [ ] ⬜ Micro-chunk 2.2.1: Update `runDarkModeAudit` (`src/core/dark-mode.ts`) to skip surface candidates whose direct or composed-ancestor `visibility === 'hidden' | 'collapse'` or effective `opacity <= 0.001`.
- [ ] ⬜ Micro-chunk 2.2.2: Add co-developed unit test in `tests/unit/dark-mode.test.ts` verifying hidden `opacity: 0` / `visibility: hidden` light-colored popovers/tooltips do not trigger `dark_mode_contrast_drop` or `stranded_light_surface`, verify with `npx vitest run tests/unit/dark-mode.test.ts && npm run typecheck:all`, and commit.

---

## ⬜ Phase 3: Verification, Merge & Issue Closure
* **Goal:** Confirm zero regressions across `matrix` and `dark-mode`, merge `fix/non-visible-overlays-57` into `main`, and close Issue #57.

### ⬜ Step 3.1: Merge & Close Issue #57
- [ ] ⬜ Micro-chunk 3.1.1: Merge `fix/non-visible-overlays-57` into `main` (`git merge --no-ff`) and close Issue #57 via `gh issue close 57`.
