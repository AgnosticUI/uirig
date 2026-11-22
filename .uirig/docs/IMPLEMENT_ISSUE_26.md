# Implementation Plan: Issue #26 — CSS `background-clip: text` Gradient Luminance in `matrix.ts`

- **Issue:** `AgnosticUI/uirig#26` — `feat(contrast): support CSS background-clip: text gradient luminance in matrix.ts`
- **Branch:** `feat/issue-26-background-clip-text`
- **Status:** Complete (Chunks 0–3 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Extend the `contrast` verification engine (`src/core/matrix.ts`) to detect CSS gradient-clipped text (`background-clip: text` / `-webkit-background-clip: text` paired with a `gradient(...)` in `background-image` and transparent text fill) so `uirig contrast` and `uirig check` evaluate the **worst-case (lowest-contrast) gradient color stop** against the composited ancestor backdrop instead of falsely evaluating `color: transparent` / fallback white `1.00:1`.

### Out of Scope
- Raster/SVG `url(...)` background images clipped to text (only CSS gradient functions `linear-gradient`, `radial-gradient`, `conic-gradient`, `repeating-linear-gradient`, `repeating-radial-gradient`, `repeating-conic-gradient` are parsed).
- Elements with `background-clip: text` that still render opaque `color` / `-webkit-text-fill-color` (when text fill is non-transparent, the visible fill color itself paints over the clipped background).

---

## 2. How Gradient-Clipped Text Contrast Works (Plain-English Rules)

1. **Detecting `background-clip: text` + Gradient + Transparent Fill:**
   - In `extractTextContrastSnapshots` (`src/core/matrix.ts`), inspect computed styles on the text node's element:
     - `backgroundClip === 'text'` OR `webkitBackgroundClip === 'text'`
     - `backgroundImage` contains a CSS gradient (`gradient(`)
     - Text fill is transparent (`-webkit-text-fill-color` or `color` parses with `alpha <= 0.05` / `'transparent'` / `'rgba(0, 0, 0, 0)'`).
   - Also exclude the text element's own `backgroundColor` / `backgroundImage` from acting as the *backdrop behind* the text when `background-clip: text` is active, because `background-clip: text` paints the background *inside* the glyph mask rather than behind the glyphs!
2. **Parsing Gradient Color Stops (`extractGradientColorStops`):**
   - Parse top-level comma-separated arguments inside `*-gradient(...)` (respecting nested parentheses such as `rgb(...)`, `rgba(...)`, `hsl(...)`, `oklch(...)`).
   - Skip non-color arguments (angles like `120deg`, directions like `to right`, shape/size keywords like `circle at center`, `from 0deg`).
   - For each color stop (e.g., `#bd34fe 30%`, `rgba(255, 255, 255, 0.8) 50%`), extract the CSS color token and validate it via `colorjs.io` (`new Color(...)`).
3. **Worst-Case Stop Evaluation (`evaluateContrastEntry`):**
   - When `gradientColors` are present on `IExtractedTextContrastEntry`, evaluate **every** parsed stop against the composited ancestor backdrop (`effectiveLayers`) using `compositeContrastLayers`.
   - Select the stop yielding the **lowest WCAG 2.1 contrast ratio** (worst-case legibility along the gradient).
   - If that worst-case ratio is `< threshold`, emit an `IContrastViolation` using that stop's resolved `foregroundRgb` (and `suggestedToken` when `allowedColors` are configured); otherwise return `null` (PASS).

---

## 3. Micro-Chunk Execution Breakdown

Each micro-chunk is small, testable, and committed immediately upon passing `npm run typecheck && npm test && npm run build`, followed by updating this checklist and `.uirig/docs/NEXT_PROMPT.md`.

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_26.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-26-background-clip-text`, save this implementation plan, and initialize the continuity capsule.
  - **Commit:** `docs(plan): add implementation plan and continuity capsule for issue #26 (background-clip: text)`

- [x] **Chunk 1: Gradient Stop Parser & Worst-Case Contrast Evaluator in `src/core/matrix.ts` + Unit Tests**
  - **Files:** `src/core/matrix.ts`, `tests/unit/matrix.test.ts`
  - **Action:**
    - Add `extractGradientColorStops(backgroundImage: string): string[]` in `src/core/matrix.ts` to parse color stops from `linear-gradient`, `radial-gradient`, `conic-gradient`, and `repeating-*` variants (including `-webkit-linear-gradient(...)`).
    - Extend `IExtractedTextContrastEntry` and `evaluateContrastEntry` with optional `gradientColors?: string[]` so worst-case stop contrast is computed against the composited backdrop.
    - Add unit tests in `tests/unit/matrix.test.ts` verifying gradient stop extraction and worst-case evaluation (passing high-contrast gradient stops vs. failing low-contrast stops on light/dark backdrops).
  - **Commit:** `feat(contrast): parse CSS gradient color stops and evaluate worst-case contrast in matrix.ts`

- [x] **Chunk 2: Live Browser `background-clip: text` Extraction & Chromium E2E Tests**
  - **Files:** `src/core/matrix.ts`, `tests/unit/matrix.test.ts`
  - **Action:**
    - Update `extractTextContrastSnapshots` in `src/core/matrix.ts` to detect `backgroundClip === 'text'` / `webkitBackgroundClip === 'text'` + `gradient(...)` + transparent text fill, strip the clipped gradient from the backdrop stack, and attach `gradientColors`.
    - Add live Chromium tests in `tests/unit/matrix.test.ts` covering VitePress-style `.name.clip` hero headings (`-webkit-background-clip: text; -webkit-text-fill-color: transparent; background: -webkit-linear-gradient(...)`) for both passing dark-backdrop gradients and failing light-backdrop low-contrast gradients.
  - **Commit:** `feat(contrast): detect live background-clip: text gradients in browser contrast crawler`

- [x] **Chunk 3: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_26.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:**
    - Document CSS `background-clip: text` gradient luminance evaluation under the `contrast` engine in `README.md` and `AGENTS.md`.
    - Mark all chunks `[x]` complete in `.uirig/docs/IMPLEMENT_ISSUE_26.md` and update `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs: document background-clip: text gradient luminance support for issue #26`

---

## 4. Acceptance Checklist (from `AgnosticUI/uirig#26`)
- [x] `backgroundClip === 'text'` / `webkitBackgroundClip === 'text'` with `gradient(...)` and transparent text fill is detected in `src/core/matrix.ts`.
- [x] Gradient color stops (hex, `rgb`/`rgba`, `hsl`/`hsla`, `oklch`, named colors, with percentage/length stop positions) are parsed accurately.
- [x] Worst-case (lowest contrast) stop is evaluated against the composited ancestor background (without self-compositing the clipped background behind the glyphs).
- [x] High-contrast gradient headings (e.g., VitePress `.name.clip` on dark surfaces) pass without `1.00:1` false positives, while low-contrast gradient stops fail with accurate `foregroundRgb` and `contrastRatio`.
- [x] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
