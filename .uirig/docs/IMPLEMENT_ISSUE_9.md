# Implementation Plan: Issue #9 — Framework Source-Map & `file:line` Attribution

- **Issue:** `AgnosticUI/uirig#9` — `Framework Source-Map & file:line Attribution`
- **Epic:** `AgnosticUI/uirig#33` (`label:epic:a2ui-eval`)
- **Track:** Track B (Source-Code Auto-Fix Path)
- **Branch:** `feat/issue-9-source-map-attribution`
- **Status:** Planned
- **Tracking:** `.uirig/docs/NEXT_PROMPT.md`

---

## 1. Goal & Scope

Attach `sourceFile` and `lineNumber` (and optional `columnNumber`) directly to violation objects in `--json` output (`IAgenticViolation`) using Chromium DevTools Protocol (CDP) CSS/JS source maps and framework dev-mode metadata hooks (Vite, Lit, Stencil, React Fiber/dev source attributes), eliminating multi-step agent repository grep loops.

### Resolution Strategy & Graceful Fallback
1. **CSS Rule Source Maps (CDP `CSS.enable` + `CSS.getMatchedStylesForNode`):** For style-driven violations (`tokens`, `contrast`, `dark-mode`, `stress`), resolve the winning CSS declaration's `styleSheetId` and `range.startLine` / `startColumn` through CDP stylesheet headers and inline/external `.map` source maps back to the original `.css` / `.scss` / component `sourceFile` and 1-based `lineNumber`.
2. **Framework Dev-Mode Metadata Hooks:** Inspect DOM/component dev metadata when present (e.g., `data-source-loc`, Vite/Svelte/Astro/Vue dev attributes, React `_debugSource` / `__reactFiber$`, Lit/custom-element constructor script URL + source map) to resolve component template `sourceFile` and `lineNumber`.
3. **Zero-Crash Production Fallback:** When source maps are disabled or missing (such as bundled production builds or static `.html` files without source maps), omit or set `sourceFile: null` and `lineNumber: null` cleanly without throwing.

### Out of Scope
- Applying file edits on disk (handled by Issue `#13` once `sourceFile` and `lineNumber` are available).

---

## 2. Micro-Chunk Execution Breakdown

- [ ] **Chunk 0: Planning & Continuity Capsule Scaffold**
  - **Files:** `.uirig/docs/IMPLEMENT_ISSUE_9.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Cut branch `feat/issue-9-source-map-attribution` and mark `#9` active in `.uirig/docs/NEXT_PROMPT.md`.
  - **Commit:** `docs(plan): initialize branch and tracking for issue #9 (source-map attribution)`

- [ ] **Chunk 1: VLQ Source-Map Decoder & Framework Metadata Resolver (`src/core/source-map.ts`) + Unit Tests**
  - **Files:** `src/interfaces/locator.ts`, `src/core/source-map.ts`, `tests/unit/source-map.test.ts`
  - **Action:**
    - Add optional `sourceFile?: string | null`, `lineNumber?: number | null`, and `columnNumber?: number | null` fields to `IAgenticViolation` (`src/utils/agent-stream.ts`).
    - Implement a zero-dependency Base64 VLQ source-map v3 decoder (`resolveOriginalPositionFromSourceMap()`) and framework dev-metadata extractor (`extractDevSourceLocation()`) in `src/core/source-map.ts`.
    - Add unit tests in `tests/unit/source-map.test.ts` covering inline data-URI source maps, external `.map` files, React/Vite dev metadata, and missing/corrupt source-map fallbacks.
  - **Commit:** `feat(dx): add VLQ source-map decoder and framework dev metadata resolver`

- [ ] **Chunk 2: Live Chromium CDP `CSS.getMatchedStylesForNode` & Script Source-Map Attribution**
  - **Files:** `src/core/source-map.ts`, `src/commands/check.ts`, `tests/unit/source-map.test.ts`
  - **Action:**
    - Implement `resolveViolationSourceLocations(page, violations, cwd)` using CDP `DOM.enable` + `CSS.enable` (`CSS.getMatchedStylesForNode` -> `CSS.styleSheetAdded` `sourceMapURL`) and custom-element constructor `Debugger.scriptParsed` source maps to populate `sourceFile`, `lineNumber`, and `columnNumber` (normalized relative to `cwd`).
    - Wire source-location enrichment into `auditViewportInParallel()` in `src/commands/check.ts` with a live Chromium E2E test verifying Vite/inline-sourcemap CSS and Web Component resolution.
  - **Commit:** `feat(dx): resolve live CDP CSS and component source maps to file:line in check`

- [ ] **Chunk 3: Agentic Stream Output, Docs Sync & Final Verification**
  - **Files:** `src/utils/agent-stream.ts`, `README.md`, `AGENTS.md`, `.uirig/docs/IMPLEMENT_ISSUE_9.md`, `.uirig/docs/NEXT_PROMPT.md`
  - **Action:** Include `sourceFile` and `lineNumber` in `remediationAdvice` when resolved, document `file:line` attribution in `README.md` and `AGENTS.md`, run `npm run typecheck && npm test && npm run build`, mark all chunks `[x]` complete, and merge PR `#9`.
  - **Commit:** `docs(dx): document source-map file:line attribution in --json output (#9)`

---

## 3. Acceptance Checklist (from `AgnosticUI/uirig#9`)
- [ ] `--json` output schema includes optional `sourceFile`, `lineNumber`, and `columnNumber` fields on violations.
- [ ] Accurately resolves `file:line` for Vite-served Web Components (Lit/Stencil) and React/CSS source-mapped dev builds.
- [ ] Falls back cleanly (`null`) without throwing when source maps are disabled or missing in production builds.
- [ ] All unit/Chromium tests, typechecks, and builds pass, and docs are synced.
