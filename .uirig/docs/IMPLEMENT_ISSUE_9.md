# Implementation Plan: Issue #9 — Framework Source-Map & `file:line` Attribution

- **Issue:** `AgnosticUI/uirig#9` — `Framework Source-Map & file:line Attribution`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Track:** Track B (Source-Code Auto-Fix Path)
- **Branch:** `feat/issue-9-source-map-attribution`
- **Status:** Complete (Chunks 0–3 Complete)
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Attach `sourceFile`, `lineNumber`, and `columnNumber` directly to violation objects in `--json` output (`IAgenticViolation`) using Chromium DevTools Protocol (CDP) CSS/JS source maps and framework dev-mode metadata hooks (`data-source-loc`, Vite/Svelte/Astro/React dev attributes), eliminating multi-step agent repository grep loops.

### Resolution Strategy & Graceful Fallback
1. **Framework Dev-Mode DOM Attributes:** Inspect `data-source-loc` / `data-loc` attributes (`path/to/File.tsx:42:10`) when emitted by dev compilers.
2. **CSS Rule Source Maps (CDP `CSS.enable` + `CSS.getMatchedStylesForNode`):** For style-driven violations (`tokens`, `contrast`, `dark-mode`, `stress`), resolve the winning author CSS rule's `styleSheetId` and `range.startLine` / `startColumn` through `CSS.styleSheetAdded` headers and inline/external `.map` Base64 VLQ (Variable-Length Quantity) source maps back to the original `.css` / `.scss` / component `sourceFile` and 1-based `lineNumber`.
3. **Zero-Crash Production Fallback:** When source maps are disabled or missing (such as bundled production builds or static `.html` files without source maps), emit `sourceFile: null`, `lineNumber: null`, and `columnNumber: null` cleanly without throwing.

### Out of Scope
- Applying file edits on disk (handled by Issue `#13` once `sourceFile` and `lineNumber` are available).

---

## 2. Micro-Chunk Execution Breakdown

- [x] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_9.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-9-source-map-attribution` and mark `#9` active in `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #9 (source-map attribution)`

- [x] **Chunk 1: VLQ Source-Map Decoder & Framework Metadata Resolver (`src/core/source-map.ts`) + Unit Tests**
  - **Files:** `src/interfaces/locator.ts`, `src/core/source-map.ts`, `tests/unit/source-map.test.ts`
  - **Action:**
    - Define `ISourceLocation` in `src/interfaces/locator.ts`.
    - Implement a zero-dependency Base64 VLQ source-map v3 decoder (`resolveOriginalPositionFromSourceMap()`, `parseRawSourceMap()`) and dev-attribute parser (`parseDevSourceLocationAttribute()`) in `src/core/source-map.ts`.
    - Add unit tests in `tests/unit/source-map.test.ts` covering inline data-URI source maps, `data-source-loc` attributes, and missing/corrupt source-map fallbacks.
  - **Commit:** `feat(dx): add VLQ source-map decoder and framework dev metadata resolver`

- [x] **Chunk 2: Live Chromium CDP `CSS.getMatchedStylesForNode` Attribution & `check.ts` Integration**
  - **Files:** `src/core/source-map.ts`, `src/commands/check.ts`, `src/utils/agent-stream.ts`, `tests/unit/source-map.test.ts`
  - **Action:**
    - Implement `resolveViolationSourceLocations(page, selectors, cwd)` using CDP `DOM.enable` + `CSS.enable` (`CSS.styleSheetAdded` -> `CSS.getMatchedStylesForNode`) to populate `sourceFile`, `lineNumber`, and `columnNumber` (normalized relative to `cwd`, or `null` when unmapped).
    - Wire source-location enrichment into `auditViewportInParallel()` (`src/commands/check.ts`) and `normalizeViewportViolations()` (`src/utils/agent-stream.ts`), plus a live Chromium E2E test in `tests/unit/source-map.test.ts`.
  - **Commit:** `feat(dx): resolve live CDP CSS source maps to file:line in check --json`

- [x] **Chunk 3: Docs Sync (`README.md`, `AGENTS.md`) & Final Verification**
  - **Files:** `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_9.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Document `sourceFile`, `lineNumber`, and `columnNumber` in `README.md` and `AGENTS.md`, run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#9`.
  - **Commit:** `docs(dx): document source-map file:line attribution in --json output (#9)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#9`)
- [x] `--json` output schema includes optional `sourceFile`, `lineNumber`, and `columnNumber` fields on violations.
- [x] Accurately resolves `file:line` for source-mapped CSS/component dev builds and `data-source-loc` dev attributes.
- [x] Falls back cleanly (`null`) without throwing when source maps are disabled or missing in production builds.
- [x] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
